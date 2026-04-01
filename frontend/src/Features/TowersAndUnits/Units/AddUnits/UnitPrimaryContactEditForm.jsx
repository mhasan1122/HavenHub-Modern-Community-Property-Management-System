import React from "react";
import { FaAddressBook } from "react-icons/fa";
import ErrorMessage from "../../../../Components/MessageBox/ErrorMessage";

const UnitPrimaryContactEditForm = ({
  selectedUnitDetails,
  onSubmit,
  showModal,
  setShowModal,
  register,
  handleSubmit,
  setValue,
  errors,
  isDirty
}) => {
  const phoneValidation = {
    validate: (value) =>
      !value ||
      /^(018|019|013|017|015|016|014)\d{8}$/.test(value) ||
      "Invalid Bangladeshi phone number"
  };

  const emailValidation = {
    validate: (value) =>
      !value ||
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/.test(value) ||
      "Enter a valid email address"
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="p-3 md:p-6 w-full"
      method="POST"
    >
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4 gap-3">
        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 w-full md:w-auto">
          <h3 className="text-base text-primary text-xl font-bold whitespace-nowrap">
            Primary Contact
          </h3>
          <div className="flex justify-between items-center w-full md:w-auto">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary text-white">
              Bill Recipient
            </span>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="md:hidden bg-primary text-white rounded text-sm py-1 px-1 flex items-center"
            >
              <FaAddressBook className="mr-2" />
              Add Contact
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="hidden md:flex bg-primary text-white rounded text-sm py-2 px-4 items-center"
        >
          <FaAddressBook className="mr-2" />
          Add Contact
        </button>
      </div>

      <p className="text-sm text-gray-600 mb-4">
        The person to whom service fee bills and invoices will be addressed.
        Their name and information will appear on billing documents under
        "Billed To".
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full lg:w-[687px]">
        <div className="login-field">
          <div className="mb-2">
            <label className="block">Number</label>
          </div>
          <input
            type="text"
            {...register("primary_number", phoneValidation)}
            className="rounded p-2 w-full login-field-input focus:border-primary focus:outline-none"
            placeholder="Number"
          />
          {errors.primary_number && (
            <ErrorMessage message={errors.primary_number.message} />
          )}
        </div>
        <div className="login-field">
          <div className="mb-2">
            <label className="block">Name</label>
          </div>
          <input
            type="text"
            {...register("primary_name")}
            className="rounded p-2 w-full login-field-input focus:border-primary focus:outline-none"
            placeholder="Name"
          />
        </div>

        <div className="login-field">
          <div className="mb-2">
            <label className="block">E-mail</label>
          </div>
          <input
            type="email"
            {...register("primary_email", emailValidation)}
            className="rounded p-2 w-full login-field-input focus:border-primary focus:outline-none"
            placeholder="E-mail"
          />
          {errors.primary_email && (
            <ErrorMessage message={errors.primary_email.message} />
          )}
        </div>
        <div className="login-field">
          <div className="mb-2">
            <label className="block">Relationship</label>
          </div>
          <input
            type="text"
            {...register("primary_relationship")}
            className="rounded p-2 w-full login-field-input focus:border-primary focus:outline-none"
            placeholder="Relationship"
          />
        </div>
      </div>

      <div className="w-full lg:w-[687px] mt-6">
        <button
          type="submit"
          className={`px-4 py-2 font-semibold rounded transition-all duration-200 w-full ${
            isDirty
              ? "bg-primary text-white"
              : "bg-white cursor-not-allowed border border-primary text-primary"
          }`}
          disabled={!isDirty}
        >
          Save
        </button>
      </div>
    </form>
  );
};

export default UnitPrimaryContactEditForm;
