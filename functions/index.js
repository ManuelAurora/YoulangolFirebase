const functions = require("firebase-functions");
const axios = require('axios');
const admin = require('firebase-admin');

admin.initializeApp();

const earthRadius = 6371;

exports.getPosts = functions.https.onCall(async (data, context) => {
    const { page, category, location, radius } = data;
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

    try {
        snapshot = await query.get();
        const posts = await Promise.all(snapshot.docs.map(async (doc) => {
            const postData = doc.data();
            if (postData.locationRef) {
                const locationId = postData.locationRef;
                const locationSnap = await admin.firestore().collection('locations').doc(locationId).get();
                const locationData = locationSnap.data();
                postData.location = locationData;
            }
            return { id: doc.id, ...postData };
        }));

        if (city) {
            const filteredPosts = posts.filter(post => post.location.city == city);

            if (radius) {
                return filterPostsByRadius(filteredPosts, location, radius)
            } else {
                return filteredPosts;
            }
        } else if (radius) {
            return filterPostsByRadius(posts, location, radius)
        } else {
            return posts;
        }
    } catch (error) {
        console.log(error);
        return null;
    }
});

exports.getUserById = functions.https.onCall(async (data, context) => {
    const userId = data.userId;
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'User not found');
    }
    const user = userDoc.data();
    const userRecord = await admin.auth().getUser(userId);
    const creationTime = userRecord.metadata.creationTime;
    
    user.dateCreated = creationTime;
    user.emailVerified = userRecord.emailVerified;
    user.name = userRecord.displayName;
    user.email = userRecord.email;
    user.phone = userRecord.phoneNumber;
    user.photoURL = userRecord.photoURL;
    user.disabled = userRecord.disabled;
    
    return user;
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

    const { title, description, price, categoryId, location, images } = data;
    const userId = context.auth.uid;

    // Create a new location document in the 'locations' collection
    const newLocationRef = await admin.firestore().collection('locations').add(location);

    // Upload images to Cloud Storage
    const imageUrls = await Promise.all(images.map(async (imageData, i) => {
        const fileName = `post_${newPostRef.id}_${i}`;
        const file = admin.storage().bucket().file(fileName);
        await file.save(imageData.buffer, { metadata: { contentType: imageData.mimeType } });
        return file.publicUrl();
    }));

    const newPost = {
        title,
        description,
        price,
        categoryId,
        locationRef: newLocationRef,
        images: imageUrls,
        userId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const newPostRef = await admin.firestore().collection('posts').add(newPost);

    return { id: newPostRef.id };
});

exports.editPost = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to edit a post.');
    }

    const { postId, title, description, price, categoryId, location, images } = data;
    const userId = context.auth.uid;

    const postRef = admin.firestore().collection('posts').doc(postId);
    const postDoc = await postRef.get();

    if (!postDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Post not found');
    }

    const post = postDoc.data();

    if (post.userId !== userId) {
        throw new functions.https.HttpsError('permission-denied', 'You do not have permission to edit this post');
    }
    
    // upd location
    let locationRef = post.locationRef;
    if (location) {
        const locationDoc = await admin.firestore().collection('locations').doc(post.locationRef.id).get();
        await locationDoc.ref.update(location);
        locationRef = locationDoc.ref;
    }

    // upd images
    let imageUrls = post.images;
    if (images) {
        const newImageUrls = await Promise.all(images.map(async (imageData, i) => {
            const fileName = `post_${postId}_${i}`;
            const file = admin.storage().bucket().file(fileName);
            await file.save(imageData.buffer, { metadata: { contentType: imageData.mimeType } });
            return file.publicUrl();
        }));
        imageUrls = newImageUrls;
    }
    
    // upd post
    const postData = {
        title: title || post.title,
        description: description || post.description,
        price: price || post.price,
        categoryId: categoryId || post.categoryId,
        locationRef,
        images: imageUrls,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await postRef.update(postData);

    return { id: postId };
});

exports.getPostsByUser = functions.https.onCall(async (data, context) => {
    const { userId } = data;

    let query = admin.firestore().collection('posts').where('userId', '==', userId).orderBy('createdAt', 'desc');

    let snapshot;

    try {
        snapshot = await query.get();
        const posts = snapshot.docs.map((doc) => {
            const postData = doc.data();
            return { id: doc.id, ...postData };
        });

        return posts;
    } catch (error) {
        console.log(error);
        return null;
    }
});

/// Vsyakoe vspomogatelnoe govno

async function filterPostsByRadius(posts, location, radius) {
    const {latitude, longitude} = location;
    const earthRadius = 6371;

    const filteredPosts = await Promise.all(posts.map(async (post) => {
        const { lat: postLat, lon: postLng } = post.location;
        const dLat = toRad(postLat - latitude);
        const dLng = toRad(postLng - longitude);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(latitude)) * Math.cos(toRad(postLat)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = earthRadius * c;
        if (distance <= radius) {
            return post;
        }
    }));

    return filteredPosts.filter(post => post);
}

function toRad(degrees) {
    return degrees * Math.PI / 180;
}

