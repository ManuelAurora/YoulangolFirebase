const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { getFirstImage, getOrderMessages } = require('../utils.js');

exports.getOrders = functions.https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'You must be authenticated to create a chat.');
        }

        const userId = context.auth.uid;

        const { status = 'sell' } = data;

        let ordersCollection;

        if (status === 'buy') {
            ordersCollection = await admin.firestore().collection('orders').where('buyerId', '==', userId).get();
        } else {
            ordersCollection = await admin.firestore().collection('orders').where('sellerId', '==', userId).get();
        }

        return await Promise.all(ordersCollection.docs.map(async orderDoc => {
            const orderData = orderDoc.data();

            const [seller, buyer, postDoc] = await Promise.all([
                admin.auth().getUser(orderData.sellerId),
                admin.auth().getUser(orderData.buyerId),
                await admin.firestore().collection('posts').doc(orderData.postId).get(),
            ]);

            if (!postDoc.exists) {
                throw new functions.https.HttpsError('not-found', 'Post not found.');
            }

            const postData = postDoc.data();

            return {
                orderId: orderDoc.id,
                id: orderData.id,
                createTime: orderData.createTime,
                status: orderData.status,
                price: orderData.price,
                messages: getOrderMessages(orderData.status, orderData.state),
                post: {
                    id: orderData.postId,
                    title: postData.title,
                    image: getFirstImage(postData.images),
                    price: postData.price,
                },
                seller: {
                    id: orderData.sellerId,
                    name: seller.displayName,
                    photoURL: seller.photoURL,
                },
                buyerId: {
                    id: orderData.buyerId,
                    name: buyer.displayName,
                    photoURL: buyer.photoURL,
                },
            };
        }));
    } catch (error) {
        console.error(error);

        if (error instanceof functions.https.HttpsError) {
            throw error;
        } else {
            throw new functions.https.HttpsError('internal', error.message, { code: 400, ...error });
        }
    }
})
