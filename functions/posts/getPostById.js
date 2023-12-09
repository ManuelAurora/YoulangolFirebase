const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.getPostById = functions.https.onCall(async (data) => {
    try {
        const { postId } = data;

        if (!postId) {
            throw new functions.https.HttpsError('invalid-argument', 'Post ID is required.');
        }

        const postDoc = await admin.firestore().collection('posts')
            .doc(postId)
            .get();

        if (!postDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Post not found.');
        }

        const postData = postDoc.data();

        const [userRecord, userDoc] = await Promise.all([
            admin.auth().getUser(postData.userId),
            admin.firestore().collection('users').doc(postData.userId).get()
        ]);

        if (!userDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'User not found.');
        }

        const { rating } = userDoc.data();

        return {
            post: {
                id: postDoc.id,
                ...postData
            },
            user: {
                id: postData.userId,
                creationTime: userRecord.metadata.creationTime,
                emailVerified: userRecord.emailVerified,
                name: userRecord.displayName,
                photoURL: userRecord.photoURL,
                disabled: userRecord.disabled,
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
