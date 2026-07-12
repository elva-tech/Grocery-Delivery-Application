/** Target display ratios — matches website (desktop) and mobile app home banners */
export const BANNER_TARGETS = {
  web: { width: 1200, height: 400, label: 'Website' },
  app: { width: 686, height: 320, label: 'Mobile App' },
};

export const EDITOR_VIEWPORT = { width: 400, height: 280 };

export function getMinZoom(imageW, imageH, viewportW, viewportH) {
  return Math.max(viewportW / imageW, viewportH / imageH);
}

export function clampPosition(position, zoom, imageW, imageH, viewportW, viewportH) {
  const baseScale = getMinZoom(imageW, imageH, viewportW, viewportH);
  const scale = baseScale * zoom;
  const dw = imageW * scale;
  const dh = imageH * scale;

  const maxX = Math.max(0, (dw - viewportW) / 2);
  const maxY = Math.max(0, (dh - viewportH) / 2);

  return {
    x: Math.min(maxX, Math.max(-maxX, position.x)),
    y: Math.min(maxY, Math.max(-maxY, position.y)),
  };
}

export function getImageStyle(imageW, imageH, viewportW, viewportH, zoom, position) {
  const baseScale = getMinZoom(imageW, imageH, viewportW, viewportH);
  const scale = baseScale * zoom;
  const dw = imageW * scale;
  const dh = imageH * scale;
  const left = (viewportW - dw) / 2 + position.x;
  const top = (viewportH - dh) / 2 + position.y;

  return {
    position: 'absolute',
    width: dw,
    height: dh,
    left,
    top,
    maxWidth: 'none',
  };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function scalePosition(position, fromW, fromH, toW, toH) {
  return {
    x: position.x * (toW / fromW),
    y: position.y * (toH / fromH),
  };
}

/** Export object-cover crop for a target frame using shared pan/zoom from the editor */
export async function exportBannerCrop(imageSrc, zoom, position, targetW, targetH) {
  const { width: editorW, height: editorH } = EDITOR_VIEWPORT;
  const img = await loadImage(imageSrc);
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const pos = scalePosition(position, editorW, editorH, targetW, targetH);

  const baseScale = getMinZoom(iw, ih, targetW, targetH);
  const scale = baseScale * zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  const left = (targetW - dw) / 2 + pos.x;
  const top = (targetH - dh) / 2 + pos.y;

  const sx = Math.max(0, -left / scale);
  const sy = Math.max(0, -top / scale);
  const sw = Math.min(iw - sx, targetW / scale);
  const sh = Math.min(ih - sy, targetH / scale);

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);

  return canvas.toDataURL('image/jpeg', 0.9);
}

export async function exportBothBannerCrops(imageSrc, zoom, position) {
  const [imageWeb, image] = await Promise.all([
    exportBannerCrop(imageSrc, zoom, position, BANNER_TARGETS.web.width, BANNER_TARGETS.web.height),
    exportBannerCrop(imageSrc, zoom, position, BANNER_TARGETS.app.width, BANNER_TARGETS.app.height),
  ]);
  return { image, imageWeb };
}

export function dataUrlToFile(dataUrl, filename) {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    array[i] = binary.charCodeAt(i);
  }
  return new File([array], filename, { type: mime });
}
