const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { POST_STATUSES } = require('../constants.js');

exports.getPostsByUser = functions.https.onCall(async (data) => {
    try {
        const { userId, status } = data;

        if (!userId) {
            throw new functions.https.HttpsError('invalid-argument', 'User ID is required.');
        }

        let query = admin.firestore().collection('posts')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc');

        const isValidStatus = Object.values(POST_STATUSES).includes(status);

        if (isValidStatus) {
            query = query.where('status', '==', status)
        }

        const snapshot = await query.get();

        return await Promise.all(snapshot.docs.map(async (doc) => {
            return {
                id: doc.id,
                ...doc.data()
            };
        }));

    } catch (error) {
        console.error(error);

        if (error instanceof functions.https.HttpsError) {
            throw error;
        } else {
            throw new functions.https.HttpsError('internal', 'An error occurred while fetching posts by user.');
        }
    }
});
