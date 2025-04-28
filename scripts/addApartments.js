const Apartments = require("../Models/Apatments.js")
const mongoose = require("mongoose")

mongoose
    .connect("mongodb://localhost:27017/tapToLink")
    .then(() => {
        console.log("Mongodb OK");
    })
    .catch((err) => {
        console.log("Mongodb Error", err);
    });


const add = async () => {
    const apartment = new Apartments({
        apartment_id: "45217",
        links: ["https://drive.google.com/file/d/1X3EQTaz5llwhvIeD-nKQUSSfu-y6zmE9/view?usp=sharing"],
        text: `Манхеттен, жилой комплекс
https://2gis.kz/almaty/geo/9430047375074690/76.877292059361935,43.242739788951596

======================


ЖК Manhattan 
Брусиловского 163/ Шакарима 
( первый дом с права от шлагбаума ) 
 блок 14 кв 60 
13 этаж

Домофон 60 ( откроется автоматически)


====================


Wi-fi
Логин: Qazaqapart
Пароль: 87761641616


===================


↪️14-99-21-70-89🔒 и два раза прокрутить ручку в сторону открытия

Закрываем так же 

Только крутим в другую сторону`
    })

    await apartment.save()

    console.log("asd");
    
}

add()