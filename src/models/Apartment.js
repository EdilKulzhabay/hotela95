const mongoose = require('mongoose');

const ApartmentSchema = new mongoose.Schema(
    {
        apartment_id: {
            type: String,
            required: true,
            unique: true,
        },
        address: {
            type: String,
            default: "",
        },
        title: {
            type: String,
            default: "",
        },
        links: {
            type: Array,
            default: [],
        },
        text: {
            type: String,
            default: "",
        },
        price: {
            type: Number,
            default: 0,
        }
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('Apartment', ApartmentSchema); 