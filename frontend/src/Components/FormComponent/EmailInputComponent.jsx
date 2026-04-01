import React from 'react';
//  Created By Firoj Hasan
function EmailInputComponent({ label, value, onChange, name, placeholder,width}) {
  return (
    <div className="login-field">
   <div className="my-2 text-left">
        <label className="" htmlFor={name}>
          {label}
        </label>
      </div>
      <input
        type="email"
        name={name}
        value={value}
        className="login-field-input"
        style={{ width }}

        placeholder={placeholder}
        onChange={onChange}
      />
     
    </div>
  );
}

export default EmailInputComponent;
