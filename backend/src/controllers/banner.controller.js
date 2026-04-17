const Banner = require("../models/Banner.model");
const User = require("../models/User.model");
const { uploadLocalFileToCloudinary } = require("../services/storage.service");
// TODO: 'image' field is deprecated. Use 'imageUrl' only.


/**
 * CREATE BANNER
 */
exports.createBanner = async (req, res) => {
  try {
    const { title } = req.body;

    let imageUrl = req.body.imageUrl;

    // Case 1: Use provided Cloudinary URL
    if (imageUrl && typeof imageUrl === "string" && imageUrl.trim()) {
      imageUrl = imageUrl.trim();
    }

    // Case 2: Fallback to file upload (old flow)
    else if (req.file?.path) {
      try {
        imageUrl = await uploadLocalFileToCloudinary(req.file.path);
      } catch (uploadError) {
        return res.status(500).json({
          success: false,
          message: uploadError.message || "Failed to upload banner image",
        });
      }
    }

    // Case 3: Nothing provided
    else {
      return res.status(400).json({
        success: false,
        message: "Banner image URL is required",
      });
    }

    const tenantId = req.user?.tenantId;
    const userId = req.user?.userId;

    const banner = new Banner({
      title,
      imageUrl,
      tenantId,
      userId,
    });

    await banner.save();

    res.status(201).json({
      success: true,
      message: "Banner created successfully",
      data: banner,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


/**
 * GET ALL BANNERS
 */
exports.getBanners = async (req, res) => {
  try {
    // ✅ Support both cases (with auth OR without auth)
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: "Tenant ID is required"
      });
    }

    const banners = await Banner.find({
      tenantId,
      isActive: true
    });

    res.json({
      success: true,
      data: banners
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.deleteBanner = async (req, res) => {
  try {

    const bannerId = req.params.id;

    const banner = await Banner.findByIdAndDelete(bannerId);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found"
      });
    }

    res.json({
      success: true,
      message: "Banner deleted successfully"
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }
};