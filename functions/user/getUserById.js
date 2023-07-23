const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.getUserById = functions.https.onCall(async (data) => {
    try {
        const { userId } = data;

        if (!userId) {
            throw new functions.https.HttpsError('invalid-argument', 'User ID is required.');
        }

        const userDoc = await admin.firestore().collection('users').doc(userId).get();

        if (!userDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'User not found.');
        }

        const userRecord = await admin.auth().getUser(userId);

        return {
            id: userId,
            dateCreated: userRecord.metadata.creationTime,
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
            throw new functions.https.HttpsError('internal', 'An error occurred while getting the user.', error.message);
        }
    }
});
