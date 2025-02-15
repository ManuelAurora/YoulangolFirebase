import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';


const firestore = getFirestore();

// @todo: сделать по примеру createOrder
// брать senderId из request.auth, переименовать в buyer - done
// брать receiverId из post - done
// убрать participants - хранить отдельно
// проверять наличие чатов по buyerId / sellerId - .where("buyerId", "==", buyerId)
export const createChat_v2 = onCall(async (request) => {
    try {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'You must be authenticated to create a chat.');
        }

        const buyerId = request.auth.uid;

        const { postId } = request.data;

        if (!postId) {
            throw new HttpsError('invalid-argument', 'post Id are required.');
        }

        // @todo: раскомментировать, удалить participants, existingChat и сохранение чатов в юзера
        // const existingChatQuery = await firestore.collection('chats')
        //     .where('postId', '==', postId)
        //     .where("buyerId", "==", buyerId)
        //     .limit(1)
        //     .get();
        //
        // if (!existingChatQuery.empty) {
        //     const existingChat = existingChatQuery.docs[0];
        //     const chatId = existingChat.ref.id;
        //
        //     return { chatId };
        // }

        const postDoc = await firestore.collection("posts").doc(postId).get();

        if (!postDoc.exists) {
            throw new HttpsError("not-found", "Post not found.");
        }

        const post = postDoc.data();
        const sellerId = post.userId;

        if (buyerId === sellerId) {
            throw new HttpsError('invalid-argument', 'Sender and receiver cannot be the same.');
        }

        // @todo: <удалить/>
        const existingChatQuery = await firestore.collection('chats')
            .where('postId', '==', postId)
            .get();

        const existingChat = existingChatQuery.docs.find(doc => {
            const participants = doc.data().participants;

            return participants.includes(buyerId) && participants.includes(sellerId);
        });

        if (existingChat) {
            return { chatId: existingChat.id };
        }
        // </удалить>

        const newChatRef = firestore.collection('chats').doc();
        const chatId = newChatRef.id;
        const createTime = Date.now();

        const newChat = {
            chatId,
            postId,
            createdAt: createTime,
            updatedAt: createTime,
            participants: [buyerId, sellerId],
            sellerId: sellerId,
            buyerId: buyerId,
        };

        await newChatRef.set(newChat);

        // @todo: <удалить/>
        await Promise.all([
            firestore.collection('users').doc(buyerId).update({ activeChats: FieldValue.arrayUnion(chatId) }),
            firestore.collection('users').doc(sellerId).update({ activeChats: FieldValue.arrayUnion(chatId) }),
        ]);
        // </удалить>

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
