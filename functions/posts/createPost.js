const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { POST_STATUSES } = require('../constants.js');


/**
 * Проверяет и преобразует данные гео.
 *
 * @param {Object} location - Объект гео.
 * @param {string} location.city - Название города.
 * @param {string} location.displayName - Отображаемое название города.
 * @param {string} location.lat - Широта в виде строки.
 * @param {string} location.lon - Долгота в виде строки.
 * @returns {Object} Объект с проверенными и преобразованными данными гео.
 * @throws {functions.https.HttpsError} Если данные гео не прошли валидацию.
 */
function parseLocation(location) {
    if (!location || typeof location !== 'object') {
        throw new functions.https.HttpsError('invalid-argument', 'Location must be an object.');
    }

    const { city, displayName, lat, lon } = location;

    if (typeof city !== 'string' || !city.trim()) {
        throw new functions.https.HttpsError('invalid-argument', 'City must be a non-empty string.');
    }

    if (typeof displayName !== 'string' || !displayName.trim()) {
        throw new functions.https.HttpsError('invalid-argument', 'Display Name must be a non-empty string.');
    }

    const parsedLat = parseFloat(lat);
    const parsedLon = parseFloat(lon);

    if (isNaN(parsedLat) || isNaN(parsedLon)) {
        throw new functions.https.HttpsError('invalid-argument', 'Latitude and Longitude must be valid numbers.');
    }

    return {
        city: city.trim(),
        displayName: displayName.trim(),
        lat: parsedLat,
        lon: parsedLon,
    };
}


exports.createPost = functions.https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to create a post.');
        }

        const { title, description, price, categoryId, location, images, isSafeDeal = false } = data;

        if (!title || !description || !price || !categoryId || !location || !images) {
            throw new functions.https.HttpsError('invalid-argument', 'Missing required fields.');
        }

        const parsedPrice = parseInt(price, 10);

        if (isNaN(parsedPrice)) {
            throw new functions.https.HttpsError('invalid-argument', 'Price must be a valid number.');
        }

        const userId = context.auth.uid;

        const locationData = parseLocation(location);

        const userFolder = `User_${userId}`;

        const userFolderRef = admin.storage().bucket().file(userFolder);

        const [userFolderExists] = await userFolderRef.exists();

        if (!userFolderExists) {
            await userFolderRef.save('');
        }

        const newPostDocRef = await admin.firestore().collection('posts').add({});

        const postFolderName = `${userFolder}/Post_${newPostDocRef.id}/`;

        const uploadedImages = await Promise.all(
            images.map(async ({ base64, mimeType }) => {
                const fileName = `post_${newPostDocRef.id}_${Date.now()}.${mimeType.split('/')[1]}`;

                const base64WithoutPrefix = base64.replace(/^data:image\/[^;]+;base64,/, '');
                const imageBuffer = Buffer.from(base64WithoutPrefix, 'base64');

                const postFolderRef = admin.storage().bucket().file(postFolderName);

                const [postFolderExists] = await postFolderRef.exists();

                if (!postFolderExists) {
                    await postFolderRef.save('');
                }

                const imageFileRef = admin.storage().bucket().file(`${postFolderName}${fileName}`);
                await imageFileRef.save(imageBuffer, { metadata: { contentType: mimeType }});

                return `https://storage.googleapis.com/${admin.storage().bucket().name}/${imageFileRef.name}`;
            }),
        );

        const newPost = {
            status: POST_STATUSES.OPEN,
            title,
            description,
            price: parsedPrice,
            categoryId,
            location: locationData,
            images: uploadedImages,
            userId,
            searchBy: title.toLowerCase(),
            createdAt: Date.now(),
            isSafeDeal,
        };

        await newPostDocRef.set(newPost);

        return { id: newPostDocRef.id };
    } catch (error) {
        console.error(error);

        if (error instanceof functions.https.HttpsError) {
            throw error;
        } else {
            throw new functions.https.HttpsError('internal', 'An error occurred while creating the post.', error.message);
        }
    }
});
