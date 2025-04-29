const axios = require('axios');
const { generateSign2 } = require('./generateSign2');

/**
 * Добавление новой брони
 * @param {Object} userData - данные пользователя
 * @param {Object} userData.bookingDate - даты бронирования
 * @param {String} userData.phone - номер телефона клиента
 * @param {Object} apartmentData - данные о квартире
 * @param {String} apartmentData.apartment_id - ID квартиры
 * @param {Number} apartmentData.amount - сумма бронирования
 * @param {String} clientName - имя клиента
 * @returns {Promise<Object|null>} - результат бронирования или null в случае ошибки
 */
const addBooking = async (userData, apartmentData, clientName) => {
    try {
        if (!userData || !apartmentData || !userData.bookingDate || !apartmentData.apartment_id) {
            console.error('Недостаточно данных для бронирования');
            return null;
        }
        
        const url = `https://realtycalendar.ru/api/v1/apartments/${apartmentData.apartment_id}/event_calendars`;
        
        const event_calendar = {
            begin_date: userData.bookingDate.startDate,
            end_date: userData.bookingDate.endDate,
            status: 5,
            amount: apartmentData.amount,
            notes: "",
            client_attributes: {
                fio: clientName || 'Клиент',
                phone: userData.phone,
                additional_phone: "+77777777777",
                email: "vatsap@test.com",
            },
        };

        const requestBody = {
            event_calendar,
            sign: generateSign2(event_calendar) // Передаем только event_calendar, как указано в документации
        };

        console.log("Request Body:", JSON.stringify(requestBody, null, 2)); // Для отладки

        const response = await axios.post(url, requestBody, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
            }
        });

        if (response.status === 201) {
            console.log("Бронирование успешно создано:", response.data);
            return response.data;
        } else {
            console.error('Ошибка при создании бронирования:', response.data);
            return null;
        }
    } catch (error) {
        if (error.response) {
            console.error('Ошибка ответа сервера:', error.response.data);
            console.error('Код ошибки:', error.response.status);
        } else {
            console.error('Ошибка добавления брони:', error.message);
        }
        return null;
    }
};

module.exports = { addBooking };