const OLA_MAPS_SDK =
  'https://unpkg.com/olamaps-web-sdk@1.4.0/dist/olamaps-web-sdk.umd.js';
const OLA_STYLE =
  'https://api.olamaps.io/tiles/vector/v1/styles/default-light-standard/style.json';

type BuildOlaMapPickerHtmlArgs = {
  apiKey: string;
  lat: number;
  lng: number;
};

export function buildOlaMapPickerHtml({ apiKey, lat, lng }: BuildOlaMapPickerHtmlArgs): string {
  const safeKey = JSON.stringify(apiKey);
  const safeLat = Number.isFinite(lat) ? lat : 12.9716;
  const safeLng = Number.isFinite(lng) ? lng : 77.5946;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <style>
    html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; overflow: hidden; background: #e2e8f0; }
  </style>
  <script src="${OLA_MAPS_SDK}"></script>
</head>
<body>
  <div id="map"></div>
  <script>
    (function () {
      var apiKey = ${safeKey};
      var map = null;
      var programmaticMove = false;

      function post(msg) {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify(msg));
        }
      }

      function emitCenter() {
        if (!map) return;
        var c = map.getCenter();
        post({
          type: 'location',
          lat: Number(Number(c.lat).toFixed(6)),
          lng: Number(Number(c.lng).toFixed(6)),
        });
      }

      window.__setMapCenter = function (lat, lng, animate) {
        if (!map) return;
        programmaticMove = true;
        var center = [Number(lng), Number(lat)];
        if (animate && typeof map.flyTo === 'function') {
          map.flyTo({ center: center, zoom: 15, essential: true });
        } else if (typeof map.jumpTo === 'function') {
          map.jumpTo({ center: center, zoom: 15, essential: true });
        } else if (typeof map.setCenter === 'function') {
          map.setCenter(center);
        }
        setTimeout(function () {
          programmaticMove = false;
          emitCenter();
        }, animate ? 700 : 120);
      };

      async function init(lat, lng) {
        try {
          var OlaMaps = (window.OlaMapsSDK && window.OlaMapsSDK.OlaMaps) || window.OlaMaps;
          if (!OlaMaps) throw new Error('Ola Maps SDK failed to load');
          var olaMaps = new OlaMaps({ apiKey: apiKey });
          map = await olaMaps.init({
            style: ${JSON.stringify(OLA_STYLE)},
            container: 'map',
            center: [Number(lng), Number(lat)],
            zoom: 15,
          });
          map.on('moveend', function () {
            if (programmaticMove) return;
            emitCenter();
          });
          post({ type: 'ready' });
          emitCenter();
        } catch (e) {
          post({ type: 'error', message: (e && e.message) || 'Map init failed' });
        }
      }

      init(${safeLat}, ${safeLng});
    })();
  </script>
</body>
</html>`;
}
