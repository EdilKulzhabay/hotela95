const { getBrowser } = require("./scripts/puppeteerManager");
const fs = require('fs')
const globalCookies = require("./globalCookies");
const { default: axios } = require("axios");
// require("dotenv").config();

const COOKIES_PATH = './cookies.json';

const sendKaspiRequest = async (cookies) => {
    const cookieString = Object.entries(cookies)
        .map(([key, value]) => `${key}=${value}`)
        .join('; ');
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0];

    // console.log("cookieString = ", cookieString);
    // console.log("formattedDate = ", formattedDate);
    

    const requestBody = {
        searchText: "",
        searchType: "0",
        startDate: `${formattedDate}T00:00:00`,
        endDate: `${formattedDate}T23:59:59`,
        services: ["7267"]
    };

    try {
        const response = await axios.post(
            'https://merchant.kaspi.kz/new/Operation/GetOperations',
            requestBody,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json, text/javascript, */*; q=0.01',
                    'Cookie': cookieString,
                    'Host': 'merchant.kaspi.kz',
                    'Origin': 'https://merchant.kaspi.kz',
                    'Referer': 'https://merchant.kaspi.kz/new',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            }
        );
        console.log('Ответ от Kaspi.kz:', response.data.data);
        return response.data.data;
    } catch (error) {
        console.error('Ошибка запроса:', error.response ? error.response.data : error.message);
        if (error.response?.status === 401) {
            return false;
        }
        throw error; // Пробрасываем ошибку дальше
    }
};

const authenticateAndGetCookies = async (page) => {
    try {
        if (fs.existsSync(COOKIES_PATH)) {
            try {
                const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
                await page.setCookie(...cookies);
            } catch (error) {
                console.error("Ошибка чтения cookies.json. Перезаписываем файл...", error);
                fs.writeFileSync(COOKIES_PATH, '[]'); // Перезаписываем пустым массивом
            }
        }

        await page.goto('https://merchant.kaspi.kz/new', { waitUntil: 'networkidle2' });

        const isLoggedIn = await page.evaluate(() => {
            return !!document.querySelector('a[href*="logout"]') || !!document.querySelector('.logout-button');
        });

        if (!isLoggedIn) {
            console.log('Требуется авторизация.');
            const loginInput = await page.$('#Login');
            if (loginInput) {
                await new Promise(resolve => setTimeout(resolve, 3000));
                await page.click('#Login');
                await new Promise(resolve => setTimeout(resolve, 2000));
                await page.type('#Login', process.env.login);
                await page.click('#submit');
                await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
                console.log("login if");
            }

            const passwordInput = await page.$('#Password');
            if (passwordInput) {
                await page.type('#Password', process.env.pass);
                await page.click('#submit');
                await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
                console.log("password if");
            }
        } else {
            console.log('Вы уже авторизованы.');
        }

        const cookiesArray = await page.cookies();
        console.log("line 95 cookiesArray = ", cookiesArray);
        
        fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookiesArray, null, 2));
        return cookiesArray;
    } catch (error) {
        console.error('Ошибка авторизации:', error);
        throw error;
    }
};

const kaspiParser = async (phone) => {
    let cookieTokens = globalCookies.getGlobalCookes();
    let cookies = {
        CSRF_Token: cookieTokens.CSRF_Token,
        Auth_Token: cookieTokens.Auth_Token,
        Security_Token: cookieTokens.Security_Token,
        Session_Token: cookieTokens.Session_Token
    };

    let responseSendKaspiRequest = await sendKaspiRequest(cookies);

    if (!responseSendKaspiRequest) {
        const browser = await getBrowser();
        let page;
        try {
            page = await browser.newPage();
            const cookiesArray = await authenticateAndGetCookies(page);

            console.log("cookiesArray = ", cookiesArray);
            

            cookies = {
                CSRF_Token: cookiesArray.find(cookie => cookie.name === 'CSRF_Token')?.value,
                Auth_Token: cookiesArray.find(cookie => cookie.name === 'Auth_Token')?.value,
                Security_Token: cookiesArray.find(cookie => cookie.name === 'Security_Token')?.value,
                Session_Token: cookiesArray.find(cookie => cookie.name === 'Session_Token')?.value
            };

            globalCookies.setSession_Token(cookies.Session_Token);
            globalCookies.setSecurity_Token(cookies.Security_Token);
            globalCookies.setAuth_Token(cookies.Auth_Token);
            globalCookies.setCSRF_Token(cookies.CSRF_Token);

            responseSendKaspiRequest = await sendKaspiRequest(cookies);
        } catch (error) {
            console.error('Ошибка в процессе парсинга:', error);
            if (page) await page.close();
            await browser.close();
            return null;
        } finally {
            if (page) await page.close();
            await browser.close();
        }
    }

    if (responseSendKaspiRequest) {
        console.log("line 155 responseSendKaspiRequest = ", responseSendKaspiRequest);
        
        const clientPay = responseSendKaspiRequest.find((item) => {
            if (!item.parameters) return false;
            const numbers = item.parameters.match(/\d+/g)?.join('');
            return numbers === phone;
        });

        if (clientPay) {
            console.log(`Найден клиент: ${phone}:`, clientPay);
            return clientPay.amount;
        } else {
            console.log(`Клиент ${phone} не найден.`);
            return null;
        }
    }

    return null;
};

// kaspiParser("77006837203")
module.exports = { kaspiParser };