import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";


const firestore = getFirestore();

export const getReviews_v2 = onCall(async (request) => {
    try {
        const { userId } = request.data;

        if (!userId) {
            throw new HttpsError("invalid-argument", "Please provide the userId.");
        }

        const userRef = firestore.collection("users").doc(userId);

        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            throw new HttpsError("not-found", "User not found.");
        }

        const { rating = 0 } = userDoc.data() || {};

        const ratingCollectionSnapshot = await userRef.collection("rating").get();

        if (ratingCollectionSnapshot.empty) {
            return {
                rating,
                reviews: [],
            };
        }

        const reviews = ratingCollectionSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));

        return {
            rating,
            reviews,
        };
    } catch (error) {
        console.error(error);

        if (error instanceof HttpsError) {
            throw error;
        } else {
            throw new HttpsError("internal", "An error occurred while fetching the reviews.", error.message);
        }
    }
});
