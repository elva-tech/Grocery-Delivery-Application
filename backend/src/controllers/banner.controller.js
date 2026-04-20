const Banner = require("../models/Banner.model");
const {
  uploadToCloudinary,
  destroyFromCloudinary,
  publicIdFromCloudinaryDeliveryUrl,
} = require("../services/cloudinary.service");
const tenantPolicy = require("../config/tenantPolicy");
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
      if (!req.user?.tenantId) {
        return res.status(401).json({
          success: false,
          message: "Tenant context is required for banner image upload.",
        });
      }
      try {
        const { url, public_id } = await uploadToCloudinary(
          req.file.path,
          req.user.tenantId,
          "banners",
          req.file.originalname
        );
        imageUrl = url;
        req._bannerUploadPublicId = public_id;
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

    const urlCheck = tenantPolicy.validateBannerImageUrlStrict(imageUrl);
    if (!urlCheck.ok) {
      return res.status(400).json({ success: false, message: urlCheck.message });
    }

    const tenantId = req.user?.tenantId;
    const userId = req.user?.userId;

    let imagePublicId =
      typeof req.body.imagePublicId === "string"
        ? req.body.imagePublicId.trim()
        : "";
    if (!imagePublicId && req._bannerUploadPublicId) {
      imagePublicId = String(req._bannerUploadPublicId).trim();
    }
    if (!imagePublicId) {
      imagePublicId = publicIdFromCloudinaryDeliveryUrl(imageUrl);
    }

    const banner = new Banner({
      title,
      imageUrl,
      imagePublicId,
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
    // tenantId is set by resolveTenant middleware
    const tenantId = req.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: "Tenant ID is required"
      });
    }

    const tenantMatch = tenantPolicy.buildBannerTenantFilter(tenantId);
    const banners = await Banner.find({
      isActive: true,
      ...tenantMatch,
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
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: "Tenant context is required",
      });
    }

    const banner = await Banner.findOneAndDelete({
      _id: bannerId,
      tenantId,
    });

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found"
      });
    }

    let publicId =
      typeof banner.imagePublicId === "string" ? banner.imagePublicId.trim() : "";
    if (!publicId) {
      publicId = publicIdFromCloudinaryDeliveryUrl(banner.imageUrl);
    }
    if (publicId && tenantPolicy.isPublicIdOwnedByTenantFolder(publicId, tenantId)) {
      try {
        await destroyFromCloudinary(publicId);
      } catch (err) {
        console.warn("deleteBanner: Cloudinary destroy failed", publicId, err.message);
      }
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