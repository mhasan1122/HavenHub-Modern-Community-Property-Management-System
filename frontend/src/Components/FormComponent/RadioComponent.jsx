import React from 'react';

function RadioComponent({ options = [], selectedValue, onChange, name, label, width,disabled = false }) {
  return (
    <div className="login-field flex flex-col">
      <div className="my-3 text-left">
        <label className="text-sm font-medium text-gray-700">{label}</label>
      </div>
      <div className="radio-group pr-3 flex items-center" style={{ minHeight: '48px' }}>
        <div className="flex gap-5 items-center whitespace-nowrap" style={{ width }}>
          {options.length > 0 ? (
            options.map((option, index) => (
              <div className="flex gap-1 items-center" key={index}>
                <input
                  type="radio"
                  id={`${name}-${option.value}`}
                  name={name}
                  value={option.value}
                  checked={selectedValue === option.value}
                  onChange={onChange}
                  className={` w-[16px] h-[16px]  accent-primary  ${disabled ? 'bg-disabledInput cursor-not-allowed text-black100' : 'cursor-pointer'} `}
                  disabled={disabled}
                />
                <label htmlFor={`${name}-${option.value}`} className={` ${disabled ? ' cursor-not-allowed ' : 'cursor-pointer'}`}>
                  {option.label}
                </label>
              </div>
            ))
          ) : (
            <p className="text-gray-500">No options available</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default RadioComponent;
