const functions = require('firebase-functions');
const admin = require('firebase-admin');

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
        return {}
    }

    const EARTH_RADIUS = 6371;
    const radianLatitude = (Math.PI / 180) * latitude;
    const radianRadius = (radius || 50) / EARTH_RADIUS;
    const degreesPerRadian = 180 / Math.PI;

    const degreesRadius = radianRadius * degreesPerRadian;

    return {
        minLatitude: latitude - degreesRadius,
        maxLatitude: latitude + degreesRadius,
        minLongitude: longitude - (degreesRadius / Math.cos(radianLatitude)),
        maxLongitude: longitude + (degreesRadius / Math.cos(radianLatitude))
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
        throw new Error('Invalid input data.');
    }

    return posts.filter((post) => {
        if (
            (typeof searchParams.minLongitude === 'number' && typeof searchParams.maxLongitude === 'number') &&
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
            (
                (typeof searchParams.datePublished.from === 'number' && post.createdAt < searchParams.datePublished.from) ||
                (typeof searchParams.datePublished.to === 'number' && post.createdAt > searchParams.datePublished.to)
            )
        ) {
            return false;
        }


        if (typeof searchParams.search === 'string' && searchParams.search && !post.title.toLowerCase().includes(searchParams.search.toLowerCase())) {
            return false;
        }

        return true;
    });
}


exports.getPosts = functions.https.onCall(
    /**
     * Функция для фильтрации и поиска постов
     *
     * @param {Object} data - Параметры для фильтрации и поиска
     *
     * @param {string} data.category - Название категории
     *
     * @param {Object} data.location - Информация о локации
     * @param {number} data.location.latitude - Широта
     * @param {number} data.location.longitude - Долгота
     * @param {number|null} data.location.radius - Максимальный радиус поиска
     *
     * @param {number} data.minPrice - Минимальная цена
     * @param {number} data.minPrice - Максимальная цена
     *
     * @param {Object} data.datePublished - Диапазон даты публикации
     * @param {number|null} data.datePublished.to - Конечная дата публикации
     * @param {number|null} data.datePublished.from - Начальная дата публикации

     * @param {string|null} data.search - Поисковый запрос

     * @param {string} [data.page=1] - Текущая страница
     * @param {string|null} [data.limit=10] - Количество результатов на странице
     * @returns {Array} - Отфильтрованный и отсортированный список постов
     */
    async (data) => {
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
            } = data;

            const startAfter = (page - 1) * limit;

            let query = admin.firestore().collection('posts')
                .where('status', '==', 'open')

            if (category) {
                query = query.where('categoryId', '==', category)
            }

            if (location && typeof location.latitude === 'number' && typeof location.longitude === 'number') {
                const {
                    minLatitude,
                    maxLatitude,
                    minLongitude,
                    maxLongitude
                } = calculateBoundingBox(location.latitude, location.longitude, location.radius);


                query = query
                    .where('location.lat', '>=', minLatitude)
                    .where('location.lat', '<=', maxLatitude)

                const snapshot = await query.get();
                const searchResults = snapshot.docs
                    .map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));

                const filteredPosts = filterPosts(searchResults, {
                    minLongitude,
                    maxLongitude,
                    minPrice,
                    maxPrice,
                    datePublished,
                    search
                })

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
                const searchResults = snapshot.docs
                    .map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));

                const filteredPosts = filterPosts(searchResults, { datePublished, search })

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
            const searchResults = snapshot.docs
                .map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

            const filteredPosts = filterPosts(searchResults, { search })

            const resultsCount = filteredPosts.length;

            return {
                posts: filteredPosts.slice(startAfter, startAfter + limit),
                resultsCount,
                page,
            };
        } catch (error) {
            console.error(error);

            if (error instanceof functions.https.HttpsError) {
                throw error;
            } else {
                throw new functions.https.HttpsError('internal', 'An error occurred while performing the search.', error.message);
            }
        }
    },
);
