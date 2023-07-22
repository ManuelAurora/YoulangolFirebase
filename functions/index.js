const admin = require('firebase-admin');

const { editProfile } = require('./user/editProfile');
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
const { createChat } = require('./chat/createChat');
const { getChatById } = require('./chat/getChatById');
const { getChats } = require('./chat/getChats');
const { markChatAsRead } = require('./chat/markChatAsRead');
const { sendMessage } = require('./chat/sendMessage');
const { addRating } = require('./rating/addRating');


admin.initializeApp();


exports.editProfile = editProfile;
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

exports.createChat = createChat;
exports.getChatById = getChatById;
exports.getChats = getChats;
exports.markChatAsRead = markChatAsRead;
exports.sendMessage = sendMessage;

exports.addRating = addRating;
