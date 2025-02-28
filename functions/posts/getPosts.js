import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { getPreviewImage } from '../utils.js';

/**
 * Преобразует метры в километры.
 * @param {number|string} meters - Значение в метрах, которое нужно преобразовать в километры.
 * @returns {number|null} - Значение в километрах или null, если переданы неверные данные.
 */
function metersToKilometers(meters) {
    const metersNumber = parseFloat(meters);

    if (!isNaN(metersNumber) && metersNumber >= 0) {
        return metersNumber / 1000;
    }

    return null;
}

/**
 * Вычисляет границы (bounding box) на основе координат и радиуса.
 *
 * @param {number} latitude - Широта в градусах.
 * @param {number} longitude - Долгота в градусах.
 * @param {number} [radius=50] - Радиус в километрах (по умолчанию 50).
 * @returns {Object} - Объект с границами bounding box, или пустой объект, если координаты некорректные.
 */
function calculateBoundingBox(latitude, longitude, radius) {
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        return {};
    }

    const EARTH_RADIUS = 6371;
    const DEFAULT_SEARCH_RADIUS = 60;

    const radiusInKilometers = radius ? metersToKilometers(radius) : DEFAULT_SEARCH_RADIUS;

    const radianLatitude = (Math.PI / 180) * latitude;
    const radianRadius = radiusInKilometers / EARTH_RADIUS;
    const degreesPerRadian = 180 / Math.PI;

    const degreesRadius = radianRadius * degreesPerRadian;

    return {
        minLatitude: latitude - degreesRadius,
        maxLatitude: latitude + degreesRadius,
        minLongitude: longitude - degreesRadius / Math.cos(radianLatitude),
        maxLongitude: longitude + degreesRadius / Math.cos(radianLatitude),
    };
}

/**
 * Фильтрует массив объектов на основе заданных параметров поиска.
 *
 * @param {Object[]} posts - Массив объектов, которые необходимо отфильтровать.
 * @param {{search: string}} searchParams - Параметры поиска.
 * @param {number|undefined} searchParams.minLongitude - Минимальное значение долготы для фильтрации по геолокации.
 * @param {number|undefined} searchParams.maxLongitude - Максимальное значение долготы для фильтрации по геолокации.
 * @param {number|undefined} searchParams.minPrice - Минимальная цена для фильтрации по цене.
 * @param {number|undefined} searchParams.maxPrice - Максимальная цена для фильтрации по цене.
 * @param {Object} searchParams.datePublished - Параметры фильтрации по дате публикации.
 * @param {number|undefined} searchParams.datePublished.from - Начальная дата публикации для фильтрации.
 * @param {number|undefined} searchParams.datePublished.to - Конечная дата публикации для фильтрации.
 * @param {string} searchParams.search - Подстрока для поиска в заголовках объектов.
 * @returns {Object[]} - Массив объектов, соответствующих заданным параметрам поиска.
 * @throws {Error} - Если переданы некорректные значения параметров поиска.
 */
function filterPosts(posts, searchParams) {
    if (!Array.isArray(posts) || typeof searchParams !== 'object') {
        throw new TypeError('Invalid input data.');
    }

    return posts.filter((post) => {
        if (
            typeof searchParams.minLongitude === 'number' &&
            typeof searchParams.maxLongitude === 'number' &&
            !(post.location.lon >= searchParams.minLongitude && post.location.lon <= searchParams.maxLongitude)
        ) {
            return false;
        }

        if (
            (typeof searchParams.minPrice === 'number' && post.price < searchParams.minPrice) ||
            (typeof searchParams.maxPrice === 'number' && post.price > searchParams.maxPrice)
        ) {
            return false;
        }

        if (
            searchParams.datePublished &&
            ((typeof searchParams.datePublished.from === 'number' && post.createdAt < searchParams.datePublished.from) ||
                (typeof searchParams.datePublished.to === 'number' && post.createdAt > searchParams.datePublished.to))
        ) {
            return false;
        }

        if (
            typeof searchParams.search === 'string' &&
            searchParams.search &&
            !post.title.toLowerCase().includes(searchParams.search.toLowerCase())
        ) {
            return false;
        }

        return true;
    });
}

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


export const getPosts = onCall(async (request) => {
    try {
        const {
            category,
            location,
            minPrice,
            maxPrice,
            datePublished,
            search = '',
            page = 1,
            limit = 10,
        } = request.data;

        const startAfter = (page - 1) * limit;

        let query = getFirestore()
            .collection('posts')
            .where('status', '==', 'open')
            .orderBy('createdAt', 'desc');

        if (category) {
            query = query.where('categoryId', '==', category);
        }

        if (location && typeof location.latitude === 'number' && typeof location.longitude === 'number') {
            const { minLatitude, maxLatitude, minLongitude, maxLongitude } = calculateBoundingBox(
                location.latitude,
                location.longitude,
                location.radius,
            );

            query = query
                .where('location.lat', '>=', minLatitude)
                .where('location.lat', '<=', maxLatitude);

            const snapshot = await query.get();
            const searchResults = mapDocumentsToPosts(snapshot.docs);

            const filteredPosts = filterPosts(searchResults, {
                minLongitude,
                maxLongitude,
                minPrice,
                maxPrice,
                datePublished,
                search,
            });

            const resultsCount = filteredPosts.length;

            return {
                posts: filteredPosts.slice(startAfter, startAfter + limit),
                resultsCount,
                page,
            };
        }

        if (minPrice || maxPrice) {
            if (minPrice) {
                query = query.where('price', '>=', minPrice);
            }

            if (maxPrice) {
                query = query.where('price', '<=', maxPrice);
            }

            const snapshot = await query.get();
            const searchResults = mapDocumentsToPosts(snapshot.docs);

            const filteredPosts = filterPosts(searchResults, { datePublished, search });

            const resultsCount = filteredPosts.length;

            return {
                posts: filteredPosts.slice(startAfter, startAfter + limit),
                resultsCount,
                page,
            };
        }

        if (datePublished) {
            if (datePublished.from) {
                query = query.where('createdAt', '>=', datePublished.from);
            }

            if (datePublished.to) {
                query = query.where('createdAt', '<=', datePublished.to);
            }
        }

        const snapshot = await query.get();
        const searchResults = mapDocumentsToPosts(snapshot.docs);

        const filteredPosts = filterPosts(searchResults, { search });

        const resultsCount = filteredPosts.length;

        return {
            posts: filteredPosts.slice(startAfter, startAfter + limit),
            resultsCount,
            page,
        };
    } catch (error) {
        console.error(error);

        if (error instanceof HttpsError) {
            throw error;
        } else {
            throw new HttpsError('internal', 'An error occurred while performing the search.', error.message);
        }
    }
});
