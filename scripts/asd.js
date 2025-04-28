const fs = require('fs');  

const COOKIES_PATH = '../cookies.json';  

const asd = () => {  
    const cookies = { asd: 1, qwe: 2 };  
    fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));  
    console.log("Cookies успешно сохранены");  
};  

asd();  