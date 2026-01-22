import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { GoogleGenAI } from "@google/genai";

const db = admin.firestore();

// Initialize Gemini - API key from environment variable (moved inside function)

interface QuizQuestion {
    question: string;
    type: "single" | "boolean" | "multiple";
    options: string[];
    correctAnswer: number[];
}

interface GeneratedQuiz {
    questions: QuizQuestion[];
}

/**
 * generateQuiz - Cloud Function to generate AI-powered quizzes using Gemini
 * 
 * Accepts: { trainingId: string }
 * Returns: { sessionId: string, questions: QuizQuestion[] (without correctAnswer) }
 */
export const generateQuiz = onCall({ secrets: ["GEMINI_API_KEY"] }, async (request) => {
    // Auth check
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be logged in.");
    }

    const userId = request.auth.uid;
    const { trainingId } = request.data;

    // Access secret at runtime
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!trainingId) {
        throw new HttpsError("invalid-argument", "trainingId is required.");
    }

    if (!geminiApiKey) {
        logger.error("GEMINI_API_KEY not configured");
        throw new HttpsError("failed-precondition", "AI service not configured.");
    }

    try {
        // 1. Fetch training and transcript
        const trainingRef = db.collection("trainings").doc(trainingId);
        const trainingDoc = await trainingRef.get();

        if (!trainingDoc.exists) {
            throw new HttpsError("not-found", "Training not found.");
        }

        const training = trainingDoc.data();
        let content = training?.transcript || "";

        // Fallback to description + title if no transcript
        if (!content.trim()) {
            content = `${training?.title || ""}\n\n${training?.description || ""}`;
        }

        if (!content.trim() || content.length < 50) {
            throw new HttpsError("failed-precondition", "Insufficient content for quiz generation. Please add a transcript or description.");
        }

        // 2. Generate quiz using Gemini
        const ai = new GoogleGenAI({ apiKey: geminiApiKey });

        const prompt = `You are an educational quiz generator. Based on the following training content, generate exactly 5 questions to test comprehension.
Mix the question types between Multiple Choice, True/False, and Select All That Apply.

CONTENT:
"""
${content.substring(0, 8000)}
"""

REQUIREMENTS:
- Generate exactly 5 questions
- Include at least 1 True/False and 1 "Select All That Apply" question if appropriate
- For Multiple Choice: 4 options, 1 correct
- For True/False: 2 options (Verdadeiro, Falso)
- For Select All That Apply: 4-5 options, 2+ correct
- Questions should test understanding, not memorization
- Language: Portuguese (Portugal)

OUTPUT FORMAT (JSON only, no markdown):
{
  "questions": [
    {
      "question": "Qual é o principal benefício...?",
      "type": "single",
      "options": ["Opção A", "Opção B", "Opção C", "Opção D"],
      "correctAnswer": [0]
    },
    {
      "question": "A afirmação X é verdadeira?",
      "type": "boolean",
      "options": ["Verdadeiro", "Falso"],
      "correctAnswer": [0]
    },
    {
      "question": "Quais destes são sintomas...?",
      "type": "multiple",
      "options": ["Sintoma A", "Sintoma B", "Sintoma C", "Sintoma D"],
      "correctAnswer": [0, 2]
    }
  ]
}`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });

        // 3. Parse response
        let responseText = response.text || "";

        // Clean up markdown code blocks if present
        responseText = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

        let parsedQuiz: GeneratedQuiz;
        try {
            parsedQuiz = JSON.parse(responseText);
        } catch (parseError) {
            logger.error("Failed to parse Gemini response:", responseText);
            throw new HttpsError("internal", "Failed to parse AI response. Please try again.");
        }

        if (!parsedQuiz.questions || parsedQuiz.questions.length !== 5) {
            logger.warn("Unexpected question count:", parsedQuiz.questions?.length);
            throw new HttpsError("internal", "AI generated invalid quiz. Please try again.");
        }

        // 4. Generate session ID and store correct answers in Firestore cache
        const sessionId = `${userId}_${trainingId}_${Date.now()}`;

        const correctAnswers: { [key: number]: number[] } = {};
        parsedQuiz.questions.forEach((q, index) => {
            correctAnswers[index] = q.correctAnswer;
        });

        // Store in Firestore (quizSessions collection)
        await db.collection("quizSessions").doc(sessionId).set({
            trainingId,
            userId,
            answers: correctAnswers,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            expiresAt: new Date(Date.now() + (10 * 60 * 1000)) // 10 minutes TTL
        });

        // 5. Return questions WITHOUT correct answers
        const questionsForClient = parsedQuiz.questions.map((q, index) => ({
            id: index,
            question: q.question,
            type: q.type,
            options: q.options
            // Note: correctAnswer is NOT included
        }));

        logger.info("Quiz generated successfully", {
            userId,
            trainingId,
            sessionId,
            questionCount: questionsForClient.length
        });

        return {
            sessionId,
            questions: questionsForClient
        };

    } catch (error: any) {
        logger.error("Error in generateQuiz:", error);

        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError("internal", error.message || "Unknown error during quiz generation.");
    }
});
