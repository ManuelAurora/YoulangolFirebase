import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { POST_STATUSES } from '../constants.js';


const firestore = getFirestore();

export const closePost = onCall(async (request) => {
    try {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'You must be logged in to close a post.');
        }

        const { postId, buyerId = null } = request.data;

        if (!postId) {
            throw new HttpsError('invalid-argument', 'postId is required and must be a string.');
        }

        const postRef = firestore.collection('posts').doc(postId);

        const doc = await postRef.get();

        if (!doc.exists) {
            throw new HttpsError('not-found', 'Post not found.');
        }

        const postData = doc.data();

        if (postData.userId !== request.auth.uid) {
            throw new HttpsError('permission-denied', 'You do not have permission to close this post.');
        }

        if (postData.status !== POST_STATUSES.OPEN) {
            throw new HttpsError('permission-denied', 'You cannot close this post.');
        }

        // @todo: Добавить проверку на ордеры - нужно ли если статус hold у постов с ордерами

        await postRef.update({
            status: POST_STATUSES.CLOSED,
            buyerId,
        });

        return {
            message: 'Post closed successfully.',
            post: {
                id: postId,
                categoryId: postData.categoryId,
                location: postData.location,
                title: postData.title,
                images: postData.images,
                price: postData.price,
            },
        };
    } catch (error) {
        console.error(error);

        throw new HttpsError('internal', 'An error occurred while closing the post.', error.message);
    }
});
