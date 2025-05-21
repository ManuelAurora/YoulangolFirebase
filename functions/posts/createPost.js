import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { POST_STATUSES } from '../constants.js';
import { processImage } from '../utils.js';
import { v4 as uuidv4 } from 'uuid';


const firestore = getFirestore();
const bucket = getStorage().bucket();


/**
 * Проверяет и преобразует данные гео.
 *
 * @param {Object} location - Объект гео.
 * @param {string} location.city - Название города.
 * @param {string} location.displayName - Отображаемое название города.
 * @param {string} location.lat - Широта в виде строки.
 * @param {string} location.lon - Долгота в виде строки.
 * @returns {Object} Объект с проверенными и преобразованными данными гео.
 * @throws {HttpsError} Если данные гео не прошли валидацию.
 */
function parseLocation(location) {
    if (!location || typeof location !== 'object') {
        throw new HttpsError('invalid-argument', 'Location must be an object.');
    }

    const { city = '', displayName, lat, lon } = location;

    if (typeof displayName !== 'string' || !displayName.trim()) {
        throw new HttpsError('invalid-argument', 'Display Name must be a non-empty string.');
    }

    const parsedLat = parseFloat(lat);
    const parsedLon = parseFloat(lon);

    if (isNaN(parsedLat) || isNaN(parsedLon)) {
        throw new HttpsError('invalid-argument', 'Latitude and Longitude must be valid numbers.');
    }

    return {
        city: city.trim(),
        displayName: displayName.trim(),
        lat: parsedLat,
        lon: parsedLon,
    };
}

/**
 * Сохраняет изображение в Firebase Storage.
 *
 * @param {string} userId - ID пользователя.
 * @param {string} postId - ID поста.
 * @param {string} base64 - Изображение в формате base64.
 * @param {string} mimeType - MIME-тип изображения.
 * @param {boolean} isSmall - сохранить как миниатюру.
 * @returns {Promise<string>} URL сохраненного изображения.
 */
async function saveImage(userId, postId, base64, mimeType, isSmall = false) {
    const fileName = `${uuidv4()}.${mimeType.split('/')[1]}`;
    const filePath = `User_${userId}/Post_${postId}/${fileName}`;

    const base64WithoutPrefix = base64.replace(/^data:image\/[^;]+;base64,/, '');
    const imageBuffer = Buffer.from(base64WithoutPrefix, 'base64');

    let resizedImageBuffer

    if (isSmall) {
        resizedImageBuffer = await processImage(imageBuffer, 360, 360);
    } else {
        resizedImageBuffer = await processImage(imageBuffer);
    }

    const fileRef = bucket.file(filePath);

    await fileRef.save(resizedImageBuffer, {
        metadata: {
            contentType: mimeType,
            cacheControl: 'public, max-age=31536000',
        }
    });

    return `https://storage.googleapis.com/${bucket.name}/${filePath}`;
}

export const createPost = onCall(async (request) => {
    try {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'You must be logged in to create a post.');
        }

        const {
            categoryId,
            subcategoryId,
            brandId,
            title,
            description,
            price,
            location,
            images,
            isSafeDeal = false
        } = request.data;

        if (!title || !description || !price || !categoryId || !location || !images) {
            throw new HttpsError('invalid-argument', 'Missing required fields.');
        }

        const parsedPrice = parseInt(price, 10);

        if (isNaN(parsedPrice)) {
            throw new HttpsError('invalid-argument', 'Price must be a valid number.');
        }

        const userId = request.auth.uid;

        const locationData = parseLocation(location);

        const newPostDocRef = firestore.collection('posts').doc();
        const postId = newPostDocRef.id;

        const uploadedImages = await Promise.all(
            images.map(image => saveImage(userId, postId, image.base64, image.mimeType)),
        );

        const firstImage = images[0];
        const preview = await saveImage(userId, postId, firstImage.base64, firstImage.mimeType, true);

        const newPost = {
            categoryId,
            subcategoryId: subcategoryId || null,
            brandId: brandId || null,
            status: POST_STATUSES.OPEN,
            title,
            description,
            price: parsedPrice,
            location: locationData,
            preview,
            images: uploadedImages,
            userId,
            createdAt: Date.now(),
            isSafeDeal,
        };

        await newPostDocRef.set(newPost);

        return { id: postId };
    } catch (error) {
        console.error(error);

        if (error instanceof HttpsError) {
            throw error;
        } else {
            throw new HttpsError('internal', 'An error occurred while creating the post.', { code: 400, ...error });
        }
    }
});
