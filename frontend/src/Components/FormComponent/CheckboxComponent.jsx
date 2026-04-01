import React, { useState } from "react";
import "./FormComponent.css"; // Custom styles if needed
import { MdCheck } from "react-icons/md";

// Created By Firoj Hasan
function CheckboxComponent({
  value = "",
  label,
  name = "",
  onChange,
  checked,
  borderColor = "border-borderCheckbox" // 👈 default value
}) {
  //  const [checked, setChecked] = useState(false); // Local state to control checkbox
  const handleCheckboxChange = (e) => {
    const newCheckedState = e.target.checked;
    // setChecked(newCheckedState); // Update local state
    if (onChange) {
      onChange(e, newCheckedState); // Call the onChange prop if passed
    }
  };

  // <label className="flex items-center  parentdiv">
  //   <span className="mb-[30px]"> {label}</span>
  //   {/* Hidden checkbox input */}
  //   <input
  //     type="checkbox"
  //     id={name}
  //     name={name}
  //     value={value}
  //     checked={checked} // Controlled checkbox state
  //     onChange={handleCheckboxChange} // Updates state on change
  //     className="" // Used for styling the checkmark when checked
  //   />
  //   {/* Custom checkbox styled with checkmark */}
  //   <span className="checkmark "></span>
  // </label>;
  return (
    <label className="flex items-center p-1 cursor-pointer">
      <input
        type="checkbox"
        id={name}
        name={name}
        value={value}
        checked={checked} // Controlled checkbox state
        onChange={handleCheckboxChange} // Updates state on change
        className="hidden peer"
      />
      {/* <span
        className={`w-6 h-6 border-2 rounded-md flex items-center justify-center peer-checked:bg-primary ${borderColor}`}
      > */}
      <span
        className={`w-6 h-6 border-2 rounded-md flex items-center justify-center flex-shrink-0
    ${checked ? "border-primary" : borderColor} peer-checked:bg-primary`}
      >
        {checked && <MdCheck className="text-white text-lg" />}
      </span>
      <span className="text-gray-800 font-medium px-3 flex-1 leading-tight">{label}</span>
    </label>
  );
}
export default CheckboxComponent;
