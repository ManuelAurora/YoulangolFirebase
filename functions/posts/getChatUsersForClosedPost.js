const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.getChatUsersForClosedPost = functions.https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to access this feature.');
        }

        const { postId } = data;

        if (!postId) {
            throw new functions.https.HttpsError('invalid-argument', 'Post ID is required.');
        }

        const currentUserID = context.auth.uid;

        const userDoc = await admin.firestore().collection('users').doc(currentUserID).get();

        if (!userDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'User not found.');
        }

        const postDoc = await admin.firestore().collection('posts').doc(postId).get();

        if (!postDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Post not found.');
        }

        const postData = postDoc.data();

        if (postData.userId !== currentUserID) {
            throw new functions.https.HttpsError('permission-denied', 'You are not authorized to close posts that do not belong to you.');
        }

        const userData = userDoc.data();

        const activeChats = userData.activeChats || [];

        const chatPromises = activeChats.map(async (chatId) => {
            const chatDoc = await admin.firestore().collection('chats').doc(chatId).get();
            const chatData = chatDoc.data();

            if (chatData.postId === postId) {
                return chatData.participants.find(id => id !== currentUserID);
            }

            return null;
        });

        const userIds = await Promise.all(chatPromises);

        const uniqueUserIds = userIds.filter(chat => chat);

        const userPromises = uniqueUserIds.map(async (userId) => {
            const userRecord = await admin.auth().getUser(userId);

            return {
                userId,
                userName: userRecord.displayName,
                userPhoto: userRecord.photoURL,
                postTitle: postData.title,
            };
        });

        return await Promise.all(userPromises);
    } catch (error) {
        console.error(error);

        if (error instanceof functions.https.HttpsError) {
            throw error;
        } else {
            throw new functions.https.HttpsError('internal', 'An error occurred while fetching chat users for the closed post.', error.message);
        }
    }
});
