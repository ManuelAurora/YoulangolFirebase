const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { getFirstImage } = require('../utils.js');

exports.getChats = functions.https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to retrieve chats.');
        }

        const userId = context.auth.uid;

        const userDoc = await admin.firestore().collection('users')
            .doc(userId)
            .get();

        if (!userDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'User not found.');
        }

        const { activeChats } = userDoc.data();

        const hasActiveChats = Array.isArray(activeChats) && activeChats.length;

        if (!hasActiveChats) {
            return [];
        }

        const querySnapshot = await admin.firestore().collection('chats')
            .where('__name__', 'in', activeChats)
            .get();

        const chatPromises = querySnapshot.docs.map(async (chat) => {
            const chatData = chat.data();

            const chatId = chat.id;
            const postId = chatData.postId;
            const participantId = chatData.participants.find(id => id !== userId);

            const [
                messagesSnapshot,
                postDoc,
                participantUser
            ] = await Promise.all([
                await admin.firestore().collection('chats').doc(chatId).collection('messages').get(),
                await admin.firestore().collection('posts').doc(postId).get(),
                await admin.auth().getUser(participantId)
            ]);

            let lastMessage = null;
            let unreadCount = 0;
            let postPhoto = '';
            let postTitle = '';

            if (!messagesSnapshot.empty) {
                const messages = messagesSnapshot.docs.map(doc => doc.data());

                if (Array.isArray(messages) && messages.length) {
                    messages.sort((a, b) => b.timestamp - a.timestamp);

                    lastMessage = messages[0];
                    unreadCount = messages.filter(({ isRead, senderId }) => (!isRead && (senderId !== userId))).length;
                }
            }

            if (postDoc.exists) {
                const postData = postDoc.data();

                postPhoto = getFirstImage(postData.images)
                postTitle = postData.title;
            }

            return {
                chatId,
                unreadCount,

                lastMessage,

                post: {
                    id: postId,
                    image: postPhoto,
                    title: postTitle,
                },

                participant: {
                    id: participantId,
                    name: participantUser.displayName,
                    photoUrl: participantUser.photoURL,
                },

                updatedAt: chatData.updatedAt,
            };
        });

        const chats =  await Promise.all(chatPromises)

        return chats.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch (error) {
        console.error(error);

        if (error instanceof functions.https.HttpsError) {
            throw error;
        } else {
            throw new functions.https.HttpsError('internal', error.message, { code: 400, ...error });
        }
    }
});
