const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.addRating = functions.https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to add a rating.');
        }

        const { productName, rating, sellerId, message } = data;

        if (!productName || typeof rating !== 'number' || rating < 1 || rating > 5 || !sellerId) {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid data. Please provide productName, rating (a number between 1 and 5), and sellerId.');
        }

        const sellerRef = admin.firestore().collection('users').doc(sellerId);

        const sellerDoc = await sellerRef.get();

        if (!sellerDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Seller not found.');
        }

        const ratingRef = sellerRef.collection('rating').doc();
        const newRating = { productName, rating, createdAt: admin.firestore.Timestamp.now().toMillis(), message };
        await ratingRef.set(newRating);

        const ratingsSnapshot = await sellerRef.collection('rating').get();
        const totalRatings = ratingsSnapshot.size;
        const sum = ratingsSnapshot.docs.reduce((total, doc) => total + doc.data().rating, 0);
        const averageRating = Math.round((sum / totalRatings) * 100) / 100;

        await sellerRef.update({ rating: averageRating });

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
