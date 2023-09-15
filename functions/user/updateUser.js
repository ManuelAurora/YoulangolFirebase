const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.updateUser = functions.https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to update your profile.');
        }

        const {
            displayName,
            image,
            email,
            phoneNumber
        } = data;

        const userId = context.auth.uid;

        if (displayName) {
            await admin.auth().updateUser(userId, { displayName })
        }

        if (email) {
            await admin.auth().updateUser(userId, { email })
        }

        if (phoneNumber) {
            await admin.auth().updateUser(userId, { phoneNumber })
        }

        if (image && image.base64 && image.mimeType) {
            const userFolder = `User_${userId}`;
            const userFolderRef = admin.storage().bucket().file(userFolder);

            const [userFolderExists] = await userFolderRef.exists();

            if (!userFolderExists) {
                await userFolderRef.save('');
            }

            const base64WithoutPrefix = image.base64.replace(/^data:image\/[^;]+;base64,/, '');
            const imageBuffer = Buffer.from(base64WithoutPrefix, 'base64');

            const photoFileName = `avatar_${Date.now()}.${image.mimeType.split('/')[1]}`;

            const photoFileRef = admin.storage().bucket().file(`${userFolder}/${photoFileName}`);
            await photoFileRef.save(imageBuffer, { metadata: { contentType: image.mimeType } });

            const photoURL = `https://storage.googleapis.com/${admin.storage().bucket().name}/${photoFileRef.name}`

            await admin.auth().updateUser(userId, { photoURL })
        }

        const userDoc = await admin.firestore().collection('users').doc(userId).get();

        const userRecord = await admin.auth().getUser(userId);

        return {
            id: userId,
            creationTime: userRecord.metadata.creationTime,
            emailVerified: userRecord.emailVerified,
            name: userRecord.displayName,
            email: userRecord.email,
            phone: userRecord.phoneNumber,
            photoURL: userRecord.photoURL,
            disabled: userRecord.disabled,
            ...userDoc.data()
        };
    } catch (error) {
        console.error(error);

        if (error instanceof functions.https.HttpsError) {
            throw error;
        } else {
            throw new functions.https.HttpsError('internal', 'An error occurred while updating the profile.', error.message);
        }
    }
});
