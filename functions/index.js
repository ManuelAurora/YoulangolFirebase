const admin = require('firebase-admin');

const { updateUser } = require('./user/updateUser');
const { getUser } = require('./user/getUser');

const { getUserById } = require('./user/getUserById');

const { closePost } = require('./posts/closePost');
const { createPost } = require('./posts/createPost');
const { getPostById } = require('./posts/getPostById');
const { getPosts } = require('./posts/getPosts');
const { getPostsByUser } = require('./posts/getPostsByUser');
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

const { createOrder } = require('./orders/createOrder');
const { getOrders } = require('./orders/getOrders');
const { getOrderById } = require('./orders/getOrderById');
const { approveOrder } = require('./orders/approveOrder');

const { getPickupPoints } = require('./orders/getPickupPoints');

admin.initializeApp();


exports.updateUser = updateUser;
exports.getUser = getUser;

exports.getUserById = getUserById;

exports.closePost = closePost;
exports.createPost = createPost;
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

exports.createOrder = createOrder;
exports.getOrders = getOrders;
exports.getOrderById = getOrderById;
exports.approveOrder = approveOrder;

exports.getPickupPoints = getPickupPoints;

exports.sendEmail = sendEmail;
