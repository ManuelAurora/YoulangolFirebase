import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { ORDER_STATES } from '../constants.js';


const firestore = getFirestore();

export const updateOrder = onCall(async (request) => {
    try {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'You must be logged in to update this order.');
        }

        const userId = request.auth.uid;
        const userRef = firestore.collection('users').doc(userId);
        const userSnap = await userRef.get();

        if (!userSnap.exists || !userSnap.data()?.isAdmin) {
            throw new HttpsError('permission-denied', 'You do not have permission to update this order.');
        }

        const { orderId, state } = request.data;

        if (!orderId || typeof state !== 'object' || Object.keys(state).length === 0) {
            throw new HttpsError('invalid-argument', 'orderId and state are required.');
        }

        const orderRef = firestore.collection('orders').doc(orderId);
        const orderSnap = await orderRef.get();

        if (!orderSnap.exists) {
            throw new HttpsError('not-found', 'Заказ не найден.');
        }

        const updates = {};
        const historyUpdates = {};
        const timestamp = Date.now();

        for (const key of Object.values(ORDER_STATES)) {
            if (state.hasOwnProperty(key)) {
                updates[`state.${key}`] = state[key];
                historyUpdates[`history.${key}`] = { time: timestamp, user: userId, value: state[key] };
            }
        }

        const changes = { ...updates, ...historyUpdates };

        if (Object.keys(changes).length) {
            await orderRef.update(changes);
        }

        return { message: 'done.' };
    } catch (error) {
        console.error(error);

        throw new HttpsError('internal', 'An error occurred while closing the post.', error.message);
    }
});
