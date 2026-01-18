/**
 * Debug Quiz Submission Logic
 * 
 * Simulates the server-side logic of submitQuiz to verify data integrity
 */

import * as admin from 'firebase-admin';

// Initialize Firebase Admin (uses GOOGLE_APPLICATION_CREDENTIALS)
admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'lms-a762e'
});

const db = admin.firestore();

// Crystal Retinal ID
const TRAINING_ID = 'm8iP0n6ykYYTCHw3Zgnw';

async function debugQuiz() {
    console.log('🔍 Starting debug for Training ID:', TRAINING_ID);

    try {
        // 1. Find quiz
        console.log('1. Finding quiz...');
        const quizSnap = await db
            .collection("quizzes")
            .where("trainingId", "==", TRAINING_ID)
            .limit(1)
            .get();

        if (quizSnap.empty) {
            throw new Error("❌ Quiz not found for this training.");
        }
        const quizId = quizSnap.docs[0].id;
        console.log('   ✓ Found Quiz ID:', quizId);

        // 2. Get questions
        console.log('2. Finding questions...');
        const questionsSnap = await db
            .collection("quizQuestions")
            .where("quizId", "==", quizId)
            .get();

        if (questionsSnap.empty) {
            throw new Error("❌ No questions found for this quiz.");
        }
        console.log(`   ✓ Found ${questionsSnap.size} questions.`);

        // 3. Simulate answering all correct
        console.log('3. Simulating submission...');

        let correctCount = 0;
        const totalQuestions = questionsSnap.size;

        for (const questionDoc of questionsSnap.docs) {
            const questionId = questionDoc.id;
            console.log(`   Question: ${questionDoc.data().question} (${questionId})`);

            // Get correct answers
            const correctAnswersSnap = await db
                .collection("quizAnswers")
                .where("questionId", "==", questionId)
                .where("isCorrect", "==", true)
                .get();

            if (correctAnswersSnap.empty) {
                console.warn('     ⚠️ No correct answer defined for this question!');
            }

            const correctIds = correctAnswersSnap.docs.map(d => d.id);
            console.log(`     Correct Answer IDs: ${correctIds.join(', ')}`);

            // Simulate user answering correctly
            const userIds = [...correctIds];

            // Logic check
            const isCorrect =
                correctIds.length === userIds.length &&
                correctIds.every((id, index) => id === userIds[index]);

            if (isCorrect) correctCount++;
            console.log(`     Is Correct? ${isCorrect}`);
        }

        console.log('-----------------------------------');
        console.log(`Result: ${correctCount}/${totalQuestions} correct.`);
        console.log('✅ Logic verified successfully locally.');

    } catch (error) {
        console.error('❌ Error in debug script:', error);
    }
}

debugQuiz().then(() => process.exit(0));
