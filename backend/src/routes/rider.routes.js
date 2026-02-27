const express = require("express");
const router = express.Router();

const {
  getAllRiders,
  getRiderById,
  createRider,
  updateRider,
  updateRiderStatus,
  getRiderOrders,
  getRiderStats,
  getAvailableRiders,
  assignOrderToRider,
  completeDelivery,
  failDelivery,
  deactivateRider,
} = require("../controllers/rider.controller");

const { authMiddleware, adminOnly } = require("../middleware/auth.middleware");
const { riderOnly, canAccessRider, canAssignRider } = require("../middleware/rider.middleware");

//////////////////////////////////////////////////////
// GET ALL RIDERS
//////////////////////////////////////////////////////
// GET /api/riders
router.get(
  "/",
  authMiddleware,
  adminOnly,
  getAllRiders
);

//////////////////////////////////////////////////////
// GET AVAILABLE RIDERS
//////////////////////////////////////////////////////
// GET /api/riders/available
router.get(
  "/available",
  authMiddleware,
  adminOnly,
  getAvailableRiders
);

//////////////////////////////////////////////////////
// GET SINGLE RIDER
//////////////////////////////////////////////////////
// GET /api/riders/:id
router.get(
  "/:id",
  authMiddleware,
  canAccessRider,
  getRiderById
);

//////////////////////////////////////////////////////
// CREATE NEW RIDER
//////////////////////////////////////////////////////
// POST /api/riders
router.post(
  "/",
  authMiddleware,
  adminOnly,
  createRider
);

//////////////////////////////////////////////////////
// UPDATE RIDER
//////////////////////////////////////////////////////
// PUT /api/riders/:id
router.put(
  "/:id",
  authMiddleware,
  adminOnly,
  updateRider
);

//////////////////////////////////////////////////////
// UPDATE RIDER STATUS
//////////////////////////////////////////////////////
// PUT /api/riders/:id/status
router.put(
  "/:id/status",
  authMiddleware,
  canAccessRider,
  updateRiderStatus
);

//////////////////////////////////////////////////////
// GET RIDER'S ORDERS
//////////////////////////////////////////////////////
// GET /api/riders/:id/orders
router.get(
  "/:id/orders",
  authMiddleware,
  canAccessRider,
  getRiderOrders
);

//////////////////////////////////////////////////////
// GET RIDER STATS
//////////////////////////////////////////////////////
// GET /api/riders/:id/stats
router.get(
  "/:id/stats",
  authMiddleware,
  canAccessRider,
  getRiderStats
);

//////////////////////////////////////////////////////
// ASSIGN ORDER TO RIDER
//////////////////////////////////////////////////////
// POST /api/riders/:id/assign-order
router.post(
  "/:id/assign-order",
  authMiddleware,
  adminOnly,
  canAssignRider,
  assignOrderToRider
);

//////////////////////////////////////////////////////
// COMPLETE DELIVERY
//////////////////////////////////////////////////////
// PUT /api/riders/:id/orders/:orderId/complete
router.put(
  "/:id/orders/:orderId/complete",
  authMiddleware,
  riderOnly,
  completeDelivery
);

//////////////////////////////////////////////////////
// FAIL DELIVERY
//////////////////////////////////////////////////////
// PUT /api/riders/:id/orders/:orderId/failed
router.put(
  "/:id/orders/:orderId/failed",
  authMiddleware,
  riderOnly,
  failDelivery
);

//////////////////////////////////////////////////////
// DEACTIVATE RIDER
//////////////////////////////////////////////////////
// DELETE /api/riders/:id
router.delete(
  "/:id",
  authMiddleware,
  adminOnly,
  deactivateRider
);

module.exports = router;
