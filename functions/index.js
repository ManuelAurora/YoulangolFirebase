const admin = require('firebase-admin');

const { registerUser } = require('./user/registerUser');
const { updateUser } = require('./user/updateUser');
const { getUser } = require('./user/getUser');

const { getUserById } = require('./user/getUserById');

const { blockPost } = require('./posts/blockPost');
const { closePost } = require('./posts/closePost');
const { createPost } = require('./posts/createPost');
const { editPost } = require('./posts/editPost');
const { getPostById } = require('./posts/getPostById');
const { getPosts } = require('./posts/getPosts');
const { getPostsByUser } = require('./posts/getPostsByUser');
const { purchasePost } = require('./posts/purchasePost');
const { getChatUsersForClosedPost } = require('./posts/getChatUsersForClosedPost');
const { getPostUserData } = require('./posts/getPostUserData');
const { createChat } = require('./chat/createChat');
const { getChatById } = require('./chat/getChatById');
const { getChats } = require('./chat/getChats');
const { sendMessage } = require('./chat/sendMessage');
const { addRating } = require('./rating/addRating');
const { getReviews } = require('./rating/getReviews');
const { addPostToFavorite } = require('./favorite/addPostToFavorite');
const { removePostFromFavorite } = require('./favorite/removePostFromFavorite');
const { getFavoritePosts } = require('./favorite/getFavoritePosts');
const { sendEmail } = require('./support/sendEmail');

admin.initializeApp();


exports.registerUser = registerUser;
exports.updateUser = updateUser;
exports.getUser = getUser;

exports.getUserById = getUserById;

exports.purchasePost = purchasePost;
exports.blockPost = blockPost;
exports.closePost = closePost;
exports.createPost = createPost;
exports.editPost = editPost;
exports.getPostById = getPostById;
exports.getPosts = getPosts;
exports.getPostsByUser = getPostsByUser;
exports.getChatUsersForClosedPost = getChatUsersForClosedPost;
exports.getPostUserData = getPostUserData;

exports.createChat = createChat;
exports.getChatById = getChatById;
exports.getChats = getChats;
exports.sendMessage = sendMessage;

exports.addRating = addRating;
exports.getReviews = getReviews;

exports.addPostToFavorite = addPostToFavorite;
exports.removePostFromFavorite = removePostFromFavorite;
exports.getFavoritePosts = getFavoritePosts;

exports.sendEmail = sendEmail;
