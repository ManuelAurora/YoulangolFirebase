const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.getChatUsersForClosedPost = functions.https.onCall(async (data, context) => {
    const { postId } = data;

    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to access this feature.');
    }

    const currentUserID = context.auth.uid;

    try {
        const userDoc = await admin.firestore().collection('users').doc(currentUserID).get();
        const userData = userDoc.data();
        const activeChats = userData.activeChats || [];

        const chatPromises = activeChats.map(async chatId => {
            const chatDoc = await admin.firestore().collection('chats').doc(chatId).get();
            const chatData = chatDoc.data();
            if (chatData.postId === postId) {

                const participants = chatData.participants.filter(id => id !== currentUserID);
                return { participants, postId: chatData.postId };
            }
            return null;
        });

        const chatUsers = (await Promise.all(chatPromises)).filter(participants => participants !== null);
        
        const postDoc = await admin.firestore().collection('posts').doc(postId).get();
        const postData = postDoc.data();
        const postTitle = postData.title;

        const uniqueUserIds = [...new Set(chatUsers.map(chat => chat.participants).flat())];
        
        const userPromises = uniqueUserIds.map(async userId => {
            const userDoc = await admin.firestore().collection('users').doc(userId).get();
            const userData = userDoc.data();
            return {
                userName: userData.displayName,
                postTitle,
                icon: context.auth.token.picture,
            };
        });

        const users = await Promise.all(userPromises);

        return users;
    } catch (error) {
        console.error(error);
        throw new functions.https.HttpsError('internal', 'An error occurred while fetching chat users for the closed post.', error.message);
    }
});