const mongoose = require('mongoose');

const placeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: false
  },
  Imageurl:{
    type:String
  },
  description: {
    type: String,
    required: true
  },
  tour: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tour'
  }
});

const Place = mongoose.model('Place', placeSchema);

module.exports = Place;