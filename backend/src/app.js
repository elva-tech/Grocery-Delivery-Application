const express = require("express");
const cors = require("cors");

// Import auth middleware
const { authMiddleware } = require("./middleware/auth.middleware");

// Webhook routes (must be imported before express.json())
const webhookRoutes = require("./routes/webhook.routes");

const app = express();

// Middlewares — reflect Origin so browsers get a concrete ACAO value (preflight + custom headers)
app.use(
  cors({
    origin: true,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-tenant-id",
      "x-platform",
      "Accept",
      "Accept-Language",
      "X-Requested-With",
    ],
    optionsSuccessStatus: 204,
    maxAge: 86400,
  })
);

// Webhook routes registered BEFORE express.json() to preserve raw body for signature verification
app.use("/api/webhooks", webhookRoutes);

app.use(express.json());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Health check (PUBLIC)
app.get("/", (req, res) => {
  res.send("Grocery Delivery Backend is running 🚀");
});

// Routes
const adminRoutes = require("./routes/admin.routes");
const authRoutes = require("./routes/auth.routes");
const productRoutes = require("./routes/product.routes");
const orderRoutes = require("./routes/order.routes");
const riderRoutes = require("./routes/rider.routes");
const returnRoutes = require("./routes/return.routes");
const bannerRoutes = require("./routes/banner.routes");
const paymentRoutes = require("./routes/payment.routes");
const settingsRoutes = require("./routes/settings.routes");
const couponRoutes     = require('./routes/coupon.routes');
const analyticsRoutes  = require('./routes/analytics.routes');
const unitRoutes       = require('./routes/unit.routes');
const uploadRoutes     = require("./routes/upload.routes");
const billingRoutes           = require('./routes/billing.routes');
const storeAvailabilityRoutes = require('./routes/storeAvailability.routes');
const tenantRoutes            = require('./routes/tenant.routes');
const superRoutes             = require('./routes/super.routes');
const { startStoreScheduler } = require('./services/storeScheduler.service');


// Public routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/banners",  bannerRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/units",    unitRoutes);
app.use("/api/upload",   uploadRoutes);
app.use("/api/store",    storeAvailabilityRoutes); // GET /api/store/status is public
app.use("/api/tenant",   tenantRoutes);           // POST /api/tenant/create is public (pre-auth onboarding)
app.use("/api/super",    superRoutes);             // Super admin — own JWT, no resolveTenant
// Protected routes
app.use(authMiddleware);

// Protected route registrations
app.use("/api/orders", orderRoutes);
app.use("/api/riders", riderRoutes);
app.use("/api/admin",  adminRoutes);
app.use("/api/returns", returnRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/coupons",  couponRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/billing",  billingRoutes);


// Start store open/close scheduler (every 60s, respects manualOverride)
startStoreScheduler();

module.exports = app;