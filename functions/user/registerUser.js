const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.registerUser = functions.https.onCall(async (data) => {
    try {
        const { uid } = data;

        if (!uid) {
            throw new functions.https.HttpsError('invalid-argument', 'UID is required in the request.');
        }

        await admin.firestore().collection('users').doc(uid).set({
            rating: 0,
            activeChats: []
        });

        return {
            success: true,
            message: 'User registered successfully. Please check your email to verify your account.',
        };
    } catch (error) {
        console.error(error);

        if (error instanceof functions.https.HttpsError) {
            throw error;
        } else {
            throw new functions.https.HttpsError('internal', 'An error occurred while registering the user.', error.message);
        }
    }
});
