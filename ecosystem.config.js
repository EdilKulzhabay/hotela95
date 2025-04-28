module.exports = {  
    apps: [  
      {  
        name: "taptolink",  
        script: "index.js",  
        watch: true,                // Включает отслеживание изменений (как nodemon)  
        ignore_watch: ["cookies.json"], // Игнорирует изменения в cookies.json  
        env: {  
          NODE_ENV: "production"    // Устанавливает переменную окружения  
        }  
      }  
    ]  
  };  

  // sudo apt update  
// sudo apt install -y libasound2t64 libatk1.0-0t64 libatk-bridge2.0-0 libc6 libcairo2 libcups2t64 libdbus-1-3 libexpat1 libfontconfig1 libgcc-s1 libgdk-pixbuf2.0-0 libglib2.0-0t64 libgtk-3-0t64 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libnss3 lsb-release xdg-utils wget libgbm-dev  