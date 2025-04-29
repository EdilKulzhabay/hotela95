const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

const createWhatsAppClient = () => {
    const client = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: {
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox"]
        },
    });

    client.on("qr", (qr) => {
        qrcode.generate(qr, { small: true });
    });

    client.on("authenticated", () => {
        console.log("WhatsApp аутентификация успешна!");
    });

    client.on("auth_failure", (msg) => {
        console.error("Ошибка аутентификации WhatsApp:", msg);
    });

    client.on("ready", () => {
        console.log("WhatsApp клиент готов!");
    });

    return client;
};

module.exports = createWhatsAppClient; 