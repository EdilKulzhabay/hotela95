const axios = require('axios');
const { getLink, getToken } = require('../scripts/getLink');
const { fetchBookings } = require('../scripts/fetchBookings');
const { deleteBooking } = require('../scripts/deleteBooking');
const { addBooking } = require('../scripts/addBooking');
const { convertDateFormat } = require('../utils/messageUtils');
const globalVar = require('../utils/globalVar');

/**
 * Получение свободных квартир по заданным параметрам
 * @param {String} startDate - дата заезда
 * @param {String} endDate - дата выезда
 * @param {Number} guests - количество гостей
 * @returns {Object} - результат операции
 */
const getAvailableApartments = async (startDate, endDate, guests = 1) => {
    try {
        if (globalVar.getVar() === "") {
            await getToken();
        }

        console.log("startDate = ", startDate);
        console.log("endDate = ", endDate);
        console.log("guests = ", guests);

        const token = globalVar.getVar()
        const beginDate = startDate
        const finishDate = endDate

        console.log("beginDate = ", beginDate);
        console.log("finishDate = ", finishDate);

        console.log(`${process.env.VACANT_APARTMENTS_API}humans=${guests}&begin_date=${beginDate}&end_date=${finishDate}`);
        
        
        const response = await axios.get(
            `${process.env.VACANT_APARTMENTS_API}humans=${guests}&begin_date=${beginDate}&end_date=${finishDate}`,
            {
                headers: {
                    "x-user-token": token,
                    "Content-Type": "application/json"
                }
            }
        );

        console.log("response = ", response);
        
        return {
            success: true,
            apartments: response.data.apartments
        };
    } catch (error) {
        console.error("Ошибка получения свободных квартир:", error);
        return {
            success: false,
            error: error.message
        };
    }
};

const getPrice = async (id, startDate, endDate) => {
    if (globalVar.getVar() === "") {
        await getToken();
    }

    const token = globalVar.getVar()

    const response = await axios.get(
        `https://realtycalendar.ru/v2/apartments/${id}/prices?begin_date=${startDate}&end_date=${endDate}`,
        {
            headers: {
                "x-user-token": token,
                "Content-Type": "application/json"
            }
        }
    );
    

    const daysBetween = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24));
    const pricePerDay = Math.ceil(response.data.price / daysBetween);
    return pricePerDay
}

/**
 * Создание ссылки для бронирования
 * @param {String} startDate - дата заезда
 * @param {String} endDate - дата выезда
 * @param {Array} apartments - список квартир
 * @returns {Object} - результат с ссылкой
 */
const createBookingLink = async (startDate, endDate, apartments) => {
    try {



        const dataToLink = apartments.map((item) => ({
            apartment_id: item.id,
            apartment_title: item.title,
            amount: getPrice(item.id, startDate, endDate),
            is_special_amount: false
        }));

        console.log("dataToLink = ", dataToLink);
        
        let link = await getLink(startDate, endDate, dataToLink);
        
        if (!link.success) {
            return {
                success: false,
                error: link.error
            };
        }
        
        return {
            success: true,
            url: link.url,
            items: link.items
        };
    } catch (error) {
        console.error("Ошибка создания ссылки:", error);
        return {
            success: false,
            error: error.message
        };
    }
};

module.exports = {
    getAvailableApartments,
    createBookingLink,
    fetchBookings,
    deleteBooking,
    addBooking
}; 