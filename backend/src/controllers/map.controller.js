const { proxyToMapService } = require("../services/mapProxy.service");

function sendProxyResult(res, result) {
  if (result.isJson) {
    return res.status(result.status).json(result.payload);
  }
  return res.status(result.status).send(result.payload);
}

function resolveOlaMapsApiKey() {
  return String(
    process.env.OLA_MAPS_API_KEY ||
      process.env.MAP_API_KEY ||
      process.env.VITE_OLA_MAPS_API_KEY ||
      process.env.REACT_APP_OLA_MAPS_API_KEY ||
      ""
  ).trim();
}

exports.getMapConfig = (req, res) => {
  const apiKey = resolveOlaMapsApiKey();

  if (!apiKey) {
    return res.status(503).json({
      success: false,
      message: "Maps API key is not configured on the server",
    });
  }

  return res.status(200).json({ apiKey });
};

exports.searchPlaces = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (q.length < 3) {
      return res.status(400).json({ error: "Query must be at least 3 characters" });
    }

    const result = await proxyToMapService({
      method: "GET",
      path: "/api/map/search",
      query: { q },
    });
    return sendProxyResult(res, result);
  } catch (err) {
    console.error("map.searchPlaces error:", err.message);
    return res.status(err.status || 502).json({
      error: err.message || "Map search failed",
    });
  }
};

exports.processLocation = async (req, res) => {
  try {
    const result = await proxyToMapService({
      method: "POST",
      path: "/api/map/process",
      body: req.body,
    });
    return sendProxyResult(res, result);
  } catch (err) {
    console.error("map.processLocation error:", err.message);
    return res.status(err.status || 502).json({
      error: err.message || "Map process failed",
    });
  }
};
