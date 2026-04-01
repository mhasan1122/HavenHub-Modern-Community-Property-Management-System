import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import axiosInstance from "../../../utils/axiosInstance";

import {
  clearVehicleMessages,
  createVehicle,
  updateVehicle,
  fetchVehiclesByUnit,
  toggleVehicleStatus
} from "../../../redux/slices/vehicle/vehicleSlice";

import ModernLoadingAnimation from "../../../Components/Loaders/ModernLoadingAnimation";
import MessageBox from "../../../Components/MessageBox/MessageBox";
import UnitTowerInfo from "../UnitDetails/components/UnitTowerInfo";
import ArrowHeading from "../../../Components/HeadingComponent/ArrowHeading";
import { Heading } from "../../../Components/Ui/Heading";
import ErrorMessage from "../../../Components/MessageBox/ErrorMessage";
import ConfirmationMessageBox from "../../../Components/MessageBox/ConfirmationMessageBox";

const AddVehicle = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const params = useParams();
  const unitId = params.id;
  const vehicleId = params.vehicleId;
  const brandVehicleId = params.brandVehicleId;
    const [initialForm, setInitialForm] = useState(null); 


 
  const { loading, error, successMessage } = useSelector(
    (state) => state.vehicle
  );
  const [validationErrors, setValidationErrors] = useState({});

  const [form, setForm] = useState({
    brand: "",
    color: "",
    license_plate: "",
    vehicle_type: "",
    unit: "",
    unit_id: ""
  });


  useEffect(() => {
    if (vehicleId) {
      axiosInstance
        .get(`/towers/vehicles/${vehicleId}/`)
        .then((res) => {
          const data = res.data?.data;
          if (data) {
            const filledForm = {
              brand: data.brand || "",
              color: data.color || "",
              license_plate: data.license_plate || "",
              vehicle_type: data.vehicle_type || "",
              unit: data.unit || "",
              unit_id: brandVehicleId || "", // ✅ change from unit → unit_id

              status: data.status
            };
            setForm(filledForm);
            setInitialForm(filledForm);
          }
        })
        .catch(console.error);
    }
  }, [vehicleId]);

  useEffect(() => {
    if (!vehicleId) {
      setInitialForm({
        brand: "",
        color: "",
        license_plate: "",
        vehicle_type: "",
        unit: "",
        unit_id: "" 
      });
    }
  }, [vehicleId]);

  // useEffect(() => {
  //   if (successMessage || error) {
  //     const timer = setTimeout(() => {
  //       dispatch(clearVehicleMessages());
  //       if (successMessage) {
  //         dispatch(fetchVehiclesByUnit(unitId));
         
  //       }
  //     }, 1500);
  //     return () => clearTimeout(timer);
  //   }
  // }, [successMessage, error, dispatch, navigate, unitId]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const [showConfirm, setShowConfirm] = useState(false);

const handleSubmit = (e) => {
  e.preventDefault();
  const errors = {};

  if (!form.license_plate || form.license_plate.trim() === "") {
    errors.license_plate = "License plate is required.";
  }

  if (Object.keys(errors).length > 0) {
    setValidationErrors(errors);
    return;
  }

  setValidationErrors({});
  setShowConfirm(true);
};

const handleConfirm = () => {
  setShowConfirm(false);
  const payloadcreate = vehicleId ? form : { ...form, unit_id: unitId };
  const payloadupdate = vehicleId ? form : { ...form, unit_id: brandVehicleId };

  if (vehicleId) {
    dispatch(updateVehicle({ vehicleId, formData: payloadupdate }));
  } else {
    dispatch(createVehicle(payloadcreate));
  }
};


const handleCancel = () => {
  setShowConfirm(false);
};
  const handleToggleStatus = () => {
    dispatch(toggleVehicleStatus(vehicleId)).then((action) => {
      if (action.type.endsWith("fulfilled")) {
        const newStatus = action.payload.status;
        setForm((prev) => ({
          ...prev,
          status: newStatus
        }));
      }
    });
  };

  const fields = [
    [
      { name: "license_plate", label: "License Plate" },
      { name: "brand", label: "Make" }
    ],
    [
      { name: "vehicle_type", label: " Type" },
      { name: "color", label: "Color" }
    ]
  ];

  const hasFormChanged = initialForm
    ? Object.keys(form).some(
        (key) => key !== "status" && form[key] !== initialForm[key]
      )
    : false;


const handleOk = () => {
  dispatch(clearVehicleMessages());
  navigate(`/unit-details/${unitId || brandVehicleId}?tab=5`, {
    replace: true,
  });
};
  return (
    <div className="w-full mx-auto p-4">
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white bg-opacity-75">
          <ModernLoadingAnimation />
        </div>
      )}


      {showConfirm && (
  <ConfirmationMessageBox
    message={
      vehicleId
        ? "Are you sure you want to update this vehicle?"
        : "Are you sure you want to add this vehicle?"
    }
    onConfirm={handleConfirm}
    onCancel={handleCancel}
  />


    )}
    {(successMessage || error) && (
      <MessageBox
        message={successMessage || error}
        error={!!error}
        onOk={handleOk}
      />
    )}
      <div className="md:flex justify-between items-center mb-4">
        <div>
          {" "}
          <ArrowHeading
            title={vehicleId ? "Edit Vehicle" : "Add Vehicle"}
            size="xl"
            color="black"
            onNext={() => navigate(-1)}
            fontWeight="semibold"
          />
        </div>
        <div>
          {" "}
          {vehicleId && (
            <button
              onClick={handleToggleStatus}
              className={`px-4 py-2 rounded ${
                form.status === "active"
                  ? "bg-primary text-white"
                  : "bg-error  text-white"
              }`}
            >
              {form.status === "active" ? "Active" : "Inactive"}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row rounded-xl max-w-[1282px] bg-white">
        {(unitId || brandVehicleId) && (
          <UnitTowerInfo id={unitId || brandVehicleId} />
        )}

        <div className="w-full md:w-3/4 p-6">
          <Heading level={1} className="my-2 text-base font-bold text-primary">
            Vehicle Information
          </Heading>
          <form onSubmit={handleSubmit} className="space-y-4">
            {fields.map((row, rowIdx) => (
              <div key={rowIdx} className="flex gap-4">
                {row.map(({ name, label }) => (
                  <div
                    key={name}
                    className="login-field flex-1"
                    style={{ width: "100%" }}
                  >
                    <label
                      htmlFor={name}
                      className="block mb-1 font-medium text-sm flex items-center gap-1"
                    >
                      {label}
                      {name === "license_plate" && (
                        <span className="text-red-500">*</span> 
                      )}
                    </label>
                    <input
                      type="text"
                      id={name}
                      name={name}
                      value={form[name]}
                      onChange={handleChange}
                      disabled={loading}
                      className={`login-field-input w-full ${
                        loading
                          ? "bg-disabledInput cursor-not-allowed text-black100"
                          : ""
                      }`}
                    />
                    {validationErrors[name] && (
                      <div className="text-sm text-red-500 mt-1">
                        <ErrorMessage message={validationErrors[name]} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}

            <button
              type="submit"
              disabled={loading || !hasFormChanged}
              className={`w-full px-4 py-2 rounded text-white ${
                loading || !hasFormChanged
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-primary"
              }`}
            >
              {loading
                ? "Saving..."
                : vehicleId
                ? "Update Vehicle"
                : "Create Vehicle"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddVehicle;
