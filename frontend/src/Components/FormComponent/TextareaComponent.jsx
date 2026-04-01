import React from 'react';

function TextareaComponent({ value, onChange, name, label, rows = 2, width, placeholder, error,disabled, labelClassName = "" }) {
  return (
    <div className="login-field">
   <div className='text-left my-2'> <label className={labelClassName} htmlFor={name}>
        {label}
      </label></div>
      <textarea
        name={name}
        value={value}
        className={`login-field-input ${error ? 'border-red-500' : ''}
          ${disabled ? 'bg-disabledInput cursor-not-allowed text-black100' : ''}
        
        `}
        rows={rows}
        style={{ width }}
        onChange={onChange}
        placeholder={placeholder || "Enter your Description here"}
        disabled={disabled}
      ></textarea>
      
      {error && <span className="text-red-500 text-xs mt-1 block">{error}</span>}
      
    </div>
  );
}

export default TextareaComponent;
