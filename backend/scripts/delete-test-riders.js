/**
 * Delete test riders for a tenant from MongoDB.
 *
 * Deletes:
 *   1) riders collection — rider profiles for the tenant
 *   2) users collection — login accounts linked to those riders (role RIDER only)
 *
 * Does NOT touch: orders, products, customers, admins, tenants, inventory, etc.
 *
 * Usage (from backend/):
 *
 *   node scripts/delete-test-riders.js --tenant-id enandi
 *   node scripts/delete-test-riders.js --tenant-id enandi --confirm DELETE_RIDERS
 *
 * Options:
 *   --tenant-id <id>       Filter by tenantId (repeatable)
 *   --ids <id1,id2,...>    Only these rider _id values
 *   --all                  Allow match across all tenants (required if no tenant-id)
 *   --confirm DELETE_RIDERS  Actually delete (otherwise dry-run)
 *   --limit <n>            Max rows in preview (default 200)
 */
require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../src/config/db");
const Rider = require("../src/models/Rider.model");
const User = require("../src/models/User.model");

const CONFIRM_TOKEN = "DELETE_RIDERS";

function parseArgs(argv) {
  const out = {
    tenantIds: [],
    ids: [],
    all: false,
    confirm: null,
    limit: 200,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--tenant-id") {
      out.tenantIds.push(String(argv[++i] || "").trim());
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

function buildFilter(args) {
  const filter = {};

  if (args.ids.length > 0) {
    const validIds = [];
    for (const id of args.ids) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error(`Invalid rider _id: ${id}`);
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

  return filter;
}

function formatRiderRow(rider) {
  return {
    _id: String(rider._id),
    tenantId: rider.tenantId,
    userId: String(rider.userId || ""),
    name: rider.name,
    phoneNumber: rider.phoneNumber,
    vehicle: rider.vehicle,
    status: rider.status,
    isActive: rider.isActive,
    createdAt: rider.createdAt ? rider.createdAt.toISOString() : "—",
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
  const totalRiders = await Rider.countDocuments({});
  const matchCount = await Rider.countDocuments(filter);

  console.log("\n=== delete-test-riders.js ===");
  console.log("Database:", dbName);
  console.log("Collections: riders + linked users (role RIDER only)");
  console.log("Filter:", JSON.stringify(filter));
  console.log("Total riders in DB:", totalRiders);
  console.log("Matching riders:", matchCount);
  console.log("Mode:", isDryRun ? "DRY-RUN (no deletes)" : "DELETE");

  if (matchCount === 0) {
    console.log("\nNothing to delete.");
    await mongoose.disconnect();
    return;
  }

  const preview = await Rider.find(filter)
    .select("_id tenantId userId name phoneNumber vehicle status isActive createdAt")
    .sort({ createdAt: -1 })
    .limit(args.limit)
    .lean();

  const userIds = preview.map((r) => r.userId).filter(Boolean);
  const linkedUsers = userIds.length
    ? await User.find({ _id: { $in: userIds }, role: "RIDER" })
        .select("_id tenantId phoneNumber name role")
        .lean()
    : [];

  console.log(`\nRiders to delete (up to ${args.limit}):`);
  console.table(preview.map(formatRiderRow));

  if (matchCount > args.limit) {
    console.log(`… and ${matchCount - args.limit} more matching rider(s) not shown.`);
  }

  console.log("\nLinked RIDER user accounts (sample from preview):");
  if (linkedUsers.length === 0) {
    console.log("(none found in preview batch)");
  } else {
    console.table(
      linkedUsers.map((u) => ({
        _id: String(u._id),
        tenantId: u.tenantId,
        phoneNumber: u.phoneNumber,
        name: u.name,
        role: u.role,
      }))
    );
  }

  const byTenant = await Rider.aggregate([
    { $match: filter },
    { $group: { _id: "$tenantId", count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  console.log("\nBreakdown by tenant:");
  console.table(byTenant.map((row) => ({ tenantId: row._id, riders: row.count })));

  if (isDryRun) {
    console.log("\nDry-run complete. To delete these riders, re-run with:");
    console.log("  --confirm DELETE_RIDERS");
    await mongoose.disconnect();
    return;
  }

  console.log("\nDeleting in 5 seconds… Press Ctrl+C to abort.");
  await new Promise((resolve) => setTimeout(resolve, 5000));

  const allMatching = await Rider.find(filter).select("_id userId").lean();
  const allUserIds = allMatching.map((r) => r.userId).filter(Boolean);

  const riderResult = await Rider.deleteMany(filter);
  const userResult = allUserIds.length
    ? await User.deleteMany({ _id: { $in: allUserIds }, role: "RIDER" })
    : { deletedCount: 0 };

  const ridersRemaining = await Rider.countDocuments({});
  console.log("\nDeleted riders:", riderResult.deletedCount);
  console.log("Deleted linked RIDER users:", userResult.deletedCount);
  console.log("Riders remaining in DB:", ridersRemaining);
  console.log("Done.");

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
