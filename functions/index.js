const functions = require("firebase-functions");
const admin = require('firebase-admin');
const axios = require('axios');

admin.initializeApp();

// // Create and deploy your first functions
// // https://firebase.google.com/docs/functions/get-started
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//   functions.logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

exports.getPosts = functions.https.onCall(async (data, context) => {
    const { page, category, city } = data;
    const pageSize = 40;
    const startAfter = (page - 1) * pageSize;
    let query = admin.firestore().collection('posts');

    if (category && city) {
        query = query.where('categoryId', '==', category).where('location.city', '==', city);
    } else if (category) {
        query = query.where('categoryId', '==', category);
    } else if (city) {
        query = query.where('location.city', '==', city);
    }

    query = query.orderBy('createdAt', 'desc').startAt(startAfter).limit(pageSize);

    const snapshot = await query.get();
    const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return posts;
});

exports.postDetails = functions.https.onRequest(async (req, res) => {
    const id = req.query.id;
    const doc = await db.collection('postDetails').doc(id).get();

    if (!doc.exists) {
        res.status(404).send('Post not found');
    } else {
        const postData = doc.data();
        res.send(postData);
    }
});

exports.searchCity = functions.https.onRequest(async (req, res) => {
    const cityName = req.query.cityName;
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${cityName}&format=json&limit=1`;

    try {
        const response = await axios.get(nominatimUrl);
        const city = response.data[0];
        if (city) {
            const cityData = {
                description: city.display_name,
                latitude: parseFloat(city.lat),
                longitude: parseFloat(city.lon),
                city: city.osm_id
            };
            return res.status(200).send(cityData);
        } else {
            return res.status(404).send('City not found');
        }
    } catch (error) {
        console.error(error);
        return res.status(500).send('Server error');
    }
});

exports.getUserById = functions.https.onCall((data, context) => {
    const userId = data.id;
    return admin.database().ref(`/users/${userId}`).once('value')
        .then(snapshot => {
            const user = snapshot.val();
            return user;
        })
        .catch(error => {
            throw new functions.https.HttpsError('internal', error.message);
        });
});

exports.getPostById = functions.https.onCall((data, context) => {
    const postId = data.id;
    return admin.database().ref(`/posts/${postId}`).once('value')
        .then(snapshot => {
            const post = snapshot.val();
            return post;
        })
        .catch(error => {
            throw new functions.https.HttpsError('internal', error.message);
        });
});