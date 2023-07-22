const functions = require('firebase-functions');
const admin = require('firebase-admin');


exports.registerUser = functions.https.onCall(async (data) => {
        try {
            const { uid } = data;

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
    }
);
