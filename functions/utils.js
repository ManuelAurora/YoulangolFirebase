const sharp = require('sharp');
const { ORDER_STATUSES, ORDER_STATES } = require('./constants');

/**
 * Получение первой картинки из массива изображений.
 *
 * @param {Array} images - Массив изображений. Должен быть массивом.
 * @returns {String} - Первая картинка из массива или '', если массив пустой или не существует.
 */
function getFirstImage(images) {
    if (!Array.isArray(images)) {
        return '';
    }

    return images[0] || '';
}

/**
 * Получение локализованных сообщений для заданного статуса заказа и его состояния.
 *
 * @param {string} status - Статус заказа (например, 'active', 'canceled', 'completed').
 * @param {Object} state - Состояние заказа, представленное объектом с флагами.
 * @returns {Object} Объект, содержащий сообщения для покупателя и продавца.
 * @throws Выбросит ошибку, если предоставлен неизвестный статус.
 *
 * @example
 * const status = 'active';
 * const state = {
 *   IS_APPROVED: false,
 *   IS_PAID: false,
 *   IS_DELIVERED: false,
 *   IS_SOLD: false,
 *   IS_PAYMENT_RECEIVED: false,
 * };
 *
 * const messages = getOrderMessages(status, state);
 * // messages: { buyer: 'waiting_for_approval', seller: 'need_to_approve' }
 */
function getOrderMessages(status, state) {
    let buyerMessage = '';
    let sellerMessage = '';

    switch (status) {
        case ORDER_STATUSES.ACTIVE:
            if (!state[ORDER_STATES.IS_APPROVED]) {
                buyerMessage = 'waiting_for_approval';
                sellerMessage = 'need_to_approve';
            } else if (!state[ORDER_STATES.IS_PAID]) {
                buyerMessage = 'need_to_pay';
                sellerMessage = 'waiting_for_payment';
            } else if (!state[ORDER_STATES.IS_DELIVERED]) {
                buyerMessage = 'waiting_for_delivery';
                sellerMessage = 'need_to_deliver';
            } else if (!state[ORDER_STATES.IS_SOLD]) {
                buyerMessage = 'need_to_check'
                sellerMessage = 'waiting_for_check';
            } else if (!state[ORDER_STATES.IS_PAYMENT_RECEIVED]) {
                buyerMessage = 'successful_purchase';
                sellerMessage = 'need_to_receive_payment';
            } else {
                buyerMessage = 'successful_purchase';
                sellerMessage = 'successful_sale';
            }

            break;

        case ORDER_STATUSES.CANCELED:
            if (state[ORDER_STATES.IS_PAID] && state[ORDER_STATES.IS_DELIVERED]) {
                buyerMessage = 'need_to_take_money';
                sellerMessage = 'need_to_take_goods';
            } else if (state[ORDER_STATES.IS_PAID]) {
                buyerMessage = 'need_to_receive_your_money';
                sellerMessage = 'successfully_canceled';
            } else if (state[ORDER_STATES.IS_DELIVERED]) {
                buyerMessage = 'successfully_canceled';
                sellerMessage = 'need_to_take_goods';
            } else {
                buyerMessage = 'successfully_canceled';
                sellerMessage = 'successfully_canceled';
            }

            break;

        case ORDER_STATUSES.COMPLETED:
            buyerMessage = 'successfully_completed';
            sellerMessage = 'successfully_completed';

            break;

        default:
            buyerMessage = 'unknown_status';
            sellerMessage = 'unknown_status';
    }

    return {
        buyer: buyerMessage,
        seller: sellerMessage
    };
}

/**
 * Обрезает и уменьшает размер изображения.
 *
 * @param {Buffer} imageBuffer - Буфер изображения для обработки.
 * @returns {Promise<Buffer>} Буфер обработанного изображения.
 */
async function processImage(imageBuffer) {
    try {
        return await sharp(imageBuffer)
            .resize({
                width: 1920,
                height: 1080,
                fit: 'inside',
            })
            .rotate()
            .toBuffer();
    } catch (error) {
        console.error('Error processing image:', error);
        throw error;
    }
}

module.exports = {
    getFirstImage,
    getOrderMessages,
    processImage,
};
