const mongoose = require("mongoose");

const tenantSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    ownerName: {
      type: String,
      trim: true,
      default: "",
    },
    phoneNumber: {
      type: String,
      trim: true,
      default: "",
    },
    plan: {
      type: String,
      enum: ["FREE", "BASIC", "PREMIUM", "ENTERPRISE"],
      default: "FREE",
    },
    status: {
      type: String,
      enum: ["ACTIVE", "SUSPENDED", "INACTIVE"],
      default: "ACTIVE",
    },
    customerDomain: {
      type: String,
      trim: true,
      default: "",
    },
    adminDomain: {
      type: String,
      trim: true,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    logo: {
      type: String,
      trim: true,
      default: "",
    },
    storeAddress: {
      type: String,
      trim: true,
      default: "",
    },
    /** Structured store postal address (super-admin onboarding / edit). Mirrors formatted `storeAddress`. */
    storeAddressParts: {
      line1: { type: String, trim: true, default: "" },
      line2: { type: String, trim: true, default: "" },
      landmark: { type: String, trim: true, default: "" },
      city: { type: String, trim: true, default: "" },
      state: { type: String, trim: true, default: "" },
      pincode: { type: String, trim: true, default: "" },
    },
    /** Hub / storefront coordinates for delivery radius checks (MapService origin→destination). */
    storeLat: { type: Number },
    storeLng: { type: Number },
    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    /** Customer-facing support (editable by store admin; may differ from owner contact). */
    supportEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    supportPhone: {
      type: String,
      trim: true,
      default: "",
    },
    supportHours: {
      type: String,
      trim: true,
      default: "",
    },
    /** Optional storefront copy (website hero, header tagline, etc.) */
    tagline: {
      type: String,
      trim: true,
      default: "",
    },
    heroBadge: {
      type: String,
      trim: true,
      default: "",
    },
    heroTitle: {
      type: String,
      trim: true,
      default: "",
    },
    heroSubtitle: {
      type: String,
      trim: true,
      default: "",
    },
    adminPassword: {
      type: String,
      default: "",
      select: false, // never returned in queries by default
    },
    storeCode: {
      type: String,
      unique: true,
      sparse: true,   // allows multiple null/missing values
      trim: true,
      uppercase: true,
    },
    deepLink: {
      type: String,
      trim: true,
      default: "",
    },
    /** Optional Google Play Store URL — shown on customer website app promo when set */
    androidAppLink: {
      type: String,
      trim: true,
      default: "",
    },
    /** Optional Apple App Store URL — shown on customer website app promo when set */
    iosAppLink: {
      type: String,
      trim: true,
      default: "",
    },
    qrCode: {
      type: String,  // base64 data-URL of the QR PNG
      default: "",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Tenant", tenantSchema);
