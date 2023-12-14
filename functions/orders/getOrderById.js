const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { getFirstImage, getOrderMessages } = require('../utils.js');

exports.getOrderById = functions.https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'You must be authenticated to create a chat.');
        }

        const userId = context.auth.uid;

        const { orderId } = data;

        if (!orderId) {
            throw new functions.https.HttpsError('invalid-argument', 'orderId is required.');
        }

        const orderDoc = await admin.firestore().collection('orders').doc(orderId).get();

        if (!orderDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Order not found.');
        }

        const orderData = orderDoc.data();

        if (userId !== orderData.buyerId && userId !== orderData.sellerId) {
            throw new functions.https.HttpsError('permission-denied', 'You do not have permission to view this order');
        }

        const [seller, buyer, postDoc] = await Promise.all([
            admin.auth().getUser(orderData.sellerId),
            admin.auth().getUser(orderData.buyerId),
            await admin.firestore().collection('posts').doc(orderData.postId).get(),
        ]);

        if (!postDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Post not found.');
        }

        const postData = postDoc.data();

        if (orderData.pointId) {
            const pickupPointDoc = await admin.firestore().collection('pickup_points').doc(orderData.pointId).get();

            if (pickupPointDoc.exists) {
                const pickupPointData = pickupPointDoc.data();

                orderData.pickupPoint = {
                    id: pickupPointDoc.id,
                    ...pickupPointData
                };
            }
        }

        return {
            orderId: orderDoc.id,
            id: orderData.id,
            createTime: orderData.createTime,
            price: orderData.price,
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
            buyer: {
                id: orderData.buyerId,
                name: buyer.displayName,
                photoURL: buyer.photoURL,
            },
            point: orderData.pickupPoint,
            status: orderData.status,
            messages: getOrderMessages(orderData.status, orderData.state),
        };
    } catch (error) {
        console.error(error);

        if (error instanceof functions.https.HttpsError) {
            throw error;
        } else {
            throw new functions.https.HttpsError('internal', error.message, { code: 400, ...error });
        }
    }
})
