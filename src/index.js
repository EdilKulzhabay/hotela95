require("dotenv").config();
const express = require("express");
const bodyParser = require('body-parser');
const cors = require("cors");
const connectDatabase = require("./config/database");
const createWhatsAppClient = require("./config/whatsapp");
const { handleIncomingMessage, handleAdminCommands } = require("./controllers/messageController");
const { gptResponse } = require("./utils/gptService");
const User = require("./models/User");
const Apartment = require("./models/Apartment");

// Подключение к базе данных
connectDatabase();

// Инициализация WhatsApp клиента
const client = createWhatsAppClient();

// Инициализация Express сервера
const app = express();
// app.use(express.json());
app.use(bodyParser.json());
app.use(cors({ origin: "*" }));

// Предоставление моделей и клиента WhatsApp для роутов
app.set('whatsappClient', client);
app.set('userModel', User);
app.set('apartmentModel', Apartment);

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


router.post("/api/test", async (req, res) => {
    try {
        const { phone, date, whatsNum } = req.body;
        
        if (!phone || !date || !whatsNum) {
            return res.status(400).json({ success: false, error: "Не все поля заполнены" });
        }

        // Получаем форматированную дату через GPT
        const prompt = "Преобразуй дату в формат YYYY-MM-DD";
        const formattedDate = await gptResponse(date, [], prompt);

        console.log("formattedDate = ", formattedDate);
        
        
        // Определяем номер телефона для поиска/сохранения
        const phoneNumber = whatsNum || phone;
        // Форматируем номер телефона, оставляя только цифры
        const formattedWhatsNum = whatsNum ? whatsNum.replace(/\D/g, '') : null;
        
        // Если номер начинается с 8, заменяем на 7
        const normalizedWhatsNum = formattedWhatsNum ? 
            (formattedWhatsNum.startsWith('8') ? '7' + formattedWhatsNum.slice(1) : formattedWhatsNum) : null;

        // Ищем или создаем пользователя
        let user = await User.findOne({ phone: `${normalizedWhatsNum}@c.us` });
        
        if (user) {
            // Обновляем существующего пользователя
            user.bookingDate = {
                ...user.bookingDate,
                startDate: formattedDate
            };
            await user.save();
        } else {
            // Создаем нового пользователя
            user = await User.create({
                phone: `${phoneNumber}@c.us`,
                bookingDate: {
                    startDate: formattedDate
                }
            });
        }

        console.log("user = ", user);

        // Отправляем приветственное сообщение и запрашиваем дополнительную информацию
        const welcomeMessage = "Здравствуйте! Я помощник APARTMENTS95. С радостью помогу вам с арендой квартиры. До какой даты планируете проживание и сколько будет человек?";

        client.sendMessage(`${normalizedWhatsNum}@c.us`, welcomeMessage);
        
        // Обновляем последние сообщения пользователя
        user.lastMessages = [
            ...user.lastMessages || [],
            {
                role: "assistant",
                content: welcomeMessage
            }
        ];
        await user.save();
        
        res.status(200).json({ success: true });
    } catch (error) {
        console.error("Ошибка отправки сообщения:", error);
        res.status(500).json({ success: false, error: error.message });
    }
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