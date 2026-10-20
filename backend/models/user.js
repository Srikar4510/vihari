const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true
      },
      lastName: {
        type: String,
        required: true
      },
      email: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    password: {
        type: String,
        required:true
    },
    mobile:{
      type: String,
      required:true
    },
    // Frequent co-travellers the user can pick when booking.
    savedPassengers: [{
      name: { type: String, required: true, trim: true },
      age: { type: Number, required: true, min: 1, max: 120 },
      gender: { type: String, required: true, enum: ['Male', 'Female', 'Other'] }
    }]
},
{timestamps: true}
);

const User = mongoose.model('User', userSchema);

module.exports = User;