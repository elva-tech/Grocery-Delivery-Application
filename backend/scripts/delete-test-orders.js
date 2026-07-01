/**
 * Delete orders from MongoDB (orders collection ONLY).
 *
 * Safety:
 * - Dry-run by default — lists matching orders, deletes nothing.
 * - Requires --confirm DELETE_ORDERS to perform deletion.
 * - Deleting all tenants requires --all (prevents accidental full wipe).
 * - Does NOT touch users, products, inventory, tenants, invoices, returns, etc.
 *
 * Orphan note: notifications / return requests / customer invoices that reference
 * deleted orders are left unchanged (per "orders only" requirement).
 *
 * Usage (from backend/):
 *
 *   # 1) Preview all orders
 *   node scripts/delete-test-orders.js
 *
 *   # 2) Preview orders for one store
 *   node scripts/delete-test-orders.js --tenant-id enandi
 *
 *   # 3) Preview orders created on/before a date (UTC)
 *   node scripts/delete-test-orders.js --before 2026-06-26
 *
 *   # 4) Delete (production — set MONGO_URI first)
 *   set MONGO_URI=mongodb+srv://...
 *   node scripts/delete-test-orders.js --tenant-id enandi --confirm DELETE_ORDERS
 *
 *   # 5) Delete all orders across every tenant (use with care)
 *   node scripts/delete-test-orders.js --all --confirm DELETE_ORDERS
 *
 * Options:
 *   --tenant-id <id>     Filter by tenantId (repeatable)
 *   --before <YYYY-MM-DD>  Only orders with createdAt <= end of that UTC day
 *   --after <YYYY-MM-DD>   Only orders with createdAt >= start of that UTC day
 *   --ids <id1,id2,...>    Only these MongoDB order _id values
 *   --all                  Allow match across all tenants (required if no tenant-id)
 *   --confirm DELETE_ORDERS  Actually delete (otherwise dry-run)
 *   --limit <n>            Max rows to show in preview (default 200)
 */
require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../src/config/db");
const Order = require("../src/models/Order.model");

const CONFIRM_TOKEN = "DELETE_ORDERS";

function parseArgs(argv) {
  const out = {
    tenantIds: [],
    before: null,
    after: null,
    ids: [],
    all: false,
    confirm: null,
    limit: 200,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--tenant-id") {
      out.tenantIds.push(String(argv[++i] || "").trim());
    } else if (arg === "--before") {
      out.before = String(argv[++i] || "").trim();
    } else if (arg === "--after") {
      out.after = String(argv[++i] || "").trim();
    } else if (arg === "--ids") {
      out.ids = String(argv[++i] || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (arg === "--all") {
      out.all = true;
    } else if (arg === "--confirm") {
      out.confirm = String(argv[++i] || "").trim();
    } else if (arg === "--limit") {
      out.limit = Math.max(1, parseInt(argv[++i], 10) || 200);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  out.tenantIds = out.tenantIds.filter(Boolean);
  return out;
}

function parseUtcDayStart(isoDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    throw new Error(`Invalid date "${isoDate}" — use YYYY-MM-DD`);
  }
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function parseUtcDayEnd(isoDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    throw new Error(`Invalid date "${isoDate}" — use YYYY-MM-DD`);
  }
  return new Date(`${isoDate}T23:59:59.999Z`);
}

function buildFilter(args) {
  const filter = {};

  if (args.ids.length > 0) {
    const validIds = [];
    for (const id of args.ids) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error(`Invalid order _id: ${id}`);
      }
      validIds.push(new mongoose.Types.ObjectId(id));
    }
    filter._id = { $in: validIds };
  }

  if (args.tenantIds.length > 0) {
    filter.tenantId = args.tenantIds.length === 1 ? args.tenantIds[0] : { $in: args.tenantIds };
  } else if (!args.all && args.ids.length === 0) {
    throw new Error(
      "Refusing to match all tenants without --all. Pass --tenant-id <id> or --ids <...> or --all explicitly."
    );
  }

  if (args.before) {
    filter.createdAt = filter.createdAt || {};
    filter.createdAt.$lte = parseUtcDayEnd(args.before);
  }

  if (args.after) {
    filter.createdAt = filter.createdAt || {};
    filter.createdAt.$gte = parseUtcDayStart(args.after);
  }

  return filter;
}

function formatOrderRow(order) {
  const id = String(order._id);
  const displayId = id.slice(-8).toUpperCase();
  const created = order.createdAt ? order.createdAt.toISOString() : "—";
  return {
    _id: id,
    displayId,
    tenantId: order.tenantId,
    orderStatus: order.orderStatus,
    paymentStatus: order.paymentStatus,
    totalAmount: order.totalAmount,
    customerName: order.customerName || "",
    customerPhone: order.customerPhone || "",
    createdAt: created,
  };
}

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not set. Export your production connection string before running.");
  }

  const args = parseArgs(process.argv);
  const filter = buildFilter(args);
  const isDryRun = args.confirm !== CONFIRM_TOKEN;

  await connectDB();

  const dbName = mongoose.connection.db.databaseName;
  const totalInDb = await Order.countDocuments({});
  const matchCount = await Order.countDocuments(filter);

  console.log("\n=== delete-test-orders.js ===");
  console.log("Database:", dbName);
  console.log("Collection: orders (ONLY — no other collections modified)");
  console.log("Filter:", JSON.stringify(filter));
  console.log("Total orders in DB:", totalInDb);
  console.log("Matching orders:", matchCount);
  console.log("Mode:", isDryRun ? "DRY-RUN (no deletes)" : "DELETE");

  if (matchCount === 0) {
    console.log("\nNothing to delete.");
    await mongoose.disconnect();
    return;
  }

  const preview = await Order.find(filter)
    .select("_id tenantId orderStatus paymentStatus totalAmount customerName customerPhone createdAt")
    .sort({ createdAt: -1 })
    .limit(args.limit)
    .lean();

  console.log(`\nPreview (up to ${args.limit} rows, newest first):`);
  console.table(preview.map(formatOrderRow));

  if (matchCount > args.limit) {
    console.log(`… and ${matchCount - args.limit} more matching order(s) not shown.`);
  }

  const byTenant = await Order.aggregate([
    { $match: filter },
    { $group: { _id: "$tenantId", count: { $sum: 1 }, totalAmount: { $sum: "$totalAmount" } } },
    { $sort: { _id: 1 } },
  ]);
  console.log("\nBreakdown by tenant:");
  console.table(
    byTenant.map((row) => ({
      tenantId: row._id,
      orders: row.count,
      sumTotalAmount: row.totalAmount,
    }))
  );

  if (isDryRun) {
    console.log("\nDry-run complete. To delete these orders, re-run with:");
    console.log("  --confirm DELETE_ORDERS");
    await mongoose.disconnect();
    return;
  }

  console.log("\nDeleting in 5 seconds… Press Ctrl+C to abort.");
  await new Promise((resolve) => setTimeout(resolve, 5000));

  const result = await Order.deleteMany(filter);

  const remaining = await Order.countDocuments({});
  console.log("\nDeleted:", result.deletedCount);
  console.log("Orders remaining in DB:", remaining);
  console.log("Done. Only the orders collection was modified.");

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("\nError:", err.message);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
