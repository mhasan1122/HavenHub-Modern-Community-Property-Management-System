import React, { useState, useEffect } from "react";
import ErrorMessage from "Components/MessageBox/ErrorMessage";
import { updateChangedFields } from "../../../utils/updateFileChange";

const MemberTypeAsign = ({
  label = "Select Member Type",
  data,
  optionKey = "type_name",
  valueKey = "id",
  onChange,
  errors,
  selectedOption = null,
  setIsFormChangedSecondTab=false // Expect a single value
}) => {
  const [selectedValue, setSelectedValue] = useState(selectedOption);

  useEffect(() => {
    setSelectedValue(selectedOption);
  }, [selectedOption]);

  const handleSelectionChange = (value) => {
    setSelectedValue(value);
    if (onChange) {
      onChange(value);
    }

   // Notify parent about the change
  };

  return (
    <div className="bg-white m-3">
      <p className="text-base font-medium text-primary mb-2">{label}</p>

      {data.length === 0 ? (
        <div className="px-3 py-2">No options available</div>
      ) : (
        <div className="max-w-full  flex items-center overflow-x-auto  rounded ">
          {data.map((option) => (
            <label key={option[valueKey]} className="flex items-center pr-3 py-2 cursor-pointer">
              <input
                type="radio"
                name="member_type" // Ensure all radios belong to the same group
                value={option[valueKey]}
                checked={selectedValue === option[valueKey]}
                onChange={() => handleSelectionChange(option[valueKey])}
                className="mr-2 accent-[#3C9D9B] w-5 h-5"
              />
              <span className="text-sm text-black">{option[optionKey]}</span>
            </label>
          ))}
        </div>
      )}

      {errors?.member_type && <ErrorMessage message={errors.member_type} />}
    </div>
  );
};

export default MemberTypeAsign;
