import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { POST_STATUSES } from '../constants.js';
import { getPreviewImage } from '../utils.js';

/**
 * Преобразует документ Firestore в объект типа Post.
 * @param {firebase.firestore.DocumentData} doc - Документ Firestore.
 * @returns {Object} - Объект типа Post.
 */
function mapDocumentToPost(doc) {
    const data = doc.data();

    return {
        id: doc.id,
        createdAt: data.createdAt,
        preview: data.preview || getPreviewImage(data),
        price: data.price,
        description: data.description,
        location: data.location,
        isSafeDeal: data.isSafeDeal,
        title: data.title,
        userId: data.userId,
        categoryId: data.categoryId,
        subcategoryId: data.subcategoryId,
        brandId: data.brandId,
        status: data.status,
    };
}

/**
 * Преобразует массив документов Firestore в массив объектов типа Post.
 * @param {firebase.firestore.DocumentData[]} docs - Массив документов Firestore.
 * @returns {Object[]} - Массив объектов типа Post.
 */
function mapDocumentsToPosts(docs) {
    return docs.map(mapDocumentToPost);
}

const firestore = getFirestore();

export const getPostsByUser = onCall(async (request) => {
    try {
        const { userId, status } = request.data;

        if (!userId) {
            throw new HttpsError('invalid-argument', 'User ID is required.');
        }

        let query = firestore.collection('posts')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc');


        const isValidStatus = status && Object.values(POST_STATUSES).includes(status);


        if (isValidStatus) {
            query = query.where('status', '==', status);
        }

        const snapshot = await query.get();

        return mapDocumentsToPosts(snapshot.docs);
    } catch (error) {
        console.error(error);

        if (error instanceof HttpsError) {
            throw error;
        } else {
            throw new HttpsError('internal', 'An error occurred while fetching posts by user.');
        }
    }
});
