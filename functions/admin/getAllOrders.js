import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import app from '../app.js';


const firestore = getFirestore();
const auth = getAuth(app);

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

        const { id, status } = request.data;

        let query = firestore.collection('orders');

        if (status) {
            query = query.where('status', '==', status);
        }

        if (id) {
            query = query
                .where('id', '>=', id)
                .where('id', '<=', `${id}\uF8FF`);
        }

        const snapshot = await query.get();

        const orders = await Promise.all(
            snapshot.docs.map(async (doc) => {
                const orderData = doc.data();

                const [
                    sellerData,
                    buyerData,
                ] = await Promise.all([
                    auth.getUser(orderData.sellerId).catch(() => null),
                    auth.getUser(orderData.buyerId).catch(() => null),
                ]);

                const [
                    postDoc,
                    pointDoc,
                ] = await Promise.all([
                    firestore.collection('posts').doc(orderData.postId).get(),
                    firestore.collection('pickup_points').doc(orderData.pointId).get(),
                ]);

                const postData = postDoc.exists ? postDoc.data() : null;
                const pointData = pointDoc.exists ? pointDoc.data() : null;

                return {
                    orderId: doc.id,
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
                    point: pointData,
                };
            }),
        );

        return {
            orders,
        };
    } catch (error) {
        console.error(error);

        throw new HttpsError('internal', 'An error occurred while closing the post.', error.message);
    }
});
