const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.closePost = functions.https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to close a post.');
        }

        const { postId } = data;

        if (!postId) {
            throw new functions.https.HttpsError('invalid-argument', 'Post ID is required and must be a string.');
        }

        const postRef = admin.firestore().collection('posts').doc(postId);
        const doc = await postRef.get();
        let postData = doc.data();
        
        if (postData.userId != context.auth.uid) {
            return 'Cannot close post that are not your own';
        }
        
        await postRef.update({
            status: 'Closed'
        });

        return { message: 'Post closed successfully.' };
    } catch (error) {
        console.error(error);

        if (error instanceof functions.https.HttpsError) {
            throw error;
        } else {
            throw new functions.https.HttpsError('internal', 'An error occurred while closing the post.', error.message);
        }
    }
});
