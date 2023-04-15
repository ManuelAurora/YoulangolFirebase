const functions = require("firebase-functions");
const axios = require('axios');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

const adminEmail = 'ambo.angola@gmail.com';
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: adminEmail,
        pass: 'huipizda'
    }
});

admin.initializeApp();

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

    query = query.orderBy('createdAt', 'desc');//.startAt(startAfter).limit(pageSize);

    const snapshot = await query.get();
    const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return posts;
});

exports.getPosts2 = functions.https.onRequest(async (req, res) => {
    const { page, category, city } = req.body;
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

    // query = query.orderBy('createdAt', 'desc').limit(pageSize);

    try {
        const snapshot = await query.get();
        const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).json(posts);
    } catch (error) {
        res.status(500).send(error);
    }
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

exports.registerUser = functions.https.onCall(async (data, context) => {
    const { email, password, name } = data;

    try {
        const userRecord = await admin.auth().createUser({
            email,
            password,
            displayName: name
        });

        // Send email verification link to user
        await admin.auth().generateEmailVerificationLink(email)
            .then((link) => {
                // Send the verification email to the user's email address
                const mailOptions = {
                    from: adminEmail,
                    to: email,
                    subject: 'Verify your email address',
                    text: `Please click on the following link to verify your email address: ${link}`,
                    html: `<p>Please click on the following link to verify your email address: <a href="${link}">${link}</a></p>`
                };
                return transporter.sendMail(mailOptions);
            })
            .catch((error) => {
                console.error(error);
                throw new functions.https.HttpsError('internal', error.message, { code: 400, ...error });
            });

        const userRef = admin.firestore().collection('users').doc(userRecord.uid);
        await userRef.set({
            email,
            name,
            rating: 0,
            phone: '',
        });

        return { success: true, message: 'User registered successfully. Please check your email to verify your account.' };
    } catch (error) {
        console.error(error);
        throw new functions.https.HttpsError('internal', error.message, { code: 400, ...error });
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
            return { success: false, error: error };
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



