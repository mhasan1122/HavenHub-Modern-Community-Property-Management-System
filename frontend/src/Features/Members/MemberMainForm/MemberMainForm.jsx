import React from "react";
import PropTypes from "prop-types";
import RadioComponent from "Components/FormComponent/RadioComponent";
import SelectComponent from "Components/FormComponent/SelectComponent";
import TextInputComponent from "Components/FormComponent/TextInputComponent";
import ErrorMessage from "Components/MessageBox/ErrorMessage";
import Heading from "Components/HeadingComponent/Heading";
import { Div } from "Components/Ui/Div";
import { Span } from "Components/Ui/Span";
import FileComponents from "../../../Components/UtilsComponents/FileComponents";
import { updateChangedFields } from "../../../utils/updateFileChange";
import ModernDatePicker from "../../../Components/FormComponent/ModernDatePicker";

const MemberMainForm = ({
  formData,
  setFormData,
  memberFields,
  errors,
  handleChange,
  onFileChange,
  savedFront,
  savedBack,
  disabled,setIsFormChangedFirstTab
}) => {
  // Convert backend format (DD-MMM-YYYY e.g., "19-Aug-1986") to HTML date input format (YYYY-MM-DD)
  const convertToHtmlDateFormat = (dateStr) => {
    if (!dateStr) return "";
    
    // If already in YYYY-MM-DD format, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }
    
    // Parse DD-MMM-YYYY format (e.g., "19-Aug-1986")
    const months = {
      'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
      'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
      'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
    };
    
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = months[parts[1]] || '01';
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
    
    return dateStr;
  };

  // Convert HTML date input format (YYYY-MM-DD) to backend format (DD-MMM-YYYY)
  const convertToBackendDateFormat = (dateStr) => {
    if (!dateStr) return "";
    
    // If already in DD-MMM-YYYY format, return as is
    if (/^\d{2}-[A-Za-z]{3}-\d{4}$/.test(dateStr)) {
      return dateStr;
    }
    
    // Parse YYYY-MM-DD format
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const monthIndex = parseInt(parts[1], 10) - 1;
      const day = parts[2];
      return `${day}-${months[monthIndex]}-${year}`;
    }
    
    return dateStr;
  };

  const handleDateChange = (htmlDateValue) => {
    // Convert from HTML format to backend format for storage
    const backendFormat = convertToBackendDateFormat(htmlDateValue);
    
    setFormData((prevData) => ({
      ...prevData,
      date_of_birth: backendFormat
    }));

    updateChangedFields(setIsFormChangedFirstTab, ["date_of_birth"], backendFormat)
  };

  return (
    <Div>

      <Heading title="General Information" size="lg" color="text-primary" />

      {/* Full Name */}
      <TextInputComponent
        value={formData.full_name || ""}
        onChange={handleChange}
        name={memberFields.full_name.name}
        label={
          <Span>
            {memberFields.full_name.label}{" "}
            <Span className="text-red-500">*</Span>
          </Span>
        }
        placeholder={memberFields.full_name.label}
        field={memberFields.full_name}
        disabled={disabled}
      />
      <ErrorMessage message={errors.full_name} />

      {/* Email */}
      <TextInputComponent
        value={formData.general_email || ""}
        onChange={handleChange}
        name={memberFields.general_email.name}
        label={
          <Span>
            {memberFields.general_email.label}{" "}
            <Span className="text-red-500">*</Span>
          </Span>
        }
        placeholder={memberFields.general_email.label}
        field={memberFields.general_email}
        disabled={disabled}
      />
      <ErrorMessage message={errors.general_email} />

      {/* Contact Number */}
      <TextInputComponent
        value={formData.general_contact || ""}
        onChange={handleChange}
        name={memberFields.general_contact.name}
        label={
          <Span>
            {memberFields.general_contact.label}{" "}
            <Span className="text-red-500">*</Span>
          </Span>
        }
        placeholder={memberFields.general_contact.label}
        field={memberFields.general_contact}
        disabled={disabled}
        maxLength={11}
      />
      <ErrorMessage message={errors.general_contact} />

      {/* NID Number */}
      <TextInputComponent
        value={formData.nid_number || ""}
        onChange={handleChange}
        name={memberFields.nid_number.name}
        label={memberFields.nid_number.label}
        placeholder={memberFields.nid_number.label}
        field={memberFields.nid_number}
        disabled={disabled}
      />
      <ErrorMessage message={errors.nid_number} />

      {/* Addresses */}
      <TextInputComponent
        value={formData.permanent_address || ""}
        onChange={handleChange}
        name={memberFields.permanent_address.name}
        label={memberFields.permanent_address.label}
        placeholder={memberFields.permanent_address.label}
        field={memberFields.permanent_address}
        disabled={disabled}
      />
      <TextInputComponent
        value={formData.present_address || ""}
        onChange={handleChange}
        name={memberFields.present_address.name}
        label={memberFields.present_address.label}
        placeholder={memberFields.present_address.label}
        field={memberFields.present_address}
        disabled={disabled}
      />

      {/* Date of Birth */}
      {/* <Div className="login-field">
        <DatePicker
          className={`login-field-input ${
            disabled ? "bg-disabledInput cursor-not-allowed text-grey100" : ""
          }`}
          name="date_of_birth"
          selected={
            formData.date_of_birth ? new Date(formData.date_of_birth) : null
          }
          onChange={(date) =>
            handleDateChange(date, { target: { name: "date_of_birth" } })
          }
          dateFormat="dd-MMM-yyyy"
          placeholderText="Date of Birth"
          showYearDropdown
          showMonthDropdown
          scrollableYearDropdown
          yearDropdownItemNumber={90}
          minDate={new Date("1950-01-01")}
          maxDate={new Date(`${currentYear}-12-31`)}
          disabled={disabled}
        
        />
      </Div> */}

      {/* Occupation & Gender */}
      <Div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-4">
        <div className="flex-1 min-w-0">
          <ModernDatePicker
            label="Date of Birth"
            value={convertToHtmlDateFormat(formData.date_of_birth) || ""}
            onChange={(value) => {
              handleDateChange(value);
            }}
            maxDate={new Date().toISOString().split('T')[0]}
            placeholder="Select date of birth"
            name="date_of_birth"
            error={errors.date_of_birth || ""}
            disabled={disabled}
          />
        </div>
        <div className="flex-1 min-w-0">
          <TextInputComponent
            value={formData.occupation || ""}
            onChange={handleChange}
            name={memberFields.occupation.name}
            label={memberFields.occupation.label}
            placeholder={memberFields.occupation.label}
            field={memberFields.occupation}
            disabled={disabled}
          />
        </div>
        <div className="flex-1 min-w-0">
          <RadioComponent
            options={memberFields.gender.options}
            selectedValue={formData.gender}
            onChange={handleChange}
            name={memberFields.gender.name}
            label={memberFields.gender.label}
            disabled={disabled}
          />
        </div>
      </Div>

      {/* Marital Status & Religion */}
      <Div className="flex flex-col sm:flex-row justify-between gap-3">
        <SelectComponent
          options={memberFields.marital_status.options}
          value={formData.marital_status}
          name={memberFields.marital_status.name}
          label={memberFields.marital_status.label}
          onChange={handleChange}
          field={memberFields.marital_status}
          disabled={disabled}
        />
        <SelectComponent
          options={memberFields.religion.options}
          value={formData.religion}
          name={memberFields.religion.name}
          label={memberFields.religion.label}
          onChange={handleChange}
          field={memberFields.religion}
          disabled={disabled}
        />
      </Div>

      {/* File Upload */}
      <FileComponents
        onFileChange={onFileChange}
        savedFront={savedFront}
        savedBack={savedBack}
        allowedTypes={["image/jpeg", "image/png", "image/jpg"]}
        errorMessage="Please upload a valid image"
        disabled={disabled}
      />
    </Div>
  );
};

MemberMainForm.propTypes = {
  formData: PropTypes.object.isRequired,
  setFormData: PropTypes.func.isRequired,
  memberFields: PropTypes.object.isRequired,
  errors: PropTypes.object,
  onFileChange: PropTypes.func.isRequired,
  savedFront: PropTypes.any,
  savedBack: PropTypes.any
};

export default MemberMainForm;
