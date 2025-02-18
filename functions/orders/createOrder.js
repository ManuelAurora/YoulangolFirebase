import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { POST_STATUSES, ORDER_STATUSES, ORDER_STATES } from '../constants.js';


const firestore = getFirestore();

export const createOrder = onCall(async (request) => {
    try {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'You must be authenticated to create an order.');
        }

        const userId = request.auth.uid;
        const { postId, pointId } = request.data;

        if (!postId) {
            throw new HttpsError('invalid-argument', 'postId is required.');
        }

        if (!pointId) {
            throw new HttpsError('invalid-argument', 'pointId is required.');
        }


        const existingOrderQuery = await firestore.collection('orders')
            .where('buyerId', '==', userId)
            .where('postId', '==', postId)
            .limit(1)
            .get();

        if (!existingOrderQuery.empty) {
            const existingOrder = existingOrderQuery.docs[0];

            return { orderId: existingOrder.id };
        }


        const postDoc = await firestore.collection('posts').doc(postId).get();

        if (!postDoc.exists) {
            throw new HttpsError('not-found', 'Post not found.');
        }

        const post = postDoc.data();

        if (post.status !== POST_STATUSES.OPEN) {
            throw new HttpsError('permission-denied', 'Invalid post status. Only open posts can be ordered.');
        }

        if (userId === post.userId) {
            throw new HttpsError('permission-denied', 'Buyer and seller cannot be the same user.');
        }

        const createTime = Date.now();

        const orderData = {
            id: createTime,
            postId,
            sellerId: post.userId,
            buyerId: userId,
            pointId,
            createTime,
            price: post.price,
            status: ORDER_STATUSES.ACTIVE,
            state: {
                [ORDER_STATES.IS_APPROVED]: false,
                [ORDER_STATES.IS_PAID]: false,
                [ORDER_STATES.IS_DELIVERED]: false,
                [ORDER_STATES.IS_SOLD]: false,
                [ORDER_STATES.IS_PAYMENT_RECEIVED]: false,
            },
        };

        const orderRef = await firestore.collection('orders').add(orderData);

        return { orderId: orderRef.id };
    } catch (error) {
        console.error(error);

        if (error instanceof HttpsError) {
            throw error;
        } else {
            throw new HttpsError('internal', error.message, { code: 400, ...error });
        }
    }
});
