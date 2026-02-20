const mongoose = require("mongoose");
const User = require("../models/User.model");

exports.blockOrUnblockUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    // 1️⃣ Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    // 2️⃣ Prevent admin from blocking themselves
    if (req.user.userId === id) {
      return res.status(400).json({
        success: false,
        message: "Admin cannot block themselves",
      });
    }

    // 3️⃣ Find user
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // 4️⃣ Check if already same state
    if (user.isActive === isActive) {
      return res.status(400).json({
        success: false,
        message: isActive
          ? "User already active"
          : "User already blocked",
      });
    }

    // 5️⃣ Update status
    user.isActive = isActive;
    await user.save();

    return res.status(200).json({
      success: true,
      message: isActive
        ? "User unblocked successfully"
        : "User blocked successfully",
    });
  } catch (error) {
    console.error("Block/Unblock Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};