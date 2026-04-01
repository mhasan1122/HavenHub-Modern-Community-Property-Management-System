import React from "react";
import PropTypes from "prop-types";
import { GoAlert } from "react-icons/go";

const PhoneNumberInput = ({
  label,
  value = "",
  onChange,
  onBlur,
  name,
  placeholder = "",
  width = "100%",
  error = "",
  disabled = false,
  required = false,
  labelClassName = "text-sm font-medium text-gray-700"
}) => {
  const handleInputChange = (e) => {
    const val = e.target.value;
    // Allow only digits and limit to 11 characters
    if (/^\d*$/.test(val) && val.length <= 11) {
      onChange(e);
    }
  };

  return (
    <div className="login-field" style={{ width }}>
      <div className="my-3 text-left">
        <label className={labelClassName} htmlFor={name}>
          {label}
        </label>
      </div>
      <input
        type="text"
        name={name}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={handleInputChange}
        onBlur={onBlur}
        required={required}
        className={`login-field-input ${
          disabled ? "bg-disabledInput cursor-not-allowed text-black100" : ""
        } ${error ? "border-red-500 focus:border-red-500" : ""}`}
        style={{ width: "100%" }}
      />
      {error && (
        <p className="text-red-500 text-[14px] mt-1 items-center flex">
          <GoAlert className="mx-[3px]" />
          {error}
        </p>
      )}
    </div>
  );
};

PhoneNumberInput.propTypes = {
  label: PropTypes.node.isRequired,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  onBlur: PropTypes.func,
  name: PropTypes.string.isRequired,
  placeholder: PropTypes.string,
  width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  error: PropTypes.string,
  disabled: PropTypes.bool,
  required: PropTypes.bool,
  labelClassName: PropTypes.string
};

export default PhoneNumberInput;
