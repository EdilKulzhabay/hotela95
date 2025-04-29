let globalCookies = {
    Session_Token: "",
    Security_Token: "",
    Auth_Token: "",
    CSRF_Token: ""
};

module.exports = {
    getGlobalCookes: () => globalCookies,
    setSession_Token: (value) => {
        globalCookies.Session_Token = value;
    },
    setSecurity_Token: (value) => {
        globalCookies.Security_Token = value;
    },
    setAuth_Token: (value) => {
        globalCookies.Auth_Token = value;
    },
    setCSRF_Token: (value) => {
        globalCookies.CSRF_Token = value;
    }
};