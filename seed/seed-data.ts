/**
 * SSL LMS - Seed Data Script
 * 
 * Run this script to populate Firestore with initial data:
 * - 3 brands (Medik8, Luxmetique, GUM)
 * - Sample trainings per brand
 * - Quizzes with questions and answers
 * 
 * Usage:
 * 1. Install dependencies: npm install firebase-admin
 * 2. Download service account key from Firebase Console
 * 3. Set GOOGLE_APPLICATION_CREDENTIALS env var to path of key file
 * 4. Run: npx ts-node seed-data.ts
 */

import * as admin from 'firebase-admin';

// Initialize Firebase Admin
admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'lms-a762e'
});

const db = admin.firestore();

interface Brand {
    name: string;
    order: number;
}

interface Training {
    brandId: string;
    title: string;
    description: string;
    mediaType: 'video' | 'podcast';
    mediaDriveUrl: string;
    isActive: boolean;
    createdAt: admin.firestore.FieldValue;
}

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

async function seedData() {
    console.log('Starting seed...');

    // ============ BRANDS ============
    console.log('Creating brands...');
    const brands: Record<string, Brand> = {
        medik8: { name: 'Medik8', order: 1 },
        luxmetique: { name: 'Luxmetique', order: 2 },
        gum: { name: 'GUM', order: 3 },
    };

    const brandRefs: Record<string, string> = {};
    for (const [key, brand] of Object.entries(brands)) {
        const ref = await db.collection('brands').add(brand);
        brandRefs[key] = ref.id;
        console.log(`  Created brand: ${brand.name} (${ref.id})`);
    }

    // ============ TRAININGS ============
    console.log('Creating trainings...');

    const trainings: Training[] = [
        {
            brandId: brandRefs.medik8,
            title: 'Crystal Retinal: Complete Guide',
            description: 'Learn everything about Medik8 Crystal Retinal, the stable retinaldehyde formula for all skin types.',
            mediaType: 'video',
            // Replace with actual Google Drive video URL
            mediaDriveUrl: 'https://drive.google.com/file/d/EXAMPLE_VIDEO_ID/preview',
            isActive: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        {
            brandId: brandRefs.medik8,
            title: 'Vitamin C Serum Training',
            description: 'Understanding the benefits and proper application of Medik8 Vitamin C formulations.',
            mediaType: 'video',
            mediaDriveUrl: 'https://drive.google.com/file/d/EXAMPLE_VIDEO_ID_2/preview',
            isActive: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        {
            brandId: brandRefs.luxmetique,
            title: 'Luxmetique Fundamentals',
            description: 'Introduction to the Luxmetique product line and key selling points.',
            mediaType: 'video',
            mediaDriveUrl: 'https://drive.google.com/file/d/EXAMPLE_VIDEO_ID_3/preview',
            isActive: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        {
            brandId: brandRefs.gum,
            title: 'GUM Oral Care Essentials',
            description: 'Complete overview of GUM oral care products and their benefits.',
            mediaType: 'podcast',
            mediaDriveUrl: 'https://drive.google.com/file/d/EXAMPLE_AUDIO_ID/preview',
            isActive: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        },
    ];

    const trainingRefs: string[] = [];
    for (const training of trainings) {
        const ref = await db.collection('trainings').add(training);
        trainingRefs.push(ref.id);
        console.log(`  Created training: ${training.title} (${ref.id})`);
    }

    // ============ QUIZZES ============
    console.log('Creating quizzes...');

    const quizRefs: string[] = [];
    for (const trainingId of trainingRefs) {
        const quiz: Quiz = {
            trainingId,
            passingScore: 90,
        };
        const ref = await db.collection('quizzes').add(quiz);
        quizRefs.push(ref.id);
        console.log(`  Created quiz for training ${trainingId} (${ref.id})`);
    }

    // ============ QUESTIONS & ANSWERS ============
    console.log('Creating questions and answers...');

    // Sample questions for first quiz (Crystal Retinal)
    const sampleQuestions = [
        {
            question: 'What is the main active ingredient in Crystal Retinal?',
            type: 'multiple_choice' as const,
            answers: [
                { text: 'Retinaldehyde', isCorrect: true },
                { text: 'Retinol', isCorrect: false },
                { text: 'Retinyl Palmitate', isCorrect: false },
                { text: 'Tretinoin', isCorrect: false },
            ],
        },
        {
            question: 'Crystal Retinal is suitable for sensitive skin.',
            type: 'true_false' as const,
            answers: [
                { text: 'True', isCorrect: true },
                { text: 'False', isCorrect: false },
            ],
        },
        {
            question: 'Which skin concerns does Crystal Retinal address? (Select all that apply)',
            type: 'multiple_choice' as const,
            answers: [
                { text: 'Fine lines and wrinkles', isCorrect: true },
                { text: 'Uneven skin tone', isCorrect: true },
                { text: 'Hair growth', isCorrect: false },
                { text: 'Acne', isCorrect: true },
            ],
        },
        {
            question: 'Retinaldehyde is more potent than retinol.',
            type: 'true_false' as const,
            answers: [
                { text: 'True', isCorrect: true },
                { text: 'False', isCorrect: false },
            ],
        },
        {
            question: 'When should Crystal Retinal be applied?',
            type: 'multiple_choice' as const,
            answers: [
                { text: 'Morning only', isCorrect: false },
                { text: 'Evening only', isCorrect: true },
                { text: 'Any time of day', isCorrect: false },
                { text: 'After sun exposure', isCorrect: false },
            ],
        },
    ];

    // Add questions to first quiz
    const quizId = quizRefs[0];
    for (const q of sampleQuestions) {
        const questionDoc: Question = {
            quizId,
            question: q.question,
            type: q.type,
        };
        const questionRef = await db.collection('quizQuestions').add(questionDoc);

        // Add answers
        for (const answer of q.answers) {
            const answerDoc: Answer = {
                questionId: questionRef.id,
                answerText: answer.text,
                isCorrect: answer.isCorrect,
            };
            await db.collection('quizAnswers').add(answerDoc);
        }
        console.log(`  Created question: ${q.question.substring(0, 40)}...`);
    }

    console.log('\n✅ Seed complete!');
    console.log('\nCreated:');
    console.log(`  - ${Object.keys(brands).length} brands`);
    console.log(`  - ${trainings.length} trainings`);
    console.log(`  - ${quizRefs.length} quizzes`);
    console.log(`  - ${sampleQuestions.length} questions with answers`);
    console.log('\n⚠️  Remember to update mediaDriveUrl with actual Google Drive file IDs');
}

seedData()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Seed failed:', error);
        process.exit(1);
    });
