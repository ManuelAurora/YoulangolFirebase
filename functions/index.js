const functions = require("firebase-functions");
const axios = require('axios');
const { OAuth2Client } = require('google-auth-library');
const admin = require('firebase-admin');

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

exports.authenticateUser = functions.https.onCall((data, context) => {
    const { email, password } = data;

    return admin.auth().signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // User authenticated successfully
            const user = userCredential.user;
            // Return user data
            return { success: true, uid: user.uid, email: user.email };
        })
        .catch((error) => {
            const errorCode = error.code;
            const errorMessage = error.message;
            return { error: errorMessage };
        });
});

exports.registerUser = functions.https.onCall(async (data, context) => {
    const { email, password, name } = data;

    try {
        const userRecord = await admin.auth().createUser({
            email,
            password,
            displayName: name
        });

        await admin.auth().sendEmailVerification(userRecord.uid);

        return { success: true, message: 'User registered successfully. Please check your email to verify your account.' };
    } catch (error) {
        console.error(error);
        return { success: false, message: 'Registration failed.' };
    }
});

exports.verifyEmail = functions.https.onRequest(async (req, res) => {
    const { mode, oobCode } = req.query;

    try {
        if (mode !== 'verifyEmail') {
            throw new Error('Invalid verification request.');
        }

        await admin.auth().applyActionCode(oobCode);

        res.send('Your email has been verified!');
    } catch (error) {
        console.error(error);
        res.status(500).send('Email verification failed.');
    }
});

exports.signInWithFacebook = functions.https.onCall((data, context) => {
    const { accessToken } = data;
    const credential = admin.auth.FacebookAuthProvider.credential(accessToken);
    return admin.auth().signInWithCredential(credential)
        .then((result) => {
            // Handle successful authentication
            const user = result.user;
            console.log(user);
            return { message: 'Successfully signed in with Facebook!' };
        })
        .catch((error) => {
            // Handle authentication errors
            const errorCode = error.code;
            const errorMessage = error.message;
            console.log(errorCode, errorMessage);
            return { error: errorMessage };
        });
});

exports.createPost = functions.https.onCall(async (data, context) => {

    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to create a post.');
    }

    // data from client
    const { title, description, price, categoryId, location, image } = data;

    const userId = context.auth.uid;

    const newPost = {
        title,
        description,
        price,
        categoryId,
        location,
        image,
        userId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const newPostRef = await admin.firestore().collection('posts').add(newPost);

    return { id: newPostRef.id };
});

