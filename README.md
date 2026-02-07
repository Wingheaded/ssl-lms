# SSL LMS - Skin Self Love Learning Management System

Ultra-minimal internal LMS MVP for sales team training with brand-based content, video playback tracking, quizzes with secure server-side scoring, and progress tracking.

## Tech Stack

- **Frontend**: Next.js 15 + React + TypeScript
- **Styling**: Tailwind CSS with Skin Self Love design system
- **Backend**: Firebase (Auth, Firestore, Cloud Functions)
- **Auth**: Google Sign-in (restricted to company domain)

## Quick Start

### Prerequisites

- Node.js 20+
- Firebase project with Auth, Firestore, and Functions enabled
- Google Sign-in configured in Firebase Console

### 1. Frontend Setup

```bash
cd lms-web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 2. Environment Configuration

The Firebase config is already set in `lms-web/lib/firebase.ts`. Ensure your Firebase project has:
- Google Sign-in enabled in Authentication
- Firestore database created
- Cloud Functions enabled (requires Blaze plan)

### 3. Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules
```

### 4. Deploy Cloud Functions

```bash
cd functions
npm install
npm run build
firebase deploy --only functions
```

### 5. Seed Initial Data

Option A: Use the seed script
```bash
cd seed
npm install firebase-admin typescript ts-node
# Download service account key from Firebase Console
export GOOGLE_APPLICATION_CREDENTIALS="path/to/serviceAccountKey.json"
npx ts-node seed-data.ts
```

Option B: Manual via Firebase Console
- Create `brands` collection with docs: `{name: "Medik8", order: 1}`, etc.
- Create `trainings` collection with docs linked to brand IDs
- Create `quizzes`, `quizQuestions`, `quizAnswers` collections

## Project Structure

```
.
├── lms-web/                    # Next.js frontend
│   ├── app/                    # Pages (App Router)
│   │   ├── page.tsx           # Login
│   │   ├── brands/            # Brand list & training list
│   │   ├── trainings/         # Training detail, quiz, result
│   │   └── dashboard/         # User progress
│   ├── components/            # Shared components
│   └── lib/                   # Firebase config, types, hooks
├── functions/                 # Cloud Functions
│   └── src/index.ts          # submitQuiz function
├── seed/                      # Seed script
├── firestore.rules           # Security rules
└── firebase.json             # Firebase config
```

## Key Features

1. **Login**: Google Sign-in with company domain restriction
2. **Brand List**: Navigate by brand (Medik8, Luxmetique, GUM)
3. **Training List**: Shows progress status per training
4. **Training Detail**: Google Drive video embed with watch tracking
5. **Quiz**: MCQ + True/False, multi-select support
6. **Result**: Score display with retry option
7. **Dashboard**: Track all progress across trainings

## Security

- Content collections (brands, trainings, quizzes) are read-only
- Users can only access their own user and progress documents
- Quiz scoring happens server-side in Cloud Function
- Correct answers are never exposed to frontend

## Domain Restriction

Edit `lib/auth-context.tsx` to change the allowed email domain:
```typescript
const ALLOWED_DOMAIN = "skinselflove.com";
```

## Firestore Collections

| Collection | Purpose |
|------------|---------|
| `users` | User profiles (created on first login) |
| `brands` | Brand names and ordering |
| `trainings` | Training content with Google Drive URLs |
| `quizzes` | Quiz config (linked to training) |
| `quizQuestions` | Questions (linked to quiz) |
| `quizAnswers` | Answer options with isCorrect flag |
| `progress` | User progress per training |

## Deployment

### Live Application
🚀 **[https://lms-a762e.web.app](https://lms-a762e.web.app)**

### CI/CD Pipeline
Automatic deployment is configured via GitHub Actions:
- **Push to `main`**: Deploys to production specific version.
- **Pull Requests**: Creates a preview channel for testing.

### Manual Deployment
```bash
# Deploy everything
firebase deploy

# Deploy only frontend (if using Firebase Hosting)
cd lms-web
npm run build
firebase deploy --only hosting

# Deploy only functions
firebase deploy --only functions

# Deploy only rules
firebase deploy --only firestore:rules
```
