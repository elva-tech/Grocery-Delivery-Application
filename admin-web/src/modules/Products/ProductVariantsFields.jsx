import React from 'react';
import { Field, ErrorMessage } from 'formik';
import { Plus, X, AlertTriangle } from 'lucide-react';

export default function ProductVariantsFields({ values, errors, setFieldValue }) {
  const rows = values.variants || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">
          Sizes / packs / units
        </label>
        <button
          type="button"
          onClick={() => {
            setFieldValue('variants', [
              ...rows,
              {
                label: '',
                price: '',
                stock: 0,
                isDefault: rows.length === 0,
                variantId: '',
                threshold: 10,
              },
            ]);
          }}
          className="text-xs font-bold text-emerald-700 flex items-center gap-1"
        >
          <Plus size={14} /> Add option
        </button>
      </div>
      <p className="text-[10px] text-gray-400 mb-3 ml-1">
        e.g. 500 ml at ₹100, 1 L at ₹200, or Size 8 / 9 / 10 for footwear. Alert highlights when stock ≤ “Low stock at”.
      </p>
      <div className="space-y-3">
        {rows.map((row, idx) => {
          const stockNum = Number(row.stock);
          const thNum = Number(row.threshold);
          const isLow =
            Number.isFinite(stockNum) &&
            Number.isFinite(thNum) &&
            stockNum <= thNum;

          return (
            <div
              key={idx}
              className={`border rounded-xl p-3 space-y-2 ${
                isLow
                  ? 'border-amber-400 bg-amber-50/90 ring-1 ring-amber-200'
                  : 'border-slate-200 bg-slate-50/50'
              }`}
              title={
                isLow
                  ? `Low stock for ${row.label || 'this option'}: ${stockNum} units (reorder when ≤ ${thNum})`
                  : undefined
              }
            >
              {isLow && (
                <div className="flex items-center gap-1.5 text-amber-800 text-[11px] font-bold">
                  <AlertTriangle size={14} aria-hidden />
                  Low stock — {stockNum} left (alert at ≤ {thNum})
                </div>
              )}
              <div className="flex gap-2 items-start">
                <div className="flex-1">
                  <Field
                    name={`variants.${idx}.label`}
                    placeholder="Label (500 ml, Size 9)"
                    className="w-full border p-2.5 rounded-lg text-sm"
                  />
                  <ErrorMessage name={`variants.${idx}.label`} component="p" className="text-red-500 text-[10px]" />
                </div>
                <button
                  type="button"
                  disabled={rows.length <= 1}
                  onClick={() => {
                    const next = rows.filter((_, i) => i !== idx);
                    if (!next.some((v) => v.isDefault) && next[0]) {
                      next[0] = { ...next[0], isDefault: true };
                    }
                    setFieldValue('variants', next);
                  }}
                  className="text-red-400 p-1 disabled:opacity-30"
                  aria-label="Remove variant"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Field
                    name={`variants.${idx}.price`}
                    type="number"
                    min="1"
                    placeholder="Price ₹"
                    className="w-full border p-2.5 rounded-lg text-sm"
                  />
                  <ErrorMessage name={`variants.${idx}.price`} component="p" className="text-red-500 text-[10px]" />
                </div>
                <div>
                  <Field
                    name={`variants.${idx}.stock`}
                    type="number"
                    min="0"
                    placeholder="Stock"
                    className="w-full border p-2.5 rounded-lg text-sm"
                  />
                  <ErrorMessage name={`variants.${idx}.stock`} component="p" className="text-red-500 text-[10px]" />
                </div>
                <div>
                  <Field
                    name={`variants.${idx}.threshold`}
                    type="number"
                    min="0"
                    placeholder="Low stock at"
                    className="w-full border p-2.5 rounded-lg text-sm"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
                <input
                  type="radio"
                  name="defaultVariant"
                  checked={Boolean(row.isDefault)}
                  onChange={() => {
                    setFieldValue(
                      'variants',
                      rows.map((v, i) => ({ ...v, isDefault: i === idx }))
                    );
                  }}
                />
                Default option (shown first in shop)
              </label>
            </div>
          );
        })}
      </div>
      {typeof errors.variants === 'string' && (
        <p className="text-red-500 text-[11px] mt-1">{errors.variants}</p>
      )}
    </div>
  );
}
