/**
 * WEDDING GUEST IMPORT SCRIPT
 * ───────────────────────────────────────────────────────
 * Imports your guest list CSV into Firestore.
 *
 * SETUP:
 *   1. npm install firebase-admin csv-parser
 *   2. Download a service account key from Firebase Console:
 *      Project Settings → Service Accounts → Generate New Private Key
 *   3. Save it as scripts/service-account.json (never commit this file!)
 *   4. Prepare your CSV (see format below)
 *   5. node scripts/import-guests.js guests.csv
 *
 * CSV FORMAT (with header row):
 *   partyId,displayName,maxGuests,name1,name2
 *
 *   partyId     — unique slug for this household (e.g. "smith-family")
 *   displayName — shown on the RSVP page (e.g. "John & Jane Smith")
 *   maxGuests   — max people on this invite (1, 2, 4, etc.)
 *   name1       — first accepted name (e.g. "John Smith")
 *   name2       — second name for couples (e.g. "Jane Smith") — leave blank for singles
 *
 * EXAMPLE CSV:
 *   partyId,displayName,maxGuests,name1,name2
 *   john-jane-smith,John & Jane Smith,2,John Smith,Jane Smith
 *   bob-jones,Bob Jones,1,Bob Jones,
 *   welton-family,The Welton Family,4,Tom Welton,Sarah Welton
 *
 * RE-RUNNING:
 *   Safe to run multiple times — uses batch set (merge: false), so it
 *   overwrites existing invite docs but does NOT touch existing rsvp data.
 *   To preserve existing RSVPs, pass --preserve flag:
 *   node scripts/import-guests.js guests.csv --preserve
 */

const admin     = require('firebase-admin');
const csv       = require('csv-parser');
const fs        = require('fs');
const path      = require('path');

// ── Config ────────────────────────────────────────────
const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'service-account.json');
const PRESERVE_RSVP        = process.argv.includes('--preserve');
const CSV_PATH             = process.argv[2];

if (!CSV_PATH) {
  console.error('❌  Usage: node scripts/import-guests.js path/to/guests.csv [--preserve]');
  process.exit(1);
}

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error('❌  Missing scripts/service-account.json — download it from Firebase Console.');
  process.exit(1);
}

// ── Init ──────────────────────────────────────────────
const serviceAccount = require(SERVICE_ACCOUNT_PATH);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ── Slugify (must match frontend) ─────────────────────
function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// ── Import ────────────────────────────────────────────
async function importGuests() {
  const rows = [];

  await new Promise((resolve, reject) => {
    fs.createReadStream(CSV_PATH)
      .pipe(csv())
      .on('data', row => rows.push(row))
      .on('end', resolve)
      .on('error', reject);
  });

  console.log(`\n📋  Found ${rows.length} parties in CSV`);

  // Firestore batches max 500 operations — chunk them
  const CHUNK = 150; // conservative: each party = up to 3 ops (invitee + 2 names)
  let totalParties = 0;
  let totalNames   = 0;

  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const batch = db.batch();

    for (const row of chunk) {
      const { partyId, displayName, maxGuests, name1, name2 } = row;

      if (!partyId || !displayName || !maxGuests || !name1) {
        console.warn(`⚠️   Skipping row with missing fields:`, row);
        continue;
      }

      // Invitee document
      const inviteeRef  = db.collection('invitees').doc(partyId.trim());
      const inviteeData = {
        displayName: displayName.trim(),
        maxGuests:   parseInt(maxGuests.trim(), 10),
        createdAt:   admin.firestore.FieldValue.serverTimestamp()
      };

      // If not preserving, always reset rsvp to null
      if (!PRESERVE_RSVP) {
        inviteeData.rsvp          = null;
        inviteeData.rsvpUpdatedAt = null;
      }

      batch.set(inviteeRef, inviteeData, { merge: PRESERVE_RSVP });
      totalParties++;

      // nameIndex entries
      const names = [name1, name2].filter(Boolean).map(n => n.trim());
      for (const name of names) {
        const slug = slugify(name);
        if (!slug) continue;
        batch.set(
          db.collection('nameIndex').doc(slug),
          { partyId: partyId.trim() }
        );
        totalNames++;
      }
    }

    await batch.commit();
    console.log(`  ✓ Committed batch ${Math.floor(i / CHUNK) + 1} (${Math.min(i + CHUNK, rows.length)}/${rows.length} parties)`);
  }

  console.log(`\n✅  Import complete!`);
  console.log(`   • ${totalParties} invite records`);
  console.log(`   • ${totalNames} name lookups`);
  if (PRESERVE_RSVP) console.log(`   • Existing RSVPs preserved`);

  process.exit(0);
}

importGuests().catch(err => {
  console.error('❌  Import failed:', err);
  process.exit(1);
});
