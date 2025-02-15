import { getFirestore } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import app from '../app.js';


// @todo: перенести в user, назвать getChatUsersByPostId
// просто фильтровать чаты по postId и sellerId

const firestore = getFirestore();
const auth = getAuth(app);

export const getChatUsersForClosedPost_v2 = onCall(async (request) => {
    try {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'You must be logged in to access this feature.');
        }

        const { postId } = request.data;

        if (!postId) {
            throw new HttpsError('invalid-argument', 'Post ID is required.');
        }

        const currentUserID = request.auth.uid;

        const userDoc = await firestore.collection('users').doc(currentUserID).get();

        if (!userDoc.exists) {
            throw new HttpsError('not-found', 'User not found.');
        }

        const postDoc = await firestore.collection('posts').doc(postId).get();

        if (!postDoc.exists) {
            throw new HttpsError('not-found', 'Post not found.');
        }

        const postData = postDoc.data();

        if (postData.userId !== currentUserID) {
            throw new HttpsError('permission-denied', 'You are not authorized to close posts that do not belong to you.');
        }

        const userData = userDoc.data();
        const activeChats = userData.activeChats || [];

        const chatPromises = activeChats.map(async (chatId) => {
            const chatDoc = await firestore.collection('chats').doc(chatId).get();

            if (chatDoc.exists) {
                const chatData = chatDoc.data();

                if (chatData.postId === postId) {
                    return chatData.participants.find(id => id !== currentUserID);
                }
            }

            return null;
        });

        const userIds = (await Promise.all(chatPromises)).filter(Boolean); // Убираем null

        const userPromises = userIds.map(async (userId) => {
            const userRecord = await auth.getUser(userId);

            return {
                userId,
                userName: userRecord.displayName,
                userPhoto: userRecord.photoURL,
                postId,
                postTitle: postData.title,
            };
        });

        return await Promise.all(userPromises);
    } catch (error) {
        console.error(error);

        if (error instanceof HttpsError) {
            throw error;
        } else {
            throw new HttpsError('internal', 'An error occurred while fetching chat users for the closed post.', error.message);
        }
    }
});
