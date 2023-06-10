const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

// User
exports.registerUser = functions.https.onCall(async (data) => {
    const { uid } = data;

    try {
        const userRef = admin.firestore().collection('users')
            .doc(uid);

        await userRef.set({ rating: 0 });

        return {
            success: true,
            message: 'User registered successfully. Please check your email to verify your account.',
        };
    } catch (error) {
        console.error(error);
        throw new functions.https.HttpsError('internal', error.message, { code: 400, ...error });
    }
});

exports.getUserById = functions.https.onCall(async (data) => {
    const userId = data.userId;
    const userDoc = await admin.firestore().collection('users')
        .doc(userId)
        .get();

    if (!userDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'User not found');
    }

    const user = userDoc.data();
    const userRecord = await admin.auth().getUser(userId);

    user.dateCreated = userRecord.metadata.creationTime;
    user.emailVerified = userRecord.emailVerified;
    user.name = userRecord.displayName;
    user.email = userRecord.email;
    user.phone = userRecord.phoneNumber;
    user.photoURL = userRecord.photoURL;
    user.disabled = userRecord.disabled;
    user.id = userId;

    return user;
});

// это есть на фронте и здесь можно удалить, если мы меняем только имя и фото
// https://firebase.google.com/docs/auth/web/manage-users#update_a_users_profile
exports.editProfile = functions.https.onCall(async (data, context) => {
    const userId = context.auth.uid;
    const { displayName, photoURL } = data;

    try {
        await admin.auth().updateUser(userId, { displayName, photoURL });

        return { message: 'Profile updated successfully' };
    } catch (error) {
        console.error(error);
        throw new functions.https.HttpsError('internal', 'An error occurred while updating the profile.');
    }
});


// Posts
exports.createPost = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to create a post.');
    }

    const { title, description, price, categoryId, location, images } = data;

    // Validation
    if (!title || !description || !price || !categoryId || !location || !images) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields.');
    }

    const userId = context.auth.uid;

    try {
        const newLocationRef = await admin.firestore().collection('locations').add(location);

        const imageUrls = await Promise.all(
            images.map(async (imageData) => {
                const base64Data = imageData.base64;
                const mimeType = imageData.mimeType;
                const buffer = Buffer.from(base64Data, 'base64');
                const fileName = `post_${newLocationRef.id}_${Date.now()}.png`;

                const file = admin.storage().bucket().file(fileName);
                await file.save(buffer, { metadata: { contentType: mimeType }, predefinedAcl: 'publicRead' });

                const url = `https://storage.googleapis.com/${file.bucket.name}/${file.name}`;
                return url;
            })
        );

        const newPost = {
            title,
            description,
            price,
            categoryId,
            locationRef: newLocationRef,
            images: imageUrls,
            userId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        const newPostRef = await admin.firestore().collection('posts').add(newPost);

        return { id: newPostRef.id };
    } catch (error) {
        throw new functions.https.HttpsError('internal', 'An error occurred while creating the post.', error.message);
    }
});

exports.editPost = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to edit a post.');
    }

    const { postId, title, description, price, categoryId, location, images } = data;
    const userId = context.auth.uid;

    const postRef = admin.firestore().collection('posts')
        .doc(postId);
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
        const locationDoc = await admin.firestore().collection('locations')
            .doc(post.locationRef.id)
            .get();

        await locationDoc.ref.update(location);

        locationRef = locationDoc.ref;
    }

    // upd images
    let imageUrls = post.images;

    if (images) {
        imageUrls = await Promise.all(
            images.map(async (imageData, i) => {
                const fileName = `post_${postId}_${i}`;
                const file = admin.storage().bucket()
                    .file(fileName);

                await file.save(imageData.buffer, { metadata: { contentType: imageData.mimeType } });

                return file.publicUrl();
            }),
        );
    }

    // upd post
    const postData = {
        title: title || post.title,
        description: description || post.description,
        price: price || post.price,
        categoryId: categoryId || post.categoryId,
        locationRef,
        images: imageUrls,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await postRef.update(postData);

    return { id: postId };
});

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
        return  { success: false, message: 'You need to have location object' };
    } else if (location.city == null) {
        return  { success: false, message: 'City should not be empty' };
    } else if (location.city == null) {
        return  { success: false, message: 'City should not be empty' };
    } else if (page == null) {
        return  { success: false, message: 'Page should not be empty' };
    }

    try {
        snapshot = await query.get();
        const posts = await Promise.all(snapshot.docs.map(async (doc) => {
            const postData = doc.data();
            if (postData.locationRef) {
                const locationId = postData.locationRef;
                const locationSnap = await admin.firestore().doc(`locations/${locationId}`).get();
                const locationData = locationSnap.data();
                postData.location = locationData;
            }
            return { id: doc.id, ...postData };
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

exports.getPostById = functions.https.onCall(async (data) => {
    const postId = data.id;

    try {
        const doc = await admin.firestore().collection('posts')
            .doc(postId)
            .get();

        if (!doc.exists) {
            throw new functions.https.HttpsError('not-found', 'Post not found.');
        }

        const data = doc.data();
        const userRecord = await admin.auth().getUser(data.userId);
        const creationTime = userRecord.metadata.creationTime;

        return {
            data,
            user: {
                creationTime,
                emailVerified: userRecord.emailVerified,
                name: userRecord.displayName,
                email: userRecord.email,
                phone: userRecord.phoneNumber,
                photoURL: userRecord.photoURL,
                disabled: userRecord.disabled,
                id: data.userId,
            },
        };
    } catch (error) {
        console.error(error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

exports.getPostsByUser = functions.https.onCall(async (data) => {
    const { userId } = data;

    const query = admin.firestore().collection('posts')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc');

    let snapshot;

    try {
        snapshot = await query.get();

        return snapshot.docs.map((doc) => {
            const postData = doc.data();

            return { id: doc.id, ...postData };
        });
    } catch (error) {
        console.log(error);

        return null;
    }
});


// Chat
    exports.createChat = functions.https.onCall(async (data) => {
        const { senderId, receiverId, postId } = data;

        if (!senderId || !receiverId) {
            throw new functions.https.HttpsError('invalid-argument', 'Sender and receiver IDs are required.');
        }

        if (senderId === receiverId) {
            throw new functions.https.HttpsError('invalid-argument', 'Sender and receiver IDs cannot be the same.');
        }

        const existingChatQuery = await admin.firestore().collection('chats')
            .where('postId', '==', postId)
            .where('participants', 'array-contains-any', [senderId, receiverId])
            .limit(1)
            .get();

        if (!existingChatQuery.empty) {
            const existingChat = existingChatQuery.docs[0].data();
            const chatId = existingChat.ref.id;
            return { success: true, message: 'success', chatId };
        }

        const newChatRef = admin.firestore().collection('chats')
            .doc();
        const chatId = newChatRef.id;

        const newChat = {
            chatId,
            postId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            participants: [senderId, receiverId],
        };

        await newChatRef.set(newChat);

        newChatRef.collection('messages');

        await Promise.all([
            admin.firestore().collection('users')
                .doc(senderId)
                .update({ activeChats: admin.firestore.FieldValue.arrayUnion(chatId) }),

            admin.firestore().collection('users')
                .doc(receiverId)
                .update({ activeChats: admin.firestore.FieldValue.arrayUnion(chatId) }),
        ]);

        return { success: true, message: 'success', chatId };
    });

exports.getChats = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to retrieve chats.');
    }

    const userId = context.auth.uid;

    try {
        const userDoc = await admin.firestore().collection('users')
            .doc(userId)
            .get();

        if (!userDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'User not found.');
        }

        const userData = userDoc.data();
        const activeChats = userData.activeChats || [];

        const querySnapshot = await admin.firestore().collection('chats')
            .where(admin.firestore.FieldPath.documentId(), 'in', activeChats)
            .get();

        const chats = [];

        const chatPromises = querySnapshot.docs.map(async (doc) => {
            const chatData = doc.data();
            const chatId = doc.id;
            const messages = chatData.messages || [];
            const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
            let lastMessageTimestamp = 0;
            const isOurs = lastMessage ? lastMessage.senderId === userId : false;
            const totalMessages = messages.filter(message => !message.isRead && message.senderId !== userId).length;
            const postId = chatData.postId || '';
            const participantId = chatData.participants.find(id => id !== userId);

            let postPhoto = '';
            let postTitle = '';

            if (lastMessage != null) {
                lastMessageTimestamp = lastMessage.timestamp;
            }

            if (postId) {
                const postDoc = await admin.firestore().collection('posts')
                    .doc(postId)
                    .get();

                if (postDoc.exists) {
                    const postData = postDoc.data();
                    const images = postData.images || [];

                    if (images.length > 0) {
                        postPhoto = images[0];
                    }
                   postTitle = postData.title;
                }
            }

            const participantUser = await admin.auth().getUser(participantId);
            const participantName = participantUser.displayName || '';
            const participantPhoto = participantUser.photoURL || '';

            return {
                chatId,
                lastMessage,
                lastMessageTimestamp,
                isOurs,
                totalMessages,
                postPhoto: postPhoto,
                postTitle,
                participant: {
                    id: participantId,
                    name: participantName,
                    photoUrl: participantPhoto,
                }
            };
        });

        const chatResults = await Promise.all(chatPromises);

        chats.push(...chatResults);

        return chats;
    } catch (error) {
        console.error(error);
        throw new functions.https.HttpsError('internal', error.message, { code: 400, ...error });
    }
});

exports.getChatById = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to retrieve a chat.');
    }

    const { chatId } = data;
    const userId = context.auth.uid;

    try {
        const chatDoc = await admin.firestore().collection('chats')
            .doc(chatId)
            .get();

        if (!chatDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Chat not found.');
        }

        const chatData = chatDoc.data();
        const postId = chatData.postId || '';
        const participantId = chatData.participants.find(id => id !== userId);

        let postPhoto = '';
        let postTitle = '';
        let participantName = '';
        let participantPhoto = '';
        let postPrice = 0;

        if (postId) {
            const postDoc = await admin.firestore().collection('posts')
                .doc(postId)
                .get();

            if (postDoc.exists) {
                const postData = postDoc.data();
                const images = postData.images || [];

                if (images.length > 0) {
                    postPhoto = images[0];
                }

                postTitle = postData.title || '';
                postPrice = postData.price || 0;
            }
        }

        const [userSnapshot, participantSnapshot] = await Promise.all([
            admin.auth().getUser(userId),
            admin.auth().getUser(participantId),
        ]);

        participantName = participantSnapshot.displayName || '';
        participantPhoto = participantSnapshot.photoURL || '';

        return {
            chatData,
            postPhoto: postPhoto,
            postTitle,
            postPrice,
            postId,
            participant: {
                id: participantId,
                name: participantName,
                photoUrl: participantPhoto,
            },
            currentUser: {
                id: userId,
                name: userSnapshot.displayName || '',
                photoUrl: userSnapshot.photoURL || '',
            },
        };
    } catch (error) {
        console.error(error);
        throw new functions.https.HttpsError('internal', error.message, { code: 400, ...error });
    }
});


// 0. Список чатов по id юзера (id чата, последнее сообщение, пропертю на сообщение bool, количество непрочитанных. фотка товара, фотка отправителя, айди отправителя, имя)
// 1. Добавить запрос чата по id (можно обнулять непрочитанные сообщения), инфу о юзере и товаре

// пост
// Добавить юзерАйди в запрос getUserById
// Добавить инфу о юзере в пост, по аналогии с getUserById


exports.sendMessage = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to send a message.');
    }

    const { text, chatId } = data;
    const senderId = context.auth.uid;
    const timestamp = admin.firestore.Timestamp.now().toMillis()

    const chatRef = admin.firestore().doc(`chats/${chatId}`);
    const messageRef = chatRef.collection('messages').doc(); // Create a new document reference

    const messageData = {
        id: messageRef.id, // Set the id field with the value of the document's ref.id
        senderId,
        text,
        timestamp
    };

    try {
        await Promise.all([
            messageRef.set(messageData),
            chatRef.update({
                messages: admin.firestore.FieldValue.arrayUnion(messageData),
                updatedAt: timestamp,
            }),
        ]);

        // notification
        // const payload = {
        //     notification: {
        //         title: 'New message',
        //         body: `You have a new message from ${senderId}`,
        //         icon: '/assets/icons/icon-96x96.png',
        //         clickAction: `https://${process.env.GCLOUD_PROJECT}.firebaseapp.com/chat/${chatId}`
        //     }
        // };
        // await admin.messaging().sendToTopic(chatRef.path, payload);

        return { success: true };
    } catch (error) {
        console.error(error);
        throw new functions.https.HttpsError('internal', error.message, { code: 400, ...error });
    }
});


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

