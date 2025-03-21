import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { POST_STATUSES, ORDER_STATUSES, ORDER_STATES } from '../constants.js';


const firestore = getFirestore();

export const createOrder = onCall(async (request) => {
    try {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'You must be authenticated to create an order.');
        }

        const buyerId = request.auth.uid;
        const { postId, pointId } = request.data;

        if (!postId) {
            throw new HttpsError('invalid-argument', 'postId is required.');
        }

        if (!pointId) {
            throw new HttpsError('invalid-argument', 'pointId is required.');
        }


        const existingOrderQuery = await firestore.collection('orders')
            .where('buyerId', '==', buyerId)
            .where('postId', '==', postId)
            .limit(1)
            .get();

        if (!existingOrderQuery.empty) {
            const existingOrder = existingOrderQuery.docs[0];

            return { orderId: existingOrder.id };
        }


        const postDoc = await firestore.collection('posts').doc(postId)
            .get();

        if (!postDoc.exists) {
            throw new HttpsError('not-found', 'Post not found.');
        }

        const post = postDoc.data();

        if (post.status !== POST_STATUSES.OPEN) {
            throw new HttpsError('permission-denied', 'Invalid post status. Only open posts can be ordered.');
        }

        const sellerId = post.userId;

        if (buyerId === sellerId) {
            throw new HttpsError('permission-denied', 'Buyer and seller cannot be the same user.');
        }


        const existingChatQuery = await firestore.collection('chats')
            .where('postId', '==', postId)
            .where('buyerId', '==', buyerId)
            .limit(1)
            .get();

        let chatId = '';

        if (!existingChatQuery.empty) {
            const existingChat = existingChatQuery.docs[0];

            chatId = existingChat.id;
        } else {
            const newChatRef = firestore.collection('chats').doc();


            const createdAt = Date.now();

            await newChatRef.set({
                chatId,
                postId,
                sellerId,
                buyerId,
                createdAt,
                updatedAt: createdAt,
            });

            chatId = newChatRef.id;
        }


        const createdAt = Date.now();

        const orderData = {
            id: `${createdAt}`,
            postId,
            sellerId,
            buyerId,
            chatId,
            pointId,
            createdAt,
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
