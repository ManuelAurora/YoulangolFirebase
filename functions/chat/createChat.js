const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.createChat = functions.https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'You must be authenticated to create a chat.');
        }

        const { senderId, receiverId, postId } = data;

        if (!senderId || !receiverId || !postId) {
            throw new functions.https.HttpsError('invalid-argument', 'Sender, receiver and post IDs are required.');
        }

        if (senderId === receiverId) {
            throw new functions.https.HttpsError('invalid-argument', 'Sender and receiver IDs cannot be the same.');
        }

        const existingChatQuery = await admin.firestore().collection('chats')
            .where('postId', '==', postId)
            .where('participants', 'array-contains-any', [senderId, receiverId])
            .limit(1)
            .get();

        if (!existingChatQuery.empty) {
            const existingChat = existingChatQuery.docs[0];
            const chatId = existingChat.ref.id;

            return { success: true, message: 'success', chatId };
        }

        const newChatRef = admin.firestore().collection('chats').doc();
        const chatId = newChatRef.id;

        const newChat = {
            chatId,
            postId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            participants: [senderId, receiverId],
        };

        await newChatRef.set(newChat);

        newChatRef.collection('messages');

        await Promise.all([
            admin.firestore().collection('users')
                .doc(senderId)
                .update({ activeChats: admin.firestore.FieldValue.arrayUnion(chatId) }),

            admin.firestore().collection('users')
                .doc(receiverId)
                .update({ activeChats: admin.firestore.FieldValue.arrayUnion(chatId) }),
        ]);

        return { success: true, message: 'success', chatId };
    } catch (error) {
        console.error(error);

        if (error instanceof functions.https.HttpsError) {
            throw error;
        } else {
            throw new functions.https.HttpsError('internal', 'An error occurred while creating the chat.', error.message);
        }
    }
});
