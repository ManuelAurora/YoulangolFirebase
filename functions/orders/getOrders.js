import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getFirstImage, getOrderMessages } from '../utils.js';
import app from '../app.js';


const firestore = getFirestore();
const auth = getAuth(app);

export const getOrders = onCall(async (request) => {
    try {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'You must be authenticated to fetch orders.');
        }

        const userId = request.auth.uid;
        const { status = 'sell' } = request.data;

        const field = status === 'buy' ? 'buyerId' : 'sellerId';
        const ordersSnapshot = await firestore
            .collection('orders')
            .where(field, '==', userId)
            .get();


        if (ordersSnapshot.empty) {
            return [];
        }

        return Promise.all(
            ordersSnapshot.docs.map(async (orderDoc) => {
                const orderData = orderDoc.data();
                const { sellerId, buyerId, postId } = orderData;

                const [seller, buyer, postDoc] = await Promise.all([
                    auth.getUser(sellerId),
                    auth.getUser(buyerId),
                    firestore.collection('posts').doc(postId).get(),
                ]);

                if (!postDoc.exists) {
                    console.warn(`Post not found: ${postId}`);

                    return null;
                }

                const postData = postDoc.data();

                return {
                    orderId: orderDoc.id,
                    ...orderData,
                    messages: getOrderMessages(orderData.status, orderData.state),
                    post: {
                        id: postId,
                        title: postData.title,
                        image: getFirstImage(postData.images),
                        price: postData.price,
                    },
                    seller: {
                        id: sellerId,
                        name: seller.displayName || '',
                        photoURL: seller.photoURL || '',
                    },
                    buyer: {
                        id: buyerId,
                        name: buyer.displayName || '',
                        photoURL: buyer.photoURL || '',
                    },
                };
            }),
        ).then(orders => orders.filter(Boolean));
    } catch (error) {
        console.error('Error fetching orders:', error);

        throw error instanceof HttpsError ?
            error :
            new HttpsError('internal', 'Failed to fetch orders.', error.message);
    }
});
