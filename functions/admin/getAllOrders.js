import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';


const firestore = getFirestore();

export const getAllOrders = onCall(async (request) => {
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

        const { orderId, id, status } = request.data;

        let query = firestore.collection("orders");

        if (orderId) {
            const orderDoc = await query.doc(orderId).get();

            if (!orderDoc.exists) {
                return {
                    orders: [],
                };
            }

            return {
                orders: [{
                    id: orderDoc.id,
                    ...orderDoc.data(),
                }],
            };
        }

        if (id) {
            query = query.where("id", "==", id);

            const snapshot = await query.get();

            const orders = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));

            return {
                orders,
            };
        }

        if (status) {
            query = query.where("status", "==", status);
        }

        const snapshot = await query.get();

        const orders = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));

        return {
            orders,
        };
    } catch (error) {
        console.error(error);

        throw new HttpsError('internal', 'An error occurred while closing the post.', error.message);
    }
});
