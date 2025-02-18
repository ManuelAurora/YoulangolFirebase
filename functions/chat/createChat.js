import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';


const firestore = getFirestore();

export const createChat = onCall(async (request) => {
    try {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'You must be authenticated to create a chat.');
        }

        const buyerId = request.auth.uid;

        const { postId } = request.data;

        if (!postId) {
            throw new HttpsError('invalid-argument', 'post Id are required.');
        }


        const existingChatQuery = await firestore.collection('chats')
            .where('postId', '==', postId)
            .where('buyerId', '==', buyerId)
            .limit(1)
            .get();

        if (!existingChatQuery.empty) {
            const existingChat = existingChatQuery.docs[0];

            return { chatId: existingChat.id };
        }


        const postDoc = await firestore.collection('posts')
            .doc(postId)
            .get();

        if (!postDoc.exists) {
            throw new HttpsError('not-found', 'Post not found.');
        }

        const post = postDoc.data();
        const sellerId = post.userId;

        if (buyerId === sellerId) {
            throw new HttpsError('invalid-argument', 'Sender and receiver cannot be the same.');
        }

        const newChatRef = firestore.collection('chats').doc();
        const chatId = newChatRef.id;

        const createdAt = Date.now();

        await newChatRef.set({
            chatId,
            postId,
            sellerId,
            buyerId,
            createdAt,
            updatedAt: createdAt,
        });

        return { chatId };
    } catch (error) {
        console.error(error);

        if (error instanceof HttpsError) {
            throw error;
        } else {
            throw new HttpsError('internal', 'An error occurred while creating the chat.', error.message);
        }
    }
});
