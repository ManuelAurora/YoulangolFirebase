const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { POST_STATUSES, ORDER_STATES } = require('../constants.js');

exports.approveOrder = functions.https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'You must be authenticated to create a chat.');
        }

        const userId = context.auth.uid;

        const { orderId } = data;

        if (!orderId) {
            throw new functions.https.HttpsError('invalid-argument', 'orderId is required.');
        }

        const orderRef = admin.firestore().collection('orders').doc(orderId);

        const orderDoc = await orderRef.get();

        if (!orderDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Order not found');
        }

        const order = orderDoc.data();

        if (userId !== order.sellerId) {
            throw new functions.https.HttpsError('permission-denied', ' You do not have permission to approve this order');
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
                }
            },
        });

        await admin.firestore().collection('posts').doc(order.postId).update({
            // buyerId: order.buyerId, // @todo: обновлять после продажи
            status: POST_STATUSES.HOLD,
        });

        return orderRef.id;
    } catch (error) {
        console.error(error);

        if (error instanceof functions.https.HttpsError) {
            throw error;
        } else {
            throw new functions.https.HttpsError('internal', error.message, { code: 400, ...error });
        }
    }
})
