const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.registerUser = functions.https.onCall(async (data) => {
    try {
        const { uid } = data;

        if (!uid) {
            throw new functions.https.HttpsError('invalid-argument', 'UID is required in the request.');
        }

        const userDocRef = admin.firestore().collection('users').doc(uid);
        await userDocRef.set({
            rating: 0,
            activeChats: []
        });

        const [userRecord, userDoc] = await Promise.all([
            admin.auth().getUser(uid),
            userDocRef.get()
        ]);

        if (!userDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'User not found.');
        }

        return {
            id: userRecord.uid,
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
            throw new functions.https.HttpsError('internal', 'An error occurred while registering the user.', error.message);
        }
    }
});
