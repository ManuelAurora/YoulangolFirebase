const functions = require('firebase-functions');
const admin = require('firebase-admin');
// const geolib = require('geolib');

exports.searchPosts = functions.https.onCall(
    /**
     * Функция для фильтрации и поиска постов
     *
     * @param {Object} data - Параметры для фильтрации и поиска
     * @param {Object[]} data.attributes - Список фильтров
     * @param {string} data.attributes.slug - Идентификатор фильтра
     * @param {any} data.attributes.value - Значение фильтра
     * @param {number|null} data.attributes.from - Начальное значение диапазона
     * @param {number|null} data.attributes.to - Конечное значение диапазона
     * @param {Object} data.datePublished - Диапазон даты публикации
     * @param {number|null} data.datePublished.to - Конечная дата публикации
     * @param {number|null} data.datePublished.from - Начальная дата публикации
     * @param {Object} data.location - Информация о локации
     * @param {number} data.location.latitude - Широта
     * @param {number} data.location.longitude - Долгота
     * @param {string|null} data.location.city - Город
     * @param {number|null} data.location.radius - Максимальный радиус поиска
     * @param {string|null} data.search - Поисковый запрос
     * @param {string|null} data.cursor - Курсор для пагинации
     * @returns {Array} - Отфильтрованный и отсортированный список постов
     */
    async (data) => {
        try {
            const {
                attributes = [],
                datePublished,
                location,
                search,
                cursor,
            } = data;

            let query = admin.firestore().collection('posts');

            // [работает] Apply filters
            if (attributes) {
                const priceFilter = attributes.find(attribute => attribute.slug === 'price');

                if (priceFilter) {
                    if (priceFilter.from) {
                        query = query.where('price', '>=', priceFilter.from);
                    }

                    if (priceFilter.to) {
                        query = query.where('price', '<=', priceFilter.to);
                    }
                }
            }

            // [работает] Apply date range filter
            if (datePublished) {
                if (datePublished.from) {
                    query = query.where('createdAt', '>=', datePublished.from);
                }

                if (datePublished.to) {
                    query = query.where('createdAt', '<=', datePublished.to);
                }
            }


            // Apply location filter
            // @todo: сделать поиск с учетом location
            // if (location && location.latitude && location.longitude) {
            //     const { latitude, longitude, city, radius } = location;
            //
            //     if (latitude && longitude) {
            //         const center = { latitude, longitude };
            //
            //         if (radius) {
            //             query = query.get()
            //                 .then(snapshot => {
            //                     return snapshot.docs.filter(doc => {
            //                         const post = doc.data();
            //                         const postLocation = { latitude: post.location.lat, longitude: post.location.lon };
            //                         const distance = geolib.getDistance(center, postLocation);
            //
            //                         return distance <= radius;
            //                     });
            //                 });
            //         } else {
            //             query = query.orderBy('location.lat', 'asc').orderBy('location.lon', 'asc');
            //             console.log('query', query)
            //         }
            //     }
            // }

            // [работает, но только с учетом регистра] Apply search query
            if (search) {
                // @todo: нужно придумать как искать
                query = query.where('title', '>=', search).where('title', '<=', `${search}\uF8FF`);
            }

            // Apply pagination using cursor
            if (cursor) {
                // @todo: добавить пагинацию
                // query = query.startAfter(cursor);
            }

            const snapshot = await query.get();

            return await Promise.all(snapshot.docs.map(async (doc) => {
                const postData = doc.data();

                if (postData.locationRef) {
                    const locationId = await postData.locationRef.get();

                    postData.location = locationId.data();
                }

                return {
                    id: doc.id,
                    categoryId: postData.categoryId,
                    title: postData.title,
                    price: postData.price,
                    userId: postData.userId,
                    images: postData.images,
                    location: postData.location,
                    createdAt: postData.createdAt,
                };
            }));
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
