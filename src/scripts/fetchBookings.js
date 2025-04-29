const axios = require('axios');
const FormData = require('form-data');

/**
 * Получение данных брони по номеру телефона
 * @param {String} phone - номер телефона
 * @returns {Promise<Object>} - результат операции
 */
const fetchBookings = async (phone) => {
    try {
        if (!phone) {
            return { success: false, error: "Номер телефона не указан" };
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
        
        // Поиск бронирований по номеру телефона
        const bookingsResponse = await axios.get(
            'https://realtycalendar.ru/api/v1/bookings',
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
                params: {
                    filter: {
                        where: {
                            "customer.phone": phone,
                        },
                    },
                },
            }
        );

        // Проверка наличия бронирований
        if (!bookingsResponse.data?.data || bookingsResponse.data.data.length === 0) {
            return { success: false, error: "Бронирования не найдены" };
        }

        // Возвращаем данные о найденной брони
        const booking = bookingsResponse.data.data[0];
        
        return {
            success: true,
            booked: {
                id: booking.id,
                apartment_id: booking.apartment_id,
                begin_date: booking.begin_date,
                end_date: booking.end_date,
                amount: booking.amount,
                status: booking.status,
                customer: booking.customer
            }
        };
    } catch (error) {
        console.error('Ошибка получения бронирований:', error.message);
        return { success: false, error: error.message };
    }
};

module.exports = { fetchBookings };
