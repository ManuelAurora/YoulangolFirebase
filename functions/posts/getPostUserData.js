const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.getPostUserData = functions.https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to get this profile.');
        }

        const { userId } = data;

        if (!userId) {
            throw new functions.https.HttpsError('invalid-argument', 'User ID is required.');
        }

        const userDoc = await admin.firestore().collection('users').doc(userId).get();

        if (!userDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'User not found.');
        }

        const { rating } = userDoc.data();

        const userRecord = await admin.auth().getUser(userId);

        return {
            id: userId,
            name: userRecord.displayName,
            phone: userRecord.phoneNumber,
            email: userRecord.email,
            creationTime: userRecord.metadata.creationTime,
            emailVerified: userRecord.emailVerified,
            photoURL: userRecord.photoURL,
            disabled: userRecord.disabled,
            rating
        };
    } catch (error) {
        console.error(error);

        if (error instanceof functions.https.HttpsError) {
            throw error;
        } else {
            throw new functions.https.HttpsError('internal', 'An error occurred while getting the user.', error.message);
        }
    }
});
