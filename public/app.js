const requestModal = document.querySelector('.new-request');
const requestLink = document.querySelector('.add-request');
import firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/firestore';
const admin = require('firebase-admin');

admin.initializeApp();

requestLink.addEventListener('click', () => {
    requestModal.classList.add('open');
})

requestModal.addEventListener('click', (e) => {
    if (e.target.classList.contains('new-request')) {
        console.log('Hello!');
    }
})


const button = document.querySelector('.call');
//
// button.addEventListener('click', () => {
//         const id = generateRandomString();
//         const price = generateRandomPrice();
//         const randomCity = cities[Math.floor(Math.random() * cities.length)];
//         const location = {
//             city: randomCity,
//             latitude: cityCoordinates[randomCity].latitude,
//             longitude: cityCoordinates[randomCity].longitude,
//             description: `Angola ${randomCity}`,
//             displayName: randomCity
//         };
//         const timestamp = generateRandomTimestamp();
//         const post = {
//             id,
//             image: 'https://www.meme-arsenal.com/memes/1f20c507a102ba45460319c2b92c1b69.jpg',
//             price,
//             title: 'Title',
//             categoryId: 'pron',
//             timestamp,
//             ownerId: 'abc',
//             description: 'Random description',
//             images: [
//                 'https://www.meme-arsenal.com/memes/1f20c507a102ba45460319c2b92c1b69.jpg',
//                 'https://www.meme-arsenal.com/memes/1f20c507a102ba45460319c2b92c1b69.jpg'
//             ],
//             location
//         };
//         console.log(post);
// });


// DEBUGGING
