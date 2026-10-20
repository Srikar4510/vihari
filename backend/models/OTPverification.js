const mongoose = require("mongoose");

const userOTP = new mongoose.Schema({
    user:{
        type: String,
        required: true
      },
    OTP :{
        type: String,
        required: true   
    } 
})

module.exports.userOTP = mongoose.model('userOTP',userOTP)