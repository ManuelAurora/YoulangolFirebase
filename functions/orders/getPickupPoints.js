import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';


const firestore = getFirestore();

export const getPickupPoints = onCall(async () => {
    try {
        const snapshot = await firestore.collection('pickup_points').get();

        return {
            list: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        };
    } catch (error) {
        console.error('Error fetching pickup points:', error);

        throw error instanceof HttpsError ?
            error :
            new HttpsError('internal', 'Failed to fetch pickup points.', error.message);
    }
});
