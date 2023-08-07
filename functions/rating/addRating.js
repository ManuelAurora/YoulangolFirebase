const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.addRating = functions.https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to add a rating.');
        }
        const userId = context.auth.uid;

        const { postId, sellerId, rating, message } = data;

        if (!postId || !rating || !sellerId) {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid data. Please provide postId, rating and sellerId.');
        }

        if (typeof rating !== 'number' || rating < 1 || rating > 5) {
            throw new functions.https.HttpsError('invalid-argument', 'Rating must be a number between 1 and 5.');
        }

        const postRef = admin.firestore().collection('posts').doc(postId);
        const postDoc = await postRef.get();

        if (!postDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Post not found.');
        }

        const postData = postDoc.data();

        if (postData.buyerId !== userId) {
            throw new functions.https.HttpsError('permission-denied', 'You are not authorized to add a rating for this post.');
        }

        if (postData.isReviewed) {
            throw new functions.https.HttpsError('already-exists', 'A review for this post has already been submitted.');
        }

        const sellerRef = admin.firestore().collection('users').doc(sellerId);
        const sellerDoc = await sellerRef.get();

        if (!sellerDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Seller not found.');
        }

        const userRecord = await admin.auth().getUser(userId);

        const ratingRef = sellerRef.collection('rating').doc();

        await ratingRef.set({
            author: {
                id: userId,
                name: userRecord.displayName || '',
                photoURL: userRecord.photoURL || '',
            },
            product: {
                id: postId,
                name: postData.title,
            },
            rating,
            message,
            createdAt: Date.now(),
        });

        const ratingsSnapshot = await sellerRef.collection('rating').get();
        const totalRatings = ratingsSnapshot.size;
        const sum = ratingsSnapshot.docs.reduce((total, doc) => total + doc.data().rating, 0);

        const averageRating = Math.round((sum / totalRatings) * 100) / 100;

        await sellerRef.update({ rating: averageRating });

        await postRef.update({ isReviewed: true });

        return { success: true };
    } catch (error) {
        console.error(error);

        if (error instanceof functions.https.HttpsError) {
            throw error;
        } else {
            throw new functions.https.HttpsError('internal', 'An error occurred while adding the rating.', error.message);
        }
    }
});
