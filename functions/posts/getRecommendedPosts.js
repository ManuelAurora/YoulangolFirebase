import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { getPreviewImage } from '../utils.js';

/**
 * Преобразует документ Firestore в объект типа Post.
 * @param {firebase.firestore.DocumentData} doc
 * @returns {Object}
 */
function mapDocumentToPost(doc) {
    const data = doc.data();

    return {
        id: doc.id,
        categoryId: data.categoryId,
        subcategoryId: data.subcategoryId,
        brandId: data.brandId,
        createdAt: data.createdAt,
        preview: data.preview || getPreviewImage(data),
        price: data.price,
        description: data.description,
        location: data.location,
        isSafeDeal: data.isSafeDeal,
        title: data.title,
        userId: data.userId,
        status: data.status,
    };
}

export const getRecommendedPosts = onCall(async (request) => {
    try {
        const { postId, limit = 5 } = request.data;

        if (!postId) {
            throw new HttpsError('invalid-argument', 'postId is required.');
        }

        const db = getFirestore();
        const postRef = await db.collection('posts').doc(postId).get();

        if (!postRef.exists) {
            throw new HttpsError('not-found', 'Post not found.');
        }

        const currentPost = postRef.data();
        const { subcategoryId, brandId } = currentPost;

        let query = db
            .collection('posts')
            .where('status', '==', 'open')
            .where('subcategoryId', '==', subcategoryId);

        if (brandId) {
            query = query.where('brandId', '==', brandId);
        }

        const snapshot = await query.orderBy('createdAt', 'desc').limit(limit * 2).get();
        let posts = snapshot.docs
            .filter(doc => doc.id !== postId)
            .map(mapDocumentToPost);

        if (posts.length < limit) {
            const existingIds = new Set(posts.map(p => p.id));

            const fallbackQuery = db
                .collection('posts')
                .where('status', '==', 'open')
                .where('subcategoryId', '==', subcategoryId)
                .orderBy('createdAt', 'desc')
                .limit(limit * 2);

            const fallbackSnapshot = await fallbackQuery.get();
            const fallbackPosts = fallbackSnapshot.docs
                .filter(doc => doc.id !== postId && !existingIds.has(doc.id))
                .map(mapDocumentToPost);

            posts = [...posts, ...fallbackPosts];
        }

        return { posts: posts.slice(0, limit) };
    } catch (error) {
        console.error(error);
        throw new HttpsError('internal', 'Failed to get recommended posts.', error.message);
    }
});
