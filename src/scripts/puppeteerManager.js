const puppeteer = require("puppeteer");

let browserInstance = null;

const getBrowser = async () => {
    if (!browserInstance) {
        browserInstance = await puppeteer.launch({
            headless: false, // Отключаем headless для диагностики
            args: ["--no-sandbox", "--disable-setuid-sandbox"]
        });
    }
    return browserInstance;
};

const closeBrowser = async () => {
    if (browserInstance) {
        await browserInstance.close();
        browserInstance = null;
        console.log("Браузер закрыт.");
    }
};

module.exports = { getBrowser, closeBrowser };