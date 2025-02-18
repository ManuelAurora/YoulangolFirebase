import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getFirstImage, getOrderMessages } from '../utils.js';
import app from '../app.js';


const auth = getAuth(app);
const firestore = getFirestore();

export const getOrderById = onCall(async (request) => {
    try {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'You must be authenticated.');
        }

        const userId = request.auth.uid;
        const { orderId } = request.data;

        if (!orderId) {
            throw new HttpsError('invalid-argument', 'orderId is required.');
        }

        const orderDoc = await firestore.collection('orders').doc(orderId)
            .get();

        if (!orderDoc.exists) {
            throw new HttpsError('not-found', 'Order not found.');
        }

        const orderData = orderDoc.data();

        if (![orderData.buyerId, orderData.sellerId].includes(userId)) {
            throw new HttpsError('permission-denied', 'You do not have permission to view this order.');
        }

        const [seller, buyer, postDoc, pickupPointDoc] = await Promise.all([
            auth.getUser(orderData.sellerId),
            auth.getUser(orderData.buyerId),
            firestore.collection('posts').doc(orderData.postId).get(),
            orderData.pointId ? firestore.collection('pickup_points').doc(orderData.pointId).get() : null,
        ]);

        if (!postDoc.exists) {
            throw new HttpsError('not-found', 'Post not found.');
        }

        const postData = postDoc.data();
        const pickupPointData = pickupPointDoc?.exists ? pickupPointDoc.data() : null;

        return {
            orderId: orderDoc.id,
            id: orderData.id,
            createTime: orderData.createTime,
            price: orderData.price,
            post: {
                id: orderData.postId,
                title: postData.title,
                description: postData.description,
                category: postData.category,
                images: postData.images,
                image: getFirstImage(postData.images),
                price: postData.price,
                location: postData.location,
            },
            seller: {
                id: seller.uid,
                name: seller.displayName,
                email: seller.email,
                phoneNumber: seller.phoneNumber,
                photoURL: seller.photoURL,
            },
            buyer: {
                id: buyer.uid,
                name: buyer.displayName,
                email: buyer.email,
                phoneNumber: buyer.phoneNumber,
                photoURL: buyer.photoURL,
            },
            pickupPoint: pickupPointData ?
                {
                    id: pickupPointDoc?.id,
                    name: pickupPointData.name,
                    address: pickupPointData.address,
                    coordinates: pickupPointData.coordinates,
                    workingHours: pickupPointData.workingHours,
                } :
                null,
            status: orderData.status,
            messages: getOrderMessages(orderData.status, orderData.state),
        };
    } catch (error) {
        console.error(error);

        if (error instanceof HttpsError) {
            throw error;
        } else {
            throw new HttpsError('internal', error.message, { code: 400, ...error });
        }
    }
});
