const mongoose = require('mongoose');

const  TourTicketSchema = new mongoose.Schema({
    user:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User'
    },
    tour:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'Tour'
    },
    tickets:{
        type:Number,
        required:true
    },
    price:{
        type:mongoose.Types.Decimal128,
        required:true
    },
    // Razorpay payment id (absent for demo bookings).
    paymentId: String
})

// A Razorpay payment can confirm only one booking.
TourTicketSchema.index({ paymentId: 1 }, { unique: true, partialFilterExpression: { paymentId: { $type: 'string' } } });

const tourTicket = mongoose.model('TourBookings',TourTicketSchema);

module.exports = tourTicket