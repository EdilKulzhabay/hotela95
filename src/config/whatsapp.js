const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

const createWhatsAppClient = () => {
    console.log("🔄 Создаю WhatsApp клиент...");
    
    const client = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: {
            headless: true,
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox", 
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--disable-extensions",
                "--disable-background-timer-throttling",
                "--disable-backgrounding-occluded-windows",
                "--disable-renderer-backgrounding",
                "--disable-features=TranslateUI",
                "--disable-web-security",
                "--no-first-run",
                "--no-default-browser-check"
            ],
            timeout: 90000, // Увеличенный таймаут до 90 секунд
            defaultViewport: null,
        },
        webVersionCache: {
            type: 'remote',
            remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
        }
    });

    client.on("qr", (qr) => {
        console.log("📱 Получен QR код для сканирования");
        qrcode.generate(qr, { small: true });
    });

    client.on("loading_screen", (percent, message) => {
        console.log("⏳ Загрузка:", percent, "%", message);
    });

    client.on("authenticated", () => {
        console.log("✅ WhatsApp аутентификация успешна!");
        console.log("⏳ Ожидание события 'ready'... Это может занять несколько минут");
        
        // Добавляем таймер для отслеживания проблемы
        const readyTimeout = setTimeout(() => {
            console.log("⚠️ ВНИМАНИЕ: Прошло 3 минуты после аутентификации, но событие 'ready' не произошло");
            console.log("Это может означать:");
            console.log("1. Проблемы с интернет-соединением");
            console.log("2. Проблемы с Puppeteer на сервере");  
            console.log("3. WhatsApp заблокировал подключение");
            console.log("4. Недостаточно ресурсов сервера");
            console.log("Рекомендация: перезапустите бота через 5 минут");
        }, 180000); // 3 минуты
        
        // Очищаем таймер когда ready сработает
        client.once('ready', () => {
            clearTimeout(readyTimeout);
        });
    });

    client.on("auth_failure", (msg) => {
        console.error("❌ Ошибка аутентификации WhatsApp:", msg);
    });

    client.on("ready", () => {
        console.log("🎉 WhatsApp клиент готов!");
        console.log("🤖 Бот готов принимать сообщения!");
        console.log("📞 Информация о клиенте:", client.info);
    });

    client.on("disconnected", (reason) => {
        console.log("🔌 WhatsApp клиент отключен:", reason);
    });

    // Добавляем обработчик ошибок
    client.on("error", (error) => {
        console.error("💥 Ошибка WhatsApp клиента:", error);
    });

    // Добавляем периодическую диагностику
    let diagnosticInterval = setInterval(() => {
        console.log("🔍 Диагностика состояния WhatsApp клиента:");
        console.log("- Состояние:", client.info ? "Готов" : "Не готов");
        console.log("- Время работы:", Math.floor(process.uptime()), "секунд");
        
        if (client.info) {
            console.log("✅ Клиент готов, останавливаю диагностику");
            clearInterval(diagnosticInterval);
        }
    }, 60000); // каждую минуту
    
    // Останавливаем диагностику через 10 минут
    setTimeout(() => {
        clearInterval(diagnosticInterval);
    }, 600000);

    console.log("✅ WhatsApp клиент создан");
    return client;
};

module.exports = createWhatsAppClient;