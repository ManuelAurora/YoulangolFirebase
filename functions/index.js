const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

const bucket = admin.storage().bucket();

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

        const userFolder = userId;

        // Check if folder exists
        const userFolderRef = bucket.file( `User_${userFolder}/`);

        const [userFolderExists] = await userFolderRef.exists();
        if (!userFolderExists) {
            await userFolderRef.save('');
        }

        const newPostDocRef = await admin.firestore().collection('posts').add({});

        const uploadedImages = await Promise.all(
            images.map(async ({ base64, mimeType }) => {
                const fileName = `post_${newPostDocRef.id}_${Date.now()}.${mimeType.split('/')[1]}`;
                const base64WithoutPrefix = base64.replace(/^data:image\/[^;]+;base64,/, '');
                const imageBuffer = Buffer.from(base64WithoutPrefix, 'base64');

                // Create folder
                const postFolderRef = bucket.file(`User_${userFolder}/Post_${newPostDocRef.id}/`);
                const [postFolderExists] = await postFolderRef.exists();
                if (!postFolderExists) {
                    await postFolderRef.save('');
                }

                const imageFileRef = bucket.file(`User_${userFolder}/Post_${newPostDocRef.id}/${fileName}`);
                await imageFileRef.save(imageBuffer, { metadata: { contentType: mimeType } });

                return `https://storage.googleapis.com/${bucket.name}/${imageFileRef.name}`;
            }),
        );
        
        const newPost = {
            status: 'Open',
            title,
            description,
            price,
            categoryId,
            locationRef: newLocationRef,
            images: uploadedImages,
            userId,
            createdAt: admin.firestore.Timestamp.now().toMillis(),
        };

        await newPostDocRef.set(newPost);
        
        return { id: newPostDocRef.id };
    } catch (error) {
        throw new functions.https.HttpsError('internal', 'An error occurred while creating the post.', error.message);
    }
});

exports.editPost = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to edit a post.');
    }

    const { postId, title, description, price, categoryId, location, images, removedImages } = data;
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

    // Update location
    let locationRef = post.locationRef;

    if (location) {
        const locationDoc = await admin.firestore().collection('locations').doc(post.locationRef.id).get();
        await locationDoc.ref.update(location);
        locationRef = locationDoc.ref;
    }

    // Remove images
    if (removedImages && removedImages.length > 0) {
        const storagePromises = removedImages.map(async imageName => {
            const filePath = `User_${userId}/Post_${postId}/${imageName}`;
            const file = admin.storage().bucket().file(filePath);
            await file.delete();
        });
        await Promise.all(storagePromises);
    }

    // Add new images
    let imageUrls = post.images || [];

    if (images && images.length > 0) {
        const uploadPromises = images.map(async ({ base64, mimeType }) => {
            const fileName = `post_${postId}_${Date.now()}.${mimeType.split('/')[1]}`;
            const base64WithoutPrefix = base64.replace(/^data:image\/[^;]+;base64,/, '');
            const imageBuffer = Buffer.from(base64WithoutPrefix, 'base64');

            const filePath = `User_${userId}/Post_${postId}/${fileName}`;
            const file = admin.storage().bucket().file(filePath);

            await file.save(imageBuffer, { metadata: { contentType: mimeType } });

            return `https://storage.googleapis.com/${bucket.name}/${file.name}`;
        });

        const uploadedImages = await Promise.all(uploadPromises);
        imageUrls = [...imageUrls, ...uploadedImages];
    }

    // Update post
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
                const locationId = await postData.locationRef.get();
                const locationData = locationId.data();
                postData.location = locationData;
                postData.locationRef = null;
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

exports.closePost = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to close a post.');
    }

    const postId = data.postId;

    try {
        const postRef = admin.firestore().collection('posts').doc(postId);

        await postRef.update({
            status: 'Closed'
        });

        return { message: 'Post closed successfully.' };
    } catch (error) {
        throw new functions.https.HttpsError('internal', 'An error occurred while closing the post.', error.message);
    }
});

exports.purchasePost = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to purchase a post.');
    }

    const postId = data.postId;

    try {
        const postRef = admin.firestore().collection('posts').doc(postId);

        await postRef.update({
            status: 'InReserve'
        });

        return { message: 'Post purchased successfully.' };
    } catch (error) {
        throw new functions.https.HttpsError('internal', 'An error occurred while purchasing the post.', error.message);
    }
});

exports.blockPost = functions.https.onCall(async (data, context) => {
    if (!context.auth || !context.auth.token.admin) {
        throw new functions.https.HttpsError('permission-denied', 'You do not have permission to block a post.');
    }

    const postId = data.postId;

    try {
        const postRef = admin.firestore().collection('posts').doc(postId);

        await postRef.update({
            status: 'Blocked'
        });

        return { message: 'Post blocked successfully.' };
    } catch (error) {
        throw new functions.https.HttpsError('internal', 'An error occurred while blocking the post.', error.message);
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

        if (data.locationRef) {
            const locationId = await data.locationRef.get();
            const locationData = locationId.data();
            data.location = locationData;
            data.locationRef = null;
        }

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

        return snapshot.docs.map(async (doc) => {
            const postData = doc.data();

            if (postData.locationRef) {
                const locationId = await postData.locationRef.get();
                const locationData = locationId.data();
                postData.location = locationData;
                postData.locationRef = null;
            }

            return {id: doc.id, ...postData};
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
            const messagesRef = admin.firestore().collection('chats').doc(chatId).collection('messages');
            const messagesSnapshot = await messagesRef.get();
            const messages = messagesSnapshot.docs.map(doc => doc.data());
            const lastMessage = messages > 0 ? messages[messages.length - 1] : null;
            let lastMessageTimestamp = 0;
            const isOurs = lastMessage ? lastMessage.senderId === userId : false;
            const totalMessages = messages.filter(message => !message.isRead && (message.senderId !== userId)).length;
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

exports.markChatAsRead = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to mark the chat as read.');
    }

    const { chatId } = data;
    const userId = context.auth.uid;

    try {
        const chatRef = admin.firestore().collection('chats').doc(chatId);
        const chatDoc = await chatRef.get();

        if (!chatDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Chat not found');
        }

        const chatData = chatDoc.data();

        if (chatData.user1 !== userId && chatData.user2 !== userId) {
            throw new functions.https.HttpsError('permission-denied', 'You do not have permission to mark this chat as read');
        }

        const messagesRef = chatRef.collection('messages');
        const querySnapshot = await messagesRef.where('isRead', '==', false).get();

        const updatePromises = querySnapshot.docs.map(doc => {
            const messageRef = messagesRef.doc(doc.id);
            return messageRef.update({ isRead: true });
        });

        await Promise.all(updatePromises);

        return { success: true, message: 'Chat marked as read' };
    } catch (error) {
        throw new functions.https.HttpsError('internal', 'An error occurred while marking the chat as read.', error.message);
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
        timestamp,
        isRead: false
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
