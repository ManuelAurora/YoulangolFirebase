const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.purchasePost = functions.https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to purchase a post.');
        }

        const userId = context.auth.uid;

        const { postId } = data;

        if (!postId) {
            throw new functions.https.HttpsError('invalid-argument', 'postId is required.');
        }

        const postRef = admin.firestore().collection('posts').doc(postId);
        const postDoc = await postRef.get();

        if (!postDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Post not found.');
        }

        const postData = postDoc.data();

        if (postData.userId === userId) {
            throw new functions.https.HttpsError('permission-denied', 'You cannot purchase your own post.');
        }

        if (postData.status !== 'Open') {
            throw new functions.https.HttpsError('permission-denied', 'This post is not available for purchase.');
        }

        await postRef.update({
            status: 'InReserve'
        });

        return { message: 'Post purchased successfully.' };
    } catch (error) {
        console.error(error);

        if (error instanceof functions.https.HttpsError) {
            throw error;
        } else {
            throw new functions.https.HttpsError('internal', 'An error occurred while purchasing the post.', error.message);
        }
    }
});
