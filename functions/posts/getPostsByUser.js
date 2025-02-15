import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { POST_STATUSES } from '../constants.js';


const firestore = getFirestore();

export const getPostsByUser_v2 = onCall(async (request) => {
    try {
        const { userId, status } = request.data;

        if (!userId) {
            throw new HttpsError('invalid-argument', 'User ID is required.');
        }

        let query = firestore.collection('posts')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc');


        const isValidStatus = status && Object.values(POST_STATUSES).includes(status);


        if (isValidStatus) {
            query = query.where('status', '==', status);
        }

        const snapshot = await query.get();

        return await Promise.all(
            snapshot.docs.map(async doc => ({
                id: doc.id,
                ...doc.data(),
            })),
        );
    } catch (error) {
        console.error(error);

        if (error instanceof HttpsError) {
            throw error;
        } else {
            throw new HttpsError('internal', 'An error occurred while fetching posts by user.');
        }
    }
});
