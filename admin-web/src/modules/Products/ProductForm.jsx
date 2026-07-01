/**
 * @file ProductForm.tsx
 * @description Admin form to manage products with backend-ready description and image handling.
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { X, Plus, ChevronDown, ArrowLeft, Loader2 } from 'lucide-react';
import { useAppState } from '../../context/AppStateContext';
import { apiService } from '../../services/apiService';
import resolveImageUrl from '../../utils/resolveImageUrl';
import ProductVariantsFields from './ProductVariantsFields';

/** Keep { url, public_id }[] for Cloudinary deletes while editing. */
function normalizeImagesForForm(imageValue) {
  if (!Array.isArray(imageValue)) {
    const one = resolveImageUrl({ image: imageValue });
    return one ? [{ url: one, public_id: '' }] : [];
  }
  return imageValue
    .map((entry) => {
      if (typeof entry === 'string') {
        const url = entry.trim();
        return url ? { url, public_id: '' } : null;
      }
      if (entry && typeof entry === 'object' && typeof entry.url === 'string') {
        const url = entry.url.trim();
        if (!url) return null;
        const public_id =
          typeof entry.public_id === 'string' ? entry.public_id.trim() : '';
        return { url, public_id };
      }
      return null;
    })
    .filter(Boolean);
}

function previewUrlsFromImageField(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((e) => {
      if (typeof e === 'string') return e.trim();
      if (e && typeof e === 'object' && typeof e.url === 'string') return e.url.trim();
      return '';
    })
    .filter(Boolean);
}

const variantRowSchema = Yup.object().shape({
  label: Yup.string().trim().required('Label required'),
  price: Yup.number().typeError('Required').min(1, 'Price must be positive').required('Required'),
  stock: Yup.number().typeError('Required').min(0, 'No negative stock').required('Required'),
  isDefault: Yup.boolean(),
  variantId: Yup.string().nullable(),
  threshold: Yup.number().typeError('Must be a number').min(0, 'Must be ≥ 0').nullable(),
});

function buildProductSchema(noMainCategories) {
  return Yup.object().shape({
    name: Yup.string().required('Required'),
    description: Yup.string().required('Required'),
    variants: Yup.array().of(variantRowSchema).min(1, 'Add at least one size/pack option'),
    parentCategoryId: noMainCategories
      ? Yup.string().nullable()
      : Yup.string().required('Required'),
    subCategoryId: Yup.string().nullable(),
    freeCategoryName: noMainCategories
      ? Yup.string().trim().min(1, 'Enter a main category name').required('Required')
      : Yup.string().nullable(),
    freeSubcategoryName: Yup.string().nullable(),
  });
}

function variantsFromInitial(initial) {
  if (Array.isArray(initial?.variants) && initial.variants.length > 0) {
    return initial.variants.map((v) => ({
      label: v.label || '',
      price: v.price ?? '',
      stock: v.availableQty ?? v.stock ?? 0,
      isDefault: Boolean(v.isDefault),
      variantId: v.variantId || '',
      threshold: v.thresholdQty ?? v.threshold ?? 10,
    }));
  }
  const unit = initial?.unit || '';
  return [
    {
      label: unit,
      price: initial?.price ?? '',
      stock: initial?.stock ?? initial?.availableQty ?? 0,
      isDefault: true,
      variantId: '',
      threshold: initial?.threshold ?? initial?.thresholdQty ?? 10,
    },
  ];
}

const ProductForm = ({ initialValues, onSubmit, onCancel, onImagesPersisted, saving = false }) => {
  const fileInputRef = useRef(null);
  const { categories } = useAppState();

  const mainCategories = categories.filter(c => !c.parentId);
  const noMainCategories = mainCategories.length === 0;
  const productSchema = useMemo(
    () => buildProductSchema(noMainCategories),
    [noMainCategories]
  );

  // Dynamic unit system
  const [units, setUnits] = useState([]);
  const [unitsLoading, setUnitsLoading] = useState(true);
  const [unitDropdownOpen, setUnitDropdownOpen] = useState(false);
  const [unitSearch, setUnitSearch] = useState('');
  const [showAddUnitModal, setShowAddUnitModal] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');
  const [savingUnit, setSavingUnit] = useState(false);
  const [addUnitError, setAddUnitError] = useState('');

  const [showErrors, setShowErrors] = useState(false);
  /** null = idle; distinguishes upload vs remove status text */
  const [imageBusy, setImageBusy] = useState(null);
  const [imageUploadError, setImageUploadError] = useState('');
  const [imageUploadSuccess, setImageUploadSuccess] = useState('');
  const [imagePreviews, setImagePreviews] = useState(() =>
    previewUrlsFromImageField(
      normalizeImagesForForm(initialValues?.images ?? initialValues?.image ?? [])
    )
  );

  const editingKey =
    initialValues?.productId || initialValues?._id || initialValues?.id || '';

  useEffect(() => {
    setImagePreviews(
      previewUrlsFromImageField(
        normalizeImagesForForm(initialValues?.images ?? initialValues?.image ?? [])
      )
    );
  }, [editingKey]);

  useEffect(() => {
    apiService.getUnits()
      .then(data => setUnits(Array.isArray(data) ? data : (data.units || [])))
      .catch(() => { })
      .finally(() => setUnitsLoading(false));
  }, []);

  const handleAddUnit = async (setFieldValue) => {
    const name = newUnitName.trim().toUpperCase();
    if (!name) return;
    setSavingUnit(true);
    setAddUnitError('');
    try {
      await apiService.createUnit(name);
      const data = await apiService.getUnits();
      const updated = Array.isArray(data) ? data : (data.units || []);
      setUnits(updated);
      setFieldValue('unitType', name);
      setShowAddUnitModal(false);
      setNewUnitName('');
    } catch (err) {
      setAddUnitError(
        err.status === 409 || err.statusCode === 409
          ? 'Unit already exists'
          : (err.message || 'Failed to save unit')
      );
    } finally {
      setSavingUnit(false);
    }
  };

  // Parse existing unit string (e.g. "500 G" → { unitValue: 500, unitType: 'G' })
  const parseUnit = (unit = '') => {
    const parts = String(unit).trim().split(/\s+/);
    const val = parseFloat(parts[0]);
    const type = parts[1]?.toUpperCase() || '';
    return {
      unitValue: isNaN(val) ? '' : val,
      unitType: type || '',
    };
  };

  const initialVariants = useMemo(
    () => variantsFromInitial(initialValues),
    [editingKey]
  );

  const isEditing = Boolean(
    initialValues?.productId || initialValues?.id || initialValues?._id
  );

  return (

    <div className="max-w-2xl mx-auto space-y-4 animate-in fade-in duration-300">
      <button
        type="button"
        onClick={onCancel}
        className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-emerald-700 transition-colors"
      >
        <ArrowLeft size={16} aria-hidden />
        Back to inventory
      </button>

      <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-100">
        <h2 className="text-xl font-bold text-slate-800 mb-6">
          {isEditing ? 'Edit Product' : 'Add New Product'}
        </h2>

      <Formik

        initialValues={{
          name: initialValues?.name || '',
          description: initialValues?.description || '',
          variants: initialVariants,
          parentCategoryId:
            initialValues?.parentCategoryId ||
            (noMainCategories ? '' : mainCategories[0]?.id || ''),
          subCategoryId: initialValues?.subCategoryId || '',
          freeCategoryName: '',
          freeSubcategoryName: '',
          image: normalizeImagesForForm(
            initialValues?.images ?? initialValues?.image ?? []
          ),
          returnAllowed: initialValues?.returnAllowed !== false,
        }}

        validationSchema={productSchema}


        // {MISSING FIELD LOGIC}
   onSubmit={(values, { setTouched }) => {

  setShowErrors(true);

  setTouched({
    name: true,
    description: true,
    variants: true,
    parentCategoryId: true,
    freeCategoryName: true,
    freeSubcategoryName: true,
  });

  const variants = (values.variants || []).map((row, idx) => ({
    ...row,
    label: String(row.label || '').trim(),
    price: Math.abs(Number(row.price)),
    stock: Math.max(0, Math.floor(Number(row.stock) || 0)),
    sortOrder: idx,
    threshold: row.threshold !== '' && row.threshold != null ? Number(row.threshold) : 10,
  }));

  const submission = {
    ...values,
    variants,
    images: values.image,
  };

  onSubmit(submission);
}}
      >

        {({ setFieldValue, values, errors, touched }) => {

          const subCats = categories.filter(
            c => c.parentId === values.parentCategoryId
          );

          const filteredUnits = units.filter(u =>
            u.name.toLowerCase().includes(unitSearch.toLowerCase())
          );

          return (

            <>

              {/* {ADDED MISSING FIELDS MESSAGE} */}
              {showErrors && Object.keys(errors).length > 0 && (
                <div className="bg-red-50 border border-red-300 text-red-600 text-xs font-bold p-3 rounded-xl">
                  Missing: {Object.keys(errors).join(', ')}
                </div>
              )}
              <Form className="space-y-6">

                <div className="flex flex-col md:flex-row gap-6">

                  {/* LEFT IMAGE UPLOADER */}

                  <div className="flex-1 space-y-4">

                    <label className="block text-sm font-bold text-gray-700">
                      Product Images
                    </label>

                    <div className="grid grid-cols-2 gap-2">

                      {imagePreviews.map((img, i) => (

                        <div
                          key={i}
                          className="relative aspect-square border rounded-lg overflow-hidden"
                        >

                          <img
                            src={img}
                            className="w-full h-full object-cover"
                          />

                          <button
                            type="button"
                            disabled={!!imageBusy}
                            onClick={async () => {
                              const nextImages = values.image.filter(
                                (_, idx) => idx !== i
                              );
                              const removed =
                                Array.isArray(values.image) && i < values.image.length
                                  ? values.image[i]
                                  : null;
                              const publicId =
                                removed &&
                                typeof removed === 'object' &&
                                typeof removed.public_id === 'string'
                                  ? removed.public_id.trim()
                                  : '';
                              if (editingKey && publicId) {
                                setImageBusy('removing');
                                setImageUploadError('');
                                try {
                                  await apiService.deleteProductImage(
                                    String(editingKey),
                                    publicId
                                  );
                                  onImagesPersisted?.();
                                  setImageUploadSuccess('Image removed from storage.');
                                  window.setTimeout(() => setImageUploadSuccess(''), 3000);
                                } catch (err) {
                                  const msg =
                                    (err && err.response && err.response.data && err.response.data.message) ||
                                    (typeof err?.message === 'string' && err.message) ||
                                    'Could not delete image.';
                                  setImageUploadError(msg);
                                  setImageBusy(null);
                                  return;
                                }
                                setImageBusy(null);
                              }
                              setFieldValue('image', nextImages);
                              setImagePreviews(previewUrlsFromImageField(nextImages));
                            }}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 disabled:opacity-40 disabled:pointer-events-none"
                          >

                            <X size={10} />

                          </button>

                        </div>

                      ))}

                      <button
                        type="button"
                        onClick={() =>
                          fileInputRef.current.click()
                        }
                        disabled={!!imageBusy}
                        className="aspect-square border-2 border-dashed border-emerald-200 rounded-lg flex items-center justify-center bg-emerald-50/30 text-emerald-600"
                      >

                        <Plus size={20} />

                      </button>

                      <input
                        type="file"
                        ref={fileInputRef}
                        hidden
                        multiple
                        onChange={async (e) => {
                          const files = Array.from(e.target.files || []);
                          if (!files.length) return;

                          setImageUploadError('');
                          setImageUploadSuccess('');
                          setImageBusy('uploading');

                          const localPreviews = files.map((file) => URL.createObjectURL(file));
                          setImagePreviews((prev) => [...prev, ...localPreviews]);

                          try {
                            const isMongoProductId =
                              editingKey &&
                              String(editingKey).match(/^[a-f\d]{24}$/i);

                            let merged;
                            if (isMongoProductId) {
                              const data = await apiService.appendProductImages(
                                String(editingKey),
                                files
                              );
                              merged = normalizeImagesForForm(
                                data?.product?.images ?? []
                              );
                              onImagesPersisted?.();
                            } else {
                              const uploaded = await Promise.all(
                                files.map(async (file) => {
                                  const data = await apiService.uploadFile(
                                    file,
                                    'products',
                                    {}
                                  );
                                  if (!data?.url) return null;
                                  return {
                                    url: data.url,
                                    public_id:
                                      typeof data.public_id === 'string'
                                        ? data.public_id
                                        : '',
                                  };
                                })
                              );
                              const newImages = uploaded.filter(Boolean);
                              merged = [...values.image, ...newImages];
                            }

                            setFieldValue('image', merged);

                            localPreviews.forEach((url) => URL.revokeObjectURL(url));
                            setImagePreviews(previewUrlsFromImageField(merged));

                            const n = files.length;
                            setImageUploadSuccess(
                              n > 1
                                ? `${n} images uploaded successfully.`
                                : 'Image uploaded successfully.'
                            );
                            window.setTimeout(() => setImageUploadSuccess(''), 4000);
                          } catch (err) {
                            localPreviews.forEach((url) => URL.revokeObjectURL(url));
                            setImagePreviews((prev) =>
                              prev.slice(0, prev.length - localPreviews.length)
                            );
                            setImageUploadError(
                              (typeof err?.response?.data?.message === 'string' && err.response.data.message)
                              || (err && typeof err === 'object' && typeof err.message === 'string' && err.message)
                              || 'Image upload failed. Please try again.'
                            );
                          } finally {
                            setImageBusy(null);
                            e.target.value = '';
                          }
                        }}
                      />

                    </div>
                    {imageBusy === 'uploading' && (
                      <p className="text-[11px] text-emerald-600">Uploading image...</p>
                    )}
                    {imageBusy === 'removing' && (
                      <p className="text-[11px] text-amber-700">Removing image...</p>
                    )}
                    {imageUploadSuccess && (
                      <p className="text-[11px] text-emerald-700 font-semibold">{imageUploadSuccess}</p>
                    )}
                    {imageUploadError && (
                      <p className="text-[11px] text-red-500">{imageUploadError}</p>
                    )}

                  </div>

                  {/* RIGHT PRODUCT DETAILS */}

                  <div className="flex-1 space-y-4">

                    <div className="grid grid-cols-2 gap-2">

                      {noMainCategories ? (
                        <>
                          <div className="col-span-2 rounded-xl border border-amber-100 bg-amber-50/80 px-3 py-2 text-[11px] text-amber-900">
                            No categories yet (they are created from your products). Type a category below, or close this form and use <span className="font-bold">New Category</span> first.
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase">
                              Main category (new)
                            </label>
                            <Field
                              name="freeCategoryName"
                              placeholder="e.g. Apparel"
                              className="w-full border p-3 rounded-xl bg-white mt-1"
                            />
                            <ErrorMessage name="freeCategoryName" component="p" className="text-red-500 text-[11px] mt-1" />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase">
                              Sub category (optional)
                            </label>
                            <Field
                              name="freeSubcategoryName"
                              placeholder="e.g. T-Shirts"
                              className="w-full border p-3 rounded-xl bg-white mt-1"
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase">
                              Main Category
                            </label>
                            <Field
                              as="select"
                              name="parentCategoryId"
                              className="w-full border p-3 rounded-xl bg-white mt-1"
                            >
                              {mainCategories.map(c => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </Field>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase">
                              Sub Category
                            </label>
                            <Field
                              as="select"
                              name="subCategoryId"
                              className="w-full border p-3 rounded-xl bg-white mt-1"
                            >
                              <option value="">Select Sub</option>
                              {subCats.map(c => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </Field>
                          </div>
                        </>
                      )}

                    </div>

                    <Field
                      name="name"
                      placeholder="Product Name"
                      className="w-full border p-3 rounded-xl"
                    />

                    {/* DESCRIPTION */}

                    <div>

                      <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">
                        Product Description
                      </label>

                      <Field
                        as="textarea"
                        name="description"
                        placeholder="Enter detailed product info for the app..."
                        className="w-full border p-3 rounded-xl mt-1 h-24 resize-none focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      />

                    </div>

                    <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <Field
                          type="checkbox"
                          name="returnAllowed"
                          className="mt-1 accent-[#0F2C1D]"
                        />
                        <div>
                          <p className="text-sm font-bold text-slate-800">Allow returns for this product</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Turn off for items that cannot be returned after delivery (e.g. fresh produce).
                          </p>
                        </div>
                      </label>
                    </div>

                    <ProductVariantsFields values={values} errors={errors} setFieldValue={setFieldValue} />

                    <button
                      type="submit"
                      disabled={saving || imageBusy}
                      className="w-full bg-[#1A4D2E] text-white py-4 rounded-xl font-bold shadow-md hover:bg-[#143d24] transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {saving ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          Saving…
                        </>
                      ) : (
                        'Save Product'
                      )}
                    </button>

                  </div>

                </div>

              </Form>

              {/* Add New Unit Modal */}
              {showAddUnitModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                  <div className="bg-white rounded-2xl shadow-2xl p-6 w-80">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-gray-800">Add New Unit</h3>
                      <button
                        type="button"
                        onClick={() => { setShowAddUnitModal(false); setNewUnitName(''); setAddUnitError(''); }}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={newUnitName}
                      onChange={e => setNewUnitName(e.target.value.toUpperCase())}
                      placeholder="e.g. BUNDLE"
                      className="w-full border p-3 rounded-xl mb-2 uppercase font-mono tracking-wide"
                      onKeyDown={e => e.key === 'Enter' && handleAddUnit(setFieldValue)}
                      autoFocus
                    />
                    {addUnitError && (
                      <p className="text-red-500 text-xs mb-2">{addUnitError}</p>
                    )}
                    <button
                      type="button"
                      onClick={() => handleAddUnit(setFieldValue)}
                      disabled={savingUnit || !newUnitName.trim()}
                      className="w-full bg-[#1A4D2E] text-white py-3 rounded-xl font-bold disabled:opacity-50 transition-opacity"
                    >
                      {savingUnit ? 'Saving...' : 'Save Unit'}
                    </button>
                  </div>
                </div>
              )}

            </>

          );

        }}

      </Formik>

      </div>
    </div>

  );

};

export default ProductForm;