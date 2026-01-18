/**
 * Set First Admin - Bootstrap script
 * 
 * Run this ONCE to set the first admin user.
 * Usage: npx ts-node set-first-admin.ts <email>
 */

import * as admin from 'firebase-admin';

// Initialize Firebase Admin
admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'lms-a762e'
});

async function setAdmin() {
    const email = process.argv[2];

    if (!email) {
        console.error('❌ Usage: npx ts-node set-first-admin.ts <email>');
        process.exit(1);
    }

    console.log(`🔐 Setting admin claim for: ${email}`);

    try {
        // Get user by email
        const user = await admin.auth().getUserByEmail(email);
        console.log(`   Found user: ${user.uid}`);

        // Set admin claim
        await admin.auth().setCustomUserClaims(user.uid, { admin: true });
        console.log(`   ✅ Admin claim set successfully!`);

        // Verify
        const updatedUser = await admin.auth().getUser(user.uid);
        console.log(`   Claims:`, updatedUser.customClaims);

        console.log(`\n✅ Done! User ${email} is now an admin.`);
        console.log(`   They need to log out and log back in for the change to take effect.`);

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

setAdmin().then(() => process.exit(0));
