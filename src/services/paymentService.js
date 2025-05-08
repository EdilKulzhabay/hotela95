const { kaspiParser } = require('../kaspi');

/**
 * Проверка оплаты через Kaspi
 * @param {String} phone - номер телефона
 * @returns {Promise<Object>} - результат проверки
 */
const checkKaspiPayment = async (phone) => {
    try {
        if (!phone) {
            return { success: false, error: "Номер телефона не указан" };
        }
        
        // Удаляем все нецифровые символы из номера
        const cleanPhone = phone.match(/\d+/g)?.join('');
        
        // Проверяем на корректность номера телефона
        if (!cleanPhone || cleanPhone.length < 10) {
            return { success: false, error: "Неверный формат номера телефона" };
        }
        
        // Удаляем первую цифру, если это +7
        const normalizedPhone = cleanPhone.startsWith('+') ? cleanPhone.slice(1) : cleanPhone;
        
        // Получаем результат от Kaspi сервиса
        const paymentAmount = await kaspiParser(normalizedPhone);
        
        if (!paymentAmount) {
            return { 
                success: false, 
                message: "Оплата не найдена" 
            };
        }
        
        return {
            success: true,
            amount: parseInt(paymentAmount),
            message: "Оплата найдена"
        };
    } catch (error) {
        console.error("Ошибка проверки платежа:", error);
        return { 
            success: false, 
            error: error.message 
        };
    }
};

/**
 * Проверяет достаточность суммы платежа
 * @param {Number} paymentAmount - сумма платежа
 * @param {Number} requiredAmount - требуемая сумма
 * @param {Number} existingAmount - имеющаяся сумма
 * @returns {Object} - результат проверки
 */
const validatePaymentAmount = (paymentAmount, requiredAmount, existingAmount = 0) => {
    const totalAmount = existingAmount + paymentAmount;
    
    if (totalAmount >= requiredAmount) {
        return {
            success: true,
            message: "Оплата достаточна",
            isPaid: true
        };
    }
    
    return {
        success: true,
        message: "Оплата недостаточна",
        isPaid: false,
        paidAmount: totalAmount,
        remainingAmount: requiredAmount - totalAmount
    };
};

module.exports = {
    checkKaspiPayment,
    validatePaymentAmount
}; 