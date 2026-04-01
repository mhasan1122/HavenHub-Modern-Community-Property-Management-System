import React, { useState } from "react";
import "./FormComponent.css";

//  Created By Firoj Hasan
const FormComponent = ({ fields, onSubmit }) => {
  const [formData, setFormData] = useState(
    fields.reduce((acc, field) => ({ ...acc, [field.name]: "" }), {})
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);}
    return (
      <div className="main-login">
        <div className="login-box">
          <h2 className="login-title login-title-main">Form</h2>
          <form onSubmit={handleSubmit}>
            {fields.map((field, index) => {
              if (field.type === "textarea") {
                return (
                  <div className="login-field" key={index}>
                    <textarea
                      id={field.name}
                      name={field.name}
                      value={formData[field.name]}
                      className="login-field-input"
                      placeholder={field.placeholder}
                      onChange={handleChange}
                    />
                    <label className="login-field-label" htmlFor={field.name}>
                      {field.label}
                    </label>
                  </div>
                );
              }

              if (field.type === "select") {
                return (
                  <div className="login-field" key={index}>
                    <select
                      id={field.name}
                      name={field.name}
                      value={formData[field.name]}
                      className="login-field-input"
                      onChange={handleChange}
                    >
                      {field.options.map((option, optIndex) => (
                        <option key={optIndex} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <label className="login-field-label" htmlFor={field.name}>
                      {field.label}
                    </label>
                  </div>
                );
              }

              if (field.type === "radio") {
                return (
                  <div className="login-field flex items-center" key={index}>
                    <div className="radio-group flex flex-col">
                      <div className="mb-2">{field.label}</div>
                      {field.options.map((option, optIndex) => (
                        <div className="radio flex items-center" key={optIndex}>
                          <input
                            type="radio"
                            id={`${field.name}-${option.value}`}
                            name={field.name}
                            value={option.value}
                            checked={formData[field.name] === option.value}
                            onChange={handleChange}
                            className="mr-2"
                          />
                          <label htmlFor={`${field.name}-${option.value}`}>
                            {option.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }

              if (field.type === "checkbox") {
                return (
                  <div className="login-field flex items-center" key={index}>
                    <input
                      type="checkbox"
                      id={field.name}
                      name={field.name}
                      checked={formData[field.name]}
                      onChange={handleChange}
                      className="mr-2"
                    />
                    <label htmlFor={field.name}>{field.label}</label>
                  </div>
                );
              }

              return (
                <div className="login-field" key={index}>
                  <input
                    type={field.type || "text"}
                    id={field.name}
                    name={field.name}
                    value={formData[field.name]}
                    className="login-field-input"
                    placeholder={field.placeholder}
                    onChange={handleChange}
                  />
                  <label className="login-field-label" htmlFor={field.name}>
                    {field.label}
                  </label>
                </div>
              );
            })}
            <button type="submit" className="login-footer-link">
              Submit
            </button>
          </form>
        </div>
      </div>
    );
  };

  export default FormComponent
