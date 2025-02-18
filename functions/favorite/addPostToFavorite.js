import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';


const firestore = getFirestore();

export const addPostToFavorite = onCall(async (request) => {
    try {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'You must be logged in to add a post to favorites.');
        }

        const userId = request.auth.uid;
        const { postId } = request.data;

        if (!postId) {
            throw new HttpsError('invalid-argument', 'Post ID is required.');
        }

        const userRef = firestore.collection('users').doc(userId);

        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            await userRef.set({ favoritePosts: [postId] });

            return { favoritePosts: [postId] };
        }

        await userRef.update({
            favoritePosts: FieldValue.arrayUnion(postId),
        });

        const updatedUserDoc = await userRef.get();

        const updatedFavoritePosts = updatedUserDoc.data().favoritePosts || [];

        return { favoritePosts: updatedFavoritePosts };
    } catch (error) {
        console.error(error);
        throw new HttpsError('internal', 'An error occurred while adding the post to favorites.', error.message);
    }
});
