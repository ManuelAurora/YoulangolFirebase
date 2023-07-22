const functions = require('firebase-functions');
const admin = require('firebase-admin');

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

