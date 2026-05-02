const mongoose = require("mongoose");

const BannerSchema = new mongoose.Schema(
{
  title: {
    type: String,
    required: true
  },

  imageUrl: {
    type: String,
    required: true
  },

  /** Cloudinary public_id for delete/replace (optional on legacy rows). */
  imagePublicId: {
    type: String,
    default: "",
  },
  
  // Deprecated — keep optional for backward compatibility
  image: {
    type: String
  },
  
  tenantId: {
    type: String,
    required: true,
  }, 
    
  userId: {
    type: String,
    required: true,
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
