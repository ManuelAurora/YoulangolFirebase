const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.getPickupPoints = functions.https.onCall(async () => {
    try {
        const pickupPointsCollection = admin.firestore().collection('pickup_points');
        const pickupPointsSnapshot = await pickupPointsCollection.get();

        if (pickupPointsSnapshot.empty) {
            return {
                list: []
            };
        }

        const pickupPoints = pickupPointsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return {
            list: pickupPoints
        };
    } catch (error) {
        console.error(error);

        if (error instanceof functions.https.HttpsError) {
            throw error;
        } else {
            throw new functions.https.HttpsError('internal', 'An error occurred while fetching the reviews.', error.message);
        }
    }
});
