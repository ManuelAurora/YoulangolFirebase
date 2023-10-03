const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { getFirstImage } = require('../utils.js');

exports.getChatById = functions.https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to retrieve a chat.');
        }

        const { chatId } = data;

        if (!chatId) {
            throw new functions.https.HttpsError('invalid-argument', 'Chat ID is required.');
        }

        const chatDoc = await admin.firestore().collection('chats')
            .doc(chatId)
            .get();

        if (!chatDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Chat not found.');
        }

        const chatData = chatDoc.data();
        const currentUserId = context.auth.uid;

        const isCurrentUserChat = chatData.participants.includes(currentUserId)

        if (!isCurrentUserChat) {
            throw new functions.https.HttpsError('permission-denied', 'You do not have permission to read this chat');
        }

        const postId = chatData.postId;
        const participantId = chatData.participants.find(id => id !== currentUserId);

        const [postDoc, participantSnapshot] = await Promise.all([
            await admin.firestore().collection('posts').doc(postId).get(),
            await admin.auth().getUser(participantId)
        ]);

        if (!postDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Post not found.');
        }

        const postData = postDoc.data();

        return {
            post: {
                id: postId,
                categoryId: postData.categoryId,
                location: postData.location,
                image: getFirstImage(postData.images),
                title: postData.title,
                price: postData.price,
                status: postData.status,
                isReviewed: postData.isReviewed,
                buyerId: postData.buyerId,
            },

            participant: {
                id: participantId,
                name: participantSnapshot.displayName,
                photoUrl: participantSnapshot.photoURL,
            },
        };
    } catch (error) {
        console.error(error);

        if (error instanceof functions.https.HttpsError) {
            throw error;
        } else {
            throw new functions.https.HttpsError('internal', error.message, { code: 400, ...error });
        }
    }
});
