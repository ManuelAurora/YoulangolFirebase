const requestModal = document.querySelector('.new-request');
const requestLink = document.querySelector('.add-request');

requestLink.addEventListener('click', () => {
    requestModal.classList.add('open');
})

requestModal.addEventListener('click', (e) => {
    if (e.target.classList.contains('new-request')) {
        console.log('Hello!');
    }
})


const button = document.querySelector('.call');

button.addEventListener('click', () => {
    console.log("Did ckick")

    fetch('https://us-central1-youlangol.cloudfunctions.net/sayHello', { method: 'POST' })
        .then(response => response.text())
        .then(data => console.log(data)); // output: "helllo, ninjas"
});

button.addEventListener('click', () => {
    console.log('Hello!');
    // add your code here to perform some action when the button is clicked
});
