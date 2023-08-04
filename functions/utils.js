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


module.exports = {
    getFirstImage,
};
