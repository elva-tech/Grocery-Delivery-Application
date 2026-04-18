const cloudinary = require("cloudinary").v2;
const fs = require("fs").promises;

/**
 * Upload a local file (e.g. from multer) to Cloudinary, then remove the local copy.
 * @param {string} localFilePath - Absolute path to the file on disk
 * @returns {Promise<string>} Cloudinary secure URL
 */
async function uploadLocalFileToCloudinary(localFilePath) {
  // Configure lazily so Render/production env vars are always current at call time
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey    = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Cloudinary credentials missing. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in environment variables."
    );
  }

  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });

  try {
    const result = await cloudinary.uploader.upload(localFilePath, {
      folder: "enandi",
      resource_type: "auto",
    });
    return result.secure_url;
  } finally {
    try {
      await fs.unlink(localFilePath);
    } catch (_) {
      /* ignore missing file */
    }
  }
}

module.exports = {
  uploadLocalFileToCloudinary,
};
