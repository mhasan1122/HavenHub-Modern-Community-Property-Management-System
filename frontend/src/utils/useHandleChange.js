import { updateChangedFields } from "./updateFileChange";

const useHandleChange = (setFormData, setIsFormChanged) => {
  const handleChange = (e) => {
    const { name, value } = e.target;

    // Update form data
    setFormData((prevState) => ({
      ...prevState,
      [name]: value,
    }));

    updateChangedFields(setIsFormChanged,name,value)
    // // Track changes
    // setIsFormChanged((prevState) => {
    //   const updatedChanges = { ...prevState };

    //   if (value === "") {
    //     // Remove field from changed tracker
    //     delete updatedChanges[name];
    //   } else {
    //     updatedChanges[name] = value;
    //   }

    //   return updatedChanges;
    // });
  };

  return { handleChange };
};

export default useHandleChange;

