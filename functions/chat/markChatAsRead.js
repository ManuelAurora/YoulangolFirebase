const functions = require('firebase-functions');
const admin = require('firebase-admin');


exports.markChatAsRead = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to mark the chat as read.');
    }

    const { chatId } = data;
    const userId = context.auth.uid;

    try {
        const chatRef = admin.firestore().collection('chats').doc(chatId);
        const chatDoc = await chatRef.get();

        if (!chatDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Chat not found');
        }

        const chatData = chatDoc.data();

        if (chatData.user1 !== userId && chatData.user2 !== userId) {
            throw new functions.https.HttpsError('permission-denied', 'You do not have permission to mark this chat as read');
        }

        const messagesRef = chatRef.collection('messages');
        const querySnapshot = await messagesRef.where('isRead', '==', false).get();

        const updatePromises = querySnapshot.docs.map(doc => {
            const messageRef = messagesRef.doc(doc.id);
            return messageRef.update({ isRead: true });
        });

        await Promise.all(updatePromises);

        return { success: true, message: 'Chat marked as read' };
    } catch (error) {
        throw new functions.https.HttpsError('internal', 'An error occurred while marking the chat as read.', error.message);
    }
});
