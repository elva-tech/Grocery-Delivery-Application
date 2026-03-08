const Banner = require("../models/Banner.model");

/**
 * CREATE BANNER
 */
exports.createBanner = async (req, res) => {
  try {

    const { title } = req.body;

    const image = req.file.path;

    const banner = new Banner({
      title,
      image
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

    const banners = await Banner.find({ isActive: true });

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