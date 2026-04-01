import React from "react";
import { FaAddressBook } from "react-icons/fa";
import ErrorMessage from "../../../../Components/MessageBox/ErrorMessage";

const UnitSecondaryContactEditForm = ({
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
    <form onSubmit={handleSubmit(onSubmit)} className="p-3 md:p-6 w-full" method="POST">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-base text-primary font-bold">
            Secondary Contact
          </h3>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-500 text-white">
            Optional
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="bg-primary text-white rounded text-sm py-2 px-4 flex items-center"
        >
          <FaAddressBook className="mr-2" />
          Add Contact
        </button>
      </div>

      <p className="text-sm text-gray-600 mb-4">
        An optional additional contact person for this unit. This is for record-keeping purposes only and has no special permissions.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full lg:w-[687px]">
        <div className="login-field">
          <div className="mb-2">
            <label className="block">Number</label>
          </div>
          <input
            type="text"
            {...register("secondary_number", phoneValidation)}
            className="rounded p-2 w-full login-field-input focus:border-primary focus:outline-none"
            placeholder="Number"
          />
          {errors.secondary_number && (
            <ErrorMessage message={errors.secondary_number.message} />
          )}
        </div>
        <div className="login-field">
          <div className="mb-2">
            <label className="block">Name</label>
          </div>
          <input
            type="text"
            {...register("secondary_name")}
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
            {...register("secondary_email", emailValidation)}
            className="rounded p-2 w-full login-field-input focus:border-primary focus:outline-none"
            placeholder="E-mail"
          />
          {errors.secondary_email && (
            <ErrorMessage message={errors.secondary_email.message} />
          )}
        </div>
        <div className="login-field">
          <div className="mb-2">
            <label className="block">Relationship</label>
          </div>
          <input
            type="text"
            {...register("secondary_relationship")}
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

export default UnitSecondaryContactEditForm;
