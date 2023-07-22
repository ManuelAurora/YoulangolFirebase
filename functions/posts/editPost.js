const functions = require('firebase-functions');
const admin = require('firebase-admin');


exports.editPost = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to edit a post.');
    }

    const { postId, title, description, price, categoryId, location, images, removedImages } = data;
    const userId = context.auth.uid;

    const postRef = admin.firestore().collection('posts').doc(postId);
    const postDoc = await postRef.get();

    if (!postDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Post not found');
    }

    const post = postDoc.data();

    if (post.userId !== userId) {
        throw new functions.https.HttpsError('permission-denied', 'You do not have permission to edit this post');
    }

    // Update location
    let locationRef = post.locationRef;

    if (location) {
        const locationDoc = await admin.firestore().collection('locations').doc(post.locationRef.id).get();
        await locationDoc.ref.update(location);
        locationRef = locationDoc.ref;
    }

    // Remove images
    if (removedImages && removedImages.length > 0) {
        const storagePromises = removedImages.map(async imageName => {
            const filePath = `User_${userId}/Post_${postId}/${imageName}`;
            const file = admin.storage().bucket().file(filePath);
            await file.delete();
        });
        await Promise.all(storagePromises);
    }

    // Add new images
    let imageUrls = post.images || [];

    if (images && images.length > 0) {
        const uploadPromises = images.map(async ({ base64, mimeType }) => {
            const fileName = `post_${postId}_${Date.now()}.${mimeType.split('/')[1]}`;
            const base64WithoutPrefix = base64.replace(/^data:image\/[^;]+;base64,/, '');
            const imageBuffer = Buffer.from(base64WithoutPrefix, 'base64');

            const filePath = `User_${userId}/Post_${postId}/${fileName}`;
            const file = admin.storage().bucket().file(filePath);

            await file.save(imageBuffer, { metadata: { contentType: mimeType } });

            return `https://storage.googleapis.com/${admin.storage().bucket().name}/${file.name}`;
        });

        const uploadedImages = await Promise.all(uploadPromises);
        imageUrls = [...imageUrls, ...uploadedImages];
    }

    // Update post
    const postData = {
        title: title || post.title,
        description: description || post.description,
        price: price || post.price,
        categoryId: categoryId || post.categoryId,
        locationRef,
        images: imageUrls,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await postRef.update(postData);

    return { id: postId };
});
