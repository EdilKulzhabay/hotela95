const axios = require('axios');
const globalVar = require('../utils/globalVar');

const getToken = async () => {
    const response = await axios.post("https://realtycalendar.ru/v2/sign_in", 
        {
            username: process.env.REALTYCALENDAR_USERNAME,
            password: process.env.REALTYCALENDAR_PASSWORD
        }
    )

    if (response.data.success) {
        globalVar.setVar(response.data.auth_token)
    } else {
        console.log("hz che delat");
    }
}
/**
 * Создает ссылку для бронирования квартир
 * @param {String} startDate - дата начала бронирования (формат YYYY-MM-DD)
 * @param {String} endDate - дата окончания бронирования (формат YYYY-MM-DD)
 * @param {Array} apartments - массив квартир для бронирования
 * @returns {Promise<Object>} - объект с ссылкой и данными
 */
const getLink = async (startDate, endDate, apartments) => {
    try {
        if (globalVar.getVar() === "") {
            await getToken();
        }

        const token = globalVar.getVar()

        console.log("token = ", token);

        console.log("startDate = ", startDate);
        console.log("endDate = ", endDate);
        console.log("apartments = ", apartments);

        const getLinkBody = {
            begin_date: startDate, 
            end_date: endDate, 
            items: apartments, 
            lifetime: 0, 
            extra_charge: 0, 
            extra_charge_type: "percent", 
            guests_count: 1
        }

        try {
            const response = await axios.post(
                "https://realtycalendar.ru/v2/carts/copy_link",
                getLinkBody,
                {
                    headers: {
                        "x-user-token": token,
                        "Content-Type": "application/json"
                    }
                }
            );

            return {
                success: true,
                url: response.data.basket.url,
                items: response.data.basket.source.items
            }; 
        } catch (error) {
            console.error("Ошибка в getLink:", error.response?.data?.errors || error.message);
            if (error.response.data.errors[0] === 'Вам необходимо войти в систему или зарегистрироваться.') {
                return {
                    success: false,
                    error: "Вам необходимо войти в систему или зарегистрироваться."
                }
            } else {
                return {
                    success: false,
                    error: "Не удалось получить ссылку"
                }
            }
        }
    } catch (error) {
        console.error("Ошибка в getLink:", error.message);
        return { success: false, error: `Ошибка API: ${error.message}` };
    }
};

module.exports = { getLink, getToken };