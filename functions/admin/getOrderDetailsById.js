import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import app from '../app.js';


const firestore = getFirestore();
const auth = getAuth(app);

export const getOrderDetailsById = onCall(async (request) => {
    try {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'You must be logged in to get this order.');
        }

        const userId = request.auth.uid;
        const userRef = firestore.collection('users').doc(userId);
        const userSnap = await userRef.get();

        if (!userSnap.exists || !userSnap.data()?.isAdmin) {
            throw new HttpsError('permission-denied', 'You do not have permission to get this order.');
        }

        const { orderId } = request.data;

        if (!orderId) {
            throw new HttpsError('invalid-argument', 'orderId is required.');
        }

        const orderDoc = await firestore.collection('orders').doc(orderId).get();

        if (!orderDoc.exists) {
            throw new HttpsError('not-found', 'Order not found.');
        }

        const orderData = orderDoc.data();

        const [sellerData, buyerData] = await Promise.all([
            auth.getUser(orderData.sellerId).catch(() => null),
            auth.getUser(orderData.buyerId).catch(() => null),
        ]);

        const postSnapshot = await firestore.collection('posts')
            .doc(orderData.postId)
            .get();

        const postData = postSnapshot.exists ? postSnapshot.data() : null;

        return {
            id: orderDoc.id,
            ...orderData,
            seller: sellerData ?
                {
                    uid: sellerData.uid,
                    email: sellerData.email,
                    displayName: sellerData.displayName,
                    photoURL: sellerData.photoURL,
                } :
                null,
            buyer: buyerData ?
                {
                    uid: buyerData.uid,
                    email: buyerData.email,
                    displayName: buyerData.displayName,
                    photoURL: buyerData.photoURL,
                } :
                null,
            post: postData,
        };
    } catch (error) {
        console.error(error);

        throw new HttpsError('internal', 'An error occurred while get the order.', error.message);
    }
});
