const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.sendMessage = functions.https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to send a message.');
        }

        const { text, chatId } = data;
        const senderId = context.auth.uid;
        const timestamp = Date.now();

        if (!text || typeof text !== 'string') {
            throw new functions.https.HttpsError('invalid-argument', 'Text message is required and must be a string.');
        }

        const chatRef = admin.firestore().collection('chats').doc(chatId);
        const messageRef = chatRef.collection('messages').doc();

        const messageData = {
            id: messageRef.id,
            senderId,
            text,
            timestamp,
            isRead: false
        };

        await Promise.all([
            messageRef.set(messageData),
            chatRef.update({
                messages: admin.firestore.FieldValue.arrayUnion(messageData),
                updatedAt: timestamp,
            }),
        ]);

        // notification
        // const payload = {
        //     notification: {
        //         title: 'New message',
        //         body: `You have a new message from ${senderId}`,
        //         icon: '/assets/icons/icon-96x96.png',
        //         clickAction: `https://${process.env.GCLOUD_PROJECT}.firebaseapp.com/chat/${chatId}`
        //     }
        // };
        // await admin.messaging().sendToTopic(chatRef.path, payload);

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
