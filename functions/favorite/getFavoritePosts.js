const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.getFavoritePosts = functions.https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to get favorite posts.');
        }

        const userId = context.auth.uid;
        const userDoc = await admin.firestore().collection('users').doc(userId).get();

        if (!userDoc.exists) {
            throw new Error('User not found.');
        }

        const { favoritePosts } = userDoc.data();

        const hasFavoritePosts = Array.isArray(favoritePosts) && favoritePosts.length;

        if (!hasFavoritePosts) {
            return [];
        }

        const favoritePostsPromises = favoritePosts.map(async (postId) => {
            const postDoc = await admin.firestore().collection('posts').doc(postId).get();

            if (postDoc.exists) {
                const postData = postDoc.data();

                return {
                    id: postDoc.id,
                    ...postData
                };
            }

            return null;
        });

        const favoritePostsWithData = await Promise.all(favoritePostsPromises);

        return favoritePostsWithData.filter((post) => post !== null);
    } catch (error) {
        console.error(error);

        if (error instanceof functions.https.HttpsError) {
            throw error;
        } else {
            throw new functions.https.HttpsError('internal', 'An error occurred while getting users favorite.', error.message);
        }
    }
});
