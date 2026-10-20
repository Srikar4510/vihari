const mongoose = require('mongoose');

const busSchema = new mongoose.Schema({
    agent: {
      type:mongoose.Schema.Types.ObjectId,
      ref:'Agent'
    },
    srcname: {
        type: String,
        required: true
      },
    destname: {
        type: String,
        required: true
      },
    trname: {
        type: String,
        required: true
      },
      deptime: {
        type: String,
        required: true
      },
      arrtime: {
        type: String,
        required: true
      },
      durtime: {
        type: String,
        required: true
      },
    tktprice: {
        type: Number,
        required: true
      },
      btype: {
        type: String,
        required: true
      },
    Imageurl:{
        type:String,
        required:true
    },
  },
  {timestamps:true}
  );

  const Bus=mongoose.model('Bus',busSchema);

  module.exports=Bus;