const functions = require('firebase-functions');
const admin = require('firebase-admin');


exports.sendMessage = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to send a message.');
    }

    const { text, chatId } = data;
    const senderId = context.auth.uid;
    const timestamp = admin.firestore.Timestamp.now().toMillis()

    const chatRef = admin.firestore().doc(`chats/${chatId}`);
    const messageRef = chatRef.collection('messages').doc(); // Create a new document reference

    const messageData = {
        id: messageRef.id, // Set the id field with the value of the document's ref.id
        senderId,
        text,
        timestamp,
        isRead: false
    };

    try {
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
        throw new functions.https.HttpsError('internal', error.message, { code: 400, ...error });
    }
});
