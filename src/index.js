require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDatabase = require("./config/database");
const createWhatsAppClient = require("./config/whatsapp");
const { handleIncomingMessage, handleAdminCommands } = require("./controllers/messageController");
const apiRoutes = require("./routes/api");
const User = require("./models/User");
const Apartment = require("./models/Apartment");

// Подключение к базе данных
connectDatabase();

// Инициализация WhatsApp клиента
const client = createWhatsAppClient();

// Инициализация Express сервера
const app = express();
app.use(express.json());
app.use(cors({ origin: "*" }));

// Предоставление моделей и клиента WhatsApp для роутов
app.set('whatsappClient', client);
app.set('userModel', User);
app.set('apartmentModel', Apartment);

// Маршруты API
app.use("/api", apiRoutes);

// Обработчики событий WhatsApp
client.on('message_create', async (msg) => {
    if (msg.fromMe) {
        const chatId = msg.to;
        const message = msg.body;
        await handleAdminCommands(message, chatId);
    }
});

client.on("message", async (msg) => {
    await handleIncomingMessage(msg, client);
});

// Запуск сервера
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});

// Инициализация WhatsApp клиента
client.initialize().catch(err => {
    console.error("Ошибка инициализации WhatsApp клиента:", err);
}); 