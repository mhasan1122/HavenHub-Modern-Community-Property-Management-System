import React, { Component } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

class PasswordInputComponents extends Component {
  constructor(props) {
    super(props);
    this.state = {
      showPassword: false,
      errorMessage: '',
    };
  }

  handleBlur = () => {
    const { validate, value } = this.props;
    if (validate) {
      const error = validate(value);
      this.setState({ errorMessage: error });
    }
  };

  togglePasswordVisibility = () => {
    this.setState((prevState) => ({
      showPassword: !prevState.showPassword,
    }));
  };

  render() {
    const { label, value, onChange, name, placeholder } = this.props;
    const { showPassword, errorMessage } = this.state;

    return (
      <div className="login-field">
       <div className='text-left my-2'>
         <label className="" htmlFor={name}>
          {label}
        </label>
       </div>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            name={name}
            value={value}
            className={`login-field-input w-full p-2 border rounded ${
              errorMessage ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder={placeholder}
            onChange={onChange}
            onBlur={this.handleBlur}
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5"
            onClick={this.togglePasswordVisibility}
          >
            {showPassword ? <FaEyeSlash /> : <FaEye />}
          </button>
        </div>
        {errorMessage && <p className="error-message text-red-500">{errorMessage}</p>}
      </div>
    );
  }
}

export default PasswordInputComponents;