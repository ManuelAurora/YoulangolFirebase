import { getFirestore } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import app from '../app.js';

const firestore = getFirestore();
const auth = getAuth(app);

export const getChatParticipantsByPost = onCall(async (request) => {
    try {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'You must be logged in to access this feature.');
        }

        const { postId } = request.data;

        if (!postId) {
            throw new HttpsError('invalid-argument', 'Post ID is required.');
        }

        const currentUserID = request.auth.uid;

        const chatQuerySnapshot = await firestore
            .collection('chats')
            .where('sellerId', '==', currentUserID)
            .where('postId', '==', postId)
            .get();

        if (chatQuerySnapshot.empty) {
            return [];
        }

        const buyerIds = new Set(chatQuerySnapshot.docs.map(chat => chat.data().buyerId));

        const userPromises = Array.from(buyerIds).map(async (buyerId) => {
            const userRecord = await auth.getUser(buyerId);

            return {
                userId: buyerId,
                userName: userRecord.displayName,
                userPhoto: userRecord.photoURL,
                postId,
            };
        });

        return await Promise.all(userPromises);
    } catch (error) {
        console.error(error);
        throw new HttpsError('internal', 'An error occurred while fetching chat users.', error.message);
    }
});
