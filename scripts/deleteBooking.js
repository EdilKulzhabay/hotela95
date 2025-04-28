const { default: axios } = require("axios");
const { generateSign } = require("./generateSign");
require("dotenv").config();

// const id = "97135787"
// const apartment_id = "96726"

// const params = {
//     id,
//     apartment_id
// }

// Функция для получения броней
const deleteBooking = async (params) => {
    const url = `https://realtycalendar.ru/api/v1/apartments/${params.apartment_id}/event_calendars/${params.id}`;

    // Добавляем подпись к параметрам запроса
    const sign = generateSign(params)

    try {
        const response = await axios.delete(url, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
            },
            params: { sign }
        });

        if (response.status === 204) {
            console.log("delete is success: ", response);
            return {success: true}
        } else {
            console.log("delete is error: ", response);
            return {success: false}
        }
    } catch (error) {
        if (error.response) {
            console.error('Error Response:', error.response.data);
            console.error('Status Code:', error.response.status);
        } else {
            console.error('Error Message:', error.message);
        }
    }
}

// deleteBooking(params)

module.exports = { deleteBooking };
