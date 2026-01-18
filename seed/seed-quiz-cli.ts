/**
 * SSL LMS - Seed Quiz Data using Firebase CLI credentials
 * 
 * This script uses the firebase-tools package to leverage 
 * the logged-in Firebase CLI credentials.
 * 
 * Usage: npx ts-node seed-quiz-cli.ts
 */

const firebase = require('firebase-tools');

// Crystal Retinal training ID (from Firestore)
const TRAINING_ID = 'm8iP0n6ykYYTCHw3Zgnw';
const PROJECT_ID = 'lms-a762e';

async function seedQuiz() {
    console.log('🚀 Starting quiz seed using Firebase CLI...\n');

    // Create quiz document
    const quizData = {
        trainingId: TRAINING_ID,
        passingScore: 90,
    };

    // Generate a document ID
    const quizId = 'quiz_' + Date.now();

    await firebase.firestore.delete('quizzes', {
        project: PROJECT_ID,
        allCollections: false,
        shallow: true,
    }).catch(() => { });  // Ignore error if doesn't exist

    // Use firebase firestore:set to create documents
    console.log('Creating quiz...');
    await firebase.firestore.write({
        project: PROJECT_ID,
        data: `quizzes/${quizId}:${JSON.stringify(quizData)}`,
    });
    console.log(`  ✓ Created quiz: ${quizId}`);

    // Questions to create
    const questions = [
        {
            id: 'q1',
            question: 'Qual é o ingrediente principal do Crystal Retinal?',
            type: 'multiple_choice',
            answers: [
                { id: 'a1', text: 'Retinaldeído', isCorrect: true },
                { id: 'a2', text: 'Retinol', isCorrect: false },
                { id: 'a3', text: 'Vitamina C', isCorrect: false },
                { id: 'a4', text: 'Ácido Hialurónico', isCorrect: false },
            ],
        },
        {
            id: 'q2',
            question: 'O Crystal Retinal é adequado para pele sensível.',
            type: 'true_false',
            answers: [
                { id: 'a5', text: 'Verdadeiro', isCorrect: true },
                { id: 'a6', text: 'Falso', isCorrect: false },
            ],
        },
        {
            id: 'q3',
            question: 'Quando deve ser aplicado o Crystal Retinal?',
            type: 'multiple_choice',
            answers: [
                { id: 'a7', text: 'Apenas de manhã', isCorrect: false },
                { id: 'a8', text: 'Apenas à noite', isCorrect: true },
                { id: 'a9', text: 'A qualquer hora do dia', isCorrect: false },
                { id: 'a10', text: 'Após exposição solar', isCorrect: false },
            ],
        },
        {
            id: 'q4',
            question: 'O Retinaldeído é mais potente que o Retinol.',
            type: 'true_false',
            answers: [
                { id: 'a11', text: 'Verdadeiro', isCorrect: true },
                { id: 'a12', text: 'Falso', isCorrect: false },
            ],
        },
        {
            id: 'q5',
            question: 'Qual é a percentagem mínima para passar no quiz?',
            type: 'multiple_choice',
            answers: [
                { id: 'a13', text: '70%', isCorrect: false },
                { id: 'a14', text: '80%', isCorrect: false },
                { id: 'a15', text: '90%', isCorrect: true },
                { id: 'a16', text: '100%', isCorrect: false },
            ],
        },
    ];

    console.log('\nCreating questions and answers...');
    for (const q of questions) {
        // Create question
        await firebase.firestore.write({
            project: PROJECT_ID,
            data: `quizQuestions/${q.id}:${JSON.stringify({
                quizId: quizId,
                question: q.question,
                type: q.type,
            })}`,
        });

        // Create answers
        for (const a of q.answers) {
            await firebase.firestore.write({
                project: PROJECT_ID,
                data: `quizAnswers/${a.id}:${JSON.stringify({
                    questionId: q.id,
                    answerText: a.text,
                    isCorrect: a.isCorrect,
                })}`,
            });
        }
        console.log(`  ✓ Created: ${q.question.substring(0, 50)}...`);
    }

    console.log('\n✅ Quiz seed complete!');
}

seedQuiz()
    .then(() => process.exit(0))
    .catch((error: any) => {
        console.error('❌ Seed failed:', error);
        process.exit(1);
    });
