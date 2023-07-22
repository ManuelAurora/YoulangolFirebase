const functions = require('firebase-functions');
const admin = require('firebase-admin');


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
