const handleMessage = async (message) => {
    const lines = message.split('\n');
    const command = lines[0]?.match(/\d+/g)?.join('')

    console.log(message);

    if (message.toLocaleLowerCase().includes("ошибка")) {
        return { what: "error" }
    }

    if (command === '1') {
        const dateInMatch = message.match(/заезд=(\d{4}-\d{2}-\d{2})/);
        const dateOutMatch = message.match(/выезд=(\d{4}-\d{2}-\d{2})/);
        const personsMatch = message.match(/количество персон=(\d+)/);

        const dateIn = dateInMatch ? dateInMatch[1] : null; // "2025-03-01"
        const dateOut = dateOutMatch ? dateOutMatch[1] : null; // "2025-03-03"
        const persons = personsMatch ? parseInt(personsMatch[1], 10) : null; // 2

        return {what: 1, dateIn, dateOut, persons}
    }

    if (command === '6') {
        const dateInMatch = message.match(/заезд=(\d{4}-\d{2}-\d{2})/);

        const dateIn = dateInMatch ? dateInMatch[1] : null; // "2025-03-01"

        return {what: 7, dateIn}
    }

    if (command === '7') {
        const dateOutMatch = message.match(/выезд=(\d{4}-\d{2}-\d{2})/);

        const dateOut = dateOutMatch ? dateOutMatch[1] : null; // "2025-03-03"

        return {what: 8, dateOut}
    }

    if (command === '8') {
        const personsMatch = message.match(/количество персон=(\d+)/);

        const persons = personsMatch ? parseInt(personsMatch[1], 10) : null; // 2

        return {what: 8, persons}
    }

    if (command === '3') {
        if (message.includes("адрес")) {
            const str = message.replace("3\n", "");
            const address = str.replace("адрес:", "");
            return {what: 3, isAddress: true, address: address.trim()}
        } else {
            const chooseApartment = parseInt(message[2])
            return {what: 3, isAddress: false, chooseApartment}
        }
    }

    if (command === '9') {
        return {what: 9}
    }
};

module.exports = { handleMessage };