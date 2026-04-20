/**
 * @file ProductForm.tsx
 * @description Admin form to manage products with backend-ready description and image handling.
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { X, Plus, ChevronDown } from 'lucide-react';
import { useAppState } from '../../context/AppStateContext';
import { apiService } from '../../services/apiService';
import resolveImageUrl from '../../utils/resolveImageUrl';

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

function buildProductSchema(noMainCategories) {
  return Yup.object().shape({
    name: Yup.string().required('Required'),
    description: Yup.string().required('Required'),
    price: Yup.number().min(1, 'Price must be positive').required('Required'),
    stock: Yup.number().min(0, 'No negative stock').required('Required'),
    parentCategoryId: noMainCategories
      ? Yup.string().nullable()
      : Yup.string().required('Required'),
    subCategoryId: Yup.string().nullable(),
    freeCategoryName: noMainCategories
      ? Yup.string().trim().min(1, 'Enter a main category name').required('Required')
      : Yup.string().nullable(),
    freeSubcategoryName: Yup.string().nullable(),
    unitValue: Yup.number().typeError('Required').min(0.01, 'Must be > 0').required('Required'),
    unitType: Yup.string().required('Select a unit type'),
    threshold: Yup.number().typeError('Must be a number').min(0, 'Must be ≥ 0').nullable(),
  });
}

const ProductForm = ({ initialValues, onSubmit, onCancel, onImagesPersisted }) => {
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

  const parsedUnit = parseUnit(initialValues?.unit);

  return (

    <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-100 max-w-2xl mx-auto">

      <div className="flex justify-between items-center mb-6">

        <h2 className="text-xl font-bold text-slate-800">
          {initialValues?.productId ? 'Edit Product' : 'Add New Product'}
        </h2>

        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600"
        >
          <X size={20} />
        </button>

      </div>

      <Formik

        initialValues={{
          name: initialValues?.name || '',
          description: initialValues?.description || '',
          price: initialValues?.price || '',
          stock: initialValues?.stock || '',
          threshold: initialValues?.threshold ?? initialValues?.thresholdQty ?? '',
          unitValue: initialValues?.unitValue ?? parsedUnit.unitValue,
          unitType: initialValues?.unitType ?? parsedUnit.unitType,
          parentCategoryId:
            initialValues?.parentCategoryId ||
            (noMainCategories ? '' : mainCategories[0]?.id || ''),
          subCategoryId: initialValues?.subCategoryId || '',
          freeCategoryName: '',
          freeSubcategoryName: '',
          image: normalizeImagesForForm(
            initialValues?.images ?? initialValues?.image ?? []
          ),
        }}

        validationSchema={productSchema}


        // {MISSING FIELD LOGIC}
   onSubmit={(values, { setTouched }) => {

  setShowErrors(true);

  setTouched({
    name: true,
    description: true,
    price: true,
    stock: true,
    parentCategoryId: true,
    freeCategoryName: true,
    freeSubcategoryName: true,
    unitValue: true,
    unitType: true,
  });


  const submission = {
    ...values,
    price: Math.abs(Number(values.price)),
    stock: Math.max(0, Math.floor(Number(values.stock))),
    unitValue: Number(values.unitValue),
    threshold: values.threshold !== '' && values.threshold != null
      ? Number(values.threshold)
      : 10,
    images: values.image
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

                    {/* UNIT */}
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">
                        Unit
                      </label>
                      <div className="flex gap-2 mt-1">
                        <div className="flex-1">
                          <Field
                            name="unitValue"
                            type="number"
                            min="0.01"
                            step="any"
                            placeholder="e.g. 500"
                            className={`w-full border p-3 rounded-xl ${errors.unitValue && touched.unitValue ? 'border-red-400' : ''
                              }`}
                          />
                          <ErrorMessage name="unitValue" component="p" className="text-red-500 text-[11px] mt-1 ml-1" />
                        </div>

                        {/* Custom unit type dropdown */}
                        <div className="w-32 relative">
                          <button
                            type="button"
                            onClick={() => setUnitDropdownOpen(o => !o)}
                            className={`w-full border p-3 rounded-xl bg-white flex items-center justify-between text-sm ${errors.unitType && touched.unitType ? 'border-red-400' : 'border-gray-300'
                              }`}
                          >
                            <span className={values.unitType ? 'text-gray-900' : 'text-gray-400'}>
                              {values.unitType || (unitsLoading ? '...' : 'Unit')}
                            </span>
                            <ChevronDown size={14} className="text-gray-400 shrink-0" />
                          </button>

                          {unitDropdownOpen && (
                            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                              <input
                                type="text"
                                value={unitSearch}
                                onChange={e => setUnitSearch(e.target.value)}
                                placeholder="Search..."
                                className="w-full px-3 py-2 text-sm border-b outline-none"
                                onClick={e => e.stopPropagation()}
                                autoFocus
                              />
                              <ul className="max-h-40 overflow-y-auto">
                                {filteredUnits.map(u => (
                                  <li
                                    key={u._id || u.name}
                                    onClick={() => {
                                      setFieldValue('unitType', u.name);
                                      setUnitDropdownOpen(false);
                                      setUnitSearch('');
                                    }}
                                    className={`px-3 py-2 text-sm cursor-pointer hover:bg-emerald-50 ${values.unitType === u.name ? 'bg-emerald-100 font-bold' : ''
                                      }`}
                                  >
                                    {u.name}
                                  </li>
                                ))}
                                {filteredUnits.length === 0 && (
                                  <li className="px-3 py-2 text-sm text-gray-400">
                                    {unitsLoading ? 'Loading...' : 'No results'}
                                  </li>
                                )}
                              </ul>
                              <button
                                type="button"
                                onClick={() => {
                                  setUnitDropdownOpen(false);
                                  setUnitSearch('');
                                  setShowAddUnitModal(true);
                                }}
                                className="w-full px-3 py-2 text-sm text-emerald-700 font-bold border-t hover:bg-emerald-50 flex items-center gap-1"
                              >
                                <Plus size={13} /> Add New Unit
                              </button>
                            </div>
                          )}

                          <ErrorMessage name="unitType" component="p" className="text-red-500 text-[11px] mt-1 ml-1" />
                        </div>
                      </div>

                      {/* Preview */}
                      {values.price && values.unitValue && values.unitType && (
                        <p className="text-[11px] text-emerald-600 font-bold mt-1.5 ml-1">
                          Preview: ₹{values.price} / {values.unitValue} {values.unitType}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">

                      <Field
                        name="price"
                        type="number"
                        min="0"
                        placeholder="Price"
                        className="w-full border p-3 rounded-xl"
                      />

                      <Field
                        name="stock"
                        type="number"
                        min="0"
                        placeholder="Stock"
                        className="w-full border p-3 rounded-xl"
                      />

                    </div>

                    <div>
                      <Field
                        name="threshold"
                        type="number"
                        min="0"
                        placeholder="5"
                        className="w-full border p-3 rounded-xl"
                      />
                      <p className="text-[10px] text-gray-400 mt-1 ml-1">Low Stock Alert (optional) — Default is 10 if not set</p>
                      <ErrorMessage name="threshold" component="p" className="text-red-500 text-[11px] mt-1 ml-1" />
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-[#1A4D2E] text-white py-4 rounded-xl font-bold shadow-md hover:bg-[#143d24] transition-colors"
                    >

                      Save Product

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

  );

};

export default ProductForm;