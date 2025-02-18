import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { processImage } from '../utils.js';
import app from '../app.js';


const auth = getAuth(app);
const firestore = getFirestore();
const bucket = getStorage().bucket();

/**
 * Загружает фото пользователя в Firebase Storage и возвращает URL.
 */
async function uploadUserImage(userId, image) {
    if (!image?.base64 || !image?.mimeType) { return null; }

    const fileExt = image.mimeType.split('/')[1];
    const filePath = `User_${userId}/avatar_${Date.now()}.${fileExt}`;
    const fileRef = bucket.file(filePath);

    const base64Data = image.base64.replace(/^data:image\/[^;]+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');
    const resizedImageBuffer = await processImage(imageBuffer);

    await fileRef.save(resizedImageBuffer, { metadata: { contentType: image.mimeType } });

    return `https://storage.googleapis.com/${bucket.name}/${filePath}`;
}

/**
 * Обновляет данные пользователя в Firebase Authentication.
 */
async function updateUserAuth(userId, updates) {
    const updateFields = Object.fromEntries(Object.entries(updates).filter(([_, v]) => v !== undefined));

    if (Object.keys(updateFields).length > 0) {
        await auth.updateUser(userId, updateFields);
    }
}

export const updateUser = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'You must be logged in to update your profile.');
    }

    const userId = request.auth.uid;
    const { displayName, email, phoneNumber, image } = request.data;

    try {
        const photoURL = image ? await uploadUserImage(userId, image) : undefined;

        await updateUserAuth(userId, { displayName, email, phoneNumber, photoURL });

        const [userRecord, userDoc] = await Promise.all([
            auth.getUser(userId),
            firestore.collection('users').doc(userId).get(),
        ]);

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
        throw error instanceof HttpsError ?
            error :
            new HttpsError('internal', 'An error occurred while updating the profile.', error.message);
    }
});
