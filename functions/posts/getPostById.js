const functions = require('firebase-functions');
const admin = require('firebase-admin');


exports.getPostById = functions.https.onCall(async (data) => {
    const postId = data.id;

    try {
        const doc = await admin.firestore().collection('posts')
            .doc(postId)
            .get();

        if (!doc.exists) {
            throw new functions.https.HttpsError('not-found', 'Post not found.');
        }

        const data = doc.data();
        const userRecord = await admin.auth().getUser(data.userId);
        const creationTime = userRecord.metadata.creationTime;

        if (data.locationRef) {
            const locationId = await data.locationRef.get();
            data.location = locationId.data();
            data.locationRef = null;
        }

        return {
            data,
            user: {
                creationTime,
                emailVerified: userRecord.emailVerified,
                name: userRecord.displayName,
                email: userRecord.email,
                phone: userRecord.phoneNumber,
                photoURL: userRecord.photoURL,
                disabled: userRecord.disabled,
                id: data.userId,
            },
        };
    } catch (error) {
        console.error(error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
