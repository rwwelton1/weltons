// ═══════════════════════════════════════════════════════
//  GRAYSON & RYAN — App Logic
//  Firebase v10 Modular SDK
// ═══════════════════════════════════════════════════════

import { initializeApp }       from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAnalytics }        from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js';
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ── Firebase Init ────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyAnoerW4ZRNT-g5J4WIotApJEFYobkTRpk",
  authDomain:        "theweltons.firebaseapp.com",
  projectId:         "theweltons",
  storageBucket:     "theweltons.firebasestorage.app",
  messagingSenderId: "787343913156",
  appId:             "1:787343913156:web:c9e56c10ef14b316f3d991",
  measurementId:     "G-7D96P0VHX2"
};

const app       = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db        = getFirestore(app);

// ── Helpers ──────────────────────────────────────────
function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // strip accents
    .replace(/[^a-z0-9\s-]/g, '')     // keep alphanumeric, spaces, hyphens
    .replace(/\s+/g, '-')             // spaces → hyphens
    .replace(/-+/g, '-')              // collapse multiple hyphens
    .replace(/^-|-$/g, '');           // trim leading/trailing hyphens
}

// ── RSVP State ───────────────────────────────────────
let currentPartyId   = null;
let currentPartyData = null;

// ── DOM Refs ─────────────────────────────────────────
const lookupSection  = document.getElementById('rsvp-lookup-section');
const formSection    = document.getElementById('rsvp-form-section');
const successSection = document.getElementById('rsvp-success');

const guestNameInput = document.getElementById('guest-name');
const lookupBtn      = document.getElementById('lookup-btn');
const lookupError    = document.getElementById('lookup-error');
const loadingEl      = document.getElementById('loading');

const partyNameEl    = document.getElementById('party-name');
const rsvpStatusEl   = document.getElementById('rsvp-status');
const attendanceDetails = document.getElementById('attendance-details');
const guestCountSel  = document.getElementById('guest-count');
const noteEl         = document.getElementById('note');
const formError      = document.getElementById('form-error');
const loadingFormEl  = document.getElementById('loading-form');
const backBtn        = document.getElementById('rsvp-back-btn');
const submitBtn      = document.getElementById('rsvp-submit-btn');

const successHeadline = document.getElementById('success-headline');
const successMessage  = document.getElementById('success-message');

// ── STEP 1: Name Lookup ──────────────────────────────
lookupBtn.addEventListener('click', handleLookup);
guestNameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') handleLookup();
});

async function handleLookup() {
  const rawName = guestNameInput.value.trim();
  if (!rawName) {
    showLookupError('Please enter your name as it appears on your invitation.');
    return;
  }

  clearLookupError();
  showLoading(loadingEl, true);
  lookupBtn.disabled = true;

  const slug = slugify(rawName);

  try {
    // Look up the name index
    const indexSnap = await getDoc(doc(db, 'nameIndex', slug));

    if (!indexSnap.exists()) {
      showLookupError(
        "We couldn't find your name. Please enter it exactly as it appears on your invitation — " +
        "including your partner's name if you were invited together."
      );
      return;
    }

    const { partyId } = indexSnap.data();
    const inviteeSnap = await getDoc(doc(db, 'invitees', partyId));

    if (!inviteeSnap.exists()) {
      showLookupError('Something went wrong. Please contact us directly.');
      return;
    }

    currentPartyId   = partyId;
    currentPartyData = inviteeSnap.data();

    displayRsvpForm(currentPartyData);
  } catch (err) {
    console.error('Lookup error:', err);
    showLookupError('Unable to connect. Please check your connection and try again.');
  } finally {
    showLoading(loadingEl, false);
    lookupBtn.disabled = false;
  }
}

// ── Display RSVP Form ────────────────────────────────
function displayRsvpForm(party) {
  lookupSection.style.display = 'none';
  formSection.style.display   = 'block';
  formSection.classList.add('visible');

  partyNameEl.textContent = party.displayName;

  // Build guest count options based on maxGuests
  guestCountSel.innerHTML = '<option value="">Select</option>';
  for (let i = 1; i <= party.maxGuests; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = i === 1 ? '1 guest' : `${i} guests`;
    guestCountSel.appendChild(opt);
  }

  // Pre-fill if already RSVP'd
  if (party.rsvp) {
    rsvpStatusEl.textContent =
      "You've already responded — feel free to update your RSVP below.";

    const yesRadio = document.getElementById('attending-yes');
    const noRadio  = document.getElementById('attending-no');

    if (party.rsvp.attending) {
      yesRadio.checked = true;
      attendanceDetails.style.display = 'block';
      guestCountSel.value = party.rsvp.guestCount || '';
    } else {
      noRadio.checked = true;
      attendanceDetails.style.display = 'none';
    }

    if (noteEl && party.rsvp.note) {
      noteEl.value = party.rsvp.note;
    }
  }

  // Toggle attendance details on radio change
  document.querySelectorAll('input[name="attending"]').forEach(radio => {
    radio.addEventListener('change', () => {
      attendanceDetails.style.display =
        radio.value === 'yes' ? 'block' : 'none';
      clearFormError();
    });
  });
}

// ── Back Button ──────────────────────────────────────
backBtn.addEventListener('click', () => {
  formSection.style.display   = 'none';
  lookupSection.style.display = 'block';
  clearFormError();
});

// ── STEP 2: Submit RSVP ──────────────────────────────
submitBtn.addEventListener('click', handleSubmit);

async function handleSubmit() {
  clearFormError();

  const attendingRadio = document.querySelector('input[name="attending"]:checked');
  if (!attendingRadio) {
    showFormError("Please let us know if you'll be attending.");
    return;
  }

  const attending  = attendingRadio.value === 'yes';
  const guestCount = attending ? parseInt(guestCountSel.value) : 0;

  if (attending && !guestCount) {
    showFormError('Please select the number of guests attending.');
    return;
  }

  if (guestCount > currentPartyData.maxGuests) {
    showFormError(
      `Your invitation includes up to ${currentPartyData.maxGuests} guest(s). ` +
      `Please contact us if you have questions.`
    );
    return;
  }

  const note       = noteEl ? noteEl.value.trim() : '';
  const mealChoice = document.getElementById('meal-choice')?.value || null;

  showLoading(loadingFormEl, true);
  submitBtn.disabled = true;

  try {
    await updateDoc(doc(db, 'invitees', currentPartyId), {
      rsvp: {
        attending,
        guestCount,
        ...(mealChoice && { mealChoice }),
        ...(note && { note }),
        submittedAt: serverTimestamp()
      },
      rsvpUpdatedAt: serverTimestamp()
    });

    showSuccess(attending);
  } catch (err) {
    console.error('Submit error:', err);

    if (err.code === 'permission-denied') {
      showFormError(
        'The RSVP deadline has passed. Please contact us directly if you need to make changes.'
      );
    } else {
      showFormError('Something went wrong. Please try again.');
    }
  } finally {
    showLoading(loadingFormEl, false);
    submitBtn.disabled = false;
  }
}

// ── Success State ────────────────────────────────────
function showSuccess(attending) {
  formSection.style.display   = 'none';
  successSection.style.display = 'block';
  successSection.classList.add('visible');

  if (attending) {
    successHeadline.textContent = 'We\'ll see you there!';
    successMessage.textContent  =
      `We can't wait to celebrate with you at Tate House. ` +
      `Watch your email for more details as the date approaches.`;
  } else {
    successHeadline.textContent = 'We\'ll miss you.';
    successMessage.textContent  =
      'Thank you so much for letting us know. You\'ll be with us in spirit.';
  }
}

// ── Error / Loading Utilities ────────────────────────
function showLookupError(msg) {
  lookupError.textContent    = msg;
  lookupError.style.display  = 'block';
}

function clearLookupError() {
  lookupError.textContent   = '';
  lookupError.style.display = 'none';
}

function showFormError(msg) {
  formError.textContent    = msg;
  formError.style.display  = 'block';
  formError.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function clearFormError() {
  formError.textContent   = '';
  formError.style.display = 'none';
}

function showLoading(el, show) {
  el.style.display = show ? 'flex' : 'none';
}

// ═══ NAVIGATION ═══════════════════════════════════════
const nav    = document.getElementById('nav');
const toggle = document.querySelector('.nav-toggle');
const links  = document.getElementById('nav-links');

// Scrolled class
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 70);
}, { passive: true });

// Mobile menu toggle
toggle.addEventListener('click', () => {
  const isOpen = links.classList.toggle('open');
  toggle.setAttribute('aria-expanded', isOpen);
  document.body.style.overflow = isOpen ? 'hidden' : '';
});

// Close mobile nav on link click
links.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    links.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  });
});

// Smooth scroll for all anchor links
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', e => {
    const href = link.getAttribute('href');
    if (href === '#') return;
    const target = document.querySelector(href);
    if (target) {
      e.preventDefault();
      const offset = nav.offsetHeight + 16;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});

// ═══ SCROLL ANIMATIONS ════════════════════════════════
const fadeObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      fadeObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

// Observe all fade-in elements, trigger hero ones immediately
document.querySelectorAll('.fade-in').forEach(el => {
  if (el.closest('#hero')) {
    // Hero elements animate in on load
    setTimeout(() => el.classList.add('visible'), 100);
  } else {
    fadeObserver.observe(el);
  }
});

// ═══ FAQ ACCORDION ════════════════════════════════════
document.querySelectorAll('.faq-question').forEach(btn => {
  btn.addEventListener('click', () => {
    const isOpen = btn.getAttribute('aria-expanded') === 'true';
    const answer = btn.nextElementSibling;

    // Close all
    document.querySelectorAll('.faq-question').forEach(b => {
      b.setAttribute('aria-expanded', 'false');
      b.nextElementSibling.style.display = 'none';
    });

    // Open this one if it was closed
    if (!isOpen) {
      btn.setAttribute('aria-expanded', 'true');
      answer.style.display = 'block';
    }
  });
});
