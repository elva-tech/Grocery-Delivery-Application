import { useField } from 'formik';

const FormInput = ({ label, ...props }) => {
  const [field, meta] = useField(props);

  return (
    <div className="w-full group">
      <label 
        htmlFor={props.id || props.name}
        className="block mb-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 group-focus-within:text-green-700 transition-colors"
      >
        {label}
      </label>
      <input
        {...field}
        {...props}
        className={`
          w-full px-4 py-3 rounded-xl border bg-gray-50/50 text-gray-900 text-sm transition-all
          focus:bg-white focus:outline-none focus:ring-4 focus:ring-green-500/10
          ${meta.touched && meta.error
            ? 'border-red-400 ring-4 ring-red-500/5'
            : 'border-gray-200 focus:border-green-600'
          }
        `}
      />
      {meta.touched && meta.error && (
        <p className="text-[11px] font-medium text-red-500 mt-1.5 flex items-center gap-1">
           {meta.error}
        </p>
      )}
    </div>
  );
};

export default FormInput;