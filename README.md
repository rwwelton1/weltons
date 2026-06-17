# Grayson & Ryan — Wedding Website

A bespoke Southern estate wedding site for **Grayson & Ryan, April 3, 2027** at Tate House, Tate GA.  
Stack: Vanilla HTML/CSS/JS · Firebase Firestore + Hosting · GitHub Actions CI/CD

---

## Quick Start

### 1. Clone & Open
```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO
```

### 2. Firebase CLI
```bash
npm install -g firebase-tools
firebase login
firebase use theweltons
```

### 3. Local Preview
```bash
firebase serve
# → http://localhost:5000
```

---

## Deploying

### Manual deploy
```bash
firebase deploy
```

### Auto-deploy via GitHub Actions
Every push to `main` deploys automatically. To set this up:

1. Go to your GitHub repo → **Settings → Secrets and variables → Actions**
2. Add a new secret: `FIREBASE_SERVICE_ACCOUNT_THEWELTONS`
3. Paste the contents of a Firebase service account JSON  
   *(Firebase Console → Project Settings → Service Accounts → Generate New Private Key)*

---

## Import Your Guest List

### 1. Install dependencies
```bash
cd scripts
npm install firebase-admin csv-parser
```

### 2. Add your service account key
Download it from Firebase Console → save as `scripts/service-account.json`  
⚠️ This file is gitignored — never commit it.

### 3. Prepare your CSV (`guests.csv`)
```csv
partyId,displayName,maxGuests,name1,name2
john-jane-smith,John & Jane Smith,2,John Smith,Jane Smith
bob-jones,Bob Jones,1,Bob Jones,
welton-family,The Welton Family,4,Tom Welton,Sarah Welton
```

**Column guide:**
- `partyId` — unique slug for this household (lowercase, hyphens)
- `displayName` — shown on their RSVP page
- `maxGuests` — max headcount on their invite
- `name1` — first/only accepted name (must match what they'd type)
- `name2` — second name for couples (leave blank for singles)

### 4. Run the import
```bash
# From project root
node scripts/import-guests.js guests.csv

# To update guest info without wiping existing RSVPs
node scripts/import-guests.js guests.csv --preserve
```

---

## Updating Content

All placeholder content is in `index.html`. Search for `[` to find every field to fill in.

| Placeholder | Where |
|---|---|
| `[Your Names]` | Already set to Grayson & Ryan |
| `[Hotel Name]` | Travel section — add 2–3 nearby hotels |
| `[Name]` in wedding party | Update with actual names |
| `[Date TBD]` in RSVP | Set your RSVP deadline |
| Registry links | Registry section `href="#"` |
| Photo `[Photo N]` | Replace `.gallery-placeholder` divs with `<img>` tags |
| FAQ answers | Update the answers in `[brackets]` |

---

## Customizing the RSVP Deadline

Change the date in **two** places:

**`firestore.rules`** — line ~22:
```
request.time < timestamp.date(2027, 3, 20)
```
*(format: year, month, day)*

**`index.html`** — RSVP section eyebrow text:
```html
<span class="section-eyebrow">Kindly Respond By [Date TBD]</span>
```

---

## Adding Meal Choices

When you have your menu:

1. In `index.html`, find the commented-out `<!-- Meal choice -->` block in the RSVP section and uncomment it. Update the `<option>` values.
2. In `js/app.js`, the `mealChoice` value is already wired into the Firestore write.
3. In `firestore.rules`, you may optionally add validation for meal choice values.

---

## Viewing RSVPs (Admin)

In the [Firebase Console](https://console.firebase.google.com/project/theweltons/firestore):

- `invitees` collection → each document is a party, with `rsvp` field once submitted
- To export: Firebase Console → Firestore → Export (or use the Admin SDK to build a CSV export)

---

## File Structure

```
wedding-website/
├── index.html                 ← All site content
├── css/
│   └── styles.css             ← Complete design system
├── js/
│   └── app.js                 ← Firebase + RSVP + UI logic
├── firebase.json              ← Hosting + Firestore config
├── .firebaserc                ← Project reference (theweltons)
├── firestore.rules            ← Security rules
├── .github/
│   └── workflows/
│       └── deploy.yml         ← Auto-deploy on push to main
├── scripts/
│   └── import-guests.js       ← CSV → Firestore import tool
└── README.md
```

---

## Design Credits

Typography: [Cormorant Garamond](https://fonts.google.com/specimen/Cormorant+Garamond) · [Jost](https://fonts.google.com/specimen/Jost)  
Venue: [Tate House](https://www.tatehouse.com), Tate, Georgia
