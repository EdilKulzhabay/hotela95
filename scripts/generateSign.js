const crypto = require("crypto");
require("dotenv").config();

const generateSign = (params) => {
    const sortedParams = Object.keys(params).sort().map(key => `${key}=${params[key]}`).join('');
    const dataToHash = sortedParams + process.env.PRIVATE_KEY;
    console.log(dataToHash);
    
    const sign = crypto.createHash('md5').update(dataToHash).digest('hex');
    return sign;
}

module.exports = { generateSign };
