const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { POST_STATUSES } = require('../constants.js');

exports.closePost = functions.https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to close a post.');
        }

        const { postId, buyerId = null } = data;

        if (!postId) {
            throw new functions.https.HttpsError('invalid-argument', 'postId are required and must be strings.');
        }

        const postRef = admin.firestore().collection('posts').doc(postId);

        const doc = await postRef.get();

        if (!doc.exists) {
            throw new functions.https.HttpsError('not-found', 'Post not found.');
        }

        const postData = doc.data();

        if (postData.userId !== context.auth.uid) {
            throw new functions.https.HttpsError('permission-denied', 'You do not have permission to close this post');
        }

        await postRef.update({
            status: POST_STATUSES.CLOSED,
            buyerId: buyerId
        });

        return {
            message: 'Post closed successfully.',
            post: {
                id: postId,
                categoryId: postData.categoryId,
                location: postData.location,
                title: postData.title,
                images: postData.images,
                price: postData.price,
            }
        };
    } catch (error) {
        console.error(error);

        if (error instanceof functions.https.HttpsError) {
            throw error;
        } else {
            throw new functions.https.HttpsError('internal', 'An error occurred while closing the post.', error.message);
        }
    }
});
