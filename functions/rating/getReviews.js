const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.getReviews = functions.https.onCall(async (data, context) => {
    try {
        const { userId } = data;

        if (!userId) {
            throw new functions.https.HttpsError('invalid-argument', 'Please provide the userId.');
        }

        const userRef = admin.firestore().collection('users').doc(userId);

        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'User not found.');
        }

        const ratingCollectionRef = userRef.collection('rating');
        const ratingCollectionSnapshot = await ratingCollectionRef.get();

        if (ratingCollectionSnapshot.empty) {
            return { success: true, reviews: [] };
        }

        const reviewsSnapshot = await ratingCollectionRef.get();
        const reviews = reviewsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return { success: true, reviews };
    } catch (error) {
        console.error(error);

        if (error instanceof functions.https.HttpsError) {
            throw error;
        } else {
            throw new functions.https.HttpsError('internal', 'An error occurred while fetching the reviews.', error.message);
        }
    }
});
