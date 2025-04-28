const { default: axios } = require("axios");
const { generateSign2 } = require("./generateSign2");

const addBooking = async (userData, apartmentData, clientName) => {
    const url = `https://realtycalendar.ru/api/v1/apartments/${apartmentData.apartment_id}/event_calendars`;
    
    const event_calendar = {
        begin_date: userData.bookingDate.startDate,
        end_date: userData.bookingDate.endDate,
        status: 5,
        amount: apartmentData.amount,
        notes: "",
        client_attributes: {
            fio: clientName,
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

    try {
        const response = await axios.post(url, requestBody, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
            }
        });

        if (response.status === 201) {
            console.log("Booking created successfully:", response.data);
            return response.data;
        }
    } catch (error) {
        if (error.response) {
            console.error('Error Response:', error.response.data);
            console.error('Status Code:', error.response.status);
        } else {
            console.error('Error Message:', error.message);
        }
        return false;
    }
};

module.exports = { addBooking };