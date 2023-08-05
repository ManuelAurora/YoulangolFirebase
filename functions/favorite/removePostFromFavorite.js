const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.removePostFromFavorite = functions.https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to remove post from favorite.');
        }

        const userId = context.auth.uid;

        const postId = data.postId;

        if (!postId) {
            throw new functions.https.HttpsError('invalid-argument', 'Post ID is required.');
        }

        const userRef = admin.firestore().collection('users').doc(userId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            throw new Error('User not found.');
        }

        await userRef.update({
            favoritePosts: admin.firestore.FieldValue.arrayRemove(postId),
        });

        const updatedUserDoc = await userRef.get();
        const updatedFavoritePosts = updatedUserDoc.data().favoritePosts || [];

        return { success: true, favoritePosts: updatedFavoritePosts };
    } catch (error) {
        console.error(error);

        if (error instanceof functions.https.HttpsError) {
            throw error;
        } else {
            throw new functions.https.HttpsError('internal', error.toString(), { code: 400, ...error });
        }
    }
});
