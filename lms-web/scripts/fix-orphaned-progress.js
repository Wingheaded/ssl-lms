
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Path to service account (up two levels from scripts/ folder)
const serviceAccountPath = path.join(__dirname, '../../service-account.json');

if (!fs.existsSync(serviceAccountPath)) {
    console.error(`Error: Service account not found at ${serviceAccountPath}`);
    process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixOrphanedProgress() {
    console.log('Starting orphaned progress cleanup...');

    try {
        // 1. Get all valid training IDs
        console.log('Fetching valid trainings...');
        const trainingsSnap = await db.collection('trainings').get();
        const validTrainingIds = new Set();
        trainingsSnap.forEach(doc => validTrainingIds.add(doc.id));
        console.log(`Found ${validTrainingIds.size} valid trainings.`);

        // 2. Get all progress records
        console.log('Fetching progress records...');
        const progressSnap = await db.collection('progress').get();
        console.log(`Found ${progressSnap.size} progress records.`);

        let deletedCount = 0;

        // 3. Find and delete orphans
        for (const doc of progressSnap.docs) {
            const data = doc.data();
            const trainingId = data.trainingId;

            if (!trainingId) {
                console.log(`⚠️ Progress ${doc.id} has no trainingId. Deleting...`);
                await doc.ref.delete();
                deletedCount++;
                continue;
            }

            if (!validTrainingIds.has(trainingId)) {
                console.log(`🗑️ Deleting orphaned progress ${doc.id} (trainingId: ${trainingId})...`);
                await doc.ref.delete();
                deletedCount++;
            }
        }

        console.log(`\n✅ Cleanup complete. Deleted ${deletedCount} orphaned records.`);

    } catch (error) {
        console.error('Error cleaning up:', error);
    }
}

fixOrphanedProgress();
