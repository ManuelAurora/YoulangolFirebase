import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirstImage } from '../utils.js';
import app from '../app.js';


const firestore = getFirestore();
const auth = getAuth(app);

export const getChats = onCall(async (request) => {
    try {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'You must be logged in to retrieve chats.');
        }

        const userId = request.auth.uid;

        const [sellerChatsSnapshot, buyerChatsSnapshot] = await Promise.all([
            firestore.collection('chats').where('sellerId', '==', userId).get(),
            firestore.collection('chats').where('buyerId', '==', userId).get(),
        ]);

        const allChats = [...sellerChatsSnapshot.docs, ...buyerChatsSnapshot.docs];

        if (!allChats.length) {
            return [];
        }

        const chatPromises = allChats.map(async (chat) => {
            const chatData = chat.data();
            const chatId = chat.id;
            const postId = chatData.postId;
            const participantId = chatData.sellerId === userId ? chatData.buyerId : chatData.sellerId;

            const [lastMessageSnapshot, postDoc, participantUser] = await Promise.all([
                firestore.collection('chats')
                    .doc(chatId)
                    .collection('messages')
                    .orderBy('timestamp', 'desc')
                    .limit(1)
                    .get(),
                firestore.collection('posts')
                    .doc(postId)
                    .get(),
                auth.getUser(participantId),
            ]);

            let lastMessage = null;
            let unreadCount = 0;
            let postPhoto = '';
            let postTitle = '';

            if (!lastMessageSnapshot.empty) {
                const messageDoc = lastMessageSnapshot.docs[0];

                lastMessage = messageDoc.data();

                const unreadMessagesSnapshot = await firestore
                    .collection('chats')
                    .doc(chatId)
                    .collection('messages')
                    .where('isRead', '==', false)
                    .where('senderId', '!=', userId)
                    .get();

                unreadCount = unreadMessagesSnapshot.size;
            }

            if (postDoc.exists) {
                const postData = postDoc.data();

                postPhoto = getFirstImage(postData.images);
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

        const chats = await Promise.all(chatPromises);

        return chats.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch (error) {
        console.error(error);

        if (error instanceof HttpsError) {
            throw error;
        } else {
            throw new HttpsError('internal', error.message, { code: 400, ...error });
        }
    }
});
