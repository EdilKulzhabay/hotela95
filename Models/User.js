const mongoose = require("mongoose")

const UserSchema = new mongoose.Schema(
    {
        phone: {
            type: String,
            required: true
        },
        status: {
            type: Boolean,
            default: false
        },
        apartment: {
            type: Object,
            default: {}
        },
        specialPhone: {
            type: Boolean,
            default: false
        },
        waitFIO: {
            type: Boolean,
            default: false
        },
        lastMessages: {
            type: [
                {
                    role: {
                        type: String,
                        enum: ["user", "assistant"],
                        required: true,
                    },
                    content: {
                        type: String,
                        required: true,
                    },
                },
            ], // Массив строк для хранения сообщений
            default: []
        },
        apartments: [],
        isGandon: {
            type: Boolean,
            default: false
        },
        temporarySum: {
            type: Number,
            default: 0
        },
        paid: {
            apartment_id: {
                type: String,
                default: ""
            },
            status: {
                type: Boolean,
                default: false
            }
        },
        chooseApartments: {
            type: [],
            default: []
        },
        chooseApartment: {
            type: Object
        },
        waitAgreement: {
            status: {
                type: Boolean,
                default: false
            },
            what: {
                type: Object
            }
        },
        bookingDate: {
            startDate: {
                type: String,
                default: ""
            },
            endDate: {
                type: String,
                default: ""
            },
            personsKol: {
                type: Number,
                default: 0
            }
        },
        last_message_date: {
            type: Date
        },
        dontUnderstand: {
            type: Number,
            default: 0
        },
        additionalPrompt: {
            type: Boolean,
            default: false
        },
        specialPhoneForInstruction: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("User", UserSchema);