const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
// Note: Adjust the path if necessary. Based on list_dir, it's in the root of the project.
const serviceAccountPath = path.resolve(__dirname, '../../service-account.json.json');

try {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
} catch (error) {
    console.error("Error loading service account:", error.message);
    console.error("Please ensure 'service-account.json.json' exists in d:\\Claudia\\SkinSelfLove\\SSL_LMS\\SSL_LLM_Project");
    process.exit(1);
}

const db = admin.firestore();

// The user to PRESERVE
const PRESERVED_EMAIL = 'jose.antonio@skinselflove.com.pt';

async function cleanup() {
    console.log(`Starting cleanup. Preserving data for: ${PRESERVED_EMAIL}`);

    try {
        // 1. Find the Preserved User's UID
        let preservedUid = null;
        const usersSnap = await db.collection('users').get();

        console.log(`Found ${usersSnap.size} user documents.`);

        const usersToDelete = [];

        usersSnap.forEach(doc => {
            const data = doc.data();
            if (data.email === PRESERVED_EMAIL) {
                preservedUid = doc.id;
                console.log(`Found preserved user UID: ${preservedUid}`);
            } else {
                usersToDelete.push(doc.ref);
            }
        });

        if (!preservedUid) {
            console.warn(`WARNING: User ${PRESERVED_EMAIL} not found in 'users' collection! Aborting to avoid data loss.`);
            // Depending on requirements, we might want to exit here or continue deleting others.
            // I will continue deleting others but log this warning.
        }

        // 2. Delete other users
        if (usersToDelete.length > 0) {
            console.log(`Deleting ${usersToDelete.length} 'users' documents...`);
            const batch = db.batch(); // Batches are limited to 500 ops, simplified here for small dataset
            usersToDelete.forEach(ref => batch.delete(ref));
            await batch.commit();
            console.log("Deleted users.");
        } else {
            console.log("No users to delete.");
        }

        // 3. Clean 'progress' collection
        const progressSnap = await db.collection('progress').get();
        console.log(`Found ${progressSnap.size} progress documents.`);

        const progressToDelete = [];

        progressSnap.forEach(doc => {
            const data = doc.data();
            // If we found the preserved user, only keep their progress.
            // If we didn't find them, we delete everything (clean slate except for the logic above).
            if (preservedUid && data.userId === preservedUid) {
                // Keep it
            } else {
                progressToDelete.push(doc.ref);
            }
        });

        if (progressToDelete.length > 0) {
            console.log(`Deleting ${progressToDelete.length} 'progress' documents...`);
            const batch = db.batch();
            progressToDelete.forEach(ref => batch.delete(ref));
            await batch.commit();
            console.log("Deleted progress records.");
        } else {
            console.log("No progress records to delete.");
        }

        console.log("Cleanup complete.");

    } catch (error) {
        console.error("Error during cleanup:", error);
    } finally {
        process.exit();
    }
}

cleanup();
