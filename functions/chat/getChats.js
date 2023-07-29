const functions = require('firebase-functions');
const admin = require('firebase-admin');

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

        const userData = userDoc.data();
        const activeChats = userData.activeChats || [];

        if (activeChats.length === 0) {
            return []; 
        }
        
        const querySnapshot = await admin.firestore().collection('chats')
            .where(admin.firestore.FieldPath.documentId(), 'in', activeChats)
            .get();

        const chats = [];

        const chatPromises = querySnapshot.docs.map(async (doc) => {
            const chatData = doc.data();
            const chatId = doc.id;
            const messagesRef = admin.firestore().collection('chats').doc(chatId).collection('messages');
            const messagesSnapshot = await messagesRef.get();
            const messages = messagesSnapshot.docs.map(doc => doc.data());
            messages.sort((a, b) => b.timestamp - a.timestamp);
            const lastMessage = messages.length > 0 ? messages[0] : null;
            const lastMessageTimestamp = lastMessage ? lastMessage.timestamp : 0;
            const isOurs = lastMessage ? lastMessage.senderId === userId : false;
            const totalMessages = messages.filter(message => !message.isRead && (message.senderId !== userId)).length;
            const postId = chatData.postId || '';
            const participantId = chatData.participants.find(id => id !== userId);

            let postPhoto = '';
            let postTitle = '';

            if (postId) {
                const postDoc = await admin.firestore().collection('posts')
                    .doc(postId)
                    .get();

                if (postDoc.exists) {
                    const postData = postDoc.data();
                    const images = postData.images || [];

                    if (images.length > 0) {
                        postPhoto = images[0];
                    }
                    postTitle = postData.title;
                }
            }

            const participantUser = await admin.auth().getUser(participantId);
            const participantName = participantUser.displayName || '';
            const participantPhoto = participantUser.photoURL || '';

            return {
                chatId,
                lastMessage,
                lastMessageTimestamp,
                isOurs,
                totalMessages,
                postPhoto,
                postTitle,
                participant: {
                    id: participantId,
                    name: participantName,
                    photoUrl: participantPhoto,
                }
            };
        });

        const chatResults = await Promise.all(chatPromises);

        chats.push(...chatResults);

        return chats;
    } catch (error) {
        console.error(error);

        if (error instanceof functions.https.HttpsError) {
            throw error;
        } else {
            throw new functions.https.HttpsError('internal', error.message, { code: 400, ...error });
        }
    }
});
