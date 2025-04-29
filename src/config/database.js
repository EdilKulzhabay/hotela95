const mongoose = require('mongoose');

const connectDatabase = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/tapToLink");
        console.log("MongoDB подключено успешно");
    } catch (error) {
        console.error("Ошибка подключения к MongoDB:", error);
        process.exit(1);
    }
};

module.exports = connectDatabase; 