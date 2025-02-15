import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';


const firestore = getFirestore();

export const getFavoritePosts_v2 = onCall(async (request) => {
    try {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'You must be logged in to get favorite posts.');
        }

        const userId = request.auth.uid;

        const userDoc = await firestore.collection('users').doc(userId).get();

        if (!userDoc.exists) {
            return [];
        }

        const { favoritePosts } = userDoc.data();

        const hasFavoritePosts = Array.isArray(favoritePosts) && favoritePosts.length;

        if (!hasFavoritePosts) {
            return [];
        }

        const favoritePostsPromises = favoritePosts.map(async (postId) => {
            const postDoc = await firestore.collection('posts').doc(postId).get();

            if (postDoc.exists) {
                const postData = postDoc.data();

                return {
                    id: postDoc.id,
                    ...postData,
                };
            }

            return null;
        });

        const favoritePostsWithData = await Promise.all(favoritePostsPromises);

        return favoritePostsWithData.filter(post => post !== null);
    } catch (error) {
        console.error(error);

        if (error instanceof HttpsError) {
            throw error;
        } else {
            throw new HttpsError('internal', 'An error occurred while getting users favorite.', error.message);
        }
    }
});
