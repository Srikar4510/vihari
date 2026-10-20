const Tour = require('../models/tour');
const tourTicket = require('../models/tourTickets');
const { paymentsEnabled, verifyPayment, refundIfPaid } = require('../utils/payments');
const { emailTourVoucher } = require('../utils/bookingEmails');
const { mailConfigured } = require('../utils/mailer');
const { QuoteError, tourQuote } = require('../utils/pricing');


exports.getAllTours=async (req,res)=>{
    var search=req.body.tname;
    // console.log(search)
    if(!search)
    search=''
    const regex = new RegExp(search, "i");

    // const filteredtours=await tours.find({ tname: { $regex: regex } });
    // console.log(filteredtours)
    // res.render('tours',{tours:filteredtours});
    Tour.find({tname:{$regex:regex}})
    .then((tours)=>{
        // console.log(tours)
        res.render('tours',{tours:tours});
    })
    .catch((err)=>{
        console.log(err);
    })

};

exports.getMoreTours=(req,res)=>{
    const {offset} = req.query;
    Tour.find({}).skip(offset).limit(3)
    .then((tours)=>{
        res.json(tours);
    })
    .catch((err)=>{
        console.log(err);
        res.status(401)
    })

};
// Books a tour. The price is computed on the server; when payments are live the Razorpay
// payment must be genuine and for that amount.
//   { tourId, travellers, payment: { orderId, paymentId, signature } }
// A paid booking that still fails (tour removed, invalid traveller count, server error) is refunded.
exports.booking = async (req, res) => {
    const { payment } = req.body;
    const live = paymentsEnabled();
    let refundable = live;
    const fail = async (status, error) => {
        const refunded = refundable && await refundIfPaid(payment, error);
        return res.status(status).json({ success: false, error: refunded ? `${error.replace(/\.?$/, '.')} Your payment has been refunded.` : error, refunded });
    };
    try {
        if (live && payment?.paymentId && await tourTicket.exists({ paymentId: payment.paymentId })) {
            refundable = false;
            return res.status(409).json({ success: false, error: 'This payment has already been used for a booking' });
        }
        const { tour, travellers, amount } = await tourQuote(req.body.tourId || req.body.tour?._id, req.body.travellers ?? req.body.tickets);
        if (live && !(await verifyPayment(payment, amount))) {
            refundable = false;
            return res.status(402).json({ success: false, error: 'Payment could not be verified' });
        }
        const ticket = await tourTicket.create({ user: req.user.id, tour: tour._id, tickets: travellers, price: amount, paymentId: live ? payment.paymentId : undefined });
        // Voucher PDF goes to the account email in the background.
        emailTourVoucher(ticket._id);
        // Same shape as /api/auth/mytours (price is Decimal128 in the model, so convert it).
        res.status(201).json({
            success: true,
            ticket: { _id: ticket._id, tour: tour._id, travellers: ticket.tickets, price: Number(ticket.price), bookedAt: ticket._id.getTimestamp() },
            demo: !live,
            emailQueued: mailConfigured(),
        });
    } catch (error) {
        if (error?.code === 11000) {
            refundable = false;
            return res.status(409).json({ success: false, error: 'This payment has already been used for a booking' });
        }
        if (error instanceof QuoteError) return fail(error.status, error.message);
        console.log(error);
        return fail(500, 'Something went wrong while booking.');
    }
}
module.exports.getTour = async(req,res)=>{
    try {
        const {id} = req.body
    const tour = await Tour.findById(id);
    if(tour){
        res.json({success:true,tour})
    }
    else {
        res.json({success:false,error:"Slow network"})
    } 
    } catch (error) {
        console.log(error)
        res.json({success:false,error:"Internal error"})
    }
}