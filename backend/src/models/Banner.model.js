const mongoose = require("mongoose");

const BannerSchema = new mongoose.Schema(
{
  title: {
    type: String,
    required: true
  },

  image: {
    type: String,
    required: true
  },

  isActive: {
    type: Boolean,
    default: true
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Banner", BannerSchema);