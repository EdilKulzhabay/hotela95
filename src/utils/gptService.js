const axios = require('axios');

const gptResponse = async (text, lastMessages, prompt) => {
    const messages = [
        {
            role: "system",
            content: prompt,
        },
        ...lastMessages.map((msg) => ({
            role: msg.role,
            content: msg.content,
        })),
        {
            role: "user",
            content: text,
        },
    ];

    try {
        const response = await axios.post(
            "https://api.openai.com/v1/chat/completions",
            {
                model: "gpt-4o",
                messages,
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                },
            }
        );

        return response.data.choices[0].message.content;
    } catch (error) {
        console.error("Ошибка запроса к GPT:", error.message);
        return "Извините, произошла ошибка при обработке вашего запроса.";
    }
};

module.exports = { gptResponse }; 