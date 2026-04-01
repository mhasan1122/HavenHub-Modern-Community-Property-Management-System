
import PropTypes from "prop-types";

const TextInputComponent = ({
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
  type = "text",
  inputRef,
  labelClassName = "text-sm font-medium text-gray-700",
  maxLength,
}) => {
  return (
    <div className="login-field" style={{ width }}>
      <div className="my-3 text-left">
        <label className={labelClassName} htmlFor={name}>
          {label}
        </label>
      </div>
      <input
        ref={inputRef}
        type={type}
        name={name}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={onChange}
        onBlur={onBlur}
        required={required}
        maxLength={maxLength}
        className={`login-field-input ${
          disabled ? "bg-disabledInput cursor-not-allowed text-black100" : ""
        } ${error ? "border-red-500 focus:border-red-500" : ""}`}
        style={{ width }}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
};

export default TextInputComponent;

TextInputComponent.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  onBlur: PropTypes.func,
  name: PropTypes.string.isRequired,
  placeholder: PropTypes.string,
  width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  error: PropTypes.string,
  disabled: PropTypes.bool,
  required: PropTypes.bool,
  type: PropTypes.string,
  inputRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
  maxLength: PropTypes.number,
};
