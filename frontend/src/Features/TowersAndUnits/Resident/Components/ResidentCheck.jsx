import React from "react";
import NumberInputComponent from "../../../../Components/FormComponent/NumberInputComponent";
import SelectComponent from "../../../../Components/FormComponent/SelectComponent";
import MultipleImageDropzone from "../../../../utils/MultipleImageDropzone";
import MultipleImageDropzoneResident from "./MultipleImageDropzoneResident";

const ResidentCheck = ({
  formData,
  setFormData,
  setIsFormChangedSecondTab,
  isFormChangedSecondTab
}) => {
  const handleCheckboxChange = (e) => {
    const isChecked = e.target.checked;

    if (isChecked) {
      setIsFormChangedSecondTab(false);
    } else if (!isChecked) {
      setIsFormChangedSecondTab(true);
    }

    setFormData((prev) => ({
      ...prev,
      is_resident_or_tenant: !isChecked,
      // Reset tenant-related fields when checkbox is unchecked
      ...(!isChecked && {
        unit_rent_fee: 0,
        advance_payment: 0,
        notice_period: 0,
        docs: []
      })
    }));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));

    setIsFormChangedSecondTab(true);
  };

  const handleFileUpload = (files) => {
    setFormData((prev) => ({
      ...prev,
      docs: [...prev.docs, ...files]
    }));
    setIsFormChangedSecondTab(true);
  };

  const handleFileRemove = (indexToRemove) => {
    setFormData((prev) => ({
      ...prev,
      docs: prev.docs.filter((_, index) => index !== indexToRemove)
    }));
    setIsFormChangedSecondTab(true);
  };
  return (
    <div className="p-4 border rounded-md">
      <p className="py-3">Status</p>
      <label className="flex items-center space-x-2">
        <input
          name="is_resident_or_tenant"
          type="checkbox"
          checked={!formData.is_resident_or_tenant}
          onChange={handleCheckboxChange}
          className="mr-3 accent-primary w-6 h-6"
        />
        <span>Resident is also a tenant</span>
      </label>

      {!formData.is_resident_or_tenant && (
        <div>
          <p className="py-3">Tenant Information</p>
          <div className="mb-2 flex gap-4">
            <NumberInputComponent
              name="unit_rent_fee"
              label="Unit Rent Fee"
              value={formData.unit_rent_fee}
              onChange={handleInputChange}
              placeholder="Unit Rent Fee"
              width="200px"
            />
            <NumberInputComponent
              name="advance_payment"
              label="Advance Payment"
              value={formData.advance_payment}
              onChange={handleInputChange}
              placeholder="Advance Payment"
              width="200px"
            />
            <SelectComponent
              options={[
                { value: "", label: "Select Months", disabled: true },
                ...Array.from({ length: 12 }, (_, i) => ({
                  value: i + 1,
                  label: `${i + 1} Months`
                }))
              ]}
              name="notice_period"
              label="Notice Period"
              value={formData.notice_period}
              onChange={handleInputChange}
              width="200px"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2">
            <div>
              <p className="py-3">Upload Rental Document</p>
              {/* <MultipleImageDropzone onUpload={handleFileUpload} /> */}
              <MultipleImageDropzoneResident
                onUpload={handleFileUpload}
                files={formData.docs}
                onRemove={handleFileRemove}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResidentCheck;
