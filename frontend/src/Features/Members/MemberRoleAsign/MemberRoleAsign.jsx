import React, { useState, useEffect } from "react";
import NavigateButton from "../../../Components/FormComponent/ButtonComponent/NavigateButton";
import { FiPlus } from "react-icons/fi";
import AddRoleModal from "../AddRoleModal";
import Button from "../../../Components/FormComponent/ButtonComponent/Button";
import { updateChangedFields } from "../../../utils/updateFileChange";

const MemberRoleAsign = ({
  label = "Select Member Type",
  data,
  optionKey = "name",
  valueKey = "value",
  onChange,
  selectedOptions = [],
  isMultiSelect = true,
  onRoleCreated,
  onAddRoleClick,
setIsFormChangedSecondTab=false
}) => {
  const [selectedValues, setSelectedValues] = useState(selectedOptions);
  // const [isAddRoleModalOpen, setIsAddRoleModalOpen] = useState(false);

  // Sync internal state with prop changes
  useEffect(() => {
    setSelectedValues(selectedOptions);
  }, [selectedOptions]);

  const handleSelectionChange = (option) => {
    let updatedSelection = [...selectedValues];
    if (isMultiSelect) {
      if (updatedSelection.includes(option)) {
        updatedSelection = updatedSelection.filter((item) => item !== option);
      } else {
        updatedSelection.push(option);
      }
    } else {
      updatedSelection = [option];
    }
    setSelectedValues(updatedSelection);
    // setIsFormChangedSecondTab(true);
    updateChangedFields(setIsFormChangedSecondTab,'members_role',updatedSelection)
    
    if (onChange) onChange(updatedSelection);
  };

  const handleSelectAllChange = (e) => {
    const checked = e.target.checked;
    const allValues = checked ? data.map((option) => option[valueKey]) : [];
    setSelectedValues(allValues);
    updateChangedFields(setIsFormChangedSecondTab,'members_role',allValues)
    if (onChange) onChange(allValues);
  };

  // Wrap the role-created callback: update parent's list and close the modal.
  // const handleRoleCreatedWrapper = (newRole) => {
  //   if (onRoleCreated) onRoleCreated(newRole);
  //   setIsAddRoleModalOpen(false);
  // };

  return (
    <div className="m-3">
      <div className="flex justify-between mb-2">
        <p className="text-base font-medium text-primary">{label}</p>
        {/* <NavigateButton
          size="small"
          icon={FaPlus}
          className="bg-primary text-white"
          // onClick={() =>{ alert() ;setIsAddRoleModalOpen(true)}}
            onClick={onAddRoleClick}
        >
          Add New Role
        </NavigateButton> */}
        <Button
          icon={FiPlus}
          onClick={onAddRoleClick}
          size="sm"
          className="bg-primary  text-center hover:bg-primary-dark text-white"
        >
          Add New Role{" "}
        </Button>
      </div>
      {data.length === 0 ? (
        <div className="px-3 py-2">No options available</div>
      ) : (
        <div className="max-w-full h-[150px]  overflow-x-auto bg-white border border-gray-300 rounded shadow-sm">
          {/* Select All Checkbox */}
          <div className="flex items-center px-3 py-2">
            <input
              type="checkbox"
              id="selectAll"
              checked={selectedValues.length === data.length}
              onChange={handleSelectAllChange}
              className="mr-2 accent-primary w-6 h-6"
              name="members_role"
            />
            <label
              htmlFor="selectAll"
              className="text-sm text-black cursor-pointer"
            >
              Select All
            </label>
          </div>
          {data.map((option) => (
            <label
              key={option[valueKey]}
              className="flex items-center px-3 py-2 cursor-pointer"
            >
              <input
                type={isMultiSelect ? "checkbox" : "radio"}
                checked={selectedValues.includes(option[valueKey])}
                onChange={() => handleSelectionChange(option[valueKey])}
                className="mr-2 accent-primary w-6 h-6"
                name="members_role"
              />
              <span className="text-sm text-black">{option[optionKey]}</span>
            </label>
          ))}
        </div>
      )}

      {/* Reusable modal for adding a new role */}
      {/* <AddRoleModal
        isOpen={isAddRoleModalOpen}
        onClose={() => setIsAddRoleModalOpen(false)}
        onRoleCreated={handleRoleCreatedWrapper}
      /> */}
    </div>
  );
};

export default MemberRoleAsign;
