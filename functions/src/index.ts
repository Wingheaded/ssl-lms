import { setGlobalOptions } from "firebase-functions";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

setGlobalOptions({ maxInstances: 10 });

admin.initializeApp();
const db = admin.firestore();

/**
 * submitQuiz - Callable Cloud Function for secure quiz scoring
 * 
 * Accepts: { trainingId, answers: { [questionId]: string[] } }
 * where strings are answer document IDs
 * 
 * Returns: { score, passed }
 */
export const submitQuiz = onCall(async (request) => {
    // Auth check
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be logged in.");
    }

    const userId = request.auth.uid;
    const { trainingId, answers } = request.data;

    if (!trainingId || !answers || typeof answers !== "object") {
        throw new HttpsError("invalid-argument", "Invalid payload: trainingId and answers required.");
    }

    // Find quiz for this training
    const quizSnap = await db
        .collection("quizzes")
        .where("trainingId", "==", trainingId)
        .limit(1)
        .get();

    if (quizSnap.empty) {
        throw new HttpsError("not-found", "Quiz not found for this training.");
    }

    const quizId = quizSnap.docs[0].id;

    // Get all questions for this quiz
    const questionsSnap = await db
        .collection("quizQuestions")
        .where("quizId", "==", quizId)
        .get();

    if (questionsSnap.empty) {
        throw new HttpsError("not-found", "No questions found for this quiz.");
    }

    let correctCount = 0;
    const totalQuestions = questionsSnap.size;

    // Validate each question's answers
    for (const questionDoc of questionsSnap.docs) {
        const questionId = questionDoc.id;

        // Get correct answers for this question from quizAnswers collection
        const correctAnswersSnap = await db
            .collection("quizAnswers")
            .where("questionId", "==", questionId)
            .where("isCorrect", "==", true)
            .get();

        const correctAnswerIds = correctAnswersSnap.docs.map(doc => doc.id).sort();
        const userAnswerIds = (answers[questionId] || []).sort();

        // Compare arrays (order-independent exact match)
        const isCorrect =
            correctAnswerIds.length === userAnswerIds.length &&
            correctAnswerIds.every((id, index) => id === userAnswerIds[index]);

        if (isCorrect) {
            correctCount++;
        }
    }

    // Calculate score
    const score = Math.round((correctCount / totalQuestions) * 100);
    const passed = score >= 90;

    // Update progress document
    const progressDocId = `${userId}_${trainingId}`;
    await db.collection("progress").doc(progressDocId).set(
        {
            userId,
            trainingId,
            score,
            passed,
            completedAt: passed ? admin.firestore.FieldValue.serverTimestamp() : null,
        },
        { merge: true }
    );

    logger.info("Quiz submitted", {
        userId,
        trainingId,
        quizId,
        score,
        passed,
        correctCount,
        totalQuestions,
    });

    return { score, passed };
});
