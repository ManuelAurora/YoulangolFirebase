const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.createPost = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to create a post.');
    }

    const { title, description, price, categoryId, location, images } = data;

    // Validation
    if (!title || !description || !price || !categoryId || !location || !images) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields.');
    }

    const userId = context.auth.uid;

    try {
        const newLocationRef = await admin.firestore().collection('locations').add(location);

        const userFolder = userId;

        // Check if folder exists
        const userFolderRef = admin.storage().bucket().file(`User_${userFolder}/`);

        const [userFolderExists] = await userFolderRef.exists();

        if (!userFolderExists) {
            await userFolderRef.save('');
        }

        const newPostDocRef = await admin.firestore().collection('posts').add({});

        const uploadedImages = await Promise.all(
            images.map(async ({ base64, mimeType }) => {
                const fileName = `post_${newPostDocRef.id}_${Date.now()}.${mimeType.split('/')[1]}`;
                const base64WithoutPrefix = base64.replace(/^data:image\/[^;]+;base64,/, '');
                const imageBuffer = Buffer.from(base64WithoutPrefix, 'base64');

                // Create folder
                const postFolderRef = admin.storage().bucket().file(`User_${userFolder}/Post_${newPostDocRef.id}/`);
                const [postFolderExists] = await postFolderRef.exists();
                if (!postFolderExists) {
                    await postFolderRef.save('');
                }

                const imageFileRef = admin.storage().bucket().file(`User_${userFolder}/Post_${newPostDocRef.id}/${fileName}`);
                await imageFileRef.save(imageBuffer, { metadata: { contentType: mimeType } });

                return `https://storage.googleapis.com/${admin.storage().bucket().name}/${imageFileRef.name}`;
            }),
        );

        const newPost = {
            status: 'Open',
            title,
            description,
            price,
            categoryId,
            locationRef: newLocationRef,
            images: uploadedImages,
            userId,
            createdAt: admin.firestore.Timestamp.now().toMillis(),
        };

        await newPostDocRef.set(newPost);

        return { id: newPostDocRef.id };
    } catch (error) {
        throw new functions.https.HttpsError('internal', 'An error occurred while creating the post.', error.message);
    }
});
