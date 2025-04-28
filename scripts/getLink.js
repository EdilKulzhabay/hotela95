const { default: axios } = require("axios")
const globalVar = require("../globalVar");

const getToken = async () => {
    const response = await axios.post("https://realtycalendar.ru/v2/sign_in", 
        {
            username: process.env.realtycalendarUsername,
            password: process.env.realtycalendarPassword
        }
    )

    if (response.data.success) {
        globalVar.setVar(response.data.auth_token)
    } else {
        console.log("hz che delat");
        
    }
}

const getLink = async(begin_date, end_date, items) => {
    if (globalVar.getVar() === "") {
        await getToken()
    }

    const token = globalVar.getVar()

    const getLinkBody = {
        begin_date, 
        end_date, items, 
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
        console.log("getLink data = ", response.data);
        return response.data.basket; // Возвращаем ссылку
    } catch (error) {
        console.error("Ошибка в getLink:", error.response?.data?.errors || error.message);
        if (error.response.data.errors[0] === 'Вам необходимо войти в систему или зарегистрироваться.') {
            return "sosi hui"
        } else {
            return "sosi hui dvazhdy"
        }
    }
}

module.exports = { getLink }