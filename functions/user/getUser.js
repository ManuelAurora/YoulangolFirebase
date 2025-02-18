import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import app from '../app.js';


const auth = getAuth(app);
const firestore = getFirestore();

export const getUser = onCall(async (request) => {
    try {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'You must be logged in to get your profile.');
        }

        const userId = request.auth.uid;

        const userDocRef = firestore.collection('users').doc(userId);

        let [userRecord, userDoc] = await Promise.all([
            auth.getUser(userId),
            userDocRef.get(),
        ]);

        if (!userDoc.exists) {
            await userDocRef.set({
                rating: 0,
            });

            userDoc = await userDocRef.get();
        }

        return {
            id: userId,
            creationTime: userRecord.metadata.creationTime,
            emailVerified: userRecord.emailVerified,
            name: userRecord.displayName,
            email: userRecord.email,
            phone: userRecord.phoneNumber,
            photoURL: userRecord.photoURL,
            disabled: userRecord.disabled,
            ...userDoc.data(),
        };
    } catch (error) {
        console.error(error);

        if (error instanceof HttpsError) {
            throw error;
        } else {
            throw new HttpsError('internal', 'An error occurred while getting your profile.', error.message);
        }
    }
});
