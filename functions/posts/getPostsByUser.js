const functions = require('firebase-functions');
const admin = require('firebase-admin');


exports.getPostsByUser = functions.https.onCall(async (data) => {
    const { userId } = data;

    const query = admin.firestore().collection('posts')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc');

    let snapshot;

    try {
        snapshot = await query.get();

        let dataToReturn = await Promise.all(snapshot.docs.map(async (doc) => {
            const postData = doc.data();

            if (postData.locationRef) {
                const locationId = await postData.locationRef.get();
                postData.location = locationId.data();
                postData.locationRef = null;
            }

            return { id: doc.id, ...postData };
        }));

        return dataToReturn;
    } catch (error) {
        console.log(error);

        return null;
    }
});
