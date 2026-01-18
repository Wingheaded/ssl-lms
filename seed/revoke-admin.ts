
import * as admin from 'firebase-admin';

// Initialize Firebase Admin
// Check if already initialized to avoid error
if (admin.apps.length === 0) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: 'lms-a762e'
    });
}

async function revokeAdmin() {
    const email = process.argv[2];

    if (!email) {
        console.error('❌ Usage: npx ts-node revoke-admin.ts <email>');
        process.exit(1);
    }

    console.log(`🔐 Revoking admin claim for: ${email}`);

    try {
        // Get user by email
        const user = await admin.auth().getUserByEmail(email);
        console.log(`   Found user: ${user.uid}`);

        // Set admin claim to null (removes it)
        await admin.auth().setCustomUserClaims(user.uid, { admin: null });
        console.log(`   ✅ Admin claim REVOKED successfully!`);

        // Verify
        const updatedUser = await admin.auth().getUser(user.uid);
        console.log(`   Claims:`, updatedUser.customClaims);

        console.log(`\n✅ Done! User ${email} is NO LONGER an admin.`);
        console.log(`   You must log out and log back in for the change to take effect.`);

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

revokeAdmin().then(() => process.exit(0));
