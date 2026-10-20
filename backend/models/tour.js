const mongoose = require('mongoose');

const tourSchema = new mongoose.Schema({
    tname: {
        type: String,
        required: true
      },
    tprice: {
        type: Number,
        required: true
      },
    DispImageurl:{
        type:String,
        required:true
    },
    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Agent'
  },
    places:[{
      type:mongoose.Schema.Types.ObjectId,
      ref:"Place"
    }],
    // Optional display details; agent-created tours fall back to defaults in the UI.
    duration: String,
    highlight: String,
    features: [String],
    rating: Number,
    reviews: Number
  },
  {timestamps:true}
  );

  const Tour=mongoose.model('Tour',tourSchema);

  module.exports=Tour;