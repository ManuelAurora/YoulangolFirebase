const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.sendMessage = functions.https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to send a message.');
        }

        const senderId = context.auth.uid;

        const { text, chatId } = data;

        if (!chatId) {
            throw new functions.https.HttpsError('invalid-argument', 'Chat ID is required.');
        }

        if (!text || typeof text !== 'string') {
            throw new functions.https.HttpsError('invalid-argument', 'Text message is required and must be a string.');
        }

        const chatRef = admin.firestore().collection('chats').doc(chatId);

        const messageRef = chatRef.collection('messages').doc();

        const timestamp = Date.now();

        await Promise.all([
            chatRef.update({ updatedAt: timestamp }),

            messageRef.set({
                id: messageRef.id,
                senderId,
                text,
                timestamp,
                isRead: false
            }),
        ]);

        return { success: true };
    } catch (error) {
        console.error(error);

        if (error instanceof functions.https.HttpsError) {
            throw error;
        } else {
            throw new functions.https.HttpsError('internal', 'An error occurred while sending the message.', error.message);
        }
    }
});
