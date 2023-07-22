const functions = require('firebase-functions');
const admin = require('firebase-admin');


exports.purchasePost = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to purchase a post.');
    }

    const postId = data.postId;

    try {
        const postRef = admin.firestore().collection('posts').doc(postId);

        await postRef.update({
            status: 'InReserve'
        });

        return { message: 'Post purchased successfully.' };
    } catch (error) {
        throw new functions.https.HttpsError('internal', 'An error occurred while purchasing the post.', error.message);
    }
});
