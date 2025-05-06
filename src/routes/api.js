const express = require('express');
const router = express.Router();
const { gptResponse } = require('../utils/gptService');
const User = req.app.get('userModel');

/**
 * Отправка сообщения клиенту по номеру телефона
 */
// router.post("/test", async (req, res) => {
//     try {
//         const { phone, date, whatsNum } = req.body;
        
//         if (!phone || !date || !whatsNum) {
//             return res.status(400).json({ success: false, error: "Не все поля заполнены" });
//         }

//         // Получаем форматированную дату через GPT
//         const prompt = "Преобразуй дату в формат YYYY-MM-DD";
//         const formattedDate = await gptResponse(date, [], prompt);
        
//         // Определяем номер телефона для поиска/сохранения
//         const phoneNumber = whatsNum || phone;
//         // Форматируем номер телефона, оставляя только цифры
//         const formattedWhatsNum = whatsNum ? whatsNum.replace(/\D/g, '') : null;
        
//         // Если номер начинается с 8, заменяем на 7
//         const normalizedWhatsNum = formattedWhatsNum ? 
//             (formattedWhatsNum.startsWith('8') ? '7' + formattedWhatsNum.slice(1) : formattedWhatsNum) : null;

//         // Ищем или создаем пользователя
//         let user = await User.findOne({ phone: `${normalizedWhatsNum}@c.us` });
        
//         if (user) {
//             // Обновляем существующего пользователя
//             user.bookingDate = {
//                 ...user.bookingDate,
//                 startDate: formattedDate
//             };
//             await user.save();
//         } else {
//             // Создаем нового пользователя
//             user = await User.create({
//                 phone: `${phoneNumber}@c.us`,
//                 bookingDate: {
//                     startDate: formattedDate
//                 }
//             });
//         }

//         // Отправляем приветственное сообщение и запрашиваем дополнительную информацию
//         const welcomeMessage = "Здравствуйте! Я помощник APARTMENTS95. С радостью помогу вам с арендой квартиры. До какой даты планируете проживание и сколько будет человек? client";
        
//         // Обновляем последние сообщения пользователя
//         user.lastMessages = [
//             ...user.lastMessages || [],
//             {
//                 role: "assistant",
//                 content: welcomeMessage
//             }
//         ];
//         await user.save();
        
//         res.status(200).json({ success: true });
//     } catch (error) {
//         console.error("Ошибка отправки сообщения:", error);
//         res.status(500).json({ success: false, error: error.message });
//     }
// });

/**
 * Получение информации о пользователе
 */
router.get("/users/:phone", async (req, res) => {
    try {
        const { phone } = req.params;
        const User = req.app.get('userModel');
        
        const user = await User.findOne({ phone: `${phone}@c.us` });
        
        if (!user) {
            return res.status(404).json({ success: false, error: "Пользователь не найден" });
        }
        
        res.status(200).json({ success: true, user });
    } catch (error) {
        console.error("Ошибка получения пользователя:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router; 