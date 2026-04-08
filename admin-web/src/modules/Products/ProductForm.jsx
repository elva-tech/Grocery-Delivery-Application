/**
 * @file ProductForm.tsx
 * @description Admin form to manage products with backend-ready description and image handling.
 */

import React, { useRef } from 'react';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import { X, Plus } from 'lucide-react';
import { useAppState } from '../../context/AppStateContext';

// VALIDATION SCHEMA
const ProductSchema = Yup.object().shape({
  name: Yup.string().required('Required'),
  description: Yup.string().required('Required'),
  price: Yup.number().min(1, 'Price must be positive').required('Required'),
  stock: Yup.number().min(0, 'No negative stock').required('Required'),
  parentCategoryId: Yup.string().required('Required'),
  subCategoryId: Yup.string(),
  unit: Yup.string().required('Required')
});

const ProductForm = ({ initialValues, onSubmit, onCancel }) => {

  const fileInputRef = useRef(null);
  const { categories } = useAppState();

  const mainCategories = categories.filter(c => !c.parentId);

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
          unit: initialValues?.unit || '',
          parentCategoryId:
            initialValues?.parentCategoryId ||
            (mainCategories[0]?.id || ''),
          subCategoryId: initialValues?.subCategoryId || '',
          image: initialValues?.image || initialValues?.images || []
        }}

        validationSchema={ProductSchema}

        onSubmit={(values) => {

          const submission = {

            ...values,

            price: Math.abs(Number(values.price)),

            stock: Math.max(
              0,
              Math.floor(Number(values.stock))
            ),

            images: values.image

          };

          onSubmit(submission);

        }}

      >

        {({ setFieldValue, values }) => {

          const subCats = categories.filter(
            c => c.parentId === values.parentCategoryId
          );

          return (

            <Form className="space-y-6">

              <div className="flex flex-col md:flex-row gap-6">

                {/* LEFT IMAGE UPLOADER */}

                <div className="flex-1 space-y-4">

                  <label className="block text-sm font-bold text-gray-700">
                    Product Images
                  </label>

                  <div className="grid grid-cols-2 gap-2">

                    {values.image.map((img, i) => (

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
                          onClick={() =>
                            setFieldValue(
                              'image',
                              values.image.filter(
                                (_, idx) => idx !== i
                              )
                            )
                          }
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
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
                      className="aspect-square border-2 border-dashed border-emerald-200 rounded-lg flex items-center justify-center bg-emerald-50/30 text-emerald-600"
                    >

                      <Plus size={20} />

                    </button>

                    <input
                      type="file"
                      ref={fileInputRef}
                      hidden
                      multiple
                      onChange={(e) =>
                        setFieldValue(
                          'image',
                          [
                            ...values.image,
                            ...Array.from(e.target.files).map(
                              f => URL.createObjectURL(f)
                            )
                          ]
                        )
                      }
                    />

                  </div>

                </div>

                {/* RIGHT PRODUCT DETAILS */}

                <div className="flex-1 space-y-4">

                  <div className="grid grid-cols-2 gap-2">

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
                          <option
                            key={c.id}
                            value={c.id}
                          >
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

                        <option value="">
                          Select Sub
                        </option>

                        {subCats.map(c => (
                          <option
                            key={c.id}
                            value={c.id}
                          >
                            {c.name}
                          </option>
                        ))}

                      </Field>

                    </div>

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

                  <Field
                    name="unit"
                    placeholder="Unit (e.g. 1L)"
                    className="w-full border p-3 rounded-xl"
                  />

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

                  <button
                    type="submit"
                    className="w-full bg-[#1A4D2E] text-white py-4 rounded-xl font-bold shadow-md hover:bg-[#143d24] transition-colors"
                  >

                    Save Product

                  </button>

                </div>

              </div>

            </Form>

          );

        }}

      </Formik>

    </div>

  );

};

export default ProductForm;