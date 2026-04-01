import { useEffect, useState, useRef, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { Paragraph } from "../../../../Components/Ui/Paragraph";
import { Heading } from "../../../../Components/Ui/Heading";
import { GoPlus, GoTrash } from "react-icons/go";
import ArrowHeading from "../../../../Components/HeadingComponent/ArrowHeading";
import PageContainer from "../../../../Components/Ui/PageContainer";
import TextInputComponent from "../../../../Components/FormComponent/TextInputComponent";
import NumberInputComponent from "../../../../Components/FormComponent/NumberInputComponent";
import CheckboxComponent from "../../../../Components/FormComponent/CheckboxComponent";
import RadioComponent from "../../../../Components/FormComponent/RadioComponent";
import DynamicTowerTable from "../components/DynamicTowerTable";
import MessageBox from "../../../../Components/MessageBox/MessageBox";
import ErrorMessage from "../../../../Components/MessageBox/ErrorMessage";
import SubmitButton from "../../../../Components/FormComponent/ButtonComponent/SubmitButton";
import { checkPermission } from "../../../../utils/permissionUtils";

import {
  createTower,
  clearMessages,
  getLastTowerNumber
} from "../../../../redux/slices/towers/towerSlice";

const schema = yup.object().shape({
  tower_name: yup
    .string()
    .max(50, "Tower name cannot exceed 50 characters.")
    .required("Tower name is required."),

  num_floors: yup
    .number()
    .typeError("Number of floors must be a number")
    .required("Number of floors is required.")
    .min(1, "Number of floors must be greater than 0") // Ensures positive number
    .max(50, "Number of floors cannot exceed 100"), // Ensures maximum of 50

  num_units: yup
    .number()
    .typeError("Units per floor must be a number")
    .required("Units per floor are required.")
    .min(1, "Units per floor must be greater than 0") // Ensures positive number
    .max(26, "Units per floor cannot exceed 26. Maximum allowed is 26 units per floor."), // Ensures maximum of 26

  unit_naming_type: yup.string().required("Unit naming is required."),
  add_tower_number_to_unit_name: yup.boolean(),
  units_per_floor: yup.string().required("Unit type is required."),

  // number_of_units: yup.array().of(
  //     yup.number()
  //         .typeError("Number of units must be a number")
  //         .min(1, "Units must be greater than 0")
  // ).required("Unit distribution is required when using 'Different' configuration"),

  number_of_units: yup.array().when("units_per_floor", {
    is: "Different",
    then: (schema) =>
      schema
        .of(
          yup
            .number()
            .typeError("Number of units must be a number")
            .required("Each unit field must be filled.")
            .min(1, "Units must be greater than 0")
        )
        .min(
          1,
          "At least one unit must be specified when 'Different' is selected."
        )
  }),

  photo: yup
    .mixed()
    .test("fileSize", "File size must be less than 5MB", (value) => {
      if (!value || value.length === 0) return true; // Allow empty file
      return value.size <= 5 * 1024 * 1024;
    })
    .test("fileType", "Unsupported file format", (value) => {
      if (!value || value.length === 0) return true;
      return ["image/jpeg", "image/png"].includes(value.type);
    }),

  description: yup
    .string()
    .transform((value, originalValue) => {
      return originalValue.trim() === "" ? undefined : value;
    })
    .test("wordCount", "Description cannot exceed 100 words", (value) => {
      if (!value) return true;
      const wordCount = value.trim().split(/\s+/).length;
      return wordCount <= 100;
    })
});
const AddTower = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { error, successMessage, lastTowerNumber, loading } = useSelector(
    (state) => state.tower
  );

  // State Hooks
  const [imagePreview, setImagePreview] = useState(null);
  const [fileError, setFileError] = useState("");
  const [floorEdits, setFloorEdits] = useState([]);
  const [unitsPerFloor, setUnitsPerFloor] = useState("Same as Every Floor");

  const [hasPermission, setHasPermission] = useState(false);
  const [loadingPermission, setLoadingPermission] = useState(true);
  const [floorEditErrors, setFloorEditErrors] = useState([]);

  useEffect(() => {
    const fetchPermission = async () => {
      const permissionGranted = await checkPermission("org", 10);
      setHasPermission(permissionGranted);
      setLoadingPermission(false);
    };
    fetchPermission();
  }, []);

  // React Hook Form
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    watch,
    formState: { errors }
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      tower_name: "",
      description: "",
      num_floors: "0",
      num_units: "0",
      num_floors_edit: "",
      num_units_edit: "",
      unit_naming_type: "Numerical",
      add_tower_number_to_unit_name: false,
      units_per_floor: "Same as Every Floor"
    }
  });

  // Watch Inputs
  const numFloors = parseInt(watch("num_floors") || "0") || 0;
  const numUnits = parseInt(watch("num_units") || "0") || 0;

  useEffect(() => {
    // console.log("Validation Errors:", errors);
  }, [errors]);

  // Fetch last tower number on component mount
  useEffect(() => {
    dispatch(getLastTowerNumber());
  }, [dispatch]);

  // Auto-set tower_number (No user input allowed)
  useEffect(() => {
    if (lastTowerNumber !== null) {
      // console.log("Fetched lastTowerNumber:", lastTowerNumber);
      setValue("tower_number", lastTowerNumber);
    }
  }, [lastTowerNumber, setValue]);

  useEffect(() => {
    if (successMessage || error) {
      return; // Do nothing, let the user handle message clearing
    }
  }, [successMessage, error]);

  // Handle backend validation errors for tower_name
  useEffect(() => {
    if (error && error.includes("Tower name already exists")) {
      setError("tower_name", {
        type: "manual",
        message: error
      });
    }
  }, [error, setError]);

  // Handle File Upload
  const handleFileChange = useCallback(
    (event) => {
      const file = event.target.files[0];

      if (!file) return;

      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        setFileError("File size must be less than 5MB");
        return;
      }

      // Validate file type (JPEG, PNG)
      if (!["image/jpeg", "image/png"].includes(file.type)) {
        setFileError(
          "Unsupported file format. Only JPG, JPEG, and PNG are allowed."
        );
        return;
      }

      // Clear previous errors
      setFileError("");
      clearErrors("photo");

      // Read file and set preview
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
      setValue("photo", file);
    },
    [setValue, clearErrors]
  );

  const fileInputRef = useRef(null);

  const handleRemoveImage = () => {
    setImagePreview(null);
    setValue("photo", null);
    setFileError("");
    clearErrors("photo");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    if (unitsPerFloor === "Same as Every Floor") {
      // Reset floorEdits since we no longer need per-floor modifications
      setFloorEdits([]);

      // Ensure all floors have the same unit count
      const updatedUnits = new Array(numFloors).fill(numUnits);
      setValue("number_of_units", updatedUnits);
    }
  }, [unitsPerFloor, numFloors, numUnits, setValue]);

  useEffect(() => {
    if (numFloors > 0 && numUnits > 0) {
      let updatedUnits = new Array(numFloors).fill(numUnits);

      floorEdits.forEach((edit) => {
        if (edit.floor >= 1 && edit.floor <= numFloors) {
          updatedUnits[edit.floor - 1] = edit.units || numUnits;
        }
      });

      // console.log("Final number_of_units:", updatedUnits);
      setValue("number_of_units", updatedUnits);
    }
  }, [numFloors, numUnits, floorEdits, setValue]);

  // **Handle adding a new floor edit**
  // const addFloorEdit = () => {
  //     setFloorEdits((prevEdits) => {
  //         // Prevent duplicate floor entries
  //         const floorNumbers = prevEdits.map((edit) => edit.floor);

  //         if (floorNumbers.includes("")) {
  //             return prevEdits; // Prevent adding multiple empty floors
  //         }

  //         return [...prevEdits, { floor: "", units: "" }];
  //     });
  // };

  const [maxFloorReached, setMaxFloorReached] = useState(false);

  const addFloorEdit = () => {
    if (floorEdits.length >= numFloors) {
      setMaxFloorReached(true);
      return; // Prevent adding more floors
    }
    setMaxFloorReached(false);

    setFloorEdits((prevEdits) => [...prevEdits, { floor: "", units: "" }]);
  };

  const updateFloorEdit = (index, field, value) => {
    setFloorEdits((prevEdits) => {
      const updatedEdits = [...prevEdits];
      let updatedErrors = [...floorEditErrors];

      // Allow empty string for clearing, but validate when there's a value
      if (value === "") {
        updatedEdits[index][field] = "";
        setFloorEditErrors(updatedErrors);
        return updatedEdits;
      }

      // Convert to number for validation
      const numValue = Number(value);

      if (field === "floor") {
        if (isNaN(numValue) || value.trim() === "") {
          updatedErrors[index] = {
            ...updatedErrors[index],
            floor: "Floor number is required."
          };
          setFloorEditErrors(updatedErrors);
          // Still update the value to allow typing
          updatedEdits[index][field] = value;
          return updatedEdits;
        }

        if (numValue < 1 || numValue > numFloors) {
          updatedErrors[index] = {
            ...updatedErrors[index],
            floor: `Floor number must be between 1 and ${numFloors}.`
          };
          setFloorEditErrors(updatedErrors);
          // Still update the value to allow typing
          updatedEdits[index][field] = value;
          return updatedEdits;
        }

        // Check if floor already exists
        const floorExists = updatedEdits.some(
          (edit, i) => Number(edit.floor) === numValue && i !== index
        );

        if (floorExists) {
          updatedErrors[index] = {
            ...updatedErrors[index],
            floor:
              "This floor is already assigned. Please choose another floor."
          };
          setFloorEditErrors(updatedErrors);
          // Still update the value to allow typing
          updatedEdits[index][field] = value;
          return updatedEdits;
        } else {
          updatedErrors[index] = { ...updatedErrors[index], floor: "" }; // Clear error if valid
        }

        // Ensure that if a floor is set, units must also be set
        const unitsValue = Number(updatedEdits[index].units);
        if (!updatedEdits[index].units || isNaN(unitsValue)) {
          updatedErrors[index] = {
            ...updatedErrors[index],
            units: "Units per floor is required."
          };
          setFloorEditErrors(updatedErrors);
        }
      }

      if (field === "units") {
        // Limit to 2 digits maximum (since max value is 26)
        if (value.length > 2) {
          // Truncate to first 2 digits
          const truncated = value.slice(0, 2);
          updatedEdits[index][field] = truncated;
          // Validate the truncated value
          const truncatedNum = Number(truncated);
          if (truncatedNum > 26) {
            const unitNamingType = watch("unit_naming_type");
            const errorMessage = unitNamingType === "Alphabetical"
              ? "Maximum 26 units allowed (A-Z). Please enter a value between 1 and 26."
              : "Maximum 26 units allowed per floor. Please enter a value between 1 and 26.";
            updatedErrors[index] = {
              ...updatedErrors[index],
              units: errorMessage
            };
            setFloorEditErrors(updatedErrors);
            updatedEdits[index][field] = "26";
            // Update number_of_units array
            const floorNum = Number(updatedEdits[index].floor);
            if (floorNum >= 1 && floorNum <= numFloors) {
              let updatedUnits = new Array(numFloors).fill(numUnits);
              updatedEdits.forEach((edit, editIndex) => {
                const editFloorNum = Number(edit.floor);
                let editUnitsNum = editIndex === index ? 26 : Number(edit.units);
                if (editFloorNum >= 1 && editFloorNum <= numFloors && !isNaN(editUnitsNum) && editUnitsNum > 0) {
                  updatedUnits[editFloorNum - 1] = editUnitsNum;
                }
              });
              setValue("number_of_units", updatedUnits);
            }
          } else {
            updatedErrors[index] = { ...updatedErrors[index], units: "" };
            setFloorEditErrors(updatedErrors);
            // Continue with normal validation flow
            const numValue = truncatedNum;
            if (numValue < 1) {
              updatedErrors[index] = {
                ...updatedErrors[index],
                units: "Units must be greater than 0."
              };
              setFloorEditErrors(updatedErrors);
            } else {
              updatedErrors[index] = { ...updatedErrors[index], units: "" };
              setFloorEditErrors(updatedErrors);
            }
          }
          // Update number_of_units array
          const floorNum = Number(updatedEdits[index].floor);
          if (floorNum >= 1 && floorNum <= numFloors) {
            let updatedUnits = new Array(numFloors).fill(numUnits);
            updatedEdits.forEach((edit) => {
              const editFloorNum = Number(edit.floor);
              const editUnitsNum = Number(edit.units);
              if (editFloorNum >= 1 && editFloorNum <= numFloors && !isNaN(editUnitsNum) && editUnitsNum > 0) {
                updatedUnits[editFloorNum - 1] = editUnitsNum;
              }
            });
            setValue("number_of_units", updatedUnits);
          }
          return updatedEdits;
        }

        if (isNaN(numValue) || value.trim() === "") {
          updatedErrors[index] = {
            ...updatedErrors[index],
            units: "Units per floor is required."
          };
          setFloorEditErrors(updatedErrors);
          // Still update the value to allow typing
          updatedEdits[index][field] = value;
          return updatedEdits;
        }

        if (numValue < 1) {
          updatedErrors[index] = {
            ...updatedErrors[index],
            units: "Units must be greater than 0."
          };
          setFloorEditErrors(updatedErrors);
          updatedEdits[index][field] = value;
          return updatedEdits;
        }

        if (numValue > 26) {
          const unitNamingType = watch("unit_naming_type");
          const errorMessage = unitNamingType === "Alphabetical"
            ? "Maximum 26 units allowed (A-Z). Please enter a value between 1 and 26."
            : "Maximum 26 units allowed per floor. Please enter a value between 1 and 26.";
          updatedErrors[index] = {
            ...updatedErrors[index],
            units: errorMessage
          };
          setFloorEditErrors(updatedErrors);
          // Set to max allowed value
          updatedEdits[index][field] = "26";
          // Update number_of_units array immediately
          const floorNum = Number(updatedEdits[index].floor);
          if (floorNum >= 1 && floorNum <= numFloors) {
            let updatedUnits = new Array(numFloors).fill(numUnits);
            updatedEdits.forEach((edit, editIndex) => {
              const editFloorNum = Number(edit.floor);
              let editUnitsNum = Number(edit.units);
              // Use 26 for the current edit if it's the one being updated
              if (editIndex === index) {
                editUnitsNum = 26;
              }
              if (editFloorNum >= 1 && editFloorNum <= numFloors && !isNaN(editUnitsNum) && editUnitsNum > 0) {
                updatedUnits[editFloorNum - 1] = editUnitsNum;
              }
            });
            setValue("number_of_units", updatedUnits);
          }
          return updatedEdits;
        }

        // Valid value
        updatedErrors[index] = { ...updatedErrors[index], units: "" }; // Clear error if valid
      }

      setFloorEditErrors(updatedErrors);
      updatedEdits[index][field] = value;

      // Update number_of_units array with the updated edits
      let updatedUnits = new Array(numFloors).fill(numUnits);
      updatedEdits.forEach((edit) => {
        const floorNum = Number(edit.floor);
        const unitsNum = Number(edit.units);
        if (floorNum >= 1 && floorNum <= numFloors && !isNaN(unitsNum) && unitsNum > 0) {
          updatedUnits[floorNum - 1] = unitsNum;
        }
      });
      setValue("number_of_units", updatedUnits);

      return updatedEdits;
    });
  };

  // **Handle removing an edited floor**
  // const removeFloorEdit = (index) => {
  //   const updatedEdits = floorEdits.filter((_, i) => i !== index);
  //   setFloorEdits(updatedEdits);

  //   let updatedUnits = new Array(numFloors).fill(numUnits);
  //   updatedEdits.forEach((edit) => {
  //     if (edit.floor >= 1 && edit.floor <= numFloors) {
  //       updatedUnits[edit.floor - 1] = edit.units || numUnits;
  //     }
  //   });

  //   setValue("number_of_units", updatedUnits);
  // };

  const removeFloorEdit = (index) => {
    const updatedEdits = floorEdits.filter((_, i) => i !== index);
    setFloorEdits(updatedEdits);

    let updatedUnits = new Array(numFloors).fill(numUnits);
    updatedEdits.forEach((edit) => {
      if (edit.floor >= 1 && edit.floor <= numFloors) {
        updatedUnits[edit.floor - 1] = edit.units || numUnits;
      }
    });

    setValue("number_of_units", updatedUnits);

    setFloorEditErrors((prevErrors) => {
      const newErrors = [...prevErrors];
      newErrors.splice(index, 1);
      return newErrors;
    });
  };

  const hasErrors = floorEditErrors.some((err) => err?.floor || err?.units);
  // const allFloorEditsValid = floorEdits.every(
  //   (edit) => edit.floor && edit.units
  // );
  // const allFieldsFilled =
  //   watch("tower_name") &&
  //   watch("num_floors") &&
  //   watch("num_units") &&
  //   watch("unit_naming_type") &&
  //   (unitsPerFloor === "Same as Every Floor" || allFloorEditsValid);
  // const isSaveDisabled =
  //   hasErrors || !allFieldsFilled || Object.keys(errors).length > 0;

  // start
  // update code .......................................... 05-21-25
  const allFloorEditsValid = floorEdits.every(
    (edit) => {
      const floorNum = Number(edit.floor);
      const unitsNum = Number(edit.units);
      return (
        edit.floor &&
        edit.units &&
        !isNaN(floorNum) &&
        !isNaN(unitsNum) &&
        floorNum >= 1 &&
        floorNum <= numFloors &&
        unitsNum >= 1 &&
        unitsNum <= 26
      );
    }
  );

  const requiredFieldsFilled =
    watch("tower_name") &&
    (parseInt(watch("num_floors") || "0") || 0) > 0 &&
    (parseInt(watch("num_units") || "0") || 0) > 0 &&
    watch("unit_naming_type");

  const isDifferentConfigValid =
    unitsPerFloor !== "Different" ||
    (unitsPerFloor === "Different" &&
      floorEdits.length > 0 &&
      allFloorEditsValid &&
      floorEdits.length === new Set(floorEdits.map((edit) => edit.floor)).size); // Ensure no duplicate floors

  const hasFormErrors = Object.keys(errors).length > 0;

  const isSaveDisabled =
    !requiredFieldsFilled ||
    !isDifferentConfigValid ||
    hasErrors ||
    hasFormErrors ||
    loading;
  // end
  // update code........................................  05-21-25

  const onSubmit = (data) => {
    // Prevent multiple submissions
    if (loading) {
      return;
    }

    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (Array.isArray(value))
        value.forEach((val) => formData.append(key, val));
      else formData.append(key, value);
    });

    dispatch(createTower(formData));
  };

  // const onSubmit = async (data) => {
  //     const formData = new FormData();

  //     for (const [key, value] of Object.entries(data)) {
  //         if (Array.isArray(value)) {
  //             value.forEach((val) => formData.append(key, val));
  //         } else {
  //             formData.append(key, value);
  //         }
  //     }

  //     dispatch(createTower(formData));
  // };

  if (loadingPermission) {
    return <div></div>;
  }

  if (!hasPermission) {
    navigate("/not-authorized");
  }

  return (
    <PageContainer className="min-h-screen bg-surfaceMuted">
      <MessageBox
        message={successMessage}
        error={error && !error.includes("Tower name already exists") ? error : null}
        clearMessage={() => dispatch(clearMessages())}
        onOk={() => {
          dispatch(clearMessages());
          if (successMessage) navigate(-1);
        }}
      />

      <div className="sticky top-0 z-20 mb-1.5 flex items-center justify-between gap-3 bg-surfaceMuted/95 py-4 backdrop-blur">
        <div
          onClick={() => navigate(-1)}
          className="inline-flex cursor-pointer items-center gap-3 text-ink transition-colors hover:text-primary"
        >
          <ArrowHeading title="Add Tower" size="2xl" color="text-black" />
        </div>
      </div>

      <div className="max-h-[calc(100vh-180px)] overflow-y-auto">
        <section className="mx-auto w-full  rounded-[32px] border border-borderLight bg-white px-8 py-10">
          <form onSubmit={handleSubmit(onSubmit)}>

            <div className="flex flex-col md:flex-row md:gap-6">
              <div className="w-full md:w-[60%] px-2 md:px-5">
                <Heading level={1} className="my-2 text-base font-bold">
                  Tower & Unit Information
                </Heading>
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="w-full md:w-1/2">
                    <Paragraph className="my-3 text-base font-medium">
                      Tower Name*
                    </Paragraph>
                    <TextInputComponent
                      {...register("tower_name")}
                      placeholder="Enter Tower Name"
                      value={watch("tower_name") || ""}
                      onChange={(e) => {
                        setValue("tower_name", e.target.value); // Ensure state updates
                        clearErrors("tower_name"); // ✅ Clears validation error when valid input is entered
                      }}
                    />
                    <ErrorMessage message={errors.tower_name?.message} />
                  </div>
                  <div className="w-full md:w-1/2">
                    <Paragraph className="my-3 text-base font-medium">
                      Tower Number
                    </Paragraph>
                    <NumberInputComponent
                      value={watch("tower_number") || lastTowerNumber || ""}
                      disabled // Ensure it's disabled
                    />
                  </div>
                </div>
                <div className="w-full mt-4">
                  <Paragraph className="my-3 text-base font-medium">
                    Description
                  </Paragraph>
                  <div className="login-field">
                    <textarea
                      className="login-field-input"
                      {...register("description")}
                      onChange={(e) => {
                        clearErrors("description");
                      }}
                      rows="4" // Optional: height of the textarea
                      cols="50" // Optional: width of the textarea
                    />
                    <div>
                      {errors?.description && (
                        <p className="text-error text-[12px]">
                          {errors.description.message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <Paragraph className="my-3 text-base font-medium">
                  Photo
                </Paragraph>
                <div className="relative w-full md:w-1/2 pt-5 pb-5 rounded-27 profile-picture flex flex-col items-center border border-dashed">
                  <label
                    htmlFor="file-upload"
                    className="relative cursor-pointer w-24 h-24 flex items-center justify-center overflow-hidden"
                  >
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="object-cover w-full h-full rounded-md"
                      />
                    ) : (
                      <img
                        src="./image_upload.png"
                        alt="Upload Placeholder"
                        className="m-3 w-[45px] h-[45px]"
                      />
                    )}
                  </label>
                  <input
                    id="file-upload"
                    type="file"
                    accept=".jpg,.jpeg,.png"
                    className="hidden"
                    onChange={handleFileChange}
                    ref={fileInputRef}
                  />
                  {imagePreview && (
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-lg hover:bg-red-600"
                      aria-label="Remove Image"
                    >
                      &#10006;
                    </button>
                  )}
                  {!imagePreview && <p>Upload Tower Photo</p>}
                  {fileError && (
                    <p className="text-red-500 text-sm">{fileError}</p>
                  )}
                  {errors?.photo && (
                    <p className="text-red-500 text-sm">
                      {errors.photo.message}
                    </p>
                  )}
                </div>
                <div className="flex flex-col md:flex-row gap-4 mt-4">
                  <div className="w-full md:w-1/2">
                    <Paragraph className="my-3 text-base font-medium">
                      Number of Floors
                    </Paragraph>
                    <TextInputComponent
                      {...register("num_floors")}
                      placeholder="Enter Number of Floors"
                      value={watch("num_floors") || ""}
                      onChange={(e) => {
                        const inputValue = e.target.value;
                        // Allow empty string to clear the field
                        setValue("num_floors", inputValue);
                        clearErrors("num_floors"); // ✅ Clears validation error when valid input is entered
                      }}
                      error={errors.num_floors?.message}
                    />
                  </div>
                  <div className="w-full md:w-1/2">
                    <Paragraph className="my-3 text-base font-medium">
                      Units in Each Floor
                    </Paragraph>
                    <TextInputComponent
                      {...register("num_units")}
                      placeholder="Enter Units per Floor"
                      type="number"
                      min="1"
                      max="26"
                      maxLength={2}
                      value={watch("num_units") || ""}
                      onChange={(e) => {
                        const inputValue = e.target.value;
                        // Allow empty string to clear the field
                        if (inputValue === "") {
                          setValue("num_units", inputValue);
                          clearErrors("num_units");
                          return;
                        }

                        // Limit to 2 digits maximum (since max value is 26)
                        if (inputValue.length > 2) {
                          // Truncate to first 2 digits
                          const truncated = inputValue.slice(0, 2);
                          setValue("num_units", truncated);
                          // Validate the truncated value
                          const numValue = Number(truncated);
                          if (numValue > 26) {
                            const unitNamingType = watch("unit_naming_type");
                            const errorMessage = unitNamingType === "Alphabetical"
                              ? "Maximum 26 units allowed (A-Z). Please enter a value between 1 and 26."
                              : "Maximum 26 units allowed per floor. Please enter a value between 1 and 26.";
                            setError("num_units", {
                              type: "manual",
                              message: errorMessage
                            });
                            setValue("num_units", 26);
                          } else {
                            clearErrors("num_units");
                          }
                          return;
                        }

                        // Convert to number for validation
                        const numValue = Number(inputValue);

                        // Prevent values greater than 26
                        if (!isNaN(numValue) && numValue > 26) {
                          const unitNamingType = watch("unit_naming_type");
                          const errorMessage = unitNamingType === "Alphabetical"
                            ? "Maximum 26 units allowed (A-Z). Please enter a value between 1 and 26."
                            : "Maximum 26 units allowed per floor. Please enter a value between 1 and 26.";
                          setError("num_units", {
                            type: "manual",
                            message: errorMessage
                          });
                          // Set to max allowed value
                          setValue("num_units", 26);
                          return;
                        }

                        // Allow valid input
                        setValue("num_units", inputValue);
                        clearErrors("num_units");
                      }}
                      error={errors.num_units?.message}
                    />
                  </div>
                </div>

                <div className="flex flex-col md:flex-row items-start justify-between gap-2 mt-2">
                  <div className="w-full md:w-1/2">
                    <RadioComponent
                      options={[
                        { label: "Numerical", value: "Numerical" },
                        { label: "Alphabetical", value: "Alphabetical" }
                      ]}
                      label="Unit Naming"
                      selectedValue={watch("unit_naming_type")}
                      onChange={(e) =>
                        setValue("unit_naming_type", e.target.value)
                      }
                      name="unit_naming_type"
                    />
                  </div>
                  <div className="w-full md:w-1/2 login-field flex flex-col">
                    <div className="hidden md:block my-3 text-left" style={{ height: '24px' }}></div>
                    <div className="flex items-center" style={{ minHeight: '48px' }}>
                      <CheckboxComponent
                        label="Add Tower Number to Unit Name"
                        borderColor="border-primary"
                        checked={watch("add_tower_number_to_unit_name")}
                        onChange={(e) =>
                          setValue(
                            "add_tower_number_to_unit_name",
                            e.target.checked
                          )
                        }
                        name="add_tower_number_to_unit_name"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="w-full md:w-[40%] px-2 md:px-5 md:border-l-stroke md:border-l-[4px] min-w-0 mt-6 md:mt-0">
                <div className="w-full pl-5 min-w-0">
                  {/* <Paragraph className="my-3 text-base font-medium">
                  
                  </Paragraph> */}

                  <RadioComponent
                    label="  Unit*"
                    options={[
                      {
                        label: "Same as Every Floor",
                        value: "Same as Every Floor"
                      },
                      { label: "Different", value: "Different" }
                    ]}
                    selectedValue={unitsPerFloor}
                    onChange={(e) => {
                      const value = e.target.value;
                      setUnitsPerFloor(value);
                      setValue("units_per_floor", value);

                      if (value === "Same as Every Floor") {
                        setFloorEdits([]);
                        setFloorEditErrors([]);
                        setValue(
                          "number_of_units",
                          new Array(numFloors).fill(numUnits)
                        );
                        setMaxFloorReached(false);
                      }
                    }}
                    name="units_per_floor"
                  />
                </div>
                {unitsPerFloor === "Different" && (
                  <>
                    <div className="flex flex-col gap-4 mt-4 pl-2">
                      <button
                        type="button"
                        onClick={addFloorEdit}
                        className="flex justify-center items-center w-10 h-10 rounded-full bg-surfaceTeal hover:bg-gray-300 transition-all"
                        disabled={floorEdits.length >= numFloors} // Disable if all floors are assigned
                        aria-label="Add Floor Unit"
                      >
                        <GoPlus className="text-black text-xl" />
                      </button>
                      {maxFloorReached && (
                        <p className="text-red-500 text-sm">
                          Maximum floor limit reached
                        </p>
                      )}

                      {floorEdits.map((edit, index) => (
                        <div key={index} className="flex flex-col gap-2 mb-4">
                          <div className="flex items-end gap-4">
                            <div className="flex-1">
                              <Paragraph className="my-3 text-base font-medium">
                                Floor
                              </Paragraph>
                              <TextInputComponent
                                label=""
                                name={`floor_edit_${index}`}
                                placeholder="Floor Number"
                                value={edit.floor === "" ? "" : edit.floor}
                                onChange={(e) => {
                                  const inputValue = e.target.value;
                                  // Allow empty string to clear the field
                                  updateFloorEdit(index, "floor", inputValue);
                                }}
                                error={floorEditErrors[index]?.floor}
                              />
                            </div>

                            {/* Units Input */}
                            <div className="flex-1">
                              <Paragraph className="my-3 text-base font-medium">
                                Unit
                              </Paragraph>
                              <TextInputComponent
                                label=""
                                name={`units_edit_${index}`}
                                placeholder="Units on Floor"
                                type="number"
                                min="1"
                                max="26"
                                maxLength={2}
                                value={edit.units === "" ? "" : edit.units}
                                onChange={(e) => {
                                  const inputValue = e.target.value;
                                  // Allow empty string to clear the field
                                  updateFloorEdit(index, "units", inputValue);
                                }}
                                error={floorEditErrors[index]?.units}
                              />
                            </div>

                            {/* Remove Button */}
                            <div className="flex items-center pb-1">
                              <button
                                type="button"
                                onClick={() => removeFloorEdit(index)}
                                className="flex justify-center items-center w-10 h-10 rounded-full bg-surfaceTeal hover:bg-gray-300 transition-all"
                                aria-label="Remove Floor Unit"
                              >
                                <GoTrash className="text-black text-xl" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <div className="w-full min-w-0 overflow-hidden">
                  <DynamicTowerTable
                    num_floors={parseInt(watch("num_floors") || "0") || 0}
                    num_units={parseInt(watch("num_units") || "0") || 0}
                    num_floors_edit={watch("num_floors_edit") || 0}
                    num_units_edit={watch("num_units_edit") || 0}
                    unit_naming_type={watch("unit_naming_type") || "Numerical"}
                    add_tower_number_to_unit_name={
                      watch("add_tower_number_to_unit_name") || false
                    }
                    tower_number={watch("tower_number") || 1}
                    units_per_floor={
                      watch("units_per_floor") || "Same as Every Floor"
                    }
                    floorEdits={floorEdits}
                  />
                </div>
              </div>
            </div>
            <div className="w-[60%] px-5 mt-10 pb-10 flex justify-center">
              <div className="w-full max-w-md">
                <SubmitButton
                  text="Save"
                  width="full"
                  disabled={isSaveDisabled}
                  loading={loading}
                />
              </div>
            </div>
          </form>
        </section>
      </div>
    </PageContainer>
  );
};
export default AddTower;
