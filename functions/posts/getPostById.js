const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.getPostById = functions.https.onCall(async (data) => {
    try {
        const postId = data.id;

        if (!postId) {
            throw new functions.https.HttpsError('invalid-argument', 'Post ID is required.');
        }

        const doc = await admin.firestore().collection('posts')
            .doc(postId)
            .get();

        if (!doc.exists) {
            throw new functions.https.HttpsError('not-found', 'Post not found.');
        }

        const postData = doc.data();
        const userRecord = await admin.auth().getUser(postData.userId);
        const creationTime = userRecord.metadata.creationTime;
        const user = await admin.firestore().collection('users').doc(postData.userId).get();

        if (!user.exists) {
            throw new functions.https.HttpsError('not-found', 'User not found.');
        }

        const { rating } = user.data();

        if (postData.locationRef) {
            const locationDoc = await postData.locationRef.get();

            postData.location = locationDoc.data();
            postData.locationRef = null;
        }

        return {
            data: postData,
            user: {
                creationTime,
                emailVerified: userRecord.emailVerified,
                name: userRecord.displayName,
                email: userRecord.email,
                phone: userRecord.phoneNumber,
                photoURL: userRecord.photoURL,
                disabled: userRecord.disabled,
                id: postData.userId,
                rating,
            },
        };
    } catch (error) {
        console.error(error);

        if (error instanceof functions.https.HttpsError) {
            throw error;
        } else {
            throw new functions.https.HttpsError('internal', 'An error occurred while fetching the post.', error.message);
        }
    }
});
