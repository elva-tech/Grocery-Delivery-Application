(function bootstrapTenantBranding() {
  function tenantIdFromHostname(host) {
    var parts = host.split(".");
    var clean = parts.filter(function (p) {
      return p !== "www";
    });
    var adminIndex = clean.indexOf("admin");
    if (adminIndex !== -1 && clean[adminIndex + 1]) {
      return clean[adminIndex + 1];
    }
    return clean[0] || "";
  }

  function setFavicon(url) {
    if (!url) return;
    var lower = String(url).toLowerCase();
    var type = "image/png";
    if (lower.indexOf(".svg") !== -1) type = "image/svg+xml";
    else if (lower.indexOf(".jpg") !== -1 || lower.indexOf(".jpeg") !== -1) type = "image/jpeg";
    else if (lower.indexOf(".webp") !== -1) type = "image/webp";

    ["icon", "shortcut icon", "apple-touch-icon"].forEach(function (rel) {
      var link = document.querySelector('link[rel="' + rel + '"]');
      if (!link) {
        link = document.createElement("link");
        link.rel = rel;
        document.head.appendChild(link);
      }
      link.href = url;
      if (rel !== "apple-touch-icon") link.type = type;
    });
  }

  var apiBase = (document.querySelector('meta[name="api-base"]') || {}).content;
  if (!apiBase) return;

  apiBase = String(apiBase).trim().replace(/\/$/, "");
  if (!apiBase || apiBase.indexOf("%VITE_") === 0) return;

  var host = (location.hostname || "").toLowerCase();
  var metaTenant = String(
    (document.querySelector('meta[name="tenant-id"]') || {}).content || ""
  )
    .trim()
    .toLowerCase();

  // localhost has no subdomain — use VITE_TENANT_ID from index.html meta, not "localhost"
  var tenantId = "";
  if (host === "localhost" || host === "127.0.0.1") {
    tenantId = metaTenant;
  } else {
    tenantId = tenantIdFromHostname(host);
    if (!tenantId && metaTenant) tenantId = metaTenant;
  }

  if (!tenantId) return;

  var suffix = document.documentElement.getAttribute("data-branding-suffix") || "";

  fetch(apiBase + "/api/tenant/details", {
    headers: { "x-tenant-id": tenantId, Accept: "application/json" },
  })
    .then(function (res) {
      return res.ok ? res.json() : null;
    })
    .then(function (data) {
      if (!data || !data.storeName) return;
      document.title = String(data.storeName).trim() + suffix;
      if (data.logo) setFavicon(String(data.logo).trim());
    })
    .catch(function () {});
})();
