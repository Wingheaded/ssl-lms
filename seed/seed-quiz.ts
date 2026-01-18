/**
 * SSL LMS - Seed Quiz Data Script
 * 
 * Creates quiz data for the Crystal Retinal training
 * 
 * Usage:
 * 1. Run: npx ts-node seed-quiz.ts
 */

import * as admin from 'firebase-admin';

// Initialize Firebase Admin
admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'lms-a762e'
});

const db = admin.firestore();

// Crystal Retinal training ID (from Firestore)
const TRAINING_ID = 'm8iP0n6ykYYTCHw3Zgnw';

interface Quiz {
    trainingId: string;
    passingScore: number;
}

interface Question {
    quizId: string;
    question: string;
    type: 'multiple_choice' | 'true_false';
}

interface Answer {
    questionId: string;
    answerText: string;
    isCorrect: boolean;
}

async function seedQuiz() {
    console.log('🚀 Starting quiz seed...\n');

    // ============ CREATE QUIZ ============
    console.log('Creating quiz...');
    const quiz: Quiz = {
        trainingId: TRAINING_ID,
        passingScore: 90,
    };
    const quizRef = await db.collection('quizzes').add(quiz);
    console.log(`  ✓ Created quiz: ${quizRef.id}`);

    // ============ CREATE QUESTIONS & ANSWERS ============
    console.log('\nCreating questions and answers...');

    const questions = [
        {
            question: 'Qual é o ingrediente principal do Crystal Retinal?',
            type: 'multiple_choice' as const,
            answers: [
                { text: 'Retinaldeído', isCorrect: true },
                { text: 'Retinol', isCorrect: false },
                { text: 'Vitamina C', isCorrect: false },
                { text: 'Ácido Hialurónico', isCorrect: false },
            ],
        },
        {
            question: 'O Crystal Retinal é adequado para pele sensível.',
            type: 'true_false' as const,
            answers: [
                { text: 'Verdadeiro', isCorrect: true },
                { text: 'Falso', isCorrect: false },
            ],
        },
        {
            question: 'Quando deve ser aplicado o Crystal Retinal?',
            type: 'multiple_choice' as const,
            answers: [
                { text: 'Apenas de manhã', isCorrect: false },
                { text: 'Apenas à noite', isCorrect: true },
                { text: 'A qualquer hora do dia', isCorrect: false },
                { text: 'Após exposição solar', isCorrect: false },
            ],
        },
        {
            question: 'O Retinaldeído é mais potente que o Retinol.',
            type: 'true_false' as const,
            answers: [
                { text: 'Verdadeiro', isCorrect: true },
                { text: 'Falso', isCorrect: false },
            ],
        },
        {
            question: 'Qual é a percentagem mínima para passar no quiz?',
            type: 'multiple_choice' as const,
            answers: [
                { text: '70%', isCorrect: false },
                { text: '80%', isCorrect: false },
                { text: '90%', isCorrect: true },
                { text: '100%', isCorrect: false },
            ],
        },
    ];

    for (const q of questions) {
        // Create question
        const questionDoc: Question = {
            quizId: quizRef.id,
            question: q.question,
            type: q.type,
        };
        const questionRef = await db.collection('quizQuestions').add(questionDoc);

        // Create answers for this question
        for (const answer of q.answers) {
            const answerDoc: Answer = {
                questionId: questionRef.id,
                answerText: answer.text,
                isCorrect: answer.isCorrect,
            };
            await db.collection('quizAnswers').add(answerDoc);
        }
        console.log(`  ✓ Created: ${q.question.substring(0, 50)}...`);
    }

    console.log('\n✅ Quiz seed complete!');
    console.log('\nCreated:');
    console.log(`  - 1 quiz (passing score: 90%)`);
    console.log(`  - ${questions.length} questions`);
    console.log(`  - ${questions.reduce((sum, q) => sum + q.answers.length, 0)} answers`);
}

seedQuiz()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Seed failed:', error);
        process.exit(1);
    });
