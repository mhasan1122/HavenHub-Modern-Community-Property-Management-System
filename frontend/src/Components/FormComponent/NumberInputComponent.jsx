import React from 'react';
import "./FormComponent.css"; 

function NumberInputComponent({ value, onChange, name, label, placeholder, width, error='', disabled = false, readOnly = false, style, ...props }, ref) {
  return (
    <div className="login-field">
      <div className="text-left my-3 mb-3">
        <label className="text-left my-3 mb-3" htmlFor={label}>
        {label}
      </label>
      </div>
      <input
        ref={ref}
        type="number"
        name={name} 
        value={value}
        className="login-field-input custom-input"
        style={{ width, ...style }}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        autoFocus={false}
        {...props}
      />
    
      {error && <p className="text-red-500 text-xs">{error}</p>}
    </div>
  );
}

const ForwardedNumberInputComponent = React.forwardRef(NumberInputComponent);
ForwardedNumberInputComponent.displayName = 'NumberInputComponent';

export default ForwardedNumberInputComponent;
