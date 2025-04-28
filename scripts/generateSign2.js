const crypto = require("crypto");
require("dotenv").config();

const paramsToString = (params) => {
    if (typeof params !== "object" || params === null) {
        return String(params); // Преобразуем примитивы в строку
    }

    const sortedKeys = Object.keys(params).sort();
    return sortedKeys
        .map(key => {
            const value = params[key];
            if (typeof value === "object" && value !== null) {
                return `${key}=${paramsToString(value)}`;
            }
            return `${key}=${value}`;
        })
        .join('');
};

const generateSign2 = (params) => {
    const sortedParamsString = paramsToString(params);
    const dataToHash = sortedParamsString + process.env.PRIVATE_KEY;
    console.log("String to hash:", dataToHash); // Для отладки
    const sign = crypto.createHash('md5').update(dataToHash).digest('hex');
    return sign;
};

module.exports = { generateSign2 };