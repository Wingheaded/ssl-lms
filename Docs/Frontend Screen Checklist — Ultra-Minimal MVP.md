# **Frontend Screen Checklist — Ultra-Minimal MVP**

## **0️⃣ Global (Applies to All Screens)**

* ☐ User must be authenticated (Google login)

* ☐ Show loading state while data loads

* ☐ Handle empty states gracefully

* ☐ Mobile-first layout

* ☐ Basic error handling (network / permission)

---

## **1️⃣ Login Screen**

**Purpose:** Authenticate user

* ☐ “Sign in with Google” button

* ☐ Restrict access to company email domain

* ☐ On success:

  * Create / update user document in Firestore

  * Redirect to Brand List screen

* ☐ Handle login failure message

✅ MVP complete when:

* User can log in and reach the app

---

## **2️⃣ Brand List Screen**

**Purpose:** Entry point to training

* ☐ Fetch brands from Firestore

* ☐ Display brands (Medik8 / Luxmetique / GUM)

* ☐ Clickable brand cards or list items

* ☐ Loading state while fetching

✅ MVP complete when:

* User can select a brand

---

## **3️⃣ Training List Screen (per Brand)**

**Purpose:** Show available trainings

* ☐ Fetch trainings by `brandId`

* ☐ Filter `isActive === true`

* ☐ Display:

  * Training title

  * Short description

  * Status badge:

    * Not started

    * Completed

    * Passed / Failed

* ☐ Click training to open detail view

✅ MVP complete when:

* User sees correct trainings and status

---

## **4️⃣ Training Detail Screen**

**Purpose:** Consume content

* ☐ Display training title & description

* ☐ Embed Google Drive video OR podcast

* ☐ Track playback progress

* ☐ Save progress locally (resume playback)

* ☐ Detect 100% completion

* ☐ Create / update `progress` document (`watched: true`)

* ☐ Disable quiz until 100% watched

✅ MVP complete when:

* Quiz unlocks only after full playback

---

## **5️⃣ Quiz Screen**

**Purpose:** Validate knowledge

* ☐ Fetch quiz for training

* ☐ Fetch quiz questions

* ☐ Fetch answers per question

* ☐ Render:

  * Multiple choice

  * True / False

* ☐ Allow multiple answers where applicable

* ☐ Client-side validation (all questions answered)

* ☐ Submit answers to Cloud Function

* ☐ Disable submit while processing

✅ MVP complete when:

* Quiz submits successfully to backend

---

## **6️⃣ Quiz Result Screen**

**Purpose:** Show outcome

* ☐ Display:

  * Score (percentage)

  * Passed / Failed

* ☐ Clear message if failed (retry allowed)

* ☐ “Retry quiz” button (if failed)

* ☐ “Back to trainings” button

* ☐ Update UI state based on latest result

✅ MVP complete when:

* User clearly sees result and next action

---

## **7️⃣ User Dashboard (Simple)**

**Purpose:** Track progress

* ☐ List all trainings attempted

* ☐ Show:

  * Training name

  * Brand

  * Status

  * Score

* ☐ Link back to training detail

✅ MVP complete when:

* User can see their own progress

---

## **❌ Screens NOT Needed for MVP**

Do **not** build these yet:

* Admin dashboard

* Training creation UI

* Certificates

* Email notifications

* Reports / exports

* Product or range pages

* PDF viewer

* Settings screen

---

## **✅ MVP Completion Definition (Frontend)**

The frontend MVP is **done** when:

* A new user can:

  1. Log in

  2. Pick a brand

  3. Watch a training

  4. Take a quiz

  5. Pass or fail

  6. See progress saved

If all 6 work → **you can ship internally**.

---

## **Next steps (optional)**

I can:

* Convert this into a **task list per screen**

* Add **UX wireframe notes**

* Define **v1.1 frontend upgrades**

