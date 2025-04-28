const express = require('express')

const app = express();
app.use(express.json()); // Для обработки JSON-запросов

const API_KEY = "testEdil"

// Middleware для проверки API-ключа
const checkApiKey = (req, res, next) => {
  console.log("req.headers = ", req.headers);
  const providedApiKey = req.headers['x-api-key']; // Ожидаем API-ключ в заголовке
  
  
  if (!providedApiKey || providedApiKey !== API_KEY) {
    return res.status(401).json({ error: 'Недействительный или отсутствующий API-ключ' });
  }
  next();
};

// Пример API-эндпоинта для обработки запросов от стороннего сервиса
app.post('/lavaTest', checkApiKey, async (req, res) => {
  try {
    console.log("req.body = ", req.body);
    
  } catch (error) {
    console.error('Ошибка в lavaTest:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

app.get("/test1", async (req, res) => {
    console.log("we in test1");
})

// Запуск сервера
const PORT = process.env.PORT || 3005;
app.listen(PORT, async () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});