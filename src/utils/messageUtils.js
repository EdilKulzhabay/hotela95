/**
 * Обновляет историю сообщений пользователя
 * @param {Object} user - объект пользователя
 * @param {String} message - содержание сообщения
 * @param {String} role - роль отправителя (user/assistant)
 */
const updateLastMessages = (user, message, role) => {
    user.lastMessages.push({ role, content: message });
    if (user.lastMessages.length > 20) {
        user.lastMessages.shift();
    }
};

/**
 * Вычисляет количество дней между двумя датами
 * @param {String} startDate - начальная дата
 * @param {String} endDate - конечная дата
 * @returns {Number} - количество дней
 */
const calculateDaysBetweenDates = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const timeDifference = end - start;
    const daysDifference = timeDifference / (1000 * 3600 * 24);

    return daysDifference;
};

/**
 * Конвертирует дату из формата YYYY-MM-DD в DD.MM.YYYY
 * @param {String} dateString - дата в формате YYYY-MM-DD
 * @returns {String} - дата в формате DD.MM.YYYY
 */
const convertDateFormat = (dateString) => {
    const [year, month, day] = dateString.split(".");
    return `${day}.${month}.${year}`;
};

module.exports = {
    updateLastMessages,
    calculateDaysBetweenDates,
    convertDateFormat
}; 