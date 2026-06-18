const DEFAULT_MAP_SERVICE_URL = "https://ola-map-service.onrender.com";
const DEFAULT_TIMEOUT_MS = 28000;

function getMapServiceOrigin() {
  const raw = String(process.env.MAP_SERVICE_URL || DEFAULT_MAP_SERVICE_URL).trim();
  return raw.replace(/\/+$/, "");
}

function buildUpstreamUrl(path, query) {
  const origin = getMapServiceOrigin();
  const resource = path.startsWith("/") ? path : `/${path}`;
  const qs =
    query && typeof query === "object" && Object.keys(query).length
      ? `?${new URLSearchParams(query).toString()}`
      : "";
  return `${origin}${resource}${qs}`;
}

async function proxyToMapService({ method, path, query, body }) {
  const url = buildUpstreamUrl(path, query);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const headers = { Accept: "application/json" };
    const init = {
      method,
      headers,
      signal: controller.signal,
    };

    if (body !== undefined && method !== "GET" && method !== "HEAD") {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }

    const upstream = await fetch(url, init);
    const text = await upstream.text();

    let payload = text;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = text;
    }

    return {
      status: upstream.status,
      payload,
      isJson: typeof payload === "object" && payload !== null,
    };
  } catch (err) {
    if (err?.name === "AbortError") {
      const error = new Error("Map service request timed out");
      error.status = 504;
      throw error;
    }
    const error = new Error("Map service is unreachable");
    error.status = 502;
    error.cause = err;
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  getMapServiceOrigin,
  proxyToMapService,
};
