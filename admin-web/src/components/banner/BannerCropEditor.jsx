import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, Smartphone, Monitor } from 'lucide-react';
import {
  EDITOR_VIEWPORT,
  BANNER_TARGETS,
  clampPosition,
  getImageStyle,
  exportBothBannerCrops,
} from '../../utils/bannerCrop';

const BannerCropEditor = ({ imageSrc, onCancel, onSave, saving }) => {
  const [imageSize, setImageSize] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const dragRef = useRef(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImageSize({ w: img.naturalWidth, h: img.naturalHeight });
      setZoom(1);
      setPosition({ x: 0, y: 0 });
    };
    img.src = imageSrc;
  }, [imageSrc]);

  const clampedPosition = imageSize
    ? clampPosition(position, zoom, imageSize.w, imageSize.h, EDITOR_VIEWPORT.width, EDITOR_VIEWPORT.height)
    : position;

  const handlePointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origin: { ...clampedPosition } };
  };

  const handlePointerMove = (e) => {
    if (!dragRef.current || !imageSize) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const next = clampPosition(
      { x: dragRef.current.origin.x + dx, y: dragRef.current.origin.y + dy },
      zoom,
      imageSize.w,
      imageSize.h,
      EDITOR_VIEWPORT.width,
      EDITOR_VIEWPORT.height
    );
    setPosition(next);
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  const handleZoomChange = (delta) => {
    if (!imageSize) return;
    const next = Math.min(3, Math.max(1, zoom + delta));
    setZoom(next);
    setPosition((prev) =>
      clampPosition(prev, next, imageSize.w, imageSize.h, EDITOR_VIEWPORT.width, EDITOR_VIEWPORT.height)
    );
  };

  const handleSave = async () => {
    const crops = await exportBothBannerCrops(imageSrc, zoom, clampedPosition);
    onSave(crops);
  };

  const renderPreview = useCallback(
    (targetKey, icon) => {
      const target = BANNER_TARGETS[targetKey];
      const previewW = targetKey === 'web' ? 280 : 200;
      const previewH = Math.round(previewW * (target.height / target.width));

      return (
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
            {icon}
            {target.label}
          </div>
          <div
            className="relative overflow-hidden rounded-2xl border-2 border-slate-200 bg-slate-900 shadow-inner mx-auto"
            style={{ width: previewW, height: previewH }}
          >
            {imageSize && (
              <img
                src={imageSrc}
                alt=""
                draggable={false}
                style={getImageStyle(
                  imageSize.w,
                  imageSize.h,
                  previewW,
                  previewH,
                  zoom,
                  {
                    x: clampedPosition.x * (previewW / EDITOR_VIEWPORT.width),
                    y: clampedPosition.y * (previewH / EDITOR_VIEWPORT.height),
                  }
                )}
              />
            )}
          </div>
        </div>
      );
    },
    [imageSrc, imageSize, zoom, clampedPosition]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-black text-slate-800">Crop Banner</h2>
            <p className="text-sm text-slate-500 font-medium mt-0.5">Drag to reposition · use slider to zoom</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors"
          >
            <X size={22} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div
            className="relative overflow-hidden rounded-2xl bg-slate-900 cursor-grab active:cursor-grabbing select-none mx-auto border-2 border-emerald-200"
            style={{ width: EDITOR_VIEWPORT.width, height: EDITOR_VIEWPORT.height }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            {imageSize ? (
              <img
                src={imageSrc}
                alt=""
                draggable={false}
                style={getImageStyle(
                  imageSize.w,
                  imageSize.h,
                  EDITOR_VIEWPORT.width,
                  EDITOR_VIEWPORT.height,
                  zoom,
                  clampedPosition
                )}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-white/50 text-sm font-bold">
                Loading…
              </div>
            )}
            <div className="absolute inset-0 pointer-events-none ring-1 ring-inset ring-white/20 rounded-2xl" />
          </div>

          <div className="flex items-center gap-4 px-1">
            <button
              type="button"
              onClick={() => handleZoomChange(-0.1)}
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
            >
              <ZoomOut size={18} />
            </button>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => {
                const next = parseFloat(e.target.value);
                setZoom(next);
                if (imageSize) {
                  setPosition((prev) =>
                    clampPosition(prev, next, imageSize.w, imageSize.h, EDITOR_VIEWPORT.width, EDITOR_VIEWPORT.height)
                  );
                }
              }}
              className="flex-1 accent-[#1A4D2E]"
            />
            <button
              type="button"
              onClick={() => handleZoomChange(0.1)}
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
            >
              <ZoomIn size={18} />
            </button>
          </div>

          <div className="flex gap-6 justify-center pt-1">
            {renderPreview('web', <Monitor size={14} />)}
            {renderPreview('app', <Smartphone size={14} />)}
          </div>
        </div>

        <div className="flex gap-3 p-6 border-t border-slate-100">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-4 rounded-2xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!imageSize || saving}
            className="flex-1 py-4 rounded-2xl font-black text-white bg-[#1A4D2E] hover:bg-[#163d25] disabled:opacity-50 transition-colors shadow-lg shadow-green-900/20"
          >
            {saving ? 'Saving…' : 'Save Banner'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BannerCropEditor;
