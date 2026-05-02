const { getAssetsRootFolder } = require("../services/cloudinary.service");

function envIsFalse(key) {
  return String(process.env[key] || "").toLowerCase() === "false";
}

/** Strict isolation is the default; set STRICT_TENANT_ISOLATION=false to allow non-Cloudinary image URLs only. */
function isStrictTenantIsolation() {
  return !envIsFalse("STRICT_TENANT_ISOLATION");
}

/** Root-level product / inventory filter: exact tenant only. */
function buildProductTenantRoot(tenantId) {
  const t = String(tenantId || "").trim();
  if (!t) return { tenantId: "__none__" };
  return { tenantId: t };
}

/** After $lookup/$unwind `product`, constrain joined document to this tenant. */
function buildProductTenantNested(prefix, tenantId) {
  const t = String(tenantId || "").trim();
  if (!t) return { [`${prefix}.tenantId`]: "__none__" };
  return { [`${prefix}.tenantId`]: t };
}

/** Banner list filter fragment (combine with isActive etc.). */
function buildBannerTenantFilter(tenantId) {
  return buildProductTenantRoot(tenantId);
}

function isCloudinaryDeliveryUrl(url) {
  if (!url || typeof url !== "string") return false;
  return url.toLowerCase().includes("res.cloudinary.com");
}

function validateProductImagesStrictUrls(images) {
  if (!isStrictTenantIsolation()) return { ok: true };
  const list = Array.isArray(images) ? images : [];
  for (const img of list) {
    const url = img && typeof img.url === "string" ? img.url.trim() : "";
    if (!url) continue;
    if (!isCloudinaryDeliveryUrl(url)) {
      return { ok: false, message: "External images not allowed" };
    }
  }
  return { ok: true };
}

function isPublicIdOwnedByTenantFolder(public_id, folderTenantId) {
  if (!public_id || typeof public_id !== "string") return false;
  const id = public_id.trim();
  if (!id) return false;
  const root = String(getAssetsRootFolder() || "grocery_app").replace(/\/+$/, "");
  const t = String(folderTenantId || "").trim();
  if (!t) return false;
  const prefix = `${root}/${t}/`;
  return id.startsWith(prefix);
}

/**
 * Delete/replace: public_id must live under this tenant's Cloudinary folder.
 * Empty public_id skips check (legacy rows without stored id).
 */
function assertPublicIdAllowedForTenantProductOps(public_id, tenantId) {
  const id = typeof public_id === "string" ? public_id.trim() : "";
  if (!id) return { ok: true };

  if (isPublicIdOwnedByTenantFolder(id, tenantId)) {
    return { ok: true };
  }

  return {
    ok: false,
    message: "Cross-tenant image access not allowed",
  };
}

function validateProductImagesForWrite(images, tenantId) {
  const strictUrl = validateProductImagesStrictUrls(images);
  if (!strictUrl.ok) return strictUrl;

  const list = Array.isArray(images) ? images : [];
  for (const img of list) {
    const pid =
      img && typeof img.public_id === "string" ? img.public_id.trim() : "";
    if (!pid) continue;
    const chk = assertPublicIdAllowedForTenantProductOps(pid, tenantId);
    if (!chk.ok) return chk;
  }
  return { ok: true };
}

function validateBannerImageUrlStrict(imageUrl) {
  if (!isStrictTenantIsolation()) return { ok: true };
  const u = typeof imageUrl === "string" ? imageUrl.trim() : "";
  if (!u) return { ok: true };
  if (!isCloudinaryDeliveryUrl(u)) {
    return { ok: false, message: "External images not allowed" };
  }
  return { ok: true };
}

/** Return / report-issue evidence URL (single string). */
function validateEvidenceImageUrlStrict(url) {
  if (!isStrictTenantIsolation()) return { ok: true };
  const u = typeof url === "string" ? url.trim() : "";
  if (!u) return { ok: false, message: "evidenceUrl is required" };
  if (!isCloudinaryDeliveryUrl(u)) {
    return { ok: false, message: "External images not allowed" };
  }
  return { ok: true };
}

module.exports = {
  isStrictTenantIsolation,
  buildProductTenantRoot,
  buildProductTenantNested,
  buildBannerTenantFilter,
  isCloudinaryDeliveryUrl,
  validateProductImagesStrictUrls,
  validateProductImagesForWrite,
  assertPublicIdAllowedForTenantProductOps,
  validateBannerImageUrlStrict,
  validateEvidenceImageUrlStrict,
  isPublicIdOwnedByTenantFolder,
};
