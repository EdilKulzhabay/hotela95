require("dotenv").config();
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const { default: axios } = require("axios");
const mongoose = require("mongoose")
const Apartments = require("./Models/Apatments.js")
const User = require("./Models/User.js");
const { prompt, agreementPrompt, additionalPromot } = require("./const/prompt.js");
const { fetchBookings } = require("./scripts/fetchBookings.js");
const { deleteBooking } = require("./scripts/deleteBooking.js");
const { kaspiParser } = require("./kaspi.js");
const { handleMessage } = require("./messageHandler.js");
const { getLink } = require("./scripts/getLink.js");
const fs = require('fs').promises; // Используем промисы для асинхронной работы с файлами
const path = require('path');
const globalVar = require("./globalVar.js");
const { addBooking } = require("./scripts/addBooking.js");
const { depo, kaspiText, startMessage } = require("./const/messages.js");

mongoose
    .connect("mongodb://localhost:27017/tapToLink")
    .then(() => {
        console.log("Mongodb OK");
    })
    .catch((err) => {
        console.log("Mongodb Error", err);
    });

// Настройка WhatsApp клиента
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
    },
});


client.on("qr", (qr) => {
    qrcode.generate(qr, { small: true });
});

client.on("authenticated", () => {
    console.log("Authenticated successfully!");
});

client.on("auth_failure", (msg) => {
    console.error("Authentication failed:", msg);
});

client.on("ready", async () => {
    console.log("Client is ready!");
});

const activeTimers = new Map();

function calculateDaysBetweenDates(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const timeDifference = end - start;
    const daysDifference = timeDifference / (1000 * 3600 * 24);

    return daysDifference;
}

client.on('message_create', async (msg) => {
    if (msg.fromMe) {
        const chatId = msg.to;
        const message = msg.body;
        if (message.toLocaleLowerCase().includes("отключить бота")) {
            console.log("we here отключить бота");
            
            const digits = message.match(/\d/g);
            const result = digits.join("") + "@c.us";
    
            const gandon = await User.findOne({phone: result})
    
            if (gandon) {
                gandon.isGandon = true
                await gandon.save()
            } else {
                const newGandon = new User({phone: result, isGandon: true})
                await newGandon.save()
            }
            return
        }
    
        if (message.toLocaleLowerCase().includes("включить бота")) {
            console.log("we here включить бота");
            const digits = message.match(/\d/g);
            const result = digits.join("") + "@c.us";
    
            const gandon = await User.findOne({phone: result})
    
            if (gandon) {
                gandon.isGandon = false
                await gandon.save()
            } 
            return
        }
    }
});

client.on("message", async (msg) => {
    const chatId = msg.from;
    const clientName = msg._data.notifyName
    const message = msg.body;
    
    // let user = await User.findOne({ phone: chatId }) || new User({ phone: chatId});
    let user = await User.findOne({ phone: chatId })

    if (message.toLocaleLowerCase().includes("restart")) {
        await User.findOneAndDelete({phone: chatId})
        return
    }

    if (user && user?.isGandon) {
        client.sendMessage(chatId, "Здравствуйте, к сожалению в данный момент нет свободных квартир.")
        updateLastMessages(user, "Здравствуйте, к сожалению в данный момент нет свободных квартир.", "assistant");
        await user.save()
        return;
    }

    if (!user) {
        user = new User({ phone: chatId, last_message_date: new Date(msg.timestamp) });
        client.sendMessage(chatId, startMessage);
        const today = new Date();
        updateLastMessages(user, message, "user");
        updateLastMessages(user, startMessage, "assistant");
        user.last_message_date = new Date(today);
        await user.save();
        return
    } else {
        const lastMessageDate = user.last_message_date;
        const today = new Date();
        const lastMessageDateObj = lastMessageDate ? new Date(lastMessageDate) : null;
        console.log("lastMessageDateObj", lastMessageDateObj);
        console.log("today", today);
        
        if (!lastMessageDate || lastMessageDateObj.toDateString() != today.toDateString()) {
            client.sendMessage(chatId, startMessage);
            updateLastMessages(user, message, "user");
            updateLastMessages(user, startMessage, "assistant");
            user.last_message_date = new Date(today);
            await user.save();
            return
        }
    }

    if (message) {
        updateLastMessages(user, message, "user");
        await user.save()
    }

    if (user?.waitAgreement?.status) {
        if (user?.waitAgreement?.what?.name === "chooseApartment") {
            const agreementAnswer = await gptResponse(message, user.lastMessages, agreementPrompt);
            if (agreementAnswer === "1" || agreementAnswer === 1) {
                await client.sendMessage(chatId, "Отлично, сейчас создам бронь")
                updateLastMessages(user, "Отлично, сейчас создам бронь", "assistant")
                user.waitAgreement = {status: false, what: {}}
                const userData = {
                    bookingDate: {
                        startDate: user.bookingDate.startDate,
                        endDate: user.bookingDate.endDate
                    },
                    phone: `+${user.phone.slice(0, 11)}`,
                }
                const apartmentData = {
                    amount: user.chooseApartment.price,
                    apartment_id: user.chooseApartment.id
                }
                const addBook = await addBooking(userData, apartmentData, clientName)
                if (addBook) {
                    const sum = user.chooseApartment.price * calculateDaysBetweenDates(user.bookingDate.startDate, user.bookingDate.endDate)
                    client.sendMessage(chatId, `Стоимость проживания ${sum} + депозит`)
                    updateLastMessages(user, `Стоимость проживания ${sum} + депозит`, "assistant")
                    client.sendMessage(chatId, depo)
                    updateLastMessages(user, depo, "assistant")
                    client.sendMessage(chatId, "Можете ли провести оплату по каспи?")
                    updateLastMessages(user, "Можете ли провести оплату по каспи?", "assistant")
                    user.waitAgreement = {status: true, what: {name: "mayToKaspi", sum}}
                    user.apartment = addBook
                }

                await user.save()
                return
            } else {
                client.sendMessage(chatId, "Вы могли бы написать адрес квартиры которую выбрали")
                updateLastMessages(user, "Вы могли бы написать адрес квартиры которую выбрали", "assistant")
                user.waitAgreement = {status: true, what: {name: "chooseApartment2"}}
                await user.save()
                return
            }
        }

        if (user?.waitAgreement?.what?.name === "chooseApartment2") {
            const [year, month, day] = user.bookingDate.startDate.split("-");
            const beginDate = `${day}.${month}.${year}`
            const [year2, month2, day2] = user.bookingDate.endDate.split("-");
            const endDate = `${day2}.${month2}.${year2}`
            const response = await axios.get(`${process.env.vacantApartments}begin_date=${beginDate}&end_date=${endDate}`)
            const vacantApartments = response.data.apartments
            const chooseApartment = vacantApartments.find((item) => item.address.includes(message))
            if (chooseApartment) {
                client.sendMessage(chatId, `${chooseApartment.address}, вот на этот адрес, да?`)
                updateLastMessages(user, `${chooseApartment.address}, вот на этот адрес, да?`, "assistant")
                user.chooseApartment = chooseApartment
                user.waitAgreement = {status: true, what: {name: "chooseApartment", chooseApartmentNumber: chooseApartment}}
                await user.save()
                return
            } else {
                client.sendMessage("120363414549010108@g.us", `Клиенту ${clientName} с номером '${chatId.slice(0, -5)}' нужно написать, не можем понять какая квартира нужна wa.me//+${chatId.slice(0, -5)}`)
                return client.sendMessage(chatId, "В скором времени с вами свяжется менеджер")
            }
        }

        if (user?.waitAgreement?.what?.name === "mayToKaspi") {
            const agreementAnswer = await gptResponse(message, user.lastMessages, agreementPrompt);
            if (agreementAnswer === "1" || agreementAnswer === 1) {
                await client.sendMessage(chatId, kaspiText);
                updateLastMessages(user, kaspiText, "assistant");
                client.sendMessage(chatId, "И после оплаты прошу уведомите нас об оплате 😊");
                updateLastMessages(user, "И после оплаты прошу уведомите нас об оплате 😊", "assistant");
        
                // Атомарное обновление первого шага
                await User.findOneAndUpdate(
                    { _id: user._id },
                    {
                        $set: {
                            "paid.apartment_id": user.apartment.apartment_id,
                            apartments: [...user.apartments, user.apartment],
                            waitAgreement: { status: false, what: {} }
                        }
                    },
                    { new: true } // Возвращает обновленный документ, если нужно
                );
        
                const timer = setTimeout(async () => {
                    try {
                        console.log(`Удаляем бронь пользователя: ${chatId}`);
                        await deleteBooking({ apartment_id: user.apartment.apartment_id, id: user.apartment.id });
        
                        // Атомарное обновление второго шага
                        await User.findOneAndUpdate(
                            { _id: user._id },
                            {
                                $set: {
                                    specialPhone: false,
                                    apartment: {},
                                    paid: { apartment_id: "", status: false }
                                }
                            },
                            { new: true }
                        );
        
                        client.sendMessage(chatId, "Ваша бронь была удалена из-за отсутствия ответа.");
                        updateLastMessages(user, "Ваша бронь была удалена из-за отсутствия ответа.", "assistant");
                    } catch (error) {
                        console.error("Ошибка в таймере:", error);
                    }
                }, 30000); // 30 секунд для теста, замените на 60000 для минуты
        
                activeTimers.set(chatId, timer);
                return;
            } else {
                client.sendMessage("120363414549010108@g.us", `Клиенту ${clientName} с номером '${chatId.slice(0, -5)}' нужно написать, не может оплатить по каспи`)
                updateLastMessages(user, `В скором времени с вами свяжется менеджер`, "user")
                await user.save()
                return client.sendMessage(chatId, "В скором времени с вами свяжется менеджер")
            }
        }
    }

    if (user?.waitFIO) {
        console.log("Запуск kaspiParser с аргументом:", message);
        const phone = message?.match(/\d+/g)?.join('')
        const kaspi = await kaspiParser(phone?.slice(1));
        if (kaspi) {
            if (parseInt(kaspi) < 20) { //user?.apartment?.amount
                if (user.temporarySum + parseInt(kaspi) >= 20) { //user?.apartment?.amount
                    client.sendMessage(chatId, `Вы успешно забронировали, в день заселения мы отправим вам инструкцию`)
                    updateLastMessages(user, "Вы успешно забронировали, в день заселения мы отправим вам инструкцию", "assistant");
                    user.temporarySum = 0
                    user.paid.status = true
                    user.waitFIO = false
                    user.additionalPrompt = true
                } else {
                    user.temporarySum += parseInt(kaspi)
                    client.sendMessage(chatId, `К сожалению вы отправили не полную сумму, вы можете еще раз пройти по ссылке и оплатить оставшуюся сумму. После оплаты напишите слово 'Оплатил'`)
                    updateLastMessages(user, "К сожалению вы отправили не полную сумму, вы можете еще раз пройти по ссылке и оплатить оставшуюся сумму. После оплаты напишите слово 'Оплатил'", "assistant");
                    user.waitFIO = false
                }
            } else {
                client.sendMessage(chatId, `Вы успешно забронировали, в день заселения мы отправим вам инструкцию`)
                updateLastMessages(user, "Вы успешно забронировали, в день заселения мы отправим вам инструкцию", "assistant");
                user.temporarySum = 0
                user.paid.status = true
                user.waitFIO = false
                user.additionalPrompt = true
            }
            user.waitFIO = false
            await user.save()
            return
        } else {
            client.sendMessage(chatId, `Мы не смогли найти вашу оплату, напишите номер телефона в формате '+7 777 777 77 77' по которому провели оплату`)
            updateLastMessages(user, "Мы не смогли найти вашу оплату, напишите номер телефона в формате '+7 777 777 77 77' по которому провели оплату", "assistant");
            user.waitFIO = true
            await user.save()
            return
        }
    }

    if (user?.specialPhone) {
        const phone = message?.match(/\d/g)?.join('');
        const isBooked = await fetchBookings(phone)
        if (isBooked?.success) {
            const sum = isBooked.booked.amount
            client.sendMessage(chatId, `Стоимость проживания ${sum} + депозит`)
            updateLastMessages(user, `Стоимость проживания ${sum} + депозит`, "assistant")
            client.sendMessage(chatId, depo)
            updateLastMessages(user, depo, "assistant")
            client.sendMessage(chatId, "Можете ли провести оплату по каспи?")
            updateLastMessages(user, "Можете ли провести оплату по каспи?", "assistant")
            user.waitAgreement = {status: true, what: {name: "mayToKaspi", sum}}
    
            // Атомарное обновление первого шага
            await User.findOneAndUpdate(
                { _id: user._id },
                {
                    $set: {
                        "paid.apartment_id": isBooked.booked.apartment_id,
                        chooseApartment: isBooked.booked,
                        waitAgreement: {statsu: true, what: {name: "mayToKaspi", sum}},
                        apartments: [...user.apartments, isBooked.booked],
                        apartment: isBooked.booked
                    }
                },
                { new: true } // Возвращает обновленный документ, если нужно
            );
            return;
        } else {
            client.sendMessage(chatId, "К сожалению мы не смогли найти ваш бронь, отправьте номер в формате '+7 777 777 77 77' по которому забронировали квартиру что бы мы могли проверить");
            updateLastMessages(user, "К сожалению мы не смогли найти ваш бронь, отправьте номер в формате '+7 777 777 77 77' по которому забронировали квартиру что бы мы могли проверить", "assistant");
            user.specialPhone = true
            await user.save();
            return
        }
    }

    if (user?.specialPhoneForInstruction) {
        const phone = message?.match(/\d/g)?.join('');
        const isBooked = await fetchBookings(phone)
        if (isBooked?.success) {
            const apartmentId = user?.apartment?.apartment_id
            const apartment = await Apartments.findOne({apartment_id: apartmentId})
    
            if (!apartment) {
                await client.sendMessage(chatId, "К сожалению мы не смогли найти инструкцию по этой квартире, с вами свяжется менеджер");
                updateLastMessages(user, "К сожалению мы не смогли найти инструкцию по этой квартире, с вами свяжется менеджер", "assistant");
                client.sendMessage("120363414549010108@g.us", `Клиенту ${clientName} с номером '${chatId.slice(0, -5)}' нужно написать wa.me//+${chatId.slice(0, -5)}`)
                await user.save()
                return
            } else {
                await client.sendMessage(chatId, apartment.links[0]);
                await client.sendMessage(chatId, apartment.text);
            }
            await User.findOneAndUpdate(
                { _id: user._id },
                {
                    $set: {
                        "paid.apartment_id": isBooked.booked.apartment_id,
                        chooseApartment: isBooked.booked,
                        apartments: [...user.apartments, isBooked.booked],
                        apartment: isBooked.booked,
                        lastMessages: [...user.lastMessages, {role: "assistant", content: apartment.links[0]}, {role: "assistant", content: apartment.text}]
                    }
                },
                { new: true } // Возвращает обновленный документ, если нужно
            );
            return;
        } else {
            client.sendMessage(chatId, "К сожалению мы не смогли найти ваш бронь, отправьте номер в формате '+7 777 777 77 77' по которому забронировали квартиру что бы мы могли проверить");
            updateLastMessages(user, "К сожалению мы не смогли найти ваш бронь, отправьте номер в формате '+7 777 777 77 77' по которому забронировали квартиру что бы мы могли проверить", "assistant");
            user.specialPhoneForInstruction = true
            await user.save();
            return
        }
    }
    
    const answer = await gptResponse(message, user.lastMessages, prompt);
    console.log("answer = ", answer);
    
    if (answer.includes("client")) {
        await client.sendMessage(chatId, answer.replace(" client", ""));
        updateLastMessages(user, answer.replace(" client", ""), "assistant");
    } else if (answer.includes("admin")) {
        const jsonMatch = answer.match(/\{.*\}/);
        let jsonStr = null;
        let data;

        if (jsonMatch) {
            jsonStr = jsonMatch[0];
            console.log("JSON найден:", jsonStr);
        } else {
            console.log("JSON не найден, обработка текста");
        }

        try {
            data = jsonStr ? JSON.parse(jsonStr) : answer.replace(" admin", ""); // Если jsonStr найден, парсим, иначе просто берем текст
        } catch (e) {
            data = jsonStr; // Если парсинг не удался, сохраняем строку
        }

        console.log("data = ", data);

        if (typeof data === "object") {
            const phone = chatId?.match(/\d+/g)?.join('')
            switch (data.type) {
            case 1: // Полные данные для брони
                const [year, month, day] = data.checkin.split("-");
                const beginDate = `${day}.${month}.${year}`
                const [year2, month2, day2] = data.checkout.split("-");
                const endDate = `${day2}.${month2}.${year2}`
                const response = await axios.get(`${process.env.vacantApartments}humans=${data.guests}&begin_date=${beginDate}&end_date=${endDate}`)
                // console.log("respone in getApartments = ", response);
                
                const vacantApartments = response.data.apartments
                const dataToLink = vacantApartments.map((item) => {
                    return {
                        apartment_id: item.id,
                        apartment_title: item.title,
                        amount: item.price,
                        is_special_amount: false
                    }
                })
                let link = await getLink(data.checkin, data.checkout, dataToLink)
                if (link === "sosi hui") {
                    globalVar.setVar("")
                    link = await getLink(data.checkin, data.checkout, dataToLink)
                }
                if (link === "sosi hui dvazhdy") {
                    client.sendMessage(chatId, "Ошибка при получении ссылки(");
                    updateLastMessages(user, "Ошибка при получении ссылки(", "assistant");
                    await user.save()
                    return
                }
                if (link.source.items.length === 0) {
                    client.sendMessage(chatId, `С ${data.checkin} по ${data.checkout} нет свободных квартир`);
                    updateLastMessages(user, `С ${data.checkin} по ${data.checkout} нет свободных квартир`, "assistant");
                    await user.save()
                    return
                }
                client.sendMessage(chatId, `С ${data.checkin} по ${data.checkout} подобрано вариантов: ${link.source.items.length}. Для просмотра перейдите по ссылке: ${link.url}`);
                updateLastMessages(user, `С ${data.checkin} по ${data.checkout} подобрано вариантов: ${link.source.items.length}. Для просмотра перейдите по ссылке: ${link.url}`, "assistant");
                user.chooseApartments = link.source.items
                user.bookingDate = {startDate: data.checkin, endDate: data.checkout, personsKol: data.guests || 1}
                await user.save()
                return
            case 3: // Выбор варианта
                if (data?.address) {
                    const [year, month, day] = user.bookingDate.startDate.split("-");
                    const beginDate = `${day}.${month}.${year}`
                    const [year2, month2, day2] = user.bookingDate.endDate.split("-");
                    const endDate = `${day2}.${month2}.${year2}`
                    const response = await axios.get(`${process.env.vacantApartments}begin_date=${beginDate}&end_date=${endDate}`)
                    const vacantApartments = response.data.apartments
                    const chooseApartment = vacantApartments.find((item) => item.address.includes(data?.address))
                    if (chooseApartment) {
                        client.sendMessage(chatId, `${chooseApartment.address}, вот на этот адрес, да?`)
                        updateLastMessages(user, `${chooseApartment.address}, вот на этот адрес, да?`, "assistant")
                        user.chooseApartment = chooseApartment
                        user.waitAgreement = {status: true, what: {name: "chooseApartment", chooseApartmentNumber: data?.address}}
                        await user.save()
                        return
                    } else {
                        client.sendMessage("120363414549010108@g.us", `Клиенту ${clientName} с номером '${chatId.slice(0, -5)}' нужно написать, не можем понять какая квартира нужна wa.me//+${chatId.slice(0, -5)}`)
                        return client.sendMessage(chatId, "В скором времени с вами свяжется менеджер")
                    }
                } else {
                    const response = await axios.get(`${process.env.vacantApartments}`)
                    const apartments = response.data.apartments
                    const userChooseApartments = user.chooseApartments
                    const chooseApartment = apartments.find((item) => item.id === userChooseApartments[data?.choice - 1].apartment_id)
                    client.sendMessage(chatId, `${chooseApartment.address}, вот на этот адрес, да?`)
                    updateLastMessages(user, `${chooseApartment.address}, вот на этот адрес, да?`, "assistant")
                    user.chooseApartment = chooseApartment
                    user.waitAgreement = {status: true, what: {name: "chooseApartment", chooseApartmentNumber: data?.choice}}
                    await user.save()
                    return
                }
                // Логика выбора варианта по data.choice или data.address
                break;
            case 4: // Оплатил
                clearTimeout(activeTimers.get(chatId)); // Сбрасываем таймер, если пользователь ответил вовремя
                activeTimers.delete(chatId);
                const kaspi = await kaspiParser(phone?.slice(1));
                if (kaspi) {
                    if (parseInt(kaspi) < 20) { //user?.apartment?.amount
                        if (user.temporarySum + parseInt(kaspi) >= 20) { //user?.apartment?.amount
                            client.sendMessage(chatId, `Вы успешно забронировали, в день заселения мы отправим вам инструкцию`)
                            updateLastMessages(user, "Вы успешно забронировали, в день заселения мы отправим вам инструкцию", "assistant");
                            user.temporarySum = 0
                            user.paid.status = true
                            user.waitFIO = false
                            user.additionalPrompt = true
                        } else {
                            user.temporarySum += parseInt(kaspi)
                            client.sendMessage(chatId, `К сожалению вы отправили не полную сумму, вы можете еще раз пройти по ссылке и оплатить оставшуюся сумму. После оплаты напишите слово 'Оплатил'`)
                            updateLastMessages(user, "К сожалению вы отправили не полную сумму, вы можете еще раз пройти по ссылке и оплатить оставшуюся сумму. После оплаты напишите слово 'Оплатил'", "assistant");
                            user.waitFIO = false
                        }
                    } else {
                        client.sendMessage(chatId, `Вы успешно забронировали, в день заселения мы отправим вам инструкцию`)
                        updateLastMessages(user, "Вы успешно забронировали, в день заселения мы отправим вам инструкцию", "assistant");
                        user.temporarySum = 0
                        user.paid.status = true
                        user.waitFIO = false
                        user.additionalPrompt = true
                    }
                    user.waitFIO = false
                    await user.save()
                    return
                } else {
                    client.sendMessage(chatId, `Мы не смогли найти вашу оплату, напишите номер телефона в формате '+7 777 777 77 77' по которому провели оплату`)
                    updateLastMessages(user, "Мы не смогли найти вашу оплату, напишите номер телефона в формате '+7 777 777 77 77' по которому провели оплату", "assistant");
                    user.waitFIO = true
                    await user.save()
                    return
                }
            case 5: // инструкция 
                const apartmentId = user?.apartment?.apartment_id
                const apartment = await Apartments.findOne({apartment_id: apartmentId})
        
                if (!apartment) {
                    await client.sendMessage(chatId, "К сожалению мы не смогли найти инструкцию по этой квартире, с вами свяжется менеджер");
                    updateLastMessages(user, "К сожалению мы не смогли найти инструкцию по этой квартире, с вами свяжется менеджер", "assistant");
                    client.sendMessage("120363414549010108@g.us", `Клиенту ${clientName} с номером '${chatId.slice(0, -5)}' нужно написать wa.me//+${chatId.slice(0, -5)}`)
                } else {
                    await client.sendMessage(chatId, apartment.links[0]);
                    updateLastMessages(user, apartment.links[0], "assistant");
                    await client.sendMessage(chatId, apartment.text);
                    updateLastMessages(user, apartment.text, "assistant");
                }
                await user.save()
                return
            case 7: // airbnb
                const isBooked = await fetchBookings(phone)
                if (isBooked?.success) {
                    const apartmentId = user?.apartment?.apartment_id
                    const apartment = await Apartments.findOne({apartment_id: apartmentId})
            
                    if (!apartment) {
                        await client.sendMessage(chatId, "К сожалению мы не смогли найти инструкцию по этой квартире, с вами свяжется менеджер");
                        updateLastMessages(user, "К сожалению мы не смогли найти инструкцию по этой квартире, с вами свяжется менеджер", "assistant");
                        client.sendMessage("120363414549010108@g.us", `Клиенту ${clientName} с номером '${chatId.slice(0, -5)}' нужно написать wa.me//+${chatId.slice(0, -5)}`)
                        await user.save()
                        return
                    } else {
                        await client.sendMessage(chatId, apartment.links[0]);
                        await client.sendMessage(chatId, apartment.text);
                    }
                    await User.findOneAndUpdate(
                        { _id: user._id },
                        {
                            $set: {
                                "paid.apartment_id": isBooked.booked.apartment_id,
                                chooseApartment: isBooked.booked,
                                apartments: [...user.apartments, isBooked.booked],
                                apartment: isBooked.booked,
                                lastMessages: [...user.lastMessages, {role: "assistant", content: apartment.links[0]}, {role: "assistant", content: apartment.text}]
                            }
                        },
                        { new: true } // Возвращает обновленный документ, если нужно
                    );
                    return;
                } else {
                    client.sendMessage(chatId, "К сожалению мы не смогли найти ваш бронь, отправьте номер в формате '+7 777 777 77 77' по которому забронировали квартиру что бы мы могли проверить");
                    updateLastMessages(user, "К сожалению мы не смогли найти ваш бронь, отправьте номер в формате '+7 777 777 77 77' по которому забронировали квартиру что бы мы могли проверить", "assistant");
                    user.specialPhoneForInstruction = true
                    await user.save();
                    return
                }
            }
        } else if (data === "забронировал") {
            const isBooked = await fetchBookings(phone)
            if (isBooked?.success) {
                const sum = isBooked.booked.amount * calculateDaysBetweenDates(isBooked.booked.begin_date, isBooked.booked.end_date)
                await client.sendMessage(chatId, `Стоимость проживания ${sum} + депозит`)
                await client.sendMessage(chatId, depo)
                await client.sendMessage(chatId, "Можете ли провести оплату по каспи?")
                await User.findOneAndUpdate(
                    { _id: user._id },
                    {
                        $set: {
                            "paid.apartment_id": isBooked.booked.apartment_id,
                            chooseApartment: isBooked.booked,
                            waitAgreement: {status: true, what: {name: "mayToKaspi", sum}},
                            apartments: [...user.apartments, isBooked.booked],
                            apartment: isBooked.booked,
                            lastMessages: [...user.lastMessages, {role: "assistant", content: `Стоимость проживания ${sum} + депозит`}, {role: "assistant", content: depo}, {role: "assistant", content: "Можете ли провести оплату по каспи?"}]

                        }
                    },
                    { new: true } // Возвращает обновленный документ, если нужно
                );
                return;
            } else {
                client.sendMessage(chatId, "К сожалению мы не смогли найти ваш бронь, отправьте номер в формате '+7 777 777 77 77' по которому забронировали квартиру что бы мы могли проверить");
                updateLastMessages(user, "К сожалению мы не смогли найти ваш бронь, отправьте номер в формате '+7 777 777 77 77' по которому забронировали квартиру что бы мы могли проверить", "assistant");
                user.specialPhone = true
                await user.save();
                return
            }
        }
    } else {
        await client.sendMessage(chatId, "Извините, я не понял ваш запрос. Уточните, пожалуйста!");
        updateLastMessages(user, "Извините, я не понял ваш запрос. Уточните, пожалуйста", "assistant");
    }
});

const updateLastMessages = (user, message, role) => {
    user.lastMessages.push({ role, content: message });
    if (user.lastMessages.length > 20) {
        user.lastMessages.shift();
    }
};

const gptResponse = async (text, lastMessages, prompt) => {
    // console.log(prompt);
    
    const messages = [
        {
            role: "system",
            content: prompt,
        },
        ...lastMessages.map((msg) => ({
            role: msg.role,
            content: msg.content,
        })),
        {
            role: "user",
            content: text,
        },
    ];

    const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
            model: "gpt-4o",
            messages,
        },
        {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            },
        }
    );

    const answer = response.data.choices[0].message.content;
    return answer;
};

client.initialize();