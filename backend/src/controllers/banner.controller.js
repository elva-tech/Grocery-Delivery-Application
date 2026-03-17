const Banner = require("../models/Banner.model");
const User = require("../models/User.model");


/**
 * CREATE BANNER
 */
exports.createBanner = async (req, res) => {
  try {

    const { title } = req.body; 

    const image = req.file.path;
    const tenantId = req.user?.tenantId;
    const userId = req.user?.userId;

    // fetch full user from DB
    const user = await User.findById(req.user.userId);

    const banner = new Banner({
      title,
      image,
      tenantId,
      userId
    });

    await banner.save();

    res.status(201).json({
      success: true,
      message: "Banner created successfully",
      data: banner
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


/**
 * GET ALL BANNERS
 */
exports.getBanners = async (req, res) => {
  try {
    const banners = await Banner.find({ isActive: true }); // public banners only
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