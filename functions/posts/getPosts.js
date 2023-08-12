const functions = require('firebase-functions');
const admin = require('firebase-admin');


/**
 * Фильтрация списка постов по заданному радиусу от заданного местоположения.
 *
 * @param {Array} posts - Массив постов, которые требуется отфильтровать.
 * @param {Object} location - Объект, содержащий координаты заданного местоположения в виде `{latitude, longitude}`.
 * @param {Number} radius - Радиус в километрах для фильтрации постов.
 * @returns {Array} - Отфильтрованный массив постов.
 */
async function filterPostsByRadius(posts, location, radius) {
    const EARTH_RADIUS = 6371;

    const { latitude, longitude } = location;

    // @todo: Нужно либо указать значение по умолчанию для radius, либо выполнять логику ниже только когда есть radius
    const filteredPosts = await Promise.all(
        posts.map(async (post) => {
            const { lat: postLat, lon: postLng } = post.location;
            const dLat = toRad(postLat - latitude);
            const dLng = toRad(postLng - longitude);
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(toRad(latitude)) * Math.cos(toRad(postLat)) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const distance = EARTH_RADIUS * c;

            if (distance <= radius) {
                return post;
            }
        }),
    );

    return filteredPosts.filter(post => post);
}

/**
 * Преобразование градусы в радианы.
 *
 * @param {Number} degrees - Значение в градусах, которое требуется преобразовать в радианы.
 * @returns {Number} - Значение в радианах.
 */
function toRad(degrees) {
    return degrees * Math.PI / 180;
}


exports.getPosts = functions.https.onCall(async (data) => {
    const { page = 1, category, location, radius } = data;
    const pageSize = 40;
    const startAfter = (page - 1) * pageSize;
    const city = location.city;
    let query = admin.firestore().collection('posts');

    if (category && city) {
        query = query.where('categoryId', '==', category);
    } else if (category) {
        query = query.where('categoryId', '==', category);
    }

    query = query.orderBy('createdAt', 'desc');

    let snapshot;

    if (page < 0) {
        return { success: false, message: 'Page cannot be below 0' };
    } else if (location == null) {
        return { success: false, message: 'You need to have location object' };
    } else if (location.city == null) {
        return { success: false, message: 'City should not be empty' };
    } else if (location.city == null) {
        return { success: false, message: 'City should not be empty' };
    } else if (page == null) {
        return { success: false, message: 'Page should not be empty' };
    }

    try {
        snapshot = await query.get();

        const posts = await Promise.all(snapshot.docs.map(async (doc) => {
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
            };
        }));

        if (city) {
            const filteredPosts = posts.filter(post => post.location && post.location.city === city);

            if (radius) {
                return filterPostsByRadius(filteredPosts, location, radius);
            }

            return filteredPosts;
        }

        if (radius) {
            return filterPostsByRadius(posts, location, radius);
        }

        return posts;
    } catch (error) {
        console.log(error);

        return null;
    }
});
