const functions = require('firebase-functions');
const admin = require('firebase-admin');


exports.addRating = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to add a rating.');
    }

    const { productName, rating, sellerId, message } = data;

    const sellerRef = admin.firestore().collection('users').doc(sellerId);

    const ratingRef = sellerRef.collection('rating').doc();
    const newRating = { productName, rating, createdAt: admin.firestore.Timestamp.now().toMillis(), message };
    await ratingRef.set(newRating);

    const ratingsSnapshot = await sellerRef.collection('rating').get();
    const totalRatings = ratingsSnapshot.size;
    const sum = ratingsSnapshot.docs.reduce((total, doc) => total + doc.data().rating, 0);
    const averageRating = Math.round((sum / totalRatings) * 100) / 100;

    await sellerRef.update({ rating: averageRating });

    return { success: true };
});
