const express = require('express');
const router = express.Router();

/**
 * Отправка сообщения клиенту по номеру телефона
 */
router.post("/test", async (req, res) => {
    try {
        // const { phone } = req.body;
        
        // if (!phone) {
        //     return res.status(400).json({ success: false, error: "Номер телефона не указан" });
        // }
        
        // const result = await whatsAppClient.sendMessage(`${phone}@c.us`, "Здравствуйте!");
        
        console.log("we in test, req.body = ", req.body);
        

        res.status(200).json({ success: true });
    } catch (error) {
        console.error("Ошибка отправки сообщения:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

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