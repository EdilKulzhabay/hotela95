/**
 * Модуль для управления глобальными переменными
 * Используется как временное хранилище между запросами
 */

let globalVar = '';

/**
 * Установить значение глобальной переменной
 * @param {String} value - новое значение
 */
const setVar = (value) => {
    globalVar = value;
};

/**
 * Получить значение глобальной переменной
 * @returns {String} - текущее значение
 */
const getVar = () => {
    return globalVar;
};

module.exports = {
    setVar,
    getVar
}; 