const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.blockPost = functions.https.onCall(async (data, context) => {
    try {
        if (!context.auth || !context.auth.token.admin) {
            throw new functions.https.HttpsError('permission-denied', 'You do not have permission to block a post.');
        }

        const { postId } = data;

        if (!postId) {
            throw new functions.https.HttpsError('invalid-argument', 'Post ID is required and must be a string.');
        }

        const postRef = admin.firestore().collection('posts').doc(postId);

        await postRef.update({
            status: 'Blocked'
        });

        return { message: 'Post blocked successfully.' };
    } catch (error) {
        console.error(error);

        if (error instanceof functions.https.HttpsError) {
            throw error;
        } else {
            throw new functions.https.HttpsError('internal', 'An error occurred while blocking the post.', error.message);
        }
    }
});
