const { default: axios } = require("axios");
const crypto = require("crypto");
const { generateSign } = require("./generateSign");
require("dotenv").config();

const threeWeeksAgo = new Date();
threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21);
const begin_date = threeWeeksAgo.toISOString().split('T')[0]; // Формат YYYY-MM-DD

// Получаем завтрашнюю дату
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const end_date = tomorrow.toISOString().split('T')[0]; // Формат YYYY-MM-DD

// Формируем параметры запроса
const params = {
    begin_date,
    end_date
};

// Функция для получения броней
const fetchBookings = async (phone) => {
    const url = `https://realtycalendar.ru/api/v1/bookings/${process.env.PUBLIC_KEY}`;
    console.log("phone: ", phone);

    // Добавляем подпись к параметрам запроса
    const requestBody = {
        ...params,
        sign: generateSign(params)
    };

    try {
        const response = await axios.post(url, requestBody, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
            }
        });

        if (response.status === 200) {
            const bookings = response.data.bookings
            const booked = bookings.find((item) => {
                return item.client && item.client.phone && item.client.phone.match(/\d/g).join('') === phone && !item.is_delete;
            });
            console.log("We here, booked is: ", booked);
            
            if (booked) {
                const res = {success: true, booked}
                console.log(booked);
                
                return res
            } else {
                const res = {success: false, booked: null}
                return res
            }
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

module.exports = { fetchBookings };
