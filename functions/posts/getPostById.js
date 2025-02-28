import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import app from '../app.js';
import { getPreviewImage } from '../utils.js';


const firestore = getFirestore();
const auth = getAuth(app);

export const getPostById = onCall(async (request) => {
    try {
        const { postId } = request.data;

        if (!postId) {
            throw new HttpsError('invalid-argument', 'Post ID is required.');
        }

        const postDoc = await firestore.collection('posts').doc(postId)
            .get();

        if (!postDoc.exists) {
            throw new HttpsError('not-found', 'Post not found.');
        }

        const postData = postDoc.data();

        const [userRecord, userDoc] = await Promise.all([
            auth.getUser(postData.userId),
            firestore.collection('users').doc(postData.userId)
                .get(),
        ]);

        const userData = userDoc.exists ? userDoc.data() : {};
        const rating = userData?.rating || null;

        return {
            post: {
                id: postDoc.id,
                ...postData,
                preview: postData.preview || getPreviewImage(postData),
            },
            user: {
                id: postData.userId,
                creationTime: userRecord.metadata.creationTime,
                emailVerified: userRecord.emailVerified,
                name: userRecord.displayName,
                photoURL: userRecord.photoURL,
                disabled: userRecord.disabled,
                rating,
            },
        };
    } catch (error) {
        console.error(error);

        if (error instanceof HttpsError) {
            throw error;
        } else {
            throw new HttpsError('internal', 'An error occurred while fetching the post.', error.message);
        }
    }
});
