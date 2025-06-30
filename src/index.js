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
client.on("message_create", async (msg) => {
    // Обрабатываем только исходящие сообщения от бота (fromMe = true)
    if (msg.fromMe) {
        const chatId = msg.to;
        console.log("Исходящее сообщение от бота:", msg.body);
        
        try {
            const message = msg.body.toLowerCase().trim();
            if (
                message.includes("здравствуйте. меня зовут") ||
                message.includes("здравствуйте! меня зовут") ||
                message.includes("здравствуйте, меня зовут") ||
                message.includes("здравствуйте меня зовут") ||
                message.includes("здравствуйте.меня зовут") ||
                message.includes("здравствуйте!меня зовут") ||
                message.includes("здравствуйте,меня зовут") ||
                message.includes("здравствуйте👋") ||
                message.includes("салем👋") ||
                message.includes("👋")
            ) {
                await User.findOneAndUpdate(
                    { phone: chatId },
                    { $set: { status: true } },
                    { new: true, upsert: true }
                );
            }
        } catch (error) {
            console.error("Ошибка при обработке message_create:", error);
        }
    }
});

client.on("message", async (msg) => {
    // Обрабатываем только входящие сообщения (fromMe = false)
    if (!msg.fromMe) {
        console.log("=== ВХОДЯЩЕЕ СООБЩЕНИЕ ===");
        console.log("Тип сообщения:", msg.type);
        console.log("Текст сообщения:", msg.body);
        console.log("От пользователя:", msg.from);
        console.log("Имя:", msg._data.notifyName);
        console.log("========================");
        
        const user = await User.findOne({ phone: msg.from });
        if (user && user.status) {
            console.log("Пропускаем сообщение - пользователь уже в статусе");
        } else {
            await handleIncomingMessage(msg, client);
        }
    }
});


app.post("/api/test", async (req, res) => {
    try {
        const { phone, date, whatsNum } = req.body;
        console.log("req.body = ", req.body);
        if (!phone || !date) {
            return res.status(400).json({ success: false, error: "Не все поля заполнены" });
        }

        // Форматирование даты через GPT
        const today = new Date().toISOString().split('T')[0];
        const prompt = `Сегодня ${today}. Преобразуй дату "${date}" в формат YYYY-MM-DD. Учитывай следующие варианты:
1. Если указан день недели (понедельник, вторник и т.д.), найди ближайшую такую дату
2. Если указано "завтра", "послезавтра", "через N дней", посчитай нужную дату
3. Если указана конкретная дата (15 января, 15.01 и т.д.), преобразуй ее
4. Если указано "на выходных", найди ближайшие выходные
Верни только дату в формате YYYY-MM-DD без пояснений`;
        const formattedDate = await gptResponse(date, [], prompt);

        // Нормализация телефона
        const rawNum = whatsNum || phone;
        const digits = rawNum.replace(/\D/g, '');
        const normalized = digits.startsWith("8") ? "7" + digits.slice(1) : digits;
        const phoneKey = `${normalized}@c.us`;

        const welcomeMessage = "Здравствуйте! Я помощник APARTMENTS95. С радостью помогу вам с арендой квартиры. До какой даты планируете проживание и сколько будет человек?";

        // Обновляем или создаем пользователя за одну операцию
        await User.findOneAndUpdate(
            { phone: phoneKey },
            {
                $set: { "bookingDate.startDate": formattedDate, last_message_date: today },
                $push: { lastMessages: { role: "assistant", content: welcomeMessage } }
            },
            { new: true, upsert: true }
        );

        // Отправка сообщения
        client.sendMessage(phoneKey, welcomeMessage);

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error("Ошибка отправки сообщения:", error);
        return res.status(500).json({ success: false, error: error.message });
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