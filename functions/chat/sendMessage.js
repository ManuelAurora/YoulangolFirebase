import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';


const firestore = getFirestore();

export const sendMessage_v2 = onCall(async (request) => {
    try {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'You must be logged in to send a message.');
        }

        const senderId = request.auth.uid;
        const { text, chatId } = request.data;

        if (!chatId) {
            throw new HttpsError('invalid-argument', 'Chat ID is required.');
        }

        if (!text || typeof text !== 'string') {
            throw new HttpsError('invalid-argument', 'Text message is required and must be a string.');
        }

        const chatRef = firestore.collection('chats').doc(chatId);
        const messageRef = chatRef.collection('messages').doc();

        const timestamp = Date.now();

        await Promise.all([
            chatRef.update({ updatedAt: timestamp }),
            messageRef.set({
                id: messageRef.id,
                senderId,
                text,
                timestamp,
                isRead: false,
            }),
        ]);

        return { success: true };
    } catch (error) {
        console.error(error);

        if (error instanceof HttpsError) {
            throw error;
        } else {
            throw new HttpsError('internal', 'An error occurred while sending the message.', error.message);
        }
    }
});
