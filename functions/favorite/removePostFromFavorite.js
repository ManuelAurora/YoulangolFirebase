import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";


const firestore = getFirestore();

export const removePostFromFavorite_v2 = onCall(async (request) => {
    try {
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "You must be logged in to remove post from favorite.");
        }

        const userId = request.auth.uid;
        const postId = request.data.postId;

        if (!postId) {
            throw new HttpsError("invalid-argument", "Post ID is required.");
        }

        const userRef = firestore.collection("users").doc(userId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            await userRef.set({ favoritePosts: [] });

            return {
                success: true,
                favoritePosts: [],
            };
        }

        await userRef.update({
            favoritePosts: FieldValue.arrayRemove(postId),
        });

        const updatedUserDoc = await userRef.get();
        const updatedFavoritePosts = updatedUserDoc.data().favoritePosts || [];

        return { favoritePosts: updatedFavoritePosts };
    } catch (error) {
        console.error(error);

        if (error instanceof HttpsError) {
            throw error;
        } else {
            throw new HttpsError("internal", error.message);
        }
    }
});
