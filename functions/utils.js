import sharp from 'sharp';
import { ORDER_STATUSES, ORDER_STATES } from './constants.js';


/**
 * Получение первой картинки из массива изображений.
 *
 * Если `image` существует, она будет возвращена. В противном случае,
 * если `images` является массивом, будет возвращена первая картинка из массива.
 * Если массив пустой или не существует, возвращается пустая строка.
 *
 * @param {Object} params - Параметры функции.
 * @param {string} [params.preview] - Первая картинка, если она передана.
 * @param {Array} [params.images] - Массив изображений.
 * @returns {string} - Первая картинка из массива или пустая строка, если данных нет.
 */
export const getPreviewImage = ({ preview, images }) => preview || (Array.isArray(images) ? images[0] : '');


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
export const getOrderMessages = (status, state) => {
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
                buyerMessage = 'need_to_check';
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
        seller: sellerMessage,
    };
};

/**
 * Обрезает и уменьшает размер изображения.
 *
 * @param {Buffer} imageBuffer - Буфер изображения для обработки.
 * @param {number} [width=1920] - Максимальная ширина изображения.
 * @param {number} [height=1080] - Максимальная высота изображения.
 * @returns {Promise<Buffer>} Буфер обработанного изображения.
 */
export const processImage = async (imageBuffer, width = 1920, height = 1080) => {
    try {
        return await sharp(imageBuffer)
            .resize({
                width,
                height,
                fit: 'inside',
            })
            .rotate()
            .toBuffer();
    } catch (error) {
        console.error('Error processing image:', error);
        throw error;
    }
};
