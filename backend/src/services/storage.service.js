const cloudinary = require("cloudinary").v2;
const fs = require("fs").promises;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a local file (e.g. from multer) to Cloudinary, then remove the local copy.
 * @param {string} localFilePath - Absolute path to the file on disk
 * @returns {Promise<string>} Cloudinary secure URL
 */
async function uploadLocalFileToCloudinary(localFilePath) {
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
