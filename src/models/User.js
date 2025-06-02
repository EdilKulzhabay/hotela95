const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
    {
        phone: {
            type: String,
            required: true,
            unique: true,
        },
        status: {
            type: Boolean,
            default: false,
        },
        last_message_date: {
            type: Date,
            default: null,
        },
        lastMessages: {
            type: Array,
            default: [],
        },
        bookingDate: {
            type: Object,
            default: {
                startDate: "",
                endDate: "",
                personsKol: "",
            },
        },
        chooseApartments: {
            type: Array,
            default: [],
        },
        chooseApartment: {
            type: Object,
            default: {},
        },
        apartment: {
            type: Object,
            default: {},
        },
        apartments: {
            type: Array,
            default: [],
        },
        waitAgreement: {
            type: Object,
            default: {
                status: false,
                what: {},
            },
        },
        paid: {
            type: Object,
            default: {
                apartment_id: "",
                status: false,
            },
        },
        additionalPrompt: {
            type: Boolean,
            default: false,
        },
        waitFIO: {
            type: Boolean,
            default: false,
        },
        specialPhone: {
            type: Boolean,
            default: false,
        },
        specialPhoneForInstruction: {
            type: Boolean,
            default: false,
        },
        temporarySum: {
            type: Number,
            default: 0,
        },
        isGandon: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('User', UserSchema); 