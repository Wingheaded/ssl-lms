import { setGlobalOptions } from "firebase-functions";
import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

setGlobalOptions({ maxInstances: 10 });

admin.initializeApp();
const db = admin.firestore();

type TrainingCleanupSummary = {
    trainingDeleted: number;
    storageFilesDeleted: number;
    progressDeleted: number;
    trainingVisitsDeleted: number;
    quizSessionsDeleted: number;
    quizzesDeleted: number;
    quizQuestionsDeleted: number;
    quizAnswersDeleted: number;
};

async function deleteDocs(
    docs: FirebaseFirestore.QueryDocumentSnapshot[]
): Promise<number> {
    if (docs.length === 0) return 0;

    let deleted = 0;
    for (let index = 0; index < docs.length; index += 450) {
        const batch = db.batch();
        const chunk = docs.slice(index, index + 450);
        chunk.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        deleted += chunk.length;
    }

    return deleted;
}

async function deleteStorageFilesForTraining(trainingId: string): Promise<number> {
    const bucket = admin.storage().bucket();
    const [files] = await bucket.getFiles({prefix: `trainings/${trainingId}/`});

    await Promise.all(files.map(async (file) => {
        try {
            await file.delete();
        } catch (error: any) {
            if (error?.code !== 404) {
                throw error;
            }
        }
    }));

    return files.length;
}

async function deleteLegacyQuizArtifacts(
    trainingId: string,
    summary: TrainingCleanupSummary
): Promise<void> {
    const quizzesSnap = await db
        .collection("quizzes")
        .where("trainingId", "==", trainingId)
        .get();

    for (const quizDoc of quizzesSnap.docs) {
        const questionsSnap = await db
            .collection("quizQuestions")
            .where("quizId", "==", quizDoc.id)
            .get();

        for (const questionDoc of questionsSnap.docs) {
            const answersSnap = await db
                .collection("quizAnswers")
                .where("questionId", "==", questionDoc.id)
                .get();

            summary.quizAnswersDeleted += await deleteDocs(answersSnap.docs);
        }

        summary.quizQuestionsDeleted += await deleteDocs(questionsSnap.docs);
    }

    summary.quizzesDeleted += await deleteDocs(quizzesSnap.docs);
}

async function deleteTrainingArtifacts(trainingId: string): Promise<TrainingCleanupSummary> {
    const summary: TrainingCleanupSummary = {
        trainingDeleted: 0,
        storageFilesDeleted: 0,
        progressDeleted: 0,
        trainingVisitsDeleted: 0,
        quizSessionsDeleted: 0,
        quizzesDeleted: 0,
        quizQuestionsDeleted: 0,
        quizAnswersDeleted: 0,
    };

    summary.storageFilesDeleted = await deleteStorageFilesForTraining(trainingId);

    const progressSnap = await db
        .collection("progress")
        .where("trainingId", "==", trainingId)
        .get();
    summary.progressDeleted += await deleteDocs(progressSnap.docs);

    const quizSessionsSnap = await db
        .collection("quizSessions")
        .where("trainingId", "==", trainingId)
        .get();
    summary.quizSessionsDeleted += await deleteDocs(quizSessionsSnap.docs);

    const trainingVisitsSnap = await db.collectionGroup("trainingVisits").get();
    summary.trainingVisitsDeleted += await deleteDocs(
        trainingVisitsSnap.docs.filter((doc) => doc.id === trainingId)
    );

    await deleteLegacyQuizArtifacts(trainingId, summary);

    const trainingRef = db.collection("trainings").doc(trainingId);
    const trainingDoc = await trainingRef.get();
    if (trainingDoc.exists) {
        await trainingRef.delete();
        summary.trainingDeleted = 1;
    }

    return summary;
}

/**
 * submitQuiz - Callable Cloud Function for secure quiz scoring
 * 
 * Accepts: { trainingId, answers: { [questionId]: string[] } }
 * where strings are answer document IDs
 * 
 * Returns: { score, passed }
 */
export const submitQuiz = onCall(async (request: CallableRequest<any>) => {
    // Auth check
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be logged in.");
    }

    const userId = request.auth.uid;
    const { trainingId, sessionId, answers } = request.data;

    if (!trainingId || !answers || typeof answers !== "object") {
        throw new HttpsError("invalid-argument", "Invalid payload: trainingId and answers required.");
    }

    let correctCount = 0;
    let totalQuestions = 0;

    // Check if this is an AI-generated quiz (has sessionId)
    if (sessionId) {
        // AI-generated quiz: fetch answers from Firestore cache
        const cacheDoc = await db.collection("quizSessions").doc(sessionId).get();

        if (!cacheDoc.exists) {
            throw new HttpsError("not-found", "Quiz session expired or not found. Please start a new quiz.");
        }

        const cacheData = cacheDoc.data()!;

        // Verify session belongs to this user and training
        if (cacheData.userId !== userId || cacheData.trainingId !== trainingId) {
            throw new HttpsError("permission-denied", "Invalid quiz session.");
        }

        // Check expiration
        const expiresAt = cacheData.expiresAt?.toDate?.() || new Date(cacheData.expiresAt);
        if (Date.now() > expiresAt.getTime()) {
            await db.collection("quizSessions").doc(sessionId).delete();
            throw new HttpsError("deadline-exceeded", "Quiz session expired. Please start a new quiz.");
        }

        const correctAnswers = cacheData.answers;
        totalQuestions = Object.keys(correctAnswers).length;

        // Validate each question (answers is { questionIndex: selectedIndices[] })
        for (const [questionIndex, correctIndices] of Object.entries(correctAnswers)) {
            const userSelectedIndices = (answers[questionIndex] || []).sort();
            const expectedIndices = (correctIndices as number[]).sort();

            // All-or-nothing comparison
            const isCorrect =
                userSelectedIndices.length === expectedIndices.length &&
                userSelectedIndices.every((idx: number, i: number) => idx === expectedIndices[i]);

            if (isCorrect) {
                correctCount++;
            }
        }

        // Clean up cache after validation
        await db.collection("quizSessions").doc(sessionId).delete();

    } else {
        // Legacy Firestore-based quiz
        const quizSnap = await db
            .collection("quizzes")
            .where("trainingId", "==", trainingId)
            .limit(1)
            .get();

        if (quizSnap.empty) {
            throw new HttpsError("not-found", "Quiz not found for this training.");
        }

        const quizId = quizSnap.docs[0].id;

        const questionsSnap = await db
            .collection("quizQuestions")
            .where("quizId", "==", quizId)
            .get();

        if (questionsSnap.empty) {
            throw new HttpsError("not-found", "No questions found for this quiz.");
        }

        totalQuestions = questionsSnap.size;

        for (const questionDoc of questionsSnap.docs) {
            const questionId = questionDoc.id;

            const correctAnswersSnap = await db
                .collection("quizAnswers")
                .where("questionId", "==", questionId)
                .where("isCorrect", "==", true)
                .get();

            const correctAnswerIds = correctAnswersSnap.docs.map(doc => doc.id).sort();
            const userAnswerIds = (answers[questionId] || []).sort();

            const isCorrect =
                correctAnswerIds.length === userAnswerIds.length &&
                correctAnswerIds.every((id, index) => id === userAnswerIds[index]);

            if (isCorrect) {
                correctCount++;
            }
        }
    }

    // Calculate score
    const score = Math.round((correctCount / totalQuestions) * 100);
    const passed = score >= 80;

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
        sessionId: sessionId || "legacy",
        score,
        passed,
        correctCount,
        totalQuestions,
    });

    return { score, passed };
});

/**
 * checkAnswer - Callable Cloud Function for per-question feedback
 *
 * AI quizzes: { trainingId, sessionId, questionIndex, selectedIndices: number[] }
 * Legacy quizzes: { trainingId, questionId, selectedAnswerIds: string[] }
 *
 * Returns: { isCorrect, correctIndices | correctAnswerIds }
 */
export const checkAnswer = onCall(async (request: CallableRequest<any>) => {
    try {
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "User must be logged in.");
        }

        const userId = request.auth.uid;
        const {
            trainingId,
            sessionId,
            questionIndex,
            selectedIndices,
            questionId,
            selectedAnswerIds
        } = request.data || {};

        if (!trainingId) {
            throw new HttpsError("invalid-argument", "trainingId is required.");
        }

        const isAiQuiz = !!sessionId;

        if (isAiQuiz) {
            if (typeof questionIndex !== "number" || !Array.isArray(selectedIndices)) {
                throw new HttpsError("invalid-argument", "questionIndex and selectedIndices are required for AI quizzes.");
            }

            const cacheDoc = await db.collection("quizSessions").doc(sessionId).get();

            if (!cacheDoc.exists) {
                throw new HttpsError("not-found", "Quiz session expired or not found.");
            }

            const cacheData = cacheDoc.data()!;

            if (cacheData.userId !== userId || cacheData.trainingId !== trainingId) {
                throw new HttpsError("permission-denied", "Invalid quiz session.");
            }

            const expiresAt = cacheData.expiresAt?.toDate?.() || new Date(cacheData.expiresAt);
            if (Date.now() > expiresAt.getTime()) {
                await db.collection("quizSessions").doc(sessionId).delete();
                throw new HttpsError("deadline-exceeded", "Quiz session expired. Please start a new quiz.");
            }

            const correctAnswers = cacheData.answers || {};
            const correctIndices = (correctAnswers[questionIndex] || []) as number[];

            const userSelected = [...selectedIndices].sort();
            const expected = [...correctIndices].sort();

            const isCorrect =
                userSelected.length === expected.length &&
                userSelected.every((idx: number, i: number) => idx === expected[i]);

            return { isCorrect, correctIndices };
        }

        if (!questionId || !Array.isArray(selectedAnswerIds)) {
            throw new HttpsError("invalid-argument", "questionId and selectedAnswerIds are required for legacy quizzes.");
        }

        const quizSnap = await db
            .collection("quizzes")
            .where("trainingId", "==", trainingId)
            .limit(1)
            .get();

        if (quizSnap.empty) {
            throw new HttpsError("not-found", "Quiz not found for this training.");
        }

        const quizId = quizSnap.docs[0].id;
        const questionDoc = await db.collection("quizQuestions").doc(questionId).get();

        if (!questionDoc.exists) {
            throw new HttpsError("not-found", "Question not found.");
        }

        const questionData = questionDoc.data() as { quizId?: string };
        if (questionData.quizId !== quizId) {
            throw new HttpsError("permission-denied", "Question does not belong to this training.");
        }

        const correctAnswersSnap = await db
            .collection("quizAnswers")
            .where("questionId", "==", questionId)
            .where("isCorrect", "==", true)
            .get();

        const correctAnswerIds = correctAnswersSnap.docs.map(doc => doc.id).sort();
        const userAnswerIds = [...selectedAnswerIds].sort();

        const isCorrect =
            correctAnswerIds.length === userAnswerIds.length &&
            correctAnswerIds.every((id, index) => id === userAnswerIds[index]);

        return { isCorrect, correctAnswerIds };
    } catch (error: any) {
        logger.error("checkAnswer error", error);
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError("internal", error?.message || "Unknown error");
    }
});


/**
 * setAdminClaim - Set admin custom claim on a user
 * 
 * Only callable by existing admins
 * Accepts: { email: string, isAdmin: boolean }
 */
export const setAdminClaim = onCall(async (request: CallableRequest<any>) => {
    // Auth check
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be logged in.");
    }

    // Check if caller is admin
    if (request.auth.token.admin !== true) {
        throw new HttpsError("permission-denied", "Only admins can set admin claims.");
    }

    const { email, isAdmin } = request.data;

    if (!email || typeof isAdmin !== "boolean") {
        throw new HttpsError("invalid-argument", "Email and isAdmin (boolean) required.");
    }

    try {
        // Get user by email
        const userRecord = await admin.auth().getUserByEmail(email);

        // Set custom claim
        await admin.auth().setCustomUserClaims(userRecord.uid, {
            admin: isAdmin,
        });

        logger.info("Admin claim updated", { email, isAdmin, by: request.auth.uid });

        return { success: true, message: `Admin claim ${isAdmin ? "granted" : "revoked"} for ${email}` };
    } catch (error) {
        logger.error("Error setting admin claim", { error, email });
        throw new HttpsError("internal", "Failed to set admin claim.");
    }
});

export const deleteTrainingCascade = onCall(async (request: CallableRequest<any>) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be logged in.");
    }

    if (request.auth.token.admin !== true) {
        throw new HttpsError("permission-denied", "Only admins can delete trainings.");
    }

    const {trainingId} = request.data || {};
    if (!trainingId || typeof trainingId !== "string") {
        throw new HttpsError("invalid-argument", "trainingId is required.");
    }

    try {
        const summary = await deleteTrainingArtifacts(trainingId);
        logger.info("Training deleted with cascade cleanup", {
            trainingId,
            by: request.auth.uid,
            summary,
        });
        return {success: true, summary};
    } catch (error) {
        logger.error("deleteTrainingCascade error", {trainingId, error});
        throw new HttpsError("internal", "Failed to delete training completely.");
    }
});

export const cleanupOrphanedTrainingData = onCall(async (request: CallableRequest<any>) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be logged in.");
    }

    if (request.auth.token.admin !== true) {
        throw new HttpsError("permission-denied", "Only admins can run cleanup.");
    }

    try {
        const referencedTrainingIds = new Set<string>();

        const [progressSnap, quizSnap, quizSessionsSnap, trainingVisitsSnap] = await Promise.all([
            db.collection("progress").get(),
            db.collection("quizzes").get(),
            db.collection("quizSessions").get(),
            db.collectionGroup("trainingVisits").get(),
        ]);

        progressSnap.docs.forEach((doc) => {
            const trainingId = doc.data().trainingId;
            if (typeof trainingId === "string" && trainingId) {
                referencedTrainingIds.add(trainingId);
            }
        });

        quizSnap.docs.forEach((doc) => {
            const trainingId = doc.data().trainingId;
            if (typeof trainingId === "string" && trainingId) {
                referencedTrainingIds.add(trainingId);
            }
        });

        quizSessionsSnap.docs.forEach((doc) => {
            const trainingId = doc.data().trainingId;
            if (typeof trainingId === "string" && trainingId) {
                referencedTrainingIds.add(trainingId);
            }
        });

        trainingVisitsSnap.docs.forEach((doc) => {
            if (doc.id) {
                referencedTrainingIds.add(doc.id);
            }
        });

        const cleanedTrainingIds: string[] = [];
        const summaries: Record<string, TrainingCleanupSummary> = {};

        for (const trainingId of referencedTrainingIds) {
            const trainingDoc = await db.collection("trainings").doc(trainingId).get();
            if (!trainingDoc.exists) {
                cleanedTrainingIds.push(trainingId);
                summaries[trainingId] = await deleteTrainingArtifacts(trainingId);
            }
        }

        logger.info("Orphaned training data cleanup completed", {
            by: request.auth.uid,
            cleanedTrainingIds,
            summaries,
        });

        return {
            success: true,
            cleanedTrainingIds,
            summaries,
        };
    } catch (error) {
        logger.error("cleanupOrphanedTrainingData error", error);
        throw new HttpsError("internal", "Failed to cleanup orphaned training data.");
    }
});

export { extractTranscript } from "./quiz/extractTranscript";
export { generateQuiz, previewQuiz } from "./quiz/generateQuiz";
