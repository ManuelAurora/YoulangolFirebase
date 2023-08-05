const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.addPostToFavorite = functions.https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to add post to favorite.');
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

        if (!userDoc.data().favoritePosts) {
            await userRef.set({ favoritePosts: [] }, { merge: true });
        }

        await userRef.update({
            favoritePosts: admin.firestore.FieldValue.arrayUnion(postId),
        });

        const updatedUserDoc = await userRef.get();
        const updatedFavoritePosts = updatedUserDoc.data().favoritePosts || [];

        return { success: true, favoritePosts: updatedFavoritePosts };
    } catch (error) {
        console.error(error);

        if (error instanceof functions.https.HttpsError) {
            throw error;
        } else {
            throw new functions.https.HttpsError('internal', error.message, { code: 400, ...error });
        }
    }
});
