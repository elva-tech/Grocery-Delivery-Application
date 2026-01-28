const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI;

    if (!uri || typeof uri !== "string" || uri.trim().length === 0) {
      console.error(
        "MongoDB connection failed ❌ Missing MONGO_URI environment variable.\nPlease set MONGO_URI in your .env file or environment. See .env.example for a template."
      );
      process.exit(1);
    }

    await mongoose.connect(uri, {
      // use the new parser and topology by default in modern mongoose
      // these options are safe to keep even if mongoose ignores them
      // (keeps behavior explicit)
      // no need to set useNewUrlParser/useUnifiedTopology in mongoose v6+
    });

    console.log("MongoDB connected successfully ✅");
  } catch (error) {
    console.error("MongoDB connection failed ❌", error);
    process.exit(1);
  }
};

module.exports = connectDB;
