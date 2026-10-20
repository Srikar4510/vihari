const mongoose = require('mongoose');

const ticketSchema= new mongoose.Schema({
    user:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User'
    },
    bus:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'Bus'
    },
    tickets:[{
        name:{
            type:String,
            required:true
        },
        age:{
            type:String,
            required:true
        },
       seat:{
            type:String,
            required:true
        },
        gender:{
            type:String,
            required:true
        }
    }],
    date:{
        type:String,
        required:true
    },
    // Total paid in rupees (computed on the server) and the Razorpay payment id, if any.
    amount: Number,
    paymentId: String
}, { timestamps: true });

// A Razorpay payment can confirm only one booking (demo bookings have no paymentId).
ticketSchema.index({ paymentId: 1 }, { unique: true, partialFilterExpression: { paymentId: { $type: 'string' } } });
  
const Ticket=mongoose.model('Ticket',ticketSchema);
module.exports=Ticket;