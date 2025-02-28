import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getPreviewImage } from '../utils.js';
import app from '../app.js';


const firestore = getFirestore();
const auth = getAuth(app);

export const getChatById = onCall(async (request) => {
    try {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'You must be logged in to retrieve a chat.');
        }

        const { chatId } = request.data;

        if (!chatId) {
            throw new HttpsError('invalid-argument', 'Chat ID is required.');
        }

        const chatDoc = await firestore.collection('chats')
            .doc(chatId)
            .get();

        if (!chatDoc.exists) {
            throw new HttpsError('not-found', 'Chat not found.');
        }

        const chatData = chatDoc.data();
        const currentUserId = request.auth.uid;
        const participants = [chatData.buyerId, chatData.sellerId];

        if (!participants.includes(currentUserId)) {
            throw new HttpsError('permission-denied', 'You do not have permission to read this chat');
        }

        const postId = chatData.postId;
        const participantId = participants.find(id => id !== currentUserId);

        const [
            postDoc,
            participantSnapshot,
        ] = await Promise.all([
            firestore.collection('posts').doc(postId).get(),
            auth.getUser(participantId),
        ]);

        if (!postDoc.exists) {
            throw new HttpsError('not-found', 'Post not found.');
        }

        const postData = postDoc.data();

        return {
            post: {
                id: postId,
                categoryId: postData.categoryId,
                location: postData.location,
                preview: postData.preview || getPreviewImage(postData),
                title: postData.title,
                price: postData.price,
                status: postData.status,
                isSafeDeal: postData.isSafeDeal,
                isReviewed: postData.isReviewed,
                buyerId: postData.buyerId,
                userId: postData.userId,
            },

            participant: {
                id: participantId,
                name: participantSnapshot.displayName,
                photoUrl: participantSnapshot.photoURL,
                phone: participantSnapshot.phoneNumber,
                email: participantSnapshot.email,
            },
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
