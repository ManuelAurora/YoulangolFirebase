const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.getUser = functions.https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to get your profile.');
        }

        const { uid } = context.auth;

        const userRecord = await admin.auth().getUser(uid);

        const userDocRef = admin.firestore().collection('users').doc(uid);

        let userDoc =  await userDocRef.get();

        if (!userDoc.exists) {
            await userDocRef.set({
                rating: 0,
                activeChats: []
            });

            userDoc =  await userDocRef.get();
        }

        return {
            id: uid,
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
