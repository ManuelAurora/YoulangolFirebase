const admin = require('firebase-admin');

const { getUserById } = require('./user/getUserById');
const { registerUser } = require('./user/registerUser');
const { blockPost } = require('./posts/blockPost');
const { closePost } = require('./posts/closePost');
const { createPost } = require('./posts/createPost');
const { editPost } = require('./posts/editPost');
const { getPostById } = require('./posts/getPostById');
const { getPosts } = require('./posts/getPosts');
const { getPostsByUser } = require('./posts/getPostsByUser');
const { purchasePost } = require('./posts/purchasePost');
const { getChatUsersForClosedPost } = require('./posts/getChatUsersForClosedPost');
const { createChat } = require('./chat/createChat');
const { getChatById } = require('./chat/getChatById');
const { getChats } = require('./chat/getChats');
const { sendMessage } = require('./chat/sendMessage');
const { addRating } = require('./rating/addRating');


admin.initializeApp();


exports.getUserById = getUserById;
exports.registerUser = registerUser;

exports.blockPost = blockPost;
exports.closePost = closePost;
exports.createPost = createPost;
exports.editPost = editPost;
exports.getPostById = getPostById;
exports.getPosts = getPosts;
exports.getPostsByUser = getPostsByUser;
exports.purchasePost = purchasePost;
exports.getChatUsersForClosedPost = getChatUsersForClosedPost;

exports.createChat = createChat;
exports.getChatById = getChatById;
exports.getChats = getChats;
exports.sendMessage = sendMessage;

exports.addRating = addRating;
