import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
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

interface ExtractedFact {
    fact: string;
    excerpt: string;
}

interface ExtractedFactsPayload {
    facts: ExtractedFact[];
}

interface RewriteQuestionPayload {
    index: number;
    question: string;
    type: "single" | "boolean" | "multiple";
    options: string[];
    correctAnswer: number[];
}

interface RewriteQuestionsResponse {
    questions: RewriteQuestionPayload[];
}

interface GeneratedQuizPackage {
    trainingTitle: string;
    extractedFacts: ExtractedFact[];
    quiz: GeneratedQuiz;
}

const META_QUESTION_PATTERNS = [
    /foco principal/i,
    /tema principal/i,
    /tema do conte[uú]do/i,
    /de acordo com o t[ií]tulo/i,
    /t[ií]tulo e subt[ií]tulo/i,
    /que t[oó]picos/i,
    /esperad[oa]s? serem abordad/i,
    /ser[aá] abordad/i,
    /perspetiva/i,
    /perspectiva/i,
    /abordagem .* ser[aá] adotad/i,
    /o texto sugere/i,
    /o conte[uú]do sugere/i,
    /o conte[uú]do abordar[aá]/i,
    /a apresenta[cç][aã]o/i,
    /esta sess[aã]o/i,
];

function getQuestionValidationReasons(question: QuizQuestion): string[] {
    const reasons: string[] = [];
    const questionText = question.question.trim();

    if (questionText.length < 12) {
        reasons.push("Pergunta demasiado curta.");
    }

    if (META_QUESTION_PATTERNS.some((pattern) => pattern.test(questionText))) {
        reasons.push("Pergunta meta sobre a apresentação em vez de conhecimento do conteúdo.");
    }

    if (!Array.isArray(question.options) || question.options.length < 2) {
        reasons.push("Número inválido de opções.");
    }

    if (!Array.isArray(question.correctAnswer) || question.correctAnswer.length === 0) {
        reasons.push("Pergunta sem resposta correta definida.");
    }

    if (question.correctAnswer.some((index) => index < 0 || index >= question.options.length)) {
        reasons.push("Índices de resposta correta fora dos limites das opções.");
    }

    if (question.type === "boolean" && question.options.length !== 2) {
        reasons.push("Pergunta verdadeiro/falso com formato inválido.");
    }

    if (question.type === "single" && question.correctAnswer.length !== 1) {
        reasons.push("Pergunta de escolha única deve ter apenas uma resposta correta.");
    }

    if (question.type === "multiple" && question.correctAnswer.length < 2) {
        reasons.push("Pergunta de seleção múltipla deve ter pelo menos duas respostas corretas.");
    }

    return reasons;
}

async function buildGeneratedQuizPackage(
    trainingId: string,
    geminiApiKey: string
): Promise<GeneratedQuizPackage> {
    const trainingRef = db.collection("trainings").doc(trainingId);
    const trainingDoc = await trainingRef.get();

    if (!trainingDoc.exists) {
        throw new HttpsError("not-found", "Training not found.");
    }

    const training = trainingDoc.data();
    const content = (training?.transcript || "").trim();

    if (!content || content.length < 150) {
        throw new HttpsError(
            "failed-precondition",
            "Transcrição insuficiente para gerar um quiz de conhecimento. Adicione ou extraia uma transcrição mais completa."
        );
    }

    const ai = new GoogleGenAI({ apiKey: geminiApiKey });

    const factExtractionPrompt = `You are analyzing training content for a professional LMS.
Extract the most important concrete knowledge statements explicitly taught in the content.

CONTENT:
"""
${content.substring(0, 8000)}
"""

REQUIREMENTS:
- Extract between 8 and 12 facts
- Each fact must be a concrete teaching point that a learner should know after the training
- Prefer definitions, mechanisms, cause/effect, benefits, cautions, comparisons, and practical claims
- Do not extract facts about presentation structure, title, subtitle, what will be discussed, expected topics, or framing language
- Each fact must be supported by a short excerpt copied or closely paraphrased from the content
- Language: Portuguese (Portugal)

OUTPUT FORMAT (JSON only, no markdown):
{
  "facts": [
    {
      "fact": "Os nutricosméticos são ...",
      "excerpt": "Trecho curto do conteúdo que suporta esta afirmação"
    }
  ]
}`;

    const factsResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: factExtractionPrompt,
    });

    let factsText = factsResponse.text || "";
    factsText = factsText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let extractedFactsPayload: ExtractedFactsPayload;
    try {
        extractedFactsPayload = JSON.parse(factsText);
    } catch (parseError) {
        logger.error("Failed to parse extracted facts response:", factsText);
        throw new HttpsError("internal", "Failed to extract grounded facts from the training content.");
    }

    const extractedFacts = (extractedFactsPayload.facts || [])
        .filter((item) => item?.fact && item?.excerpt)
        .slice(0, 12);

    if (extractedFacts.length < 5) {
        logger.warn("Insufficient grounded facts extracted", { trainingId, extractedFactsCount: extractedFacts.length });
        throw new HttpsError("failed-precondition", "Insufficient grounded facts extracted from the training content.");
    }

    const factsBlock = extractedFacts
        .map((item, index) => `${index + 1}. FACT: ${item.fact}\n   EVIDENCE: ${item.excerpt}`)
        .join("\n");

    const prompt = `You are an educational quiz generator for a professional LMS.
Your job is to create a final assessment that tests the learner's knowledge of the subject matter actually taught in the training.
The quiz must evaluate domain knowledge, not whether the learner understood the framing, title, structure, objectives, or expected topics of the presentation.
Mix the question types between Multiple Choice, True/False, and Select All That Apply.

TRAINING TITLE:
${training?.title || ""}

GROUNDED FACTS FROM THE TRAINING:
${factsBlock}

REQUIREMENTS:
- Generate exactly 5 questions
- Include at least 1 True/False and 1 "Select All That Apply" question if appropriate
- For Multiple Choice: 4 options, 1 correct
- For True/False: 2 options (Verdadeiro, Falso)
- For Select All That Apply: 4-5 options, 2+ correct
- Questions must test important factual or conceptual knowledge taught in the content
- Prioritize definitions, mechanisms, concepts, comparisons, benefits, cautions, practical implications, and cause/effect relationships explicitly explained in the training
- Every question must be answerable from the content itself, not from the title alone and not by guessing what the presentation intends to discuss
- Ask about what Luxmetique is, what nutricosmetics are, how they work, why they matter, what relationships or claims are explained, and other core learning points if those appear in the content
- Language: Portuguese (Portugal)

DO NOT GENERATE QUESTIONS ABOUT:
- the title, subtitle, or framing of the content
- the main focus/theme of the presentation
- what topics are expected to be discussed
- what perspective or approach will be adopted
- what the content suggests will happen
- whether the content will cover something
- the structure, intent, or objectives of the session

AVOID BAD QUESTION STYLES SUCH AS:
- "Qual é o foco principal do conteúdo...?"
- "Que tópicos são esperados serem abordados...?"
- "Que perspetiva é mencionada...?"
- "De acordo com o título e subtítulo..."
- "O texto sugere que..."

GOOD QUESTION STYLE:
- Ask about the actual concepts, explanations, relationships, benefits, definitions, and claims presented in the training
- Prefer concrete content questions over abstract summary questions
- If the content teaches what something is, ask what it is
- If the content explains why something matters, ask why it matters
- If the content compares ideas, ask about the comparison
- If the content describes mechanisms or effects, ask about those mechanisms or effects
- Every question must be based on one or more of the grounded facts listed above
- Do not invent facts that are not present in the grounded facts list

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

    let responseText = response.text || "";
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

    const invalidQuestions = parsedQuiz.questions
        .map((question, index) => ({
            index,
            question,
            reasons: getQuestionValidationReasons(question),
        }))
        .filter((item) => item.reasons.length > 0);

    if (invalidQuestions.length > 0) {
        logger.warn("Invalid questions detected, attempting rewrite", {
            trainingId,
            invalidQuestions: invalidQuestions.map((item) => ({
                index: item.index,
                reasons: item.reasons,
                question: item.question.question,
            })),
        });

        const rewritePrompt = `You are correcting weak quiz questions for a professional LMS.
Rewrite ONLY the invalid questions listed below.
The rewritten questions must test concrete subject knowledge taught in the training facts.

GROUNDED FACTS:
${factsBlock}

INVALID QUESTIONS TO REWRITE:
${invalidQuestions.map((item) => `INDEX ${item.index}
QUESTION: ${item.question.question}
TYPE: ${item.question.type}
OPTIONS: ${JSON.stringify(item.question.options)}
CORRECT ANSWER: ${JSON.stringify(item.question.correctAnswer)}
PROBLEMS: ${item.reasons.join(" | ")}`).join("\n\n")}

REWRITE RULES:
- Keep the same index for each rewritten question
- Keep the same question type for each rewritten question
- Keep valid Portuguese (Portugal)
- Make the question about actual knowledge taught in the training, not about the presentation framing
- Do not mention title, subtitle, focus, expected topics, perspective, or what the content suggests
- Ensure each rewritten question has valid options and valid correctAnswer indices

OUTPUT FORMAT (JSON only, no markdown):
{
  "questions": [
    {
      "index": 0,
      "question": "Pergunta reescrita",
      "type": "single",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": [1]
    }
  ]
}`;

        const rewriteResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: rewritePrompt,
        });

        let rewriteText = rewriteResponse.text || "";
        rewriteText = rewriteText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

        let rewrittenQuestionsPayload: RewriteQuestionsResponse;
        try {
            rewrittenQuestionsPayload = JSON.parse(rewriteText);
        } catch (parseError) {
            logger.error("Failed to parse rewritten questions response:", rewriteText);
            throw new HttpsError("internal", "Failed to rewrite invalid quiz questions.");
        }

        const rewrittenByIndex = new Map<number, QuizQuestion>();
        (rewrittenQuestionsPayload.questions || []).forEach((item) => {
            rewrittenByIndex.set(item.index, {
                question: item.question,
                type: item.type,
                options: item.options,
                correctAnswer: item.correctAnswer,
            });
        });

        parsedQuiz.questions = parsedQuiz.questions.map((question, index) =>
            rewrittenByIndex.get(index) || question
        );

        const stillInvalid = parsedQuiz.questions
            .map((question, index) => ({
                index,
                reasons: getQuestionValidationReasons(question),
                question: question.question,
            }))
            .filter((item) => item.reasons.length > 0);

        if (stillInvalid.length > 0) {
            logger.error("Quiz still contains invalid questions after rewrite", { trainingId, stillInvalid });
            throw new HttpsError("internal", "AI generated weak or invalid questions after rewrite.");
        }
    }

    return {
        trainingTitle: training?.title || "Formação",
        extractedFacts,
        quiz: parsedQuiz,
    };
}

/**
 * generateQuiz - Cloud Function to generate AI-powered quizzes using Gemini
 * 
 * Accepts: { trainingId: string }
 * Returns: { sessionId: string, questions: QuizQuestion[] (without correctAnswer) }
 */
export const generateQuiz = onCall({ secrets: ["GEMINI_API_KEY"] }, async (request: CallableRequest<any>) => {
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
        const quizPackage = await buildGeneratedQuizPackage(trainingId, geminiApiKey);

        // 4. Generate session ID and store correct answers in Firestore cache
        const sessionId = `${userId}_${trainingId}_${Date.now()}`;

        const correctAnswers: { [key: number]: number[] } = {};
        quizPackage.quiz.questions.forEach((q, index) => {
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
        const questionsForClient = quizPackage.quiz.questions.map((q, index) => ({
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

export const previewQuiz = onCall({ secrets: ["GEMINI_API_KEY"] }, async (request: CallableRequest<any>) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be logged in.");
    }

    if (request.auth.token.admin !== true) {
        throw new HttpsError("permission-denied", "Only admins can preview quizzes.");
    }

    const { trainingId } = request.data;
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!trainingId) {
        throw new HttpsError("invalid-argument", "trainingId is required.");
    }

    if (!geminiApiKey) {
        logger.error("GEMINI_API_KEY not configured");
        throw new HttpsError("failed-precondition", "AI service not configured.");
    }

    try {
        const quizPackage = await buildGeneratedQuizPackage(trainingId, geminiApiKey);
        return {
            trainingTitle: quizPackage.trainingTitle,
            extractedFacts: quizPackage.extractedFacts,
            questions: quizPackage.quiz.questions.map((question, index) => ({
                id: index,
                question: question.question,
                type: question.type,
                options: question.options,
                correctAnswer: question.correctAnswer,
            })),
        };
    } catch (error: any) {
        logger.error("Error in previewQuiz:", error);

        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError("internal", error.message || "Unknown error during quiz preview generation.");
    }
});
