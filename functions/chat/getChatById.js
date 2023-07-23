const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.getChatById = functions.https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to retrieve a chat.');
        }

        const { chatId } = data;

        if (!chatId) {
            throw new functions.https.HttpsError('invalid-argument', 'Chat ID is required.');
        }

        const userId = context.auth.uid;

        const chatDoc = await admin.firestore().collection('chats')
            .doc(chatId)
            .get();

        if (!chatDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Chat not found.');
        }

        const chatData = chatDoc.data();
        const postId = chatData.postId || '';
        const participantId = chatData.participants.find(id => id !== userId);

        let postPhoto = '';
        let postTitle = '';
        let participantName = '';
        let participantPhoto = '';
        let postPrice = 0;

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

                postTitle = postData.title || '';
                postPrice = postData.price || 0;
            }
        }

        const [userSnapshot, participantSnapshot] = await Promise.all([
            admin.auth().getUser(userId),
            admin.auth().getUser(participantId),
        ]);

        participantName = participantSnapshot.displayName || '';
        participantPhoto = participantSnapshot.photoURL || '';

        return {
            chatData,
            postPhoto: postPhoto,
            postTitle,
            postPrice,
            postId,
            participant: {
                id: participantId,
                name: participantName,
                photoUrl: participantPhoto,
            },
            currentUser: {
                id: userId,
                name: userSnapshot.displayName || '',
                photoUrl: userSnapshot.photoURL || '',
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
