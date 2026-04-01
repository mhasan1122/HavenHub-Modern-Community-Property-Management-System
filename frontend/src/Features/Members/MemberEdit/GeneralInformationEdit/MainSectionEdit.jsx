import TextInputComponent from "../../../../Components/FormComponent/TextInputComponent";
import RadioComponent from "../../../../Components/FormComponent/RadioComponent";
import SelectComponent from "../../../../Components/FormComponent/SelectComponent";
import ModernDatePicker from "../../../../Components/FormComponent/ModernDatePicker";
import ErrorMessage from "../../../../Components/MessageBox/ErrorMessage";
import { Div } from "../../../../Components/Ui/Div";

const MainSectionEdit = ({ formData, handleChange, errors, touched }) => {
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

  const handleDateChange = (e) => {
    // Convert from HTML format to backend format for storage
    const backendFormat = convertToBackendDateFormat(e.target.value);
    handleChange({
      target: {
        name: "date_of_birth",
        value: backendFormat
      }
    });
  };

  return (
    <>
      {/* Full Name */}
      <TextInputComponent
        value={formData.full_name}
        onChange={handleChange}
        name="full_name"
        label={
          <span>
            Full Name <span className="text-red-500">*</span>
          </span>
        }
        placeholder="Full Name"
      />
      {errors.full_name && touched.full_name && (
        <ErrorMessage message={errors.full_name} />
      )}

      {/* <ErrorM message={errors.general_email} /> */}

      {/* Email */}
      <TextInputComponent
        value={formData.general_email}
        onChange={handleChange}
        name="general_email"
        label={
          <span>
            Email <span className="text-red-500">*</span>
          </span>
        }
        placeholder="Email"
      />
      {errors.general_email && touched.general_email && (
        <ErrorMessage message={errors.general_email} />
      )}

      {/* Contact Number */}
      <TextInputComponent
        value={formData.general_contact}
        onChange={handleChange}
        name="general_contact"
        label={
          <span>
            Contact Number <span className="text-red-500">*</span>
          </span>
        }
        placeholder="Contact Number"
        maxLength={11}
      />
      {/* {errors.general_contact && touched.general_contact && (
        <div>{errors.general_contact}</div>
      )} */}
      {errors.general_contact && touched.general_contact && (
        <ErrorMessage message={errors.general_contact} />
      )}

      {/* NID Number (No validation) */}
      <TextInputComponent
        value={formData.nid_number}
        onChange={handleChange}
        name="nid_number"
        label="NID Number"
        placeholder="NID Number"
      />
      {errors.nid_number && touched.nid_number && (
        <ErrorMessage message={errors.nid_number} />
      )}

      {/* Permanent Address (No validation) */}
      <TextInputComponent
        value={formData.permanent_address}
        onChange={handleChange}
        name="permanent_address"
        label="Permanent Address"
        placeholder="Permanent Address"
      />

      {/* Present Address (No validation) */}
      <TextInputComponent
        value={formData.present_address}
        onChange={handleChange}
        name="present_address"
        label="Present Address"
        placeholder="Present Address"
      />

      {/* Date of Birth + Occupation + Gender */}
      <Div className="mt-6 flex flex-col md:flex-row md:items-end gap-4">
        <div className="flex-1 min-w-0">
          <ModernDatePicker
            label="Date of Birth"
            value={convertToHtmlDateFormat(formData.date_of_birth) || ""}
            onChange={(value) => {
              // Convert from HTML format to backend format for storage
              const backendFormat = convertToBackendDateFormat(value);
              handleChange({
                target: {
                  name: "date_of_birth",
                  value: backendFormat
                }
              });
            }}
            maxDate={new Date().toISOString().split('T')[0]}
            placeholder="Select date of birth"
            name="date_of_birth"
          />
        </div>
        <div className="flex-1 min-w-0">
          <TextInputComponent
            value={formData.occupation}
            onChange={handleChange}
            name="occupation"
            label="Occupation"
            placeholder="Occupation"
            width="100%"
          />
        </div>
        <div className="flex-1 min-w-0">
          <RadioComponent
            options={[
              { label: "Male", value: "Male" },
              { label: "Female", value: "Female" },
              { label: "Other", value: "Other" }
            ]}
            selectedValue={formData.gender}
            onChange={handleChange}
            name="gender"
            label="Gender"
          />
        </div>
      </Div>
      <div className="flex flex-col md:flex-row justify-between gap-3">
        <SelectComponent
          options={[
            { label: "Select Marital Status", value: "" },

            { label: "Single", value: "Single" },
            { label: "Married", value: "Married" },
            { label: "Divorced", value: "Divorced" },
            { label: "Widowed", value: "Widowed" }
          ]}
          value={formData.marital_status}
          name="marital_status"
          label="Select Marital Status"
          onChange={handleChange}
        />

        <SelectComponent
          options={[
            { label: "Select Religion", value: "" },

            { label: "Islam", value: "Islam" },
            { label: "Christianity", value: "Christianity" },
            { label: "Hinduism", value: "Hinduism" },
            { label: "Buddhism", value: "Buddhism" },
            { label: "Judaism", value: "Judaism" },
            { label: "Other", value: "Other" }
          ]}
          value={formData.religion}
          name="religion"
          label=" Select Religion"
          onChange={handleChange}
        />
      </div>
    </>
  );
};

export default MainSectionEdit;
