let globalAuthToken = "";

module.exports = {
    getVar: () => globalAuthToken,
    setVar: (value) => {
        globalAuthToken = value;
    }
};