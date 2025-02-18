import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import app from '../app.js';


const auth = getAuth(app);
const firestore = getFirestore();

// @todo - переименовать в запрос инфы о пользователе и закинуть в user
export const getPostUserData = onCall(async (request) => {
    try {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'You must be logged in to get this profile.');
        }

        const { userId } = request.data;

        if (!userId) {
            throw new HttpsError('invalid-argument', 'User ID is required.');
        }


        const [userRecord, userDoc] = await Promise.all([
            auth.getUser(userId).catch((error) => {
                if (error.code === 'auth/user-not-found') {
                    throw new HttpsError('not-found', 'User not found.');
                }

                throw error;
            }),
            firestore.collection('users').doc(userId)
                .get(),
        ]);

        if (!userDoc.exists) {
            throw new HttpsError('not-found', 'User not found.');
        }

        const { rating } = userDoc.data();

        return {
            id: userId,
            name: userRecord.displayName,
            phone: userRecord.phoneNumber,
            email: userRecord.email,
            creationTime: userRecord.metadata.creationTime,
            emailVerified: userRecord.emailVerified,
            photoURL: userRecord.photoURL,
            disabled: userRecord.disabled,
            rating,
        };
    } catch (error) {
        console.error(error);

        if (error instanceof HttpsError) {
            throw error;
        } else {
            throw new HttpsError('internal', 'An error occurred while getting the user.', error.message);
        }
    }
});
