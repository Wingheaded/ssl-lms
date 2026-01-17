1️⃣ PRD — APPLICATION (Explicitly for Firebase)

This is a rewritten PRD, adapted from what we already defined, but now Firebase-native.

1\. Assistant Role (Meta Prompting)

You are a world-class expert software developer in React, TypeScript, Tailwind CSS, Firebase (Auth, Firestore, Cloud Functions), and VITE. You must build the application with maximum precision, strictly following this document, without assuming any functionality not specified.

2\. Overview and Vision

The application is an internal training platform (LMS) for the Skin Self Love sales team.

It allows users to:

\- Log in with their corporate Google account    
\- Consume trainings in video or podcast format (Google Drive)    
\- Download complementary PDFs    
\- Complete mandatory quizzes with a minimum score    
\- Earn badges and certificates    
\- View their progress and results  

Admins can:

\- Create and deactivate trainings    
\- Manage quizzes    
\- View progress and results    
\- Export data  

Main goal (MVP):    
Deliver a functional LMS with Google authentication, embedded content from Google Drive, quizzes with automatic scoring, progress tracking, and basic reporting.

3\. Tech Stack and Technical Constraints

Frontend

\- React \+ TypeScript    
\- Tailwind CSS    
\- ShadCN UI    
\- Mobile-first    
\- VITE  

Backend (Firebase)

\- Firebase Authentication    
  \- Google Sign-In    
  \- Corporate domain restriction    
\- Cloud Firestore    
  \- Main database    
\- Firebase Cloud Functions    
  \- Quiz grading    
  \- Certificate generation    
  \- Email sending    
\- Firebase Hosting (optional)

Constraints

Videos and podcasts:

\- Embedded from Google Drive    
\- Not downloadable  

PDF:

\- Downloadable (Drive link or Firebase Storage)

Quiz locked until 100% of the content is completed

Fully automatic grading

4\. Data Architecture and Flow (Conceptual)

\- Firestore as a NoSQL database    
\- Relationships handled via references (id) and queries    
\- Security controlled by Firestore Security Rules    
\- Clear separation between:    
  \- Content    
  \- Progress    
  \- Results  

5\. Detailed User Flow

Screens

\- Login (Google)    
\- User dashboard    
\- Brand selector    
\- Products / ranges    
\- Training detail    
\- Media player    
\- Quiz    
\- Results    
\- Certificates    
\- Admin dashboard    
\- Training management    
\- Reporting  

Flow

1\. User logs in    
2\. Navigates by brand → product → training    
3\. Consumes content (progress saved)    
4\. Unlocks quiz    
5\. Completes quiz    
6\. Sees score and status (passed / not passed)    
7\. Earns badge or certificate if applicable  

6\. Key Features and Implementation Order

Order

1\. Authentication    
2\. Navigation and structure    
3\. Media embed \+ tracking    
4\. Quiz \+ scoring    
5\. Progress and results    
6\. Admin tools    
7\. Certificates and emails  

Features

\- Google login    
\- Role control (learner / admin)    
\- Training visualization    
\- Progress tracking per user    
\- Quizzes:    
  \- Multiple choice    
  \- True/False    
  \- Multiple answers    
\- Passing score: 90%    
\- Unlimited attempts    
\- Badges per training    
\- Certificates per brand    
\- Admin dashboard    
\- CSV / Excel export  

7\. Integrations and External Logic

\- Google Auth    
\- Google Drive embeds    
\- Firebase Cloud Functions:    
  \- Quiz grading    
  \- Certificate issuance    
  \- Email sending  

8\. UI/UX Design Guidelines

\- Clean and professional    
\- Skin Self Love branding    
\- Mobile-first    
\- Clear hierarchy    
\- Visual feedback for progress and scores  

9\. Project Scope

Included

\- Complete internal LMS    
\- Tracking and scoring    
\- Automatic quizzes    
\- Certificates and badges    
\- Basic reporting  

Excluded

\- External use    
\- Payments    
\- Advanced gamification    
\- Manual moderation    
\- Native mobile app  

10\. Final Note (Chat Mode)

Before developing, confirm full understanding of this document.

2️⃣ Firestore Schema (Collections \+ Fields)

Below is a clean, production-ready Firestore structure.

🔐 users (collection)

Document ID: uid (from Firebase Auth)

{  
  "name": "Jane Doe",  
  "email": "jane@company.com",  
  "role": "learner",  
  "createdAt": "timestamp"  
}

🏷️ brands  
{  
  "name": "Medik8",  
  "order": 1  
}

📦 products  
{  
  "brandId": "brandId",  
  "name": "Crystal Retinal",  
  "description": "Retinal-based products"  
}

🎓 trainings  
{  
  "title": "Crystal Retinal Core Training",  
  "description": "How to position and sell",  
  "mediaType": "video",  
  "mediaDriveUrl": "https://drive.google.com/...",  
  "pdfUrl": "https://drive.google.com/...",  
  "isActive": true,  
  "createdAt": "timestamp",  
  "updatedAt": "timestamp"  
}

🔗 trainingProducts (many-to-many)  
{  
  "trainingId": "trainingId",  
  "productId": "productId"  
}

❓ quizzes  
{  
  "trainingId": "trainingId",  
  "passingScore": 90  
}

❔ quizQuestions  
{  
  "quizId": "quizId",  
  "question": "Which skin type is suitable?",  
  "type": "multiple\_choice",  
  "multipleCorrect": true  
}

✅ quizAnswers  
{  
  "questionId": "questionId",  
  "answerText": "Sensitive skin",  
  "isCorrect": true  
}

📊 userTrainingProgress  
{  
  "userId": "uid",  
  "trainingId": "trainingId",  
  "progress": 100,  
  "completed": true,  
  "completedAt": "timestamp"  
}

🧪 quizAttempts  
{  
  "userId": "uid",  
  "quizId": "quizId",  
  "score": 95,  
  "passed": true,  
  "attemptNumber": 2,  
  "createdAt": "timestamp"  
}

🏅 certificates  
{  
  "userId": "uid",  
  "type": "brand",  
  "referenceId": "brandId",  
  "issuedAt": "timestamp"  
}

🔐 Security Rules (High-level)

Learners:

\- Read brands, products, trainings    
\- Read/write own progress & attempts  

Admins:

\- Full read/write access  

All rules enforced via the role field  
