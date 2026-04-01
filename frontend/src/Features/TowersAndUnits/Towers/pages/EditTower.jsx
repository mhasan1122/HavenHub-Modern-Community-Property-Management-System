import { useEffect, useState, useRef, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
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
import TextareaComponent from "../../../../Components/FormComponent/TextareaComponent";
import CheckboxComponent from "../../../../Components/FormComponent/CheckboxComponent";
import RadioComponent from "../../../../Components/FormComponent/RadioComponent";
import DynamicTowerTable from "../components/DynamicTowerTable";
import MessageBox from "../../../../Components/MessageBox/MessageBox";
import ErrorMessage from "../../../../Components/MessageBox/ErrorMessage";
import SubmitButton from "../../../../Components/FormComponent/ButtonComponent/SubmitButton";
import img from "../../../../../public/image_upload.png";
import {
  clearMessages,
  fetchTowerById,
  updateTower,
  resetTowers
} from "../../../../redux/slices/towers/towerSlice";
import { checkPermission } from "../../../../utils/permissionUtils";

const BASE_URL = import.meta.env.VITE_BASE_API || "http://127.0.0.1:8000";

const getPhotoUrl = (photoPath) => {
  if (!photoPath) return null;
  if (photoPath.startsWith("http://") || photoPath.startsWith("https://")) {
    return photoPath;
  }
  const normalizedBase = BASE_URL.endsWith("/")
    ? BASE_URL.slice(0, -1)
    : BASE_URL;
  const normalizedPath = photoPath.startsWith("/")
    ? photoPath
    : `/${photoPath}`;
  return `${normalizedBase}${normalizedPath}`;
};

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

  number_of_units: yup
    .array()
    .of(
      yup
        .number()
        .typeError("Number of units must be a number")
        .min(1, "Units must be greater than 0")
    )
    .required(
      "Unit distribution is required when using 'Different' configuration"
    ),

  description: yup
    .string()
    .transform((value, originalValue) => {
      return originalValue.trim() === "" ? undefined : value;
    })
    .test("wordCount", "Description cannot exceed 100 words", (value) => {
      if (!value) return true;
      const wordCount = value.trim().split(/\s+/).length;
      return wordCount <= 100;
    }),
  photo: yup
    .mixed()
    .nullable()
    .test("fileSize", "File size must be less than 5MB", (value) => {
      if (!value || typeof value === "string") return true;
      return value.size <= 5 * 1024 * 1024;
    })
    .test("fileType", "Unsupported file format", (value) => {
      if (!value || typeof value === "string") return true;
      return ["image/jpeg", "image/png"].includes(value.type);
    })
});

const EditTower = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { id } = useParams(); // Get ID from URL params

  const { singleTower, loading, error, successMessage } = useSelector(
    (state) => state.tower || {}
  );

  const [imagePreview, setImagePreview] = useState(null);
  const [fileError, setFileError] = useState("");
  const [isRemoved, setIsRemoved] = useState(false);
  const [newImageUploaded, setNewImageUploaded] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [loadingPermission, setLoadingPermission] = useState(true);
  const [floorEditErrors, setFloorEditErrors] = useState([]);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    watch,
    reset,
    formState: { errors: formErrors, isDirty }
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      tower_name: "",
      description: "",
      num_floors: "",
      num_units: "",
      num_floors_edit: "",
      num_units_edit: "",
      unit_naming_type: "Numerical",
      add_tower_number_to_unit_name: false,
      units_per_floor: "Same as Every Floor"
    }
  });

  const [unitsPerFloor, setUnitsPerFloor] = useState("Same as Every Floor");
  const [floorEdits, setFloorEdits] = useState([]);
  const numFloors = watch("num_floors") || 0;
  const numUnits = watch("num_units") || 0;
  useEffect(() => {
    const fetchPermission = async () => {
      const permissionGranted = await checkPermission("org", 11);
      setHasPermission(permissionGranted);
      setLoadingPermission(false);
    };
    fetchPermission();
  }, []);

  useEffect(() => {
    if (
      error === "This tower has been deleted." ||
      error === "Tower not found."
    ) {
      // Do nothing here, let the MessageBox handle it
    }
  }, [error]);

  const getErrorText = useCallback((value) => {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.filter(Boolean).join(", ");
    if (typeof value === "object") {
      if (value.detail) return String(value.detail);
      return Object.values(value).flat().filter(Boolean).join(", ");
    }
    return String(value);
  }, []);

  // Handle backend validation errors for tower_name
  useEffect(() => {
    const errorText = getErrorText(error);
    if (errorText && errorText.includes("Tower name already exists")) {
      setError("tower_name", {
        type: "manual",
        message: errorText
      });
    }
  }, [error, getErrorText, setError]);

  useEffect(() => {
    if (id) {
      dispatch(fetchTowerById(id));
    }

    return () => {
      dispatch(resetTowers());
    };
  }, [dispatch, id]);

  useEffect(() => {
    if (singleTower) {
      setValue("tower_name", singleTower.tower_name || "");
      setValue("tower_number", singleTower.tower_number || null);
      setValue("description", singleTower.description || "");
      setValue("num_floors", singleTower.num_floors || null);
      setValue("num_units", singleTower.num_units || null);
      setValue("unit_naming_type", singleTower.unit_naming_type || "Numerical");
      setValue(
        "units_per_floor",
        singleTower.units_per_floor || "Same as Every Floor"
      );

      setValue(
        "add_tower_number_to_unit_name",
        singleTower.add_tower_number_to_unit_name || false
      );

      console.log(singleTower);

      if (singleTower.number_of_units) {
        setValue("number_of_units", singleTower.number_of_units);
      }

      if (singleTower?.photo) {
        setValue("photo", singleTower.photo);
        setImagePreview(getPhotoUrl(singleTower.photo));
      } else {
        setValue("photo", null);
        setImagePreview(null);
      }

      if (singleTower.floors && Array.isArray(singleTower.floors)) {
        setValue("floors", singleTower.floors);
      } else {
        setValue("floors", []);
      }

      const allUnits =
        singleTower.floors?.flatMap((floor) => floor.units) || [];
      setValue("units", allUnits);

      if (singleTower) {
        const towerUnitsPerFloor =
          singleTower.units_per_floor || "Same as Every Floor";
        setUnitsPerFloor(towerUnitsPerFloor);
        setValue("units_per_floor", towerUnitsPerFloor);

        if (towerUnitsPerFloor === "Different" && singleTower.floors) {
          const floorEditsData = singleTower.floors.map((floor) => ({
            floor: String(floor.floor_no),
            units: String(floor.number_of_units)
          }));
          setFloorEdits(floorEditsData);
          setPreviousFloorEdits(floorEditsData); // Store initial state
        }
      }
    }
  }, [singleTower, setValue]);

  // useEffect to update preview if server image exists and new image is not uploaded
  useEffect(() => {
    if (singleTower && singleTower.photo && !isRemoved && !newImageUploaded) {
      setImagePreview(getPhotoUrl(singleTower.photo));
    }
  }, [singleTower, isRemoved, newImageUploaded]);

  // Handle new image upload
  const handleFileChange = (event) => {
    const file = event.target.files[0];

    if (!file) {
      // ✅ If no file is selected, mark photo as removed
      setValue("photo", "", { shouldDirty: true });
      setImagePreview(null);
      setIsRemoved(true);
      setFileError(""); // Clear previous error
      clearErrors("photo");
      return;
    }

    setValue("photo", file, { shouldDirty: true }); // ✅ Mark as dirty

    // ✅ File size validation (Max: 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setFileError("File size must be less than 5MB");
      setError("photo", {
        type: "manual",
        message: "File size must be less than 5MB"
      });
      return;
    }

    // ✅ File format validation
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setFileError(
        "Unsupported file format. Only JPG, JPEG, and PNG are allowed."
      );
      setError("photo", {
        type: "manual",
        message: "Unsupported file format. Only JPG, JPEG, and PNG are allowed."
      });
      return;
    }

    // ✅ Clear errors if file is valid
    setFileError("");
    clearErrors("photo");

    // ✅ Read and preview the image
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
      setNewImageUploaded(true);
      setIsRemoved(false);
    };
    reader.readAsDataURL(file);
  };

  // Handle remove image
  const handleRemoveImage = () => {
    setImagePreview("");
    // setValue("photo", "");
    setValue("photo", "", { shouldDirty: true });

    // setImagePreview(null);
    // setValue("photo", null);
    setFileError("");
    clearErrors("photo");
    document.getElementById("file-upload").value = "";
    setNewImageUploaded(false);
    setIsRemoved(true);
  };

  // Update `number_of_units` dynamically
  useEffect(() => {
    let updatedUnits = new Array(numFloors).fill(numUnits);
    floorEdits.forEach((edit) => {
      if (edit.floor >= 1 && edit.floor <= numFloors) {
        updatedUnits[edit.floor - 1] = edit.units || numUnits;
      }
    });
    setValue("number_of_units", updatedUnits);
  }, [numFloors, numUnits, floorEdits, setValue]);

  const [previousFloorEdits, setPreviousFloorEdits] = useState([]); // Store previous "Different" config

  useEffect(() => {
    if (singleTower) {
      setValue(
        "units_per_floor",
        singleTower.units_per_floor || "Same as Every Floor"
      );

      if (singleTower.units_per_floor === "Different") {
        const floorEditsData = singleTower.floors.map((floor) => ({
          floor: String(floor.floor_no),
          units: String(floor.number_of_units)
        }));
        setFloorEdits(floorEditsData);
        setPreviousFloorEdits(floorEditsData); // Store the initial state
      }
    }
  }, [singleTower, setValue]);

  const handleUnitTypeChange = (value) => {
    setUnitsPerFloor(value);
    setValue("units_per_floor", value, { shouldDirty: true });

    if (value === "Same as Every Floor") {
      setPreviousFloorEdits(floorEdits);
      setFloorEdits([]);
      setValue("number_of_units", new Array(numFloors).fill(numUnits), {
        shouldDirty: true
      });
    } else if (value === "Different") {
      setFloorEdits(previousFloorEdits);
      setValue(
        "number_of_units",
        previousFloorEdits.map((edit) => edit.units),
        { shouldDirty: true }
      );
    }
  };

  // **Handle adding a new floor edit**
  // const addFloorEdit = () => {
  //   setFloorEdits((prevEdits) => {
  //     // Prevent duplicate floor entries
  //     const floorNumbers = prevEdits.map((edit) => edit.floor);

  //     if (floorNumbers.includes("")) {
  //       return prevEdits; // Prevent adding multiple empty floors
  //     }

  //     return [...prevEdits, { floor: "", units: "" }];
  //   });
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
              setValue("number_of_units", updatedUnits, { shouldDirty: true });
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
            setValue("number_of_units", updatedUnits, { shouldDirty: true });
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
            setValue("number_of_units", updatedUnits, { shouldDirty: true });
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
      setValue("number_of_units", updatedUnits, { shouldDirty: true });

      return updatedEdits;
    });
  };

  // **Handle removing an edited floor**
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
  };

  const onSubmit = async (data) => {
    try {
      const formData = new FormData();
      const allowedImageTypes = [
        "image/jpeg",
        "image/png",
        "image/jpg",
        "image/webp"
      ];

      Object.keys(data).forEach((key) => {
        const value = data[key];

        if (["photo"].includes(key)) {
          if (typeof value === "string" && value.startsWith("/media/")) {
            console.log(`Skipping ${key} URL:`, value); // Don't append if it's a URL
            return;
          } else if (value instanceof File || value instanceof Blob) {
            // ✅ Validate file type if it is a file
            if (!allowedImageTypes.includes(value.type)) {
              return; // Stop form submission if the file format is not correct
            }
            formData.append(key, value); // Append the valid file
          } else if (value === "") {
            formData.append(`${key}_removed`, "Removed"); // Mark as removed if empty
          }
        } else if (Array.isArray(value)) {
          // If it's an array, append each value separately
          value.forEach((item) => {
            formData.append(key, item);
          });
        } else if (typeof value === "boolean" || typeof value === "number") {
          // Convert Boolean & Number to String
          formData.append(key, String(value));
        } else if (typeof value === "object" && value !== null) {
          // If it's an object, convert it to JSON string
          formData.append(key, JSON.stringify(value));
        } else {
          // Otherwise, append the value directly
          formData.append(key, value || "");
        }
      });

      console.log(
        "Form data submitted:",
        Object.fromEntries(formData.entries())
      );

      const result = await dispatch(updateTower({ formData, id }));

      if (updateTower.fulfilled.match(result)) {
        console.log("Update Successful:", result.payload);
        reset(); // ✅ Clears the form fields after successful submission
      } else {
        console.error("Update Failed:", result.payload);
      }
    } catch (error) {
      console.error("Error submitting update:", error);
    }
  };

  if (loadingPermission) {
    return <div></div>;
  }

  if (!hasPermission) {
    navigate("/not-authorized");
    return null;
  }

  return (
    <PageContainer className="min-h-screen bg-surfaceMuted">
      <MessageBox
        message={
          successMessage ||
          (getErrorText(error) && !getErrorText(error).includes("Tower name already exists")
            ? getErrorText(error)
            : null)
        }
        error={
          getErrorText(error) && !getErrorText(error).includes("Tower name already exists")
            ? getErrorText(error)
            : null
        }
        clearMessage={() => dispatch(clearMessages())}
        onOk={() => {
          dispatch(clearMessages());

          // Redirect to ViewTowers if the error is related to deletion
          if (
            error === "This tower has been deleted." ||
            error === "Tower not found."
          ) {
            navigate("/ViewTowers");
          } else if (successMessage) {
            navigate(-1); // Navigate back for other success cases
          }
        }}
      />

      <div className="sticky top-0 z-20 mb-1.5 flex items-center justify-between gap-3 bg-surfaceMuted/95 py-4 backdrop-blur">
        <div
          onClick={() => navigate(-1)}
          className="inline-flex cursor-pointer items-center gap-3 text-[#0F172A] transition-colors hover:text-primary"
        >
          <ArrowHeading title="Edit Tower" size="2xl" color="text-black" />
        </div>
        <div className="flex items-center gap-2">
          <SubmitButton
            text="Update"
            loading={loading}
            disabled={!isDirty || loading}
            onClick={handleSubmit(onSubmit)}
            bgColor={
              !isDirty || loading
                ? "bg-white cursor-not-allowed"
                : "bg-primary"
            }
            textColor={
              !isDirty || loading
                ? "text-primary"
                : "text-white"
            }
            width="auto"
          />
        </div>
      </div>

      <div className="max-h-[calc(100vh-180px)] overflow-y-auto">
        <section className="mx-auto w-full  rounded-[32px] border border-borderLight bg-white px-8 py-10">
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="flex flex-col md:flex-row md:gap-6">
              <div className="w-full md:w-[60%] px-2 md:px-5">
                <Heading level={1} className="my-2 text-sm font-medium">
                  Tower & Unit Information
                </Heading>
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="w-full md:w-1/2">
                    <Paragraph className="my-3 text-sm font-medium">
                      Tower Name*
                    </Paragraph>
                    <TextInputComponent
                      name="tower_name"
                      placeholder="Enter Tower Name"
                      value={watch("tower_name") || ""}
                      onChange={(e) => {
                        setValue("tower_name", e.target.value, {
                          shouldDirty: true
                        });
                        clearErrors("tower_name");
                      }}
                    />
                    <ErrorMessage message={formErrors.tower_name?.message} />
                  </div>
                  <div className="w-full md:w-1/2">
                    <Paragraph className="my-3 text-sm font-medium">
                      Tower Number
                    </Paragraph>
                    <NumberInputComponent
                      name="tower_number"
                      placeholder="Enter Tower Number"
                      value={watch("tower_number") || ""}
                      onChange={(e) =>
                        setValue("tower_number", Number(e.target.value), {
                          shouldDirty: true
                        })
                      }
                      error={formErrors.tower_number?.message}
                      disabled={true} // This will disable the input field
                    />
                  </div>
                </div>
                <div className="w-full mt-4">
                  <Paragraph className="my-3 text-sm font-medium">
                    Description
                  </Paragraph>
                  <div className="login-field">
                    <textarea
                      name="description"
                      rows={4}
                      placeholder="Enter your description here"
                      {...register("description", {
                        required: "Description is required"
                      })}
                      className={`login-field-input ${formErrors.description ? "border-red-500" : ""
                        }`}
                    />
                    {formErrors.description && (
                      <span className="text-red-500 text-xs mt-1 block">
                        {formErrors.description.message}
                      </span>
                    )}
                  </div>
                </div>
                <Paragraph className="my-3 text-sm font-medium">
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
                    ) : singleTower?.photo && !isRemoved ? (
                      <img
                        src={getPhotoUrl(singleTower.photo)}
                        alt="Current Tower Photo"
                        className="object-cover w-full h-full rounded-md"
                      />
                    ) : (
                      <img
                        src={img}
                        alt="Upload Placeholder"
                        className="m-3 w-[45px] h-[45px]"
                      />
                    )}
                  </label>
                  <input
                    id="file-upload"
                    name="photo"
                    type="file"
                    accept=".jpg,.jpeg,.png"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  {(imagePreview || (singleTower?.photo && !isRemoved)) && (
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-lg hover:bg-red-600"
                      aria-label="Remove Image"
                    >
                      &#10006;
                    </button>
                  )}
                  {!(imagePreview || (singleTower?.photo && !isRemoved)) && (
                    <p>Upload Tower Photo</p>
                  )}
                  {/* {fileError && (
                                        <p className="text-red-500 text-sm">{fileError}</p>
                                      )}
                                      {formErrors?.photo && (
                                        <p className="text-red-500 text-sm">
                                          {formErrors.photo.message}
                                        </p>
                                      )} */}
                  {(fileError || formErrors?.photo) && (
                    <p className="text-red-500 text-sm">
                      {fileError || formErrors.photo?.message}
                    </p>
                  )}
                </div>

                <div className="flex gap-4 mt-4">
                  <div className="w-1/2">
                    <Paragraph className="my-3 text-sm font-medium">
                      Number of Floors*
                    </Paragraph>
                    <TextInputComponent
                      label=""
                      name="num_floors"
                      placeholder="Enter number of floors"
                      value={watch("num_floors") === "" ? "" : (watch("num_floors") || "0")}
                      onChange={(e) => {
                        const inputValue = e.target.value;
                        // Allow empty string to clear the field
                        setValue("num_floors", inputValue, { shouldDirty: true });
                        clearErrors("num_floors"); // ✅ Clears validation error when valid input is entered
                      }}
                      error={formErrors.num_floors?.message}
                    />
                  </div>
                  <div className="w-1/2">
                    <Paragraph className="my-3 text-sm font-medium">
                      Units in Each Floor*
                    </Paragraph>
                    <TextInputComponent
                      label=""
                      name="num_units"
                      placeholder="Enter units per floor"
                      type="number"
                      min="1"
                      max="26"
                      maxLength={2}
                      value={watch("num_units") === "" ? "" : (watch("num_units") || "0")}
                      onChange={(e) => {
                        const inputValue = e.target.value;
                        // Allow empty string to clear the field
                        if (inputValue === "") {
                          setValue("num_units", inputValue, { shouldDirty: true });
                          clearErrors("num_units");
                          return;
                        }

                        // Limit to 2 digits maximum (since max value is 26)
                        if (inputValue.length > 2) {
                          // Truncate to first 2 digits
                          const truncated = inputValue.slice(0, 2);
                          setValue("num_units", truncated, { shouldDirty: true });
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
                            setValue("num_units", 26, { shouldDirty: true });
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
                          setValue("num_units", 26, { shouldDirty: true });
                          return;
                        }

                        // Allow valid input
                        setValue("num_units", inputValue, { shouldDirty: true });
                        clearErrors("num_units");
                      }}
                      error={formErrors.num_units?.message}
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
                      label="Unit Naming*"
                      selectedValue={watch("unit_naming_type")}
                      onChange={(e) =>
                        setValue("unit_naming_type", e.target.value, {
                          shouldDirty: true
                        })
                      }
                      name="unit_naming_type"
                    />
                  </div>
                  <div className="w-full md:w-1/2 login-field flex flex-col">
                    <div className="hidden md:block my-3 text-left" style={{ height: '24px' }}></div>
                    <div className="flex items-center" style={{ minHeight: '48px' }}>
                      <CheckboxComponent
                        label="Add Tower Number to Unit Name"
                        checked={watch("add_tower_number_to_unit_name")}
                        onChange={(e) =>
                          setValue(
                            "add_tower_number_to_unit_name",
                            e.target.checked,
                            { shouldDirty: true }
                          )
                        }
                        name="add_tower_number_to_unit_name"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="w-full md:w-[40%] px-2 md:px-5 md:border-l-[#F9F9FB] md:border-l-[4px] mt-6 md:mt-0">
                <div className="w-full pl-0 md:pl-5">
                  <Paragraph className="my-3 text-sm font-medium">
                    Unit*
                  </Paragraph>
                  <RadioComponent
                    options={[
                      {
                        label: "Same as Every Floor",
                        value: "Same as Every Floor"
                      },
                      { label: "Different", value: "Different" }
                    ]}
                    // selectedValue={unitsPerFloor}
                    selectedValue={watch("units_per_floor")}
                    onChange={(e) => handleUnitTypeChange(e.target.value)}
                    name="units_per_floor"
                  />
                </div>
                {unitsPerFloor === "Different" && (
                  <>
                    <div className="flex flex-col gap-4 mt-4 pl-0 md:pl-2">
                      <button
                        type="button"
                        onClick={() => {
                          addFloorEdit();
                          setValue(
                            "floors",
                            [...floorEdits, { floor: "", units: "" }],
                            { shouldDirty: true }
                          );
                        }}
                        className="flex justify-center items-center w-10 h-10 rounded-full bg-surfaceTeal hover:bg-gray-300 transition-all"
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
                            {/* Floor Number Input */}
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
                                  setValue("floors", [...floorEdits], {
                                    shouldDirty: true
                                  });
                                  clearErrors(`floor_edit_${index}`); // ✅ Clears validation error when valid input is entered
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
                                  setValue("floors", [...floorEdits], {
                                    shouldDirty: true
                                  });
                                  clearErrors(`units_edit_${index}`); // ✅ Clears validation error when valid input is entered
                                }}
                                error={floorEditErrors[index]?.units}
                              />
                            </div>

                            {/* Remove Button */}
                            <div className="flex items-center pb-1">
                              <button
                                type="button"
                                onClick={() => {
                                  removeFloorEdit(index);
                                  setValue("floors", [...floorEdits], {
                                    shouldDirty: true
                                  });
                                }}
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

                <div className="w-full overflow-hidden mt-4">
                  <DynamicTowerTable
                    num_floors={watch("num_floors") || 0}
                    num_units={watch("num_units") || 0}
                    unit_naming_type={
                      watch("unit_naming_type") || "Numerical"
                    }
                    add_tower_number_to_unit_name={
                      watch("add_tower_number_to_unit_name") || false
                    }
                    tower_number={watch("tower_number") || 1}
                    units_per_floor={
                      watch("units_per_floor") || "Same as Every Floor"
                    }
                    floorEdits={floorEdits} // Ensure updated floor edits are passed
                  />
                </div>
              </div>
            </div>
          </form>
        </section>
      </div>
    </PageContainer>
  );
};

export default EditTower;
