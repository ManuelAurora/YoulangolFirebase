import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { POST_STATUSES, ORDER_STATES } from '../constants.js';


const firestore = getFirestore();

export const approveOrder_v2 = onCall(async (request) => {
    try {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'You must be authenticated to approve an order.');
        }

        const userId = request.auth.uid;
        const { orderId } = request.data;

        if (!orderId) {
            throw new HttpsError('invalid-argument', 'orderId is required.');
        }

        const orderRef = firestore.collection('orders').doc(orderId);

        const orderDoc = await orderRef.get();

        if (!orderDoc.exists) {
            throw new HttpsError('not-found', 'Order not found.');
        }

        const order = orderDoc.data();

        if (userId !== order.sellerId) {
            throw new HttpsError('permission-denied', 'You do not have permission to approve this order.');
        }

        await orderRef.update({
            state: {
                ...order.state,
                [ORDER_STATES.IS_APPROVED]: true,
            },
            history: {
                ...order.history,
                [ORDER_STATES.IS_APPROVED]: {
                    time: Date.now(),
                    user: userId,
                },
            },
        });

        await firestore.collection('posts')
            .doc(order.postId)
            .update({
                status: POST_STATUSES.HOLD,
            });

        return orderRef.id;
    } catch (error) {
        console.error(error);

        if (error instanceof HttpsError) {
            throw error;
        } else {
            throw new HttpsError('internal', error.message, { code: 400, ...error });
        }
    }
});
