const mongoose = require("mongoose")

const ApartmentsSchema = new mongoose.Schema(
    {
        apartment_id: {
            type: String,
            required: true
        },
        links: [],
        text: {
            type: String,
            default: ""
        }
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("Apartments", ApartmentsSchema);