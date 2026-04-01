
import { useState, useCallback } from "react";
import { updateChangedFields } from "./updateFileChange";
const useHandleFileChange = (setFormData,setIsFormChanged) => {
  const [nidFront, setNidFront] = useState(null);
  const [nidBack, setNidBack] = useState(null);

  const handleFileChange = useCallback((field, file) => {
    setFormData((prevState) => ({
      ...prevState,
      [field]: file,
    }));

    if (field === "nid_front") {
      setNidFront(file);
    } else if (field === "nid_back") {
      setNidBack(file);
    }

    updateChangedFields(setIsFormChanged,field,file)


  }, [setFormData, setIsFormChanged]);


  const handleFile3 = (field, file) => {
    console.log("File3 selected:", file);
    setFormData((prevState) => ({
        ...prevState,
        [field]: file,
    }));
    
  updateChangedFields(setIsFormChanged,field,file)
};

  const resetFiles = useCallback(() => {
    setNidFront(null);
    setNidBack(null);
  }, []);

  return { handleFileChange,handleFile3, nidFront, nidBack, resetFiles };
};

export default useHandleFileChange;
