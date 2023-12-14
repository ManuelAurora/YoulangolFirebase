const functions = require('firebase-functions');
const admin = require('firebase-admin');
const {
    POST_STATUSES,
    ORDER_STATUSES,
    ORDER_STATES
} = require('../constants.js');

exports.createOrder = functions.https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
           throw new functions.https.HttpsError('unauthenticated', 'You must be authenticated to create a chat.');
        }

        const userId = context.auth.uid;

        const { postId, pointId } = data;

        if (!postId) {
            throw new functions.https.HttpsError('invalid-argument', 'postId is required.');
        }

        if (!pointId) {
            throw new functions.https.HttpsError('invalid-argument', 'pointId is required.');
        }

        const postDoc = await admin.firestore().collection('posts').doc(postId).get();

        if (!postDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Post not found');
        }

        const post = postDoc.data();

        if (post.status !== POST_STATUSES.OPEN) {
            throw new functions.https.HttpsError('permission-denied', 'Invalid post status. Only open posts can be ordered.');
        }

        if (userId === post.userId) {
            throw new functions.https.HttpsError('permission-denied', 'Buyer and seller cannot be the same user.');
        }

        const existingOrderQuery = await admin.firestore().collection('orders')
            .where('buyerId', '==', userId)
            .where('postId', '==', postId)
            .limit(1)
            .get();

        if (!existingOrderQuery.empty) {
            throw new functions.https.HttpsError('already-exists', 'Order already exists for this user and postId.');
        }

        const createTime = Date.now()

        const DELIVERY_FEE = 228; // @todo: придумать как быть с комиссией

        const orderData = {
            status: ORDER_STATUSES.ACTIVE,
            id: createTime,
            createTime,
            price: post.price + DELIVERY_FEE,
            state: {
                [ORDER_STATES.IS_APPROVED]: false,
                [ORDER_STATES.IS_PAID]: false,
                [ORDER_STATES.IS_DELIVERED]: false,
                [ORDER_STATES.IS_SOLD]: false,
                [ORDER_STATES.IS_PAYMENT_RECEIVED]: false,
            },
            sellerId: post.userId,
            buyerId: userId,
            postId,
            pointId,
        };

        const orderRef = await admin.firestore().collection('orders').add(orderData);

        return { success: true, message: 'success', orderId: orderRef.id };

    } catch (error) {
        console.error(error);

        if (error instanceof functions.https.HttpsError) {
            throw error;
        } else {
            throw new functions.https.HttpsError('internal', error.message, { code: 400, ...error });
        }
    }
})
