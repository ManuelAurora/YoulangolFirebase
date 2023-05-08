const functions = require("firebase-functions");
const axios = require('axios');
const admin = require('firebase-admin');

admin.initializeApp();

exports.getPosts = functions.https.onCall(async (data, context) => {
    const { page, category, location, radius } = data;
    const pageSize = 40;
    const startAfter = (page - 1) * pageSize;
    const city = location.city;
    let query = admin.firestore().collection('posts');

    if (category && city) {
        query = query.where('categoryId', '==', category).where('location.city', '==', city);
    } else if (category) {
        query = query.where('categoryId', '==', category);
    } else if (city) {
        query = query.where('location.city', '==', city);
    }

    query = query.orderBy('createdAt', 'desc');

    let snapshot;
    
    try {
        snapshot = await query.get();
        const posts = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));

        if (radius) {
            const {latitude, longitude} = location;
            const earthRadius = 6371;

            const filteredPosts = posts.filter(post => {
                const {lat: postLat, lon: postLng} = post.location;
                const dLat = toRad(postLat - latitude);
                const dLng = toRad(postLng - longitude);
                const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(toRad(latitude)) * Math.cos(toRad(postLat)) *
                    Math.sin(dLng / 2) * Math.sin(dLng / 2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                const distance = earthRadius * c;
                return distance <= radius;
            });
            return filteredPosts;
        }
    } catch (error) {
        console.log(error);
        return null;
    }
});

function toRad(degrees) {
    return degrees * Math.PI / 180;
}


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

exports.getPostById = functions.https.onCall(async (data, context) => {
    const postId = data.id;

    try {
        const doc = await admin.firestore().collection('posts').doc(postId).get();
        if (!doc.exists) {
            throw new functions.https.HttpsError('not-found', 'Post not found.');
        }
        const post = doc.data();
        return post;
    } catch (error) {
        console.error(error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

exports.registerUser = functions.https.onCall(async (data, context) => {
    const { uid, email, name } = data;

    try {
        const userRef = admin.firestore().collection('users').doc(uid);
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
    // const { accessToken } = data;
    // const credential = admin.auth.FacebookAuthProvider.credential(accessToken);
    // return admin.auth().signInWithCredential(credential)
    //     .then((result) => {
    //         // Handle successful authentication
    //         const user = result.user;
    //         console.log(user);
    //         return { message: 'Successfully signed in with Facebook!' };
    //     })
    //     .catch((error) => {
    //         // Handle authentication errors
    //         const errorCode = error.code;
    //         const errorMessage = error.message;
    //         console.log(errorCode, errorMessage);
    //         return { success: false, error: error };
    //     });
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



