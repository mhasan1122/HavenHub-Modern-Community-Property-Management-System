import { useEffect } from "react";
import { BiArrowBack } from "react-icons/bi";
import TextInputComponent from "Components/FormComponent/TextInputComponent";
import RadioComponent from "Components/FormComponent/RadioComponent";
import ArrowHeading from "Components/HeadingComponent/ArrowHeading";
import { Div } from "Components/Ui/Div";
import ErrorMessage from "../../../Components/MessageBox/ErrorMessage";

const LoginCredential = ({
  formData,
  memberFields,
  handleChange,
  onNext,
  setFormData,
  errors
}) => {
  // Auto-select Email and reset to original email every time
  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      login: prev.login || "email",
      email: prev.general_email || "",
      delivery_method: prev.login === "contact" ? prev.general_contact : prev.general_email || ""
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle Radio Button Change (Contact or Email)

  const handleRadioChange = (e) => {
    const { value } = e.target;
    setFormData((prev) => ({
      ...prev,
      login: value, // Save the selected login method (either 'contact' or 'email')
      delivery_method:
        value === "contact" ? formData.general_contact : formData.general_email // Set delivery_method when login changes
    }));
  };

  // Handle input field change for contact or email
  const handleInputChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value, // Store the edited value directly
      delivery_method: value || "" // Update delivery_method with the current input value
    }));
  };

  // Set the label and value dynamically based on selected login method
  const label =
    formData.login === "contact"
      ? "Enter Contact Number"
      : formData.login === "email"
      
  // Use the email/contact value if explicitly set, otherwise fall back to general_email/general_contact
  const value =
    formData.login === "contact"
      ? (formData.contact !== undefined ? formData.contact : formData.general_contact || "")
      : formData.login === "email"
      ? (formData.email !== undefined ? formData.email : formData.general_email || "")
      : "";
  const delivery_method_name =
    formData.login === "contact" ? errors.contact : errors.email;
  return (
    <Div className="w-full">
      <ArrowHeading title="Login Credential" onNext={onNext} size="xl" />

      {/* Radio Button for Login Method */}
      <Div className="mb-3">
        <RadioComponent
          options={[
            { value: "email", label: "Email" },
            // { value: "contact", label: "Phone Number" }
          ]}
          selectedValue={formData.login || "email"}
          onChange={handleRadioChange}
          name="login"
          label="Send User ID & Password"
        />
      </Div>

      <div className="login-field">
        <input
          type={formData.login === "email" ? "email" : "text"}
          name={formData.login === "contact" ? "contact" : "email"}
          value={value}
          className={`login-field-input text-black  ${!formData.login ? 'bg-disabledInput cursor-not-allowed text-black100' : ''}`}
          onChange={handleInputChange}
          style={{ width: "100%" }}
          disabled={!formData.login} // Disable if no login method is selected
          placeholder={formData.login === "email" ? "Enter Email" : "Enter Contact Number"}
        />
        <label className="login-field-label" htmlFor={label}>
          {label}
        </label>
      </div>

      <ErrorMessage message={delivery_method_name} />
    </Div>
  );
};

export default LoginCredential;
