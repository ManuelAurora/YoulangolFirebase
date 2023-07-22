const functions = require('firebase-functions');
const admin = require('firebase-admin');


exports.closePost = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to close a post.');
    }

    const postId = data.postId;

    try {
        const postRef = admin.firestore().collection('posts').doc(postId);

        await postRef.update({
            status: 'Closed'
        });

        return { message: 'Post closed successfully.' };
    } catch (error) {
        throw new functions.https.HttpsError('internal', 'An error occurred while closing the post.', error.message);
    }
});
