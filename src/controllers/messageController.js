const User = require('../models/User');
const Apartment = require('../models/Apartment');
const { gptResponse } = require('../utils/gptService');
const { updateLastMessages, calculateDaysBetweenDates } = require('../utils/messageUtils');
const { prompt, agreementPrompt } = require('../const/prompt');
const { depo, kaspiText, startMessage } = require('../const/messages');
const { checkKaspiPayment, validatePaymentAmount } = require('../services/paymentService');
const { getAvailableApartments, createBookingLink, addBooking, deleteBooking } = require('../services/bookingService');
const axios = require('axios');
const FormData = require('form-data');
const { kaspiParser } = require('../kaspi');
const globalVar = require('../utils/globalVar');

// Таймеры для отложенных уведомлений и действий
const activeTimers = new Map();
const NOTIFICATION_DELAY = 300000; // 5 минут в миллисекундах
const DELETION_DELAY = 300000; // 5 минут в миллисекундах

/**
 * Получение информации о бронированиях по номеру телефона
 * @param {String} phone - номер телефона
 * @returns {Promise<Object>} - информация о бронировании
 */
const fetchBookings = async (phone) => {
    try {
        if (!phone) {
            return { success: false, error: "Номер телефона не указан" };
        }
        
        const authResponse = await axios.post('https://realtycalendar.ru/v2/sign_in', {
            username: process.env.REALTYCALENDAR_USERNAME,
            password: process.env.REALTYCALENDAR_PASSWORD
        });

        // console.log("authResponse = ", authResponse);

        if (!authResponse?.data?.auth_token) {
            return { success: false, error: "Не удалось получить токен авторизации" };
        }

        const token = authResponse.data.auth_token;

        const bookingsResponse = await axios.get(
            'https://realtycalendar.ru/v2/event_calendars/?begin_date=2025-06-08&end_date=2025-07-23&statuses[]=booked&statuses[]=request&apartment_ids=231339,231347',
            {
                headers: {
                    'X-User-Token': token,
                },
            }
        );

        console.log("bookingsResponse = ", bookingsResponse.data);
        
        // Проверка наличия бронирований
        if (!bookingsResponse.data?.items || bookingsResponse.data.items.length === 0) {
            return { success: false, error: "Бронирования не найдены" };
        }

        // Нормализуем номер телефона для поиска (убираем пробелы и специальные символы)
        const normalizePhone = (phoneNumber) => {
            if (!phoneNumber) return '';
            return phoneNumber.replace(/[\s\-\(\)\+]/g, '');
        };

        const searchPhone = normalizePhone(phone);
        console.log("Ищем номер телефона:", searchPhone);
        console.log("Ищем номер телефона:", phone);

        // Ищем бронирование по номеру телефона в массиве items
        let foundBooking = null;
        
        for (const item of bookingsResponse.data.items) {
            if (item.events && Array.isArray(item.events)) {
                for (const event of item.events) {
                    if (event.client && event.client.phone) {
                        const clientPhone = normalizePhone(event.client.phone);
                        console.log("Сравниваем с:", clientPhone, "из события:", event.id);
                        
                        if (clientPhone === searchPhone) {
                            foundBooking = {
                                ...event,
                                apartment_id: item.apartment_id,
                                room_id: item.room_id
                            };
                            console.log("Найдено бронирование:", foundBooking);
                            break;
                        }
                    }
                }
                if (foundBooking) break;
            }
        }

        if (!foundBooking) {
            console.log("Бронирование не найдено для номера:", phone);
            return { 
                success: false, 
                error: `Бронирование с номером телефона ${phone} не найдено` 
            };
        }

        // Возвращаем данные о найденной брони
        return {
            success: true,
            booking: foundBooking
        };
    } catch (error) {
        console.error('Ошибка получения бронирований:', error.message);
        return { success: false, error: error.message };
    }
};

/**
 * Обработка команд включения/отключения бота
 * @param {String} message - текст сообщения
 * @param {String} chatId - ID чата
 * @returns {Promise<Boolean>} - результат обработки команды
 */
const handleAdminCommands = async (message, chatId) => {
    const lowerMessage = message.toLocaleLowerCase();
    
    if (lowerMessage.includes("отключить бота")) {
        const digits = message.match(/\d/g);
        if (!digits) return false;
        
        const result = digits.join("") + "@c.us";
        
        let user = await User.findOne({phone: result});
        
        if (user) {
            user.isGandon = true;
            await user.save();
        } else {
            user = new User({phone: result, isGandon: true});
            await user.save();
        }
        return true;
    }
    
    if (lowerMessage.includes("включить бота")) {
        const digits = message.match(/\d/g);
        if (!digits) return false;
        
        const result = digits.join("") + "@c.us";
        
        const user = await User.findOne({phone: result});
        
        if (user) {
            user.isGandon = false;
            await user.save();
        }
        return true;
    }
    
    return false;
};

/**
 * Обработка выбора квартиры
 * @param {Object} user - объект пользователя 
 * @param {Object} message - сообщение
 * @param {Object} client - WhatsApp клиент
 * @param {String} chatId - ID чата
 * @param {String} clientName - имя клиента
 * @returns {Promise<Boolean>} - флаг успешности обработки
 */
const handleApartmentSelection = async (user, message, client, chatId, clientName) => {
    const agreementAnswer = await gptResponse(message, user.lastMessages, agreementPrompt);
    
    if (agreementAnswer === "1" || agreementAnswer === 1) {
        await client.sendMessage(chatId, "Отлично, сейчас создам бронь");
        updateLastMessages(user, "Отлично, сейчас создам бронь", "assistant");
        user.waitAgreement = {status: false, what: {}};
        
        const userData = {
            bookingDate: {
                startDate: user.bookingDate.startDate,
                endDate: user.bookingDate.endDate
            },
            phone: `+${user.phone.slice(0, 11)}`,
        };
        
        const apartmentData = {
            amount: user.chooseApartment.amount,
            apartment_id: user.chooseApartment.apartment_id
        };

        console.log("userData = ", userData);
        console.log("apartmentData = ", apartmentData);
        
        
        const bookingResult = await addBooking(userData, apartmentData, clientName);
        
        if (bookingResult) {
            const sum = user.chooseApartment.amount * calculateDaysBetweenDates(
                user.bookingDate.startDate, 
                user.bookingDate.endDate
            );
            
            client.sendMessage(chatId, `Стоимость проживания ${sum} + депозит`);
            updateLastMessages(user, `Стоимость проживания ${sum} + депозит`, "assistant");
            
            client.sendMessage(chatId, depo);
            updateLastMessages(user, depo, "assistant");
            
            client.sendMessage(chatId, "Можете ли провести оплату по каспи?");
            updateLastMessages(user, "Можете ли провести оплату по каспи?", "assistant");
            
            user.waitAgreement = {status: true, what: {name: "mayToKaspi", sum}};
            user.apartment = bookingResult;
            
            await user.save();
            return true;
        }
    } else {
        // client.sendMessage(chatId, "Вы могли бы написать цену квартиры которую выбрали");
        // updateLastMessages(user, "Вы могли бы написать цену квартиры которую выбрали", "assistant");
        // user.waitAgreement = {status: true, what: {name: "chooseApartment2"}};
        // await user.save();
        client.sendMessage(
            process.env.ADMIN_GROUP_ID, 
            `Клиенту ${user.clientName || "Неизвестный"} с номером '${chatId.slice(0, -5)}' нужно написать, не может оплатить по каспи`
        );
        
        client.sendMessage(chatId, "В скором времени с вами свяжется менеджер");
        updateLastMessages(user, "В скором времени с вами свяжется менеджер", "assistant");
        
        await user.save();
        return true;
    }
    
    return false;
};

/**
 * Обработка оплаты по Kaspi
 * @param {Object} user - объект пользователя
 * @param {String} message - текст сообщения
 * @param {Object} client - WhatsApp клиент
 * @param {String} chatId - ID чата
 * @returns {Promise<Boolean>} - флаг успешности обработки
 */
const handleKaspiPayment = async (user, message, client, chatId) => {
    const agreementAnswer = await gptResponse(message, user.lastMessages, agreementPrompt);
    
    if (agreementAnswer === "1" || agreementAnswer === 1) {
        await client.sendMessage(chatId, kaspiText);
        updateLastMessages(user, kaspiText, "assistant");
        
        client.sendMessage(chatId, "И после оплаты прошу уведомите нас об оплате 😊");
        updateLastMessages(user, "И после оплаты прошу уведомите нас об оплате 😊", "assistant");
        
        // Атомарное обновление пользователя
        await User.findOneAndUpdate(
            { _id: user._id },
            {
                $set: {
                    "paid.apartment_id": user.apartment.apartment_id,
                    apartments: [...user.apartments, user.apartment],
                    waitAgreement: { status: false, what: {} }
                }
            },
            { new: true }
        );
        
        // Создаем таймер для напоминания
        const notificationTimer = setTimeout(async () => {
            try {
                console.log(`Отправляем уведомление пользователю: ${chatId}`);
                await client.sendMessage(chatId, "Ваша бронь будет удалена через 5 минут, если вы не подтвердите оплату.");
                updateLastMessages(user, "Ваша бронь будет удалена через 5 минут, если вы не подтвердите оплату.", "assistant");
                await user.save();
                
                // Второй таймер: удаление брони
                const deletionTimer = setTimeout(async () => {
                    try {
                        console.log(`Удаляем бронь пользователя: ${chatId}`);
                        await deleteBooking({ apartment_id: user.apartment.apartment_id, id: user.apartment.id });
                        
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
                        await user.save();
                    } catch (error) {
                        console.error("Ошибка во втором таймере:", error);
                    }
                }, DELETION_DELAY);
                
                // Сохраняем второй таймер
                activeTimers.set(`${chatId}_deletion`, deletionTimer);
            } catch (error) {
                console.error("Ошибка в первом таймере:", error);
            }
        }, NOTIFICATION_DELAY);
        
        // Сохраняем первый таймер
        activeTimers.set(`${chatId}_notification`, notificationTimer);
        return true;
    } else {
        // Уведомление администраторов если клиент не может оплатить через Kaspi
        client.sendMessage(
            process.env.ADMIN_GROUP_ID, 
            `Клиенту ${user.clientName || "Неизвестный"} с номером '${chatId.slice(0, -5)}' нужно написать, не может оплатить по каспи`
        );
        
        client.sendMessage(chatId, "В скором времени с вами свяжется менеджер");
        updateLastMessages(user, "В скором времени с вами свяжется менеджер", "assistant");

        user.status = true;
        
        await user.save();
        return true;
    }
};

/**
 * Проверка оплаты по номеру телефона
 * @param {Object} user - объект пользователя
 * @param {String} message - текст сообщения
 * @param {Object} client - WhatsApp клиент
 * @param {String} chatId - ID чата
 * @returns {Promise<Boolean>} - флаг успешности обработки
 */
const handlePaymentCheck = async (user, message, client, chatId) => {
    const phone = message?.match(/\d+/g)?.join('');
    
    if (!phone) {
        client.sendMessage(chatId, "Пожалуйста, укажите корректный номер телефона");
        updateLastMessages(user, "Пожалуйста, укажите корректный номер телефона", "assistant");
        return true;
    }
    
    const paymentResult = await checkKaspiPayment(phone);
    
    if (paymentResult.success) {
        // Получаем требуемую сумму из данных пользователя или устанавливаем минимальную
        const requiredAmount = 10000;
        const validation = validatePaymentAmount(paymentResult.amount, requiredAmount, user.temporarySum);
        
        if (validation.isPaid) {
            client.sendMessage(chatId, "Вы успешно забронировали, в день заселения мы отправим вам инструкцию");
            updateLastMessages(user, "Вы успешно забронировали, в день заселения мы отправим вам инструкцию", "assistant");
            
            user.temporarySum = 0;
            user.paid.status = true;
            user.waitFIO = false;
            user.additionalPrompt = true;
        } else {
            user.temporarySum += paymentResult.amount;
            
            client.sendMessage(
                chatId, 
                `К сожалению вы отправили не полную сумму, вы можете еще раз пройти по ссылке и оплатить оставшуюся сумму (${validation.remainingAmount}). После оплаты напишите слово 'Оплатил'`
            );
            
            updateLastMessages(
                user, 
                `К сожалению вы отправили не полную сумму, вы можете еще раз пройти по ссылке и оплатить оставшуюся сумму (${validation.remainingAmount}). После оплаты напишите слово 'Оплатил'`, 
                "assistant"
            );
            
            user.waitFIO = false;
        }
        
        await user.save();
        return true;
    } else {
        client.sendMessage(
            chatId, 
            "Мы не смогли найти вашу оплату, напишите номер телефона в формате '+7 777 777 77 77' по которому провели оплату"
        );
        
        updateLastMessages(
            user, 
            "Мы не смогли найти вашу оплату, напишите номер телефона в формате '+7 777 777 77 77' по которому провели оплату", 
            "assistant"
        );
        
        user.waitFIO = true;
        await user.save();
        return true;
    }
};

/**
 * Обработка JSON-команд, полученных от GPT
 * @param {Object} data - данные команды
 * @param {Object} user - объект пользователя
 * @param {Object} client - WhatsApp клиент
 * @param {String} chatId - ID чата
 * @param {String} clientName - имя клиента
 * @returns {Promise<Boolean>} - флаг успешности обработки
 */
const handleGptCommand = async (data, user, client, chatId, clientName) => {
    try {
        const phone = chatId?.match(/\d+/g)?.join('');
        
        switch (data.type) {
            case 1: // Обработка запроса на бронирование с датами
                try {
                    let beginDate = "";
                    let endDate = "";

                    if (user?.bookingDate?.startDate) {
                        const [year, month, day] = user?.bookingDate?.startDate?.split("-");
                        beginDate = `${day}.${month}.${year}`;
                    } else {
                        const [year, month, day] = data.checkin.split("-");
                        beginDate = `${day}.${month}.${year}`;
                    }

                    if (user?.bookingDate?.endDate) {
                        const [year, month, day] = user?.bookingDate?.endDate?.split("-");
                        endDate = `${day}.${month}.${year}`;
                    } else {
                        const [year, month, day] = data.checkout.split("-");
                        endDate = `${day}.${month}.${year}`;
                    }


                    // Получаем свободные квартиры
                    const apartmentsResponse = await getAvailableApartments(beginDate, endDate, data.guests);

                    if (!apartmentsResponse.success || !apartmentsResponse.apartments.length) {
                        client.sendMessage(chatId, `С ${data.checkin} по ${data.checkout} нет свободных квартир`);
                        updateLastMessages(user, `С ${data.checkin} по ${data.checkout} нет свободных квартир`, "assistant");
                        await user.save();
                        return true;
                    }
                    
                    // Создаем ссылку для бронирования
                    const linkResponse = await createBookingLink(data.checkin, data.checkout, apartmentsResponse.apartments);

                    if (!linkResponse.success) {
                        client.sendMessage(chatId, `Ошибка при получении ссылки: ${linkResponse.error}`);
                        updateLastMessages(user, `Ошибка при получении ссылки: ${linkResponse.error}`, "assistant");
                        await user.save();
                        return true;
                    }
                    
                    client.sendMessage(chatId, `С ${data.checkin} по ${data.checkout} подобрано вариантов: ${linkResponse.items.length}. Для просмотра перейдите по ссылке: ${linkResponse.url}`);
                    updateLastMessages(user, `С ${data.checkin} по ${data.checkout} подобрано вариантов: ${linkResponse.items.length}. Для просмотра перейдите по ссылке: ${linkResponse.url}`, "assistant");
                    
                    user.chooseApartments = linkResponse.items;
                    user.bookingDate = {
                        startDate: data.checkin, 
                        endDate: data.checkout, 
                        personsKol: data.guests || 1
                    };
                    
                    await user.save();
                    return true;
                } catch (error) {
                    console.error("Ошибка при обработке бронирования:", error);
                    client.sendMessage(chatId, "Произошла ошибка при обработке запроса на бронирование");
                    return true;
                }
                break;
                
            case 3: // Выбор квартиры
                try {
                    if (data?.price) {
                        
                        const chooseApartment = user.chooseApartments.find(
                            (item) => item?.amount === Number(data?.price)
                        );
                        
                        if (chooseApartment) {
                            client.sendMessage(chatId, `Вам номер  за ${chooseApartment?.amount}, да?`);
                            updateLastMessages(user, `Вам номер  за ${chooseApartment?.amount}, да?`, "assistant");
                            
                            user.chooseApartment = chooseApartment;
                            user.waitAgreement = {
                                status: true, 
                                what: {
                                    name: "chooseApartment", 
                                    chooseApartmentNumber: data?.address
                                }
                            };
                            
                            await user.save();
                            return true;
                        } else {
                            client.sendMessage(
                                process.env.ADMIN_GROUP_ID, 
                                `Клиенту ${clientName} с номером '${chatId.slice(0, -5)}' нужно написать, не можем понять какая квартира нужна wa.me//+${chatId.slice(0, -5)}`
                            );
                            
                            client.sendMessage(chatId, "В скором времени с вами свяжется менеджер");
                            updateLastMessages(user, "В скором времени с вами свяжется менеджер", "assistant");
                            await user.save();
                            return true;
                        }
                    } else {
                        // Выбор квартиры по индексу из списка
                        const choiceIndex = parseInt(data?.choice) - 1;
                        
                        if (isNaN(choiceIndex) || choiceIndex < 0 || !user.chooseApartments || choiceIndex >= user.chooseApartments.length) {
                            client.sendMessage(chatId, "Неверный номер квартиры");
                            return true;
                        }
                        
                        const chooseApartment = user.chooseApartments[choiceIndex];
                        
                        if (!chooseApartment) {
                            client.sendMessage(chatId, "Не удалось найти выбранную квартиру");
                            return true;
                        }
                        
                        client.sendMessage(chatId, `Вам номер  за ${chooseApartment?.amount}, да?`);
                        updateLastMessages(user, `Вам номер  за ${chooseApartment?.amount}, да?`, "assistant");
                        
                        user.chooseApartment = chooseApartment;
                        user.waitAgreement = {
                            status: true, 
                            what: {
                                name: "chooseApartment", 
                                chooseApartmentNumber: chooseApartment?.amount
                            }
                        };
                        
                        await user.save();
                        return true;
                    }
                } catch (error) {
                    console.error("Ошибка при выборе квартиры:", error);
                    client.sendMessage(chatId, "Произошла ошибка при выборе квартиры");
                    return true;
                }
                break;
                
            case 4: // Проверка оплаты
                try {
                    // Отменяем таймеры если они есть
                    clearTimeout(activeTimers.get(`${chatId}_notification`));
                    clearTimeout(activeTimers.get(`${chatId}_deletion`));
                    activeTimers.delete(`${chatId}_notification`);
                    activeTimers.delete(`${chatId}_deletion`);
                    
                    // Проверяем оплату
                    const phoneToCheck = phone?.slice(1); // Убираем начальную 7
                    const paymentAmount = await kaspiParser(phoneToCheck);
                    
                    if (paymentAmount) {
                        // const requiredAmount = user.waitAgreement?.what?.sum || user.apartment?.amount || 20;
                        const requiredAmount = 20;
                        const amount = parseInt(paymentAmount);
                        
                        if (user.temporarySum + amount >= requiredAmount) {
                            client.sendMessage(chatId, "Вы успешно забронировали, в день заселения мы отправим вам инструкцию");
                            updateLastMessages(user, "Вы успешно забронировали, в день заселения мы отправим вам инструкцию", "assistant");
                            
                            user.temporarySum = 0;
                            user.paid.status = true;
                            user.waitFIO = false;
                            user.additionalPrompt = true;
                        } else {
                            // Недостаточная сумма
                            user.temporarySum += amount;
                            
                            client.sendMessage(
                                chatId, 
                                `К сожалению вы отправили не полную сумму, вы можете еще раз пройти по ссылке и оплатить оставшуюся сумму (${requiredAmount - user.temporarySum}). После оплаты напишите слово 'Оплатил'`
                            );
                            
                            updateLastMessages(
                                user, 
                                `К сожалению вы отправили не полную сумму, вы можете еще раз пройти по ссылке и оплатить оставшуюся сумму (${requiredAmount - user.temporarySum}). После оплаты напишите слово 'Оплатил'`, 
                                "assistant"
                            );
                            
                            user.waitFIO = false;
                        }
                        
                        await user.save();
                        return true;
                    } else {
                        // Оплата не найдена
                        client.sendMessage(
                            chatId, 
                            "Мы не смогли найти вашу оплату, напишите номер телефона в формате '+7 777 777 77 77' по которому провели оплату"
                        );
                        
                        updateLastMessages(
                            user, 
                            "Мы не смогли найти вашу оплату, напишите номер телефона в формате '+7 777 777 77 77' по которому провели оплату", 
                            "assistant"
                        );
                        
                        user.waitFIO = true;
                        await user.save();
                        return true;
                    }
                } catch (error) {
                    console.error("Ошибка при проверке оплаты:", error);
                    client.sendMessage(chatId, "Произошла ошибка при проверке оплаты");
                    return true;
                }
                break;
                
            case 5: // Инструкция
                try {
                    const apartmentId = user?.apartment?.apartment_id;
                    const apartment = await Apartment.findOne({apartment_id: apartmentId});
                    
                    if (!apartment) {
                        await client.sendMessage(chatId, "К сожалению мы не смогли найти инструкцию по этой квартире, с вами свяжется менеджер");
                        updateLastMessages(user, "К сожалению мы не смогли найти инструкцию по этой квартире, с вами свяжется менеджер", "assistant");
                        
                        client.sendMessage(
                            process.env.ADMIN_GROUP_ID, 
                            `Клиенту ${clientName} с номером '${chatId.slice(0, -5)}' нужно написать wa.me//+${chatId.slice(0, -5)}`
                        );
                    } else {
                        if (apartment.links && apartment.links.length > 0) {
                            await client.sendMessage(chatId, apartment.links[0]);
                            updateLastMessages(user, apartment.links[0], "assistant");
                        }
                        
                        if (apartment.text) {
                            await client.sendMessage(chatId, apartment.text);
                            updateLastMessages(user, apartment.text, "assistant");
                        }
                    }
                    
                    await user.save();
                    return true;
                } catch (error) {
                    console.error("Ошибка при получении инструкции:", error);
                    client.sendMessage(chatId, "Произошла ошибка при получении инструкции");
                    return true;
                }
                break;
                
            case 7: // Airbnb
                try {
                    const isBooked = await fetchBookings(phone);
                    
                    if (isBooked?.success) {
                        const apartmentId = isBooked.booking.apartment_id;
                        const apartment = await Apartment.findOne({apartment_id: apartmentId});
                        
                        if (!apartment) {
                            await client.sendMessage(chatId, "К сожалению мы не смогли найти инструкцию по этой квартире, с вами свяжется менеджер");
                            updateLastMessages(user, "К сожалению мы не смогли найти инструкцию по этой квартире, с вами свяжется менеджер", "assistant");
                            
                            client.sendMessage(
                                process.env.ADMIN_GROUP_ID, 
                                `Клиенту ${clientName} с номером '${chatId.slice(0, -5)}' нужно написать wa.me//+${chatId.slice(0, -5)}`
                            );
                            
                            await user.save();
                            return true;
                        } else {
                            if (apartment.links && apartment.links.length > 0) {
                                await client.sendMessage(chatId, apartment.links[0]);
                            }
                            
                            if (apartment.text) {
                                await client.sendMessage(chatId, apartment.text);
                            }
                            
                            await User.findOneAndUpdate(
                                { _id: user._id },
                                {
                                    $set: {
                                        "paid.apartment_id": isBooked.booking.apartment_id,
                                        chooseApartment: isBooked.booking,
                                        apartments: [...user.apartments, isBooked.booking],
                                        apartment: isBooked.booking,
                                        lastMessages: [
                                            ...user.lastMessages, 
                                            ...(apartment.links && apartment.links.length > 0 ? [{role: "assistant", content: apartment.links[0]}] : []),
                                            ...(apartment.text ? [{role: "assistant", content: apartment.text}] : [])
                                        ]
                                    }
                                },
                                { new: true }
                            );
                            
                            return true;
                        }
                    } else {
                        client.sendMessage(chatId, "К сожалению мы не смогли найти ваш бронь, отправьте номер в формате '+7 777 777 77 77' по которому забронировали квартиру что бы мы могли проверить");
                        updateLastMessages(user, "К сожалению мы не смогли найти ваш бронь, отправьте номер в формате '+7 777 777 77 77' по которому забронировали квартиру что бы мы могли проверить", "assistant");
                        
                        user.specialPhoneForInstruction = true;
                        await user.save();
                        return true;
                    }
                } catch (error) {
                    console.error("Ошибка при проверке бронирования:", error);
                    client.sendMessage(chatId, "Произошла ошибка при проверке бронирования");
                    return true;
                }
                break;
                
            default:
                return false;
        }
    } catch (error) {
        console.error("Ошибка при обработке команды GPT:", error);
        return false;
    }
};

/**
 * Обработка входящего сообщения от пользователя
 * @param {Object} msg - объект сообщения
 * @param {Object} client - WhatsApp клиент
 * @returns {Promise<void>}
 */
const handleIncomingMessage = async (msg, client) => {
    const chatId = msg.from;
    const clientName = msg._data.notifyName;
    const message = msg.body;
    const messageType = msg.type;
    
    console.log("=== НАЧАЛО ОБРАБОТКИ СООБЩЕНИЯ ===");
    console.log("message:", message);
    console.log("messageType:", messageType);
    console.log("chatId:", chatId);
    console.log("clientName:", clientName);
    
    // Фильтруем нежелательные типы сообщений
    if (messageType !== 'chat' && messageType !== 'image' && messageType !== 'document') {
        console.log(`Пропускаем сообщение типа: ${messageType}`);
        return;
    }
    
    // Защита от обработки пустых сообщений
    if (!message || message.trim().length === 0) {
        console.log("Пропускаем пустое сообщение");
        return;
    }
    
    // Проверка базовых команд
    if (message.toLocaleLowerCase().includes("restart")) {
        await User.findOneAndDelete({phone: chatId});
        return;
    }
    
    // Создание нового пользователя если не существует
    let user = await User.findOne({ phone: chatId });
    
    // Проверка блокировки пользователя
    if (user && user?.isGandon) {
        client.sendMessage(chatId, "Здравствуйте, к сожалению в данный момент нет свободных квартир.");
        updateLastMessages(user, "Здравствуйте, к сожалению в данный момент нет свободных квартир.", "assistant");
        await user.save();
        return;
    }
    
    // Создание нового пользователя если не существует
    if (!user) {
        try {
            // Используем findOneAndUpdate с upsert для избежания ошибки дублирования
            user = await User.findOneAndUpdate(
                { phone: chatId },
                { 
                    $setOnInsert: { 
                        phone: chatId, 
                        last_message_date: new Date(),
                        lastMessages: [],
                        bookingDate: { startDate: "", endDate: "", personsKol: "" },
                        chooseApartments: [],
                        chooseApartment: {},
                        apartment: {},
                        apartments: [],
                        waitAgreement: { status: false, what: {} },
                        paid: { apartment_id: "", status: false },
                        additionalPrompt: false,
                        waitFIO: false,
                        specialPhone: false,
                        specialPhoneForInstruction: false,
                        temporarySum: 0,
                        isGandon: false,
                        status: false
                    }
                },
                { 
                    new: true, 
                    upsert: true 
                }
            );
            
            console.log("Пользователь создан или найден:", user.phone);
        } catch (error) {
            console.error("Ошибка при создании/поиске пользователя:", error);
            // Если ошибка - пытаемся найти существующего пользователя
            user = await User.findOne({ phone: chatId });
            if (!user) {
                console.error("Критическая ошибка: не удалось создать или найти пользователя");
                return;
            }
        }
        
        // Добавляем сообщение пользователя в историю для анализа
        updateLastMessages(user, message, "user");
        await user.save();
        
        // Проверяем через GPT что написал новый пользователь
        console.log("Новый пользователь, проверяю сообщение через GPT...");
        try {
            const gptAnswer = await gptResponse(
                message, 
                user.lastMessages, 
                prompt + `\n${user} \nдаты хранятся в bookingDate если даты меньше сегодняшнего дня то узнай на какие даты хочет заселиться клиент, сегодня ${new Date().toISOString().split('T')[0]}`
            );
            
            console.log("GPT ответ для нового пользователя:", gptAnswer);
            
            // Если GPT распознал команду бронирования, обрабатываем
            if (gptAnswer.includes("забронировал admin")) {
                console.log("Новый пользователь с командой бронирования, обрабатываю...");
                
                // Обрабатываем команду бронирования
                const phone = chatId?.match(/\d+/g)?.join('');
                
                try {
                    const isBooked = await fetchBookings(phone);
                    
                    if (isBooked?.success) {
                        const sum = isBooked.booking.amount * calculateDaysBetweenDates(
                            isBooked.booking.begin_date, 
                            isBooked.booking.end_date
                        );
                        
                        await client.sendMessage(chatId, `Стоимость проживания ${sum} + депозит`);
                        updateLastMessages(user, `Стоимость проживания ${sum} + депозит`, "assistant");
                        
                        await client.sendMessage(chatId, depo);
                        updateLastMessages(user, depo, "assistant");
                        
                        await client.sendMessage(chatId, "Можете ли провести оплату по каспи?");
                        updateLastMessages(user, "Можете ли провести оплату по каспи?", "assistant");
                        
                        await User.findOneAndUpdate(
                            { _id: user._id },
                            {
                                $set: {
                                    "paid.apartment_id": isBooked.booking.apartment_id,
                                    chooseApartment: isBooked.booking,
                                    waitAgreement: {status: true, what: {name: "mayToKaspi", sum}},
                                    apartments: [...user.apartments, isBooked.booking],
                                    apartment: isBooked.booking
                                }
                            },
                            { new: true }
                        );
                    } else {
                        client.sendMessage(
                            chatId, 
                            "К сожалению мы не смогли найти вашу бронь. Отправьте номер в формате '+7 777 777 77 77' по которому забронировали квартиру, чтобы мы могли проверить"
                        );
                        
                        updateLastMessages(
                            user, 
                            "К сожалению мы не смогли найти вашу бронь. Отправьте номер в формате '+7 777 777 77 77' по которому забронировали квартиру, чтобы мы могли проверить", 
                            "assistant"
                        );
                        
                        user.specialPhone = true;
                        await user.save();
                    }
                } catch (error) {
                    console.error("Ошибка при обработке бронирования для нового пользователя:", error);
                    client.sendMessage(chatId, "Произошла ошибка при обработке бронирования. Пожалуйста, повторите попытку позже");
                    updateLastMessages(user, "Произошла ошибка при обработке бронирования. Пожалуйста, повторите попытку позже", "assistant");
                }
                
                return;
            } else {
                // GPT не распознал команду бронирования, отправляем стартовое сообщение
                console.log("Новый пользователь без команды бронирования, отправляю приветствие...");
                client.sendMessage(chatId, startMessage);
                updateLastMessages(user, startMessage, "assistant");
                await user.save();
                return;
            }
        } catch (gptError) {
            console.error("Ошибка при анализе сообщения нового пользователя:", gptError);
            // В случае ошибки GPT отправляем стартовое сообщение
            client.sendMessage(chatId, startMessage);
            updateLastMessages(user, startMessage, "assistant");
            await user.save();
            return;
        }
    }
    
    // Проверка нужно ли отправить приветственное сообщение для существующих пользователей (новый день)
    const lastMessageDate = user.last_message_date;
    const today = new Date();
    const lastMessageDateObj = lastMessageDate ? new Date(lastMessageDate) : null;
    
    const isNewDay = lastMessageDateObj && lastMessageDateObj.toDateString() !== today.toDateString();
    const isFrom2GIS = message.toLowerCase().includes("пишу из приложения 2гис.");
    
    console.log("Проверка стартового сообщения для существующего пользователя:");
    console.log("- isNewDay:", isNewDay);
    console.log("- isFrom2GIS:", isFrom2GIS);
    console.log("- lastMessageDate:", lastMessageDate);
    console.log("- today:", today.toDateString());
    
    // Если это новый день или сообщение из 2GIS, сначала проверяем через GPT
    if (isNewDay || isFrom2GIS) {
        console.log("Проверяю сообщение существующего пользователя через GPT...");
        
        // Добавляем сообщение пользователя в историю для GPT
        if (message) {
            updateLastMessages(user, message, "user");
            await user.save();
        }
        
        try {
            const gptAnswer = await gptResponse(
                message, 
                user.lastMessages, 
                prompt + `\n${user} \nдаты хранятся в bookingDate если даты меньше сегодняшнего дня то узнай на какие даты хочет заселиться клиент, сегодня ${new Date().toISOString().split('T')[0]}`
            );
            
            console.log("GPT ответ для существующего пользователя:", gptAnswer);
            
            // Если GPT распознал команду бронирования, обрабатываем
            if (gptAnswer.includes("забронировал admin")) {
                console.log("Существующий пользователь с командой бронирования, обрабатываю...");
                user.last_message_date = today;
                await user.save();
                
                // Обрабатываем команду бронирования
                const phone = chatId?.match(/\d+/g)?.join('');
                
                try {
                    const isBooked = await fetchBookings(phone);
                    
                    if (isBooked?.success) {
                        const sum = isBooked.booking.amount * calculateDaysBetweenDates(
                            isBooked.booking.begin_date, 
                            isBooked.booking.end_date
                        );
                        
                        await client.sendMessage(chatId, `Стоимость проживания ${sum} + депозит`);
                        updateLastMessages(user, `Стоимость проживания ${sum} + депозит`, "assistant");
                        
                        await client.sendMessage(chatId, depo);
                        updateLastMessages(user, depo, "assistant");
                        
                        await client.sendMessage(chatId, "Можете ли провести оплату по каспи?");
                        updateLastMessages(user, "Можете ли провести оплату по каспи?", "assistant");
                        
                        await User.findOneAndUpdate(
                            { _id: user._id },
                            {
                                $set: {
                                    "paid.apartment_id": isBooked.booking.apartment_id,
                                    chooseApartment: isBooked.booking,
                                    waitAgreement: {status: true, what: {name: "mayToKaspi", sum}},
                                    apartments: [...user.apartments, isBooked.booking],
                                    apartment: isBooked.booking
                                }
                            },
                            { new: true }
                        );
                    } else {
                        client.sendMessage(
                            chatId, 
                            "К сожалению мы не смогли найти вашу бронь. Отправьте номер в формате '+7 777 777 77 77' по которому забронировали квартиру, чтобы мы могли проверить"
                        );
                        
                        updateLastMessages(
                            user, 
                            "К сожалению мы не смогли найти вашу бронь. Отправьте номер в формате '+7 777 777 77 77' по которому забронировали квартиру, чтобы мы могли проверить", 
                            "assistant"
                        );
                        
                        user.specialPhone = true;
                        await user.save();
                    }
                } catch (error) {
                    console.error("Ошибка при обработке бронирования для существующего пользователя:", error);
                    client.sendMessage(chatId, "Произошла ошибка при обработке бронирования. Пожалуйста, повторите попытку позже");
                    updateLastMessages(user, "Произошла ошибка при обработке бронирования. Пожалуйста, повторите попытку позже", "assistant");
                }
                
                return;
            } else {
                // GPT не распознал команду бронирования, отправляем стартовое сообщение
                console.log("Существующий пользователь без команды бронирования, отправляю приветствие...");
                client.sendMessage(chatId, startMessage);
                updateLastMessages(user, startMessage, "assistant");
                user.last_message_date = today;
                await user.save();
                return;
            }
        } catch (gptError) {
            console.error("Ошибка при анализе сообщения существующего пользователя:", gptError);
            // В случае ошибки GPT отправляем стартовое сообщение
            client.sendMessage(chatId, startMessage);
            updateLastMessages(user, startMessage, "assistant");
            user.last_message_date = today;
            await user.save();
            return;
        }
    }
    
    // Добавляем сообщение пользователя в историю только если оно еще не было добавлено
    const lastUserMessage = user.lastMessages?.[user.lastMessages.length - 1];
    const messageAlreadyAdded = lastUserMessage?.role === "user" && lastUserMessage?.content === message;
    
    if (message && !messageAlreadyAdded) {
        updateLastMessages(user, message, "user");
        await user.save();
    }
    
    // Обработка состояний пользователя
    if (user?.waitAgreement?.status) {
        // Обработка выбора квартиры
        if (user?.waitAgreement?.what?.name === "chooseApartment") {
            const result = await handleApartmentSelection(user, message, client, chatId, clientName);
            if (result) return;
        }
        
        // Обработка выбора квартиры по адресу
        if (user?.waitAgreement?.what?.name === "chooseApartment2") {
            const apartmentAddress = user.waitAgreement.what.address;
            const userResponse = message.toLowerCase();

            if (userResponse === 'да' || userResponse === 'согласен') {
                const apartment = await Apartment.findOne({ address: apartmentAddress });
                
                if (!apartment) {
                    client.sendMessage(chatId, "Извините, данная квартира уже недоступна.");
                    user.waitAgreement = null;
                    await user.save();
                    return true;
                }

                client.sendMessage(chatId, `Отлично! Вы выбрали квартиру по адресу: ${apartmentAddress}\nДля продолжения бронирования, пожалуйста, подтвердите оплату через Kaspi. Согласны?`);
                user.waitAgreement = {
                    status: true,
                    what: {
                        name: "mayToKaspi",
                        apartment: apartment
                    }
                };
                await user.save();
                return true;
            } else if (userResponse === 'нет' || userResponse === 'отмена') {
                client.sendMessage(chatId, "Хорошо, давайте посмотрим другие варианты. Напишите интересующий вас район или адрес.");
                user.waitAgreement = null;
                await user.save();
                return true;
            } else {
                client.sendMessage(chatId, "Пожалуйста, ответьте 'Да' если согласны с выбором квартиры, или 'Нет' если хотите посмотреть другие варианты.");
                return true;
            }
        }
        
        // Обработка согласия на оплату через Kaspi
        if (user?.waitAgreement?.what?.name === "mayToKaspi") {
            const result = await handleKaspiPayment(user, message, client, chatId);
            if (result) return;
        }
    }
    
    // Проверка оплаты
    if (user?.waitFIO) {
        const result = await handlePaymentCheck(user, message, client, chatId);
        if (result) return;
    }
    
    // Проверка на особый номер для инструкций
    if (user?.specialPhoneForInstruction) {
        const phone = message?.match(/\d+/g)?.join('');
        
        if (!phone) {
            client.sendMessage(chatId, "Пожалуйста, укажите корректный номер телефона");
            updateLastMessages(user, "Пожалуйста, укажите корректный номер телефона", "assistant");
            return;
        }
        
        try {
            const isBooked = await fetchBookings(phone);
            
            if (isBooked?.success) {
                const apartmentId = isBooked.booking.apartment_id;
                const apartment = await Apartment.findOne({apartment_id: apartmentId});
                
                if (!apartment) {
                    await client.sendMessage(chatId, "К сожалению мы не смогли найти инструкцию по этой квартире, с вами свяжется менеджер");
                    updateLastMessages(user, "К сожалению мы не смогли найти инструкцию по этой квартире, с вами свяжется менеджер", "assistant");
                    
                    client.sendMessage(
                        process.env.ADMIN_GROUP_ID, 
                        `Клиенту ${clientName} с номером '${chatId.slice(0, -5)}' нужно написать wa.me//+${chatId.slice(0, -5)}`
                    );
                } else {
                    if (apartment.links && apartment.links.length > 0) {
                        await client.sendMessage(chatId, apartment.links[0]);
                        updateLastMessages(user, apartment.links[0], "assistant");
                    }
                    
                    if (apartment.text) {
                        await client.sendMessage(chatId, apartment.text);
                        updateLastMessages(user, apartment.text, "assistant");
                    }
                    
                    await User.findOneAndUpdate(
                        { _id: user._id },
                        {
                            $set: {
                                "paid.apartment_id": isBooked.booking.apartment_id,
                                chooseApartment: isBooked.booking,
                                apartments: [...user.apartments, isBooked.booking],
                                apartment: isBooked.booking
                            }
                        },
                        { new: true }
                    );
                }
            } else {
                client.sendMessage(chatId, "К сожалению мы не смогли найти вашу бронь по указанному номеру. Пожалуйста, проверьте номер или свяжитесь с менеджером");
                updateLastMessages(user, "К сожалению мы не смогли найти вашу бронь по указанному номеру. Пожалуйста, проверьте номер или свяжитесь с менеджером", "assistant");
            }
        } catch (error) {
            console.error("Ошибка при проверке инструкций:", error);
            client.sendMessage(chatId, "Произошла ошибка при получении инструкций. Пожалуйста, свяжитесь с менеджером");
            updateLastMessages(user, "Произошла ошибка при получении инструкций. Пожалуйста, свяжитесь с менеджером", "assistant");
        }
        
        user.specialPhoneForInstruction = false;
        await user.save();
        return;
    }
    
    // Проверка на особый номер
    if (user?.specialPhone) {
        const phone = message?.match(/\d+/g)?.join('');
        
        if (!phone) {
            client.sendMessage(chatId, "Пожалуйста, укажите корректный номер телефона");
            updateLastMessages(user, "Пожалуйста, укажите корректный номер телефона", "assistant");
            return;
        }
        
        try {
            const isBooked = await fetchBookings(phone);
            
            if (isBooked?.success) {
                const sum = isBooked.booking.amount * calculateDaysBetweenDates(
                    isBooked.booking.begin_date, 
                    isBooked.booking.end_date
                );
                
                await client.sendMessage(chatId, `Стоимость проживания ${sum} + депозит`);
                updateLastMessages(user, `Стоимость проживания ${sum} + депозит`, "assistant");
                
                await client.sendMessage(chatId, depo);
                updateLastMessages(user, depo, "assistant");
                
                await client.sendMessage(chatId, "Можете ли провести оплату по каспи?");
                updateLastMessages(user, "Можете ли провести оплату по каспи?", "assistant");
                
                await User.findOneAndUpdate(
                    { _id: user._id },
                    {
                        $set: {
                            "paid.apartment_id": isBooked.booking.apartment_id,
                            chooseApartment: isBooked.booking,
                            waitAgreement: {status: true, what: {name: "mayToKaspi", sum}},
                            apartments: [...user.apartments, isBooked.booking],
                            apartment: isBooked.booking
                        }
                    },
                    { new: true }
                );
            } else {
                client.sendMessage(
                    chatId, 
                    "К сожалению мы не смогли найти вашу бронь, пожалуйста, проверьте номер телефона или свяжитесь с менеджером"
                );
                
                updateLastMessages(
                    user, 
                    "К сожалению мы не смогли найти вашу бронь, пожалуйста, проверьте номер телефона или свяжитесь с менеджером", 
                    "assistant"
                );
            }
        } catch (error) {
            console.error("Ошибка при проверке брони:", error);
            client.sendMessage(chatId, "Произошла ошибка при проверке бронирования. Пожалуйста, свяжитесь с менеджером");
            updateLastMessages(user, "Произошла ошибка при проверке бронирования. Пожалуйста, свяжитесь с менеджером", "assistant");
        }
        
        user.specialPhone = false;
        await user.save();
        return;
    }
    
    // Обработка через GPT если не обработано специальными обработчиками
    console.log("Начинаю обработку через GPT...");
    try {
        const answer = await gptResponse(
            message, 
            user.lastMessages, 
            prompt + `\n${user} \nдаты хранятся в bookingDate если даты меньше сегодняшнего дня то узнай на какие даты хочет заселиться клиент, сегодня ${new Date().toISOString().split('T')[0]}`
        );
        
        console.log("GPT ответ:", answer);
        
        if (answer.includes("client")) {
            // Ответ для клиента
            console.log("Отправляю сообщение клиенту:", answer.replace(" client", ""));
            await client.sendMessage(chatId, answer.replace(" client", ""));
            updateLastMessages(user, answer.replace(" client", ""), "assistant");
            await user.save();
        } else if (answer.includes("admin")) {
            // Команда для обработки
            try {
                // Ищем JSON в ответе
                const jsonMatch = answer.match(/\{.*\}/s);
                let data = null;
                
                if (jsonMatch) {
                    try {
                        data = JSON.parse(jsonMatch[0]);
                        console.log("Найдены данные JSON:", data);
                        
                        // Обработка команды
                        const handled = await handleGptCommand(data, user, client, chatId, clientName);
                        
                        if (handled) {
                            return;
                        }
                    } catch (jsonError) {
                        console.error("Ошибка парсинга JSON:", jsonError);
                    }
                }
                
                // Проверяем специальные команды
                if (answer.includes("забронировал")) {
                    const phone = chatId?.match(/\d+/g)?.join('');
                    
                    try {
                        const isBooked = await fetchBookings(phone);
                        
                        if (isBooked?.success) {
                            const sum = isBooked.booking.amount * calculateDaysBetweenDates(
                                isBooked.booking.begin_date, 
                                isBooked.booking.end_date
                            );
                            
                            await client.sendMessage(chatId, `Стоимость проживания ${sum} + депозит`);
                            updateLastMessages(user, `Стоимость проживания ${sum} + депозит`, "assistant");
                            
                            await client.sendMessage(chatId, depo);
                            updateLastMessages(user, depo, "assistant");
                            
                            await client.sendMessage(chatId, "Можете ли провести оплату по каспи?");
                            updateLastMessages(user, "Можете ли провести оплату по каспи?", "assistant");
                            
                            await User.findOneAndUpdate(
                                { _id: user._id },
                                {
                                    $set: {
                                        "paid.apartment_id": isBooked.booking.apartment_id,
                                        chooseApartment: isBooked.booking,
                                        waitAgreement: {status: true, what: {name: "mayToKaspi", sum}},
                                        apartments: [...user.apartments, isBooked.booking],
                                        apartment: isBooked.booking
                                    }
                                },
                                { new: true }
                            );
                        } else {
                            client.sendMessage(
                                chatId, 
                                "К сожалению мы не смогли найти вашу бронь. Отправьте номер в формате '+7 777 777 77 77' по которому забронировали квартиру, чтобы мы могли проверить"
                            );
                            
                            updateLastMessages(
                                user, 
                                "К сожалению мы не смогли найти вашу бронь. Отправьте номер в формате '+7 777 777 77 77' по которому забронировали квартиру, чтобы мы могли проверить", 
                                "assistant"
                            );
                            
                            user.specialPhone = true;
                            await user.save();
                        }
                    } catch (error) {
                        console.error("Ошибка при обработке бронирования:", error);
                        client.sendMessage(chatId, "Произошла ошибка при обработке бронирования. Пожалуйста, повторите попытку позже");
                        updateLastMessages(user, "Произошла ошибка при обработке бронирования. Пожалуйста, повторите попытку позже", "assistant");
                    }
                    
                    return;
                }
                
                // Если не удалось обработать команду, отправляем общий ответ
                await client.sendMessage(chatId, "Я понял ваш запрос. Обрабатываю...");
                await user.save();
            } catch (commandError) {
                console.error("Ошибка обработки команды:", commandError);
                await client.sendMessage(chatId, "Произошла ошибка при обработке вашего запроса");
                await user.save();
            }
        } else {
            // Если ответ не содержит меток, но содержит текст, отправляем его как сообщение клиенту
            if (answer && answer.trim().length > 0) {
                console.log("Отправляю ответ GPT без меток как сообщение клиенту:", answer);
                await client.sendMessage(chatId, answer);
                updateLastMessages(user, answer, "assistant");
                await user.save();
            } else {
                await client.sendMessage(chatId, "Извините, я не понял ваш запрос. Уточните, пожалуйста!");
                updateLastMessages(user, "Извините, я не понял ваш запрос. Уточните, пожалуйста!", "assistant");
                await user.save();
            }
        }
    } catch (gptError) {
        console.error("Ошибка при получении ответа от GPT:", gptError);
        await client.sendMessage(chatId, "Извините, у меня возникли проблемы с обработкой вашего запроса. Попробуйте еще раз позже.");
        await user.save();
    }
    
    console.log("=== КОНЕЦ ОБРАБОТКИ СООБЩЕНИЯ ===");
};

module.exports = {
    handleIncomingMessage,
    handleAdminCommands,
    activeTimers
}; 