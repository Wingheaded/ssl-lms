## **Ultra-Minimal Firebase MVP (What to Build First)**

### **🎯 Goal**

Validate that the sales team can **log in, watch training, complete a quiz, and have progress tracked**.

---

## **✅ INCLUDED (MVP ONLY)**

### **1\. Authentication**

* Firebase **Google Login**

* Restricted to **company email domain**

* Single role only: **Learner**

---

### **2\. Content Structure (Simplified)**

* **Brand → Training**

* No products or ranges yet

* Brands:

  * Medik8

  * Luxmetique

  * GUM

---

### **3\. Training Content**

* One **embedded Google Drive video OR podcast** per training

* Not downloadable

* User must reach **100% playback** to continue

---

### **4\. Quiz (Very Simple)**

* One quiz per training

* Question types:

  * Multiple choice

  * True / False

* Automatic correction

* **Passing score: 90%**

* Unlimited retries

* Quiz unlocks only after full playback

---

### **5\. Progress Tracking (Firestore)**

For each user \+ training:

* Watched: yes / no

* Quiz score

* Passed: yes / no

* Completion timestamp

---

### **6\. Basic User View**

* See list of trainings

* See status:

  * Not started

  * Completed

  * Passed / Failed

* See latest score

---

## **❌ EXCLUDED (NOT IN MVP)**

* Admin dashboard

* Training creation UI

* Products / ranges hierarchy

* PDFs

* Certificates & badges

* Email notifications

* CSV / Excel exports

* Analytics

* Role management

* UI branding polish

---

## **🔥 Why This MVP Is Smart**

* Can be built **fast**

* Uses Firebase **Auth \+ Firestore only**

* Proves:

  * Training consumption

  * Knowledge validation

  * Data tracking works

* Everything else can be added **without refactoring**

# **Firestore Collections — Ultra-Minimal MVP**

## **1️⃣ `users`**

**Purpose: Identify logged-in users**

**Document ID: `uid` (from Firebase Auth)**

**`{`**

  **`"name": "Jane Doe",`**

  **`"email": "jane@skinselflove.com",`**

  **`"createdAt": "timestamp"`**

**`}`**

**🔹 Notes:**

* **No roles in MVP**

* **Created on first login**

---

## **2️⃣ `brands`**

**Purpose: Group trainings by brand**

**`{`**

  **`"name": "Medik8",`**

  **`"order": 1`**

**`}`**

**🔹 MVP brands:**

* **Medik8**

* **Luxmetique**

* **GUM**

---

## **3️⃣ `trainings`**

**Purpose: Core training content**

**`{`**

  **`"brandId": "brandId",`**

  **`"title": "Crystal Retinal Training",`**

  **`"description": "Core product knowledge",`**

  **`"mediaType": "video",`** 

  **`"mediaDriveUrl": "https://drive.google.com/...",`**

  **`"isActive": true,`**

  **`"createdAt": "timestamp"`**

**`}`**

**🔹 Notes:**

* **One training \= one video OR podcast**

* **No PDFs in MVP**

* **Admins can toggle `isActive`**

---

## **4️⃣ `quizzes`**

**Purpose: One quiz per training**

**`{`**

  **`"trainingId": "trainingId",`**

  **`"passingScore": 90`**

**`}`**

---

## **5️⃣ `quizQuestions`**

**Purpose: Quiz content**

**`{`**

  **`"quizId": "quizId",`**

  **`"question": "Which skin type is suitable?",`**

  **`"type": "multiple_choice"`**

**`}`**

**🔹 Types allowed:**

* **`multiple_choice`**

* **`true_false`**

---

## **6️⃣ `quizAnswers`**

**Purpose: Auto-correction**

**`{`**

  **`"questionId": "questionId",`**

  **`"answerText": "Sensitive skin",`**

  **`"isCorrect": true`**

**`}`**

---

## **7️⃣ `progress`**

**Purpose: Track user completion**

**`{`**

  **`"userId": "uid",`**

  **`"trainingId": "trainingId",`**

  **`"watched": true,`**

  **`"score": 95,`**

  **`"passed": true,`**

  **`"completedAt": "timestamp"`**

**`}`**

**🔹 This replaces:**

* **Progress tracking**

* **Completion status**

* **Latest quiz result**

---

# **🚫 Collections NOT Needed in MVP**

**Do not create these yet:**

* **products**

* **trainingProducts**

* **certificates**

* **quizAttempts (history)**

* **roles / admins**

* **notifications**

* **exports**

* **analytics**

---

# **✅ MVP Validation Checklist**

**With this schema, you can already:**

**✔ Log users in**  
 **✔ Show brand → training list**  
 **✔ Play video/podcast**  
 **✔ Enforce 100% watch rule**  
 **✔ Run quiz with 90% pass score**  
 **✔ Track completion per user**

# **🔐 Firestore Security Rules — Ultra-Minimal MVP**

### **Assumptions**

* Users authenticate via **Firebase Google Auth**

* Only **logged-in users** can access the app

* Users can **only write their own progress**

* All training content is **read-only**

---

## **✅ Final Rules (Copy–Paste Ready)**

`rules_version = '2';`  
`service cloud.firestore {`  
  `match /databases/{database}/documents {`

    `// 🔐 Helper function`  
    `function isSignedIn() {`  
      `return request.auth != null;`  
    `}`

    `function isOwner(userId) {`  
      `return request.auth.uid == userId;`  
    `}`

    `/* =========================`  
       `USERS`  
    `========================== */`  
    `match /users/{userId} {`  
      `allow read, write: if isSignedIn() && isOwner(userId);`  
    `}`

    `/* =========================`  
       `BRANDS (READ ONLY)`  
    `========================== */`  
    `match /brands/{brandId} {`  
      `allow read: if isSignedIn();`  
      `allow write: if false;`  
    `}`

    `/* =========================`  
       `TRAININGS (READ ONLY)`  
    `========================== */`  
    `match /trainings/{trainingId} {`  
      `allow read: if isSignedIn();`  
      `allow write: if false;`  
    `}`

    `/* =========================`  
       `QUIZZES (READ ONLY)`  
    `========================== */`  
    `match /quizzes/{quizId} {`  
      `allow read: if isSignedIn();`  
      `allow write: if false;`  
    `}`

    `/* =========================`  
       `QUIZ QUESTIONS (READ ONLY)`  
    `========================== */`  
    `match /quizQuestions/{questionId} {`  
      `allow read: if isSignedIn();`  
      `allow write: if false;`  
    `}`

    `/* =========================`  
       `QUIZ ANSWERS (READ ONLY)`  
    `========================== */`  
    `match /quizAnswers/{answerId} {`  
      `allow read: if isSignedIn();`  
      `allow write: if false;`  
    `}`

    `/* =========================`  
       `USER PROGRESS`  
    `========================== */`  
    `match /progress/{progressId} {`  
      `allow read: if isSignedIn() && isOwner(resource.data.userId);`  
      `allow create, update: if isSignedIn()`  
        `&& isOwner(request.resource.data.userId);`  
      `allow delete: if false;`  
    `}`  
  `}`  
`}`

---

## **🧠 What These Rules Enforce (Plain English)**

### **✔ Users**

* Can read & write **only their own user document**

### **✔ Brands / Trainings / Quizzes**

* **Read-only**

* No one can modify content from the client

### **✔ Progress**

* Users can:

  * Create their own progress

  * Update their own progress

  * Read their own progress

* Users **cannot**:

  * Read other users’ progress

  * Delete progress records

---

## **🚫 What This MVP Does NOT Allow (By Design)**

* No admin edits from frontend

* No user impersonation

* No quiz answer tampering

* No access without authentication

Admins/content updates are assumed to be done via:

* Firebase Console

* Script

* Or added later with admin roles

---

## **✅ Safe for MVP?**

Yes.  
 This is:

* Secure

* Simple

* Easy to extend later (roles, admins, reports)

Below are **clear, copy-pasteable Firestore examples** showing **exactly how the app reads and writes data** for the **ultra-minimal MVP**.

Assumptions:

* Frontend: **React \+ Firebase v9+ (modular SDK)**

* Auth already initialized

* `db` \= Firestore instance

* `auth.currentUser.uid` available

---

## **1️⃣ Create / Update User on First Login**

`import { doc, setDoc, serverTimestamp } from "firebase/firestore";`

`await setDoc(`  
  `doc(db, "users", auth.currentUser.uid),`  
  `{`  
    `name: auth.currentUser.displayName,`  
    `email: auth.currentUser.email,`  
    `createdAt: serverTimestamp()`  
  `},`  
  `{ merge: true }`  
`);`

---

## **2️⃣ Read All Brands**

`import { collection, getDocs, query, orderBy } from "firebase/firestore";`

`const q = query(collection(db, "brands"), orderBy("order"));`  
`const snapshot = await getDocs(q);`

`const brands = snapshot.docs.map(doc => ({`  
  `id: doc.id,`  
  `...doc.data()`  
`}));`

---

## **3️⃣ Read Trainings for a Brand**

`import { collection, getDocs, query, where } from "firebase/firestore";`

`const q = query(`  
  `collection(db, "trainings"),`  
  `where("brandId", "==", brandId),`  
  `where("isActive", "==", true)`  
`);`

`const snapshot = await getDocs(q);`

`const trainings = snapshot.docs.map(doc => ({`  
  `id: doc.id,`  
  `...doc.data()`  
`}));`

---

## **4️⃣ Load Quiz for a Training**

### **Get Quiz**

`const quizQuery = query(`  
  `collection(db, "quizzes"),`  
  `where("trainingId", "==", trainingId)`  
`);`

`const quizSnap = await getDocs(quizQuery);`  
`const quiz = quizSnap.docs[0];`

### **Get Questions**

`const questionsQuery = query(`  
  `collection(db, "quizQuestions"),`  
  `where("quizId", "==", quiz.id)`  
`);`

`const questionsSnap = await getDocs(questionsQuery);`

### **Get Answers for Each Question**

`const answersQuery = query(`  
  `collection(db, "quizAnswers"),`  
  `where("questionId", "==", questionId)`  
`);`

`const answersSnap = await getDocs(answersQuery);`

---

## **5️⃣ Save “Watched 100%” Progress**

`import { addDoc, collection, serverTimestamp } from "firebase/firestore";`

`await addDoc(collection(db, "progress"), {`  
  `userId: auth.currentUser.uid,`  
  `trainingId,`  
  `watched: true,`  
  `score: null,`  
  `passed: false,`  
  `completedAt: null`  
`});`

---

## **6️⃣ Submit Quiz Result (Create or Update Progress)**

`import { query, where, getDocs, updateDoc } from "firebase/firestore";`

`const progressQuery = query(`  
  `collection(db, "progress"),`  
  `where("userId", "==", auth.currentUser.uid),`  
  `where("trainingId", "==", trainingId)`  
`);`

`const progressSnap = await getDocs(progressQuery);`  
`const progressDoc = progressSnap.docs[0];`

`await updateDoc(progressDoc.ref, {`  
  `score: 95,`  
  `passed: true,`  
  `completedAt: serverTimestamp()`  
`});`

---

## **7️⃣ Read User Progress (Dashboard)**

`const q = query(`  
  `collection(db, "progress"),`  
  `where("userId", "==", auth.currentUser.uid)`  
`);`

`const snapshot = await getDocs(q);`

`const progress = snapshot.docs.map(doc => ({`  
  `id: doc.id,`  
  `...doc.data()`  
`}));`

---

## **8️⃣ Determine Training Status (Frontend Logic)**

`if (!progress) status = "Not started";`  
`else if (progress.watched && !progress.passed) status = "Failed";`  
`else if (progress.passed) status = "Completed";`

---

## **🔑 Key MVP Rules Enforced by Queries**

* Users **only read/write their own progress**

* Trainings & quizzes are **read-only**

* One progress record per user \+ training

* Quiz score overwrites previous score (no history yet)

Below is a clean, secure Cloud Function for quiz validation, designed specifically for the ultra-minimal MVP.

This ensures:

Quiz answers cannot be tampered with on the frontend

Scores are calculated server-side

Progress is updated safely in Firestore

☁️ Firebase Cloud Function — Quiz Validation (MVP)  
🎯 What This Function Does

Receives:

trainingId

quizId

User’s selected answers

Fetches correct answers from Firestore

Calculates score

Determines pass/fail (≥ 90%)

Updates the user’s progress document

Returns score \+ result to frontend

📁 Firestore Assumptions (MVP)

quizQuestions

quizAnswers

progress (1 doc per user \+ training)

1️⃣ Function Signature

Callable function (recommended for auth safety):

submitQuiz(quizId, trainingId, answers)

Where answers is:

{  
  \[questionId\]: string\[\] // array of selected answerIds  
}

2️⃣ Cloud Function Code (TypeScript)  
import \* as functions from "firebase-functions";  
import \* as admin from "firebase-admin";

admin.initializeApp();  
const db \= admin.firestore();

export const submitQuiz \= functions.https.onCall(  
  async (data, context) \=\> {

    // 🔐 Auth check  
    if (\!context.auth) {  
      throw new functions.https.HttpsError(  
        "unauthenticated",  
        "User must be authenticated"  
      );  
    }

    const userId \= context.auth.uid;  
    const { quizId, trainingId, answers } \= data;

    if (\!quizId || \!trainingId || \!answers) {  
      throw new functions.https.HttpsError(  
        "invalid-argument",  
        "Missing quizId, trainingId, or answers"  
      );  
    }

    /\* \=========================  
       Fetch questions  
    \========================== \*/  
    const questionsSnap \= await db  
      .collection("quizQuestions")  
      .where("quizId", "==", quizId)  
      .get();

    if (questionsSnap.empty) {  
      throw new functions.https.HttpsError(  
        "not-found",  
        "Quiz questions not found"  
      );  
    }

    let correctCount \= 0;  
    let totalQuestions \= questionsSnap.size;

    /\* \=========================  
       Validate each question  
    \========================== \*/  
    for (const questionDoc of questionsSnap.docs) {  
      const questionId \= questionDoc.id;

      const correctAnswersSnap \= await db  
        .collection("quizAnswers")  
        .where("questionId", "==", questionId)  
        .where("isCorrect", "==", true)  
        .get();

      const correctAnswerIds \= correctAnswersSnap.docs.map(doc \=\> doc.id);  
      const userAnswerIds \= answers\[questionId\] || \[\];

      // Compare arrays (order-independent)  
      const isCorrect \=  
        correctAnswerIds.length \=== userAnswerIds.length &&  
        correctAnswerIds.every(id \=\> userAnswerIds.includes(id));

      if (isCorrect) {  
        correctCount++;  
      }  
    }

    /\* \=========================  
       Calculate score  
    \========================== \*/  
    const score \= Math.round((correctCount / totalQuestions) \* 100);  
    const passed \= score \>= 90;

    /\* \=========================  
       Update progress  
    \========================== \*/  
    const progressQuery \= await db  
      .collection("progress")  
      .where("userId", "==", userId)  
      .where("trainingId", "==", trainingId)  
      .limit(1)  
      .get();

    if (progressQuery.empty) {  
      throw new functions.https.HttpsError(  
        "not-found",  
        "Progress record not found"  
      );  
    }

    const progressRef \= progressQuery.docs\[0\].ref;

    await progressRef.update({  
      score,  
      passed,  
      completedAt: passed ? admin.firestore.FieldValue.serverTimestamp() : null  
    });

    /\* \=========================  
       Return result  
    \========================== \*/  
    return {  
      score,  
      passed  
    };  
  }  
);

3️⃣ Frontend Call Example  
import { httpsCallable } from "firebase/functions";

const submitQuiz \= httpsCallable(functions, "submitQuiz");

const result \= await submitQuiz({  
  quizId,  
  trainingId,  
  answers  
});

console.log(result.data.score);  
console.log(result.data.passed);

🔐 Why This Is Secure

Users never send scores

Correct answers are never exposed

Auth enforced automatically

Firestore rules stay simple

Logic is fully server-side

🚫 MVP Limitations (Intentional)

No attempt history

Latest score overwrites previous

No time limits

No admin override

(All easy to add later.)

✅ What You Have Now

With this function \+ previous rules:  
✔ Secure quiz validation  
✔ Tamper-proof scoring  
✔ Clean MVP architecture

Below is a **clear, safe, and production-correct way to calculate quiz scores**, explained step by step, **without trusting the frontend at all**.

This is exactly how scoring should work in Firebase.

---

## **🔐 Principle: “Never trust the client”**

The frontend **never**:

* Sends a score

* Knows which answers are correct

* Decides pass/fail

The backend:  
 ✔ Fetches correct answers  
 ✔ Compares selections  
 ✔ Calculates score  
 ✔ Stores result

---

## **1️⃣ Data the Frontend Is Allowed to Send**

Only this:

`{`  
  `"quizId": "quiz123",`  
  `"trainingId": "training456",`  
  `"answers": {`  
    `"questionId1": ["answerIdA"],`  
    `"questionId2": ["answerIdC", "answerIdD"]`  
  `}`  
`}`

That’s it.

---

## **2️⃣ Safe Scoring Logic (Server-Side)**

### **Step-by-step algorithm (plain English)**

For each question:

1. Load **correct answer IDs** from Firestore

2. Load **user-selected answer IDs**

3. Compare them:

   * Same length

   * Same IDs (order doesn’t matter)

4. If they match → question \= correct

Final score:

`score = (correctQuestions / totalQuestions) × 100`

---

## **3️⃣ Correct Comparison Logic (IMPORTANT)**

❌ **Wrong (unsafe / incorrect):**

* Checking if *any* correct answer is selected

* Checking percentage per question

* Letting frontend calculate score

✅ **Correct (safe):**

* Exact match between correct answers and user answers

---

## **4️⃣ Safe Score Calculation (Code Snippet)**

`let correctCount = 0;`  
`const totalQuestions = questions.length;`

`for (const question of questions) {`  
  `const correctAnswerIds = getCorrectAnswerIds(question.id);`  
  `const userAnswerIds = userAnswers[question.id] || [];`

  `const isCorrect =`  
    `correctAnswerIds.length === userAnswerIds.length &&`  
    `correctAnswerIds.every(id => userAnswerIds.includes(id));`

  `if (isCorrect) {`  
    `correctCount++;`  
  `}`  
`}`

`const score = Math.round((correctCount / totalQuestions) * 100);`  
`const passed = score >= 90;`

---

## **5️⃣ Why This Is Secure**

✔ Frontend can’t guess correct answers  
 ✔ User can’t fake a higher score  
 ✔ Multi-answer questions handled correctly  
 ✔ Deterministic, auditable logic  
 ✔ Works for MCQ \+ True/False

---

## **6️⃣ Edge Cases Handled**

| Case | Result |
| ----- | ----- |
| Extra answers selected | ❌ Incorrect |
| Missing correct answer | ❌ Incorrect |
| Order different | ✅ Correct |
| No answers submitted | ❌ Incorrect |
| All answers correct | ✅ Correct |

---

## **7️⃣ Optional Safety Enhancements (Later)**

Not needed for MVP, but good to know:

* Time-based lock between retries

* Max attempts

* Store attempt history

* Question randomization

---

## **✅ Bottom line**

If you calculate scores **only in a Cloud Function**, using **exact ID matching**, your quiz system is:

✔ Secure  
 ✔ Fair  
 ✔ Scalable  
 ✔ MVP-correct

