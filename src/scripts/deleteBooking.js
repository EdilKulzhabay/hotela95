const axios = require('axios');
const FormData = require('form-data');

/**
 * Удаление брони по идентификатору
 * @param {Object} booking - информация о брони для удаления
 * @param {String} booking.apartment_id - ID квартиры
 * @param {String} booking.id - ID брони
 * @returns {Promise<Object>} - результат операции удаления
 */
const deleteBooking = async (booking) => {
    try {
        if (!booking || !booking.apartment_id || !booking.id) {
            return { success: false, error: "Недостаточно информации для удаления брони" };
        }
        
        // Получение токена для аутентификации
        const form = new FormData();
        form.append('login', process.env.REALTYCALENDAR_USERNAME);
        form.append('password', process.env.REALTYCALENDAR_PASSWORD);

        const authResponse = await axios.post('https://realtycalendar.ru/api/v1/auth/login', form, {
            headers: {
                ...form.getHeaders(),
            },
        });

        if (!authResponse?.data?.token) {
            return { success: false, error: "Не удалось получить токен авторизации" };
        }

        const token = authResponse.data.token;
        
        // Запрос на удаление брони
        const deleteResponse = await axios.delete(
            `https://realtycalendar.ru/v2/event_calendars/${booking.id}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            }
        );
        
        if (deleteResponse.status === 200 || deleteResponse.status === 204) {
            return {
                success: true,
                message: "Бронь успешно удалена"
            };
        }
        
        return {
            success: false,
            error: "Ошибка удаления брони",
            status: deleteResponse.status
        };
    } catch (error) {
        console.error('Ошибка удаления брони:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
};

module.exports = { deleteBooking };
