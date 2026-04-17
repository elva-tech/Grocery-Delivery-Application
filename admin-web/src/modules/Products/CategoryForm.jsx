import React, { useRef } from 'react';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import { X, Camera } from 'lucide-react';
import { useAppState } from '../../context/AppStateContext';
import resolveImageUrl from '../../utils/resolveImageUrl';

const CategorySchema = Yup.object().shape({
  name: Yup.string().required('Required'),
});

const CategoryForm = ({ initialValues, onSubmit, onCancel }) => {
  const fileInputRef = useRef(null);
  const { categories } = useAppState();
  const mainCategories = categories.filter(c => !c.parentId);

  return (
    <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-100 max-w-md mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-800">{initialValues?.id ? 'Edit Category' : 'Add New Category'}</h2>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
      </div>

      <Formik
        initialValues={{
          name: initialValues?.name || '',
          parentId: initialValues?.parentId || '', 
          image: initialValues?.image || [] 
        }}
        validationSchema={CategorySchema}
        onSubmit={(values) => {
          const id = initialValues?.id || `cat_${values.name.toLowerCase().replace(/\s+/g, '_')}`;
          const submission = { 
            ...values,
            id,
            // FIX: If parentId is empty string, make it null so it shows as a Main Pillar
            parentId: values.parentId === "" ? null : values.parentId,
            image: Array.isArray(values.image) ? values.image : [values.image] 
          };
          onSubmit(submission);
        }}
      >
        {({ setFieldValue, values }) => {
          const imageSrc = resolveImageUrl({ image: values.image });
          return (
          <Form className="space-y-6">
            <div className="flex flex-col items-center gap-4">
              <div onClick={() => fileInputRef.current.click()} className="relative w-32 h-32 rounded-3xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden cursor-pointer">
                {imageSrc ? (
                  <img src={imageSrc} className="w-full h-full object-cover" alt="" />
                ) : (
                  <Camera className="text-gray-300" size={32} />
                )}
                <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={(e) => {
                  if (e.target.files[0]) { setFieldValue('image', [URL.createObjectURL(e.target.files[0])]); }
                }} />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700">Category Type</label>
                <Field as="select" name="parentId" className="mt-1 block w-full border border-gray-200 rounded-xl p-3 bg-white">
                  <option value="">Create as Main Category</option>
                  {mainCategories.map(c => (
                    <option key={c.id} value={c.id}>Sub-category of {c.name}</option>
                  ))}
                </Field>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700">Name</label>
                <Field name="name" placeholder="e.g. Buffalo Milk" className="mt-1 block w-full border border-gray-200 rounded-xl p-3" />
              </div>
              <button type="submit" className="w-full bg-[#1A4D2E] text-white py-4 rounded-xl font-bold shadow-lg">Save Category</button>
            </div>
          </Form>
          );
        }}
      </Formik>
    </div>
  );
};

export default CategoryForm;