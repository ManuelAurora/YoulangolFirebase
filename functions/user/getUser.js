const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.getUser = functions.https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to get your profile.');
        }

        const userId = context.auth.uid;

        const [userDoc, userRecord] = await Promise.all([
            await admin.firestore().collection('users').doc(userId).get(),
            await admin.auth().getUser(userId)
        ]);

        if (!userDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'User not found.');
        }

        return {
            id: userId,
            creationTime: userRecord.metadata.creationTime,
            emailVerified: userRecord.emailVerified,
            name: userRecord.displayName,
            email: userRecord.email,
            phone: userRecord.phoneNumber,
            photoURL: userRecord.photoURL,
            disabled: userRecord.disabled,
            ...userDoc.data()
        };
    } catch (error) {
        console.error(error);

        if (error instanceof functions.https.HttpsError) {
            throw error;
        } else {
            throw new functions.https.HttpsError('internal', 'An error occurred while getting your profile.', error.message);
        }
    }
});
