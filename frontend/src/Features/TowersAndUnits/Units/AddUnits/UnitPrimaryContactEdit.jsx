import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { FaRegClock } from "react-icons/fa";
import { useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import ArrowHeading from "../../../../Components/HeadingComponent/ArrowHeading";
import PageContainer from "../../../../Components/Ui/PageContainer";
import UnitTowerInfo from "../../UnitDetails/components/UnitTowerInfo";
import {
  unitDetails,
  addExistingContact,
  unitUpdate
} from "../../../../redux/slices/units/unitSlice";
import AddUnitContactModal from "./AddUnitContactModal";
import MessageBox from "../../../../Components/MessageBox/MessageBox";
import UnitPrimaryContactEditForm from "./UnitPrimaryContactEditForm";
import { checkPermission } from "utils/permissionUtils";

const UnitPrimaryContactEdit = () => {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [hasPermission, setHasPermission] = useState(false);
  const [loadingPermission, setLoadingPermission] = useState(true);

  const { selectedUnitDetails } = useSelector((state) => state.unit);
  const [showSuccess, setShowSuccess] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isDirty }
  } = useForm();

  useEffect(() => {
    const fetchPermission = async () => {
      const permissionGranted = await checkPermission("org", 14);
      setHasPermission(permissionGranted);
      setLoadingPermission(false);
    };
    fetchPermission();
  }, []);

  useEffect(() => {
    if (!loadingPermission && !hasPermission) {
      navigate("/not-authorized");
    }
  }, [loadingPermission, hasPermission, navigate]);

  useEffect(() => {
    if (id) {
      dispatch(unitDetails(id));
      dispatch(addExistingContact(id));
    }
  }, [id, dispatch]);

  useEffect(() => {
    if (selectedUnitDetails && selectedUnitDetails.id) {
      reset({
        primary_name: selectedUnitDetails.primary_name || "",
        primary_number: selectedUnitDetails.primary_number || "",
        primary_email: selectedUnitDetails.primary_email || "",
        primary_relationship: selectedUnitDetails.primary_relationship || ""
      });
    }
  }, [selectedUnitDetails, reset]);

  const handleContactSelect = (contact) => {
    setValue("primary_name", contact.full_name, { shouldDirty: true });
    setValue("primary_number", contact.general_contact, {
      shouldDirty: true
    });
    setValue("primary_email", contact.general_email, { shouldDirty: true });
    setShowModal(false);
  };

  const onSubmit = async (data) => {
    const formData = new FormData();
    
    // Only include primary contact fields
    if (data.primary_name) formData.append("primary_name", data.primary_name);
    if (data.primary_number) formData.append("primary_number", data.primary_number);
    if (data.primary_email) formData.append("primary_email", data.primary_email);
    if (data.primary_relationship) formData.append("primary_relationship", data.primary_relationship);

    try {
      await dispatch(unitUpdate({ id, data: formData })).unwrap();
      setMessage("Primary Contact has been successfully updated.");
      setShowSuccess(true);
    } catch (err) {
      setError(err.message || "Failed to update primary contact.");
    }
  };

  const handleOk = () => {
    navigate(`/unit-details/${id}?tab=5`);
  };

  if (loadingPermission) {
    return null;
  }

  if (!hasPermission) {
    return null;
  }

  return (
    <PageContainer className="bg-surfaceMuted">
      <AddUnitContactModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSelect={handleContactSelect}
        unitId={id}
        contactType="primary"
      />

      <MessageBox
        message={message}
        error={error}
        clearMessage={() => setShowSuccess(false)}
        onOk={handleOk}
      />

      <div className="sticky top-0 z-20 mb-1.5 flex items-center justify-between gap-3 bg-surfaceMuted/95 py-4 backdrop-blur">
        <div
          onClick={() => navigate(`/unit-details/${id}?tab=5`)}
          className="inline-flex cursor-pointer items-center gap-3 text-ink transition-colors hover:text-primary"
        >
          <ArrowHeading title="Edit Primary Contact" size="2xl" color="text-black" />
        </div>
        <div className="flex items-center gap-6">
          <button
            className="flex flex-row justify-center items-center gap-1.5 w-[106px] h-12 p-4 bg-primary text-white rounded-lg text-base font-medium leading-[140%]"
            style={{
              boxShadow: 'inset 0px 7px 12px rgba(255, 255, 255, 0.08), inset 0px -2px 2px rgba(48, 48, 48, 0.1)'
            }}
            onClick={() => navigate(`/unit-history/${id}`)}
          >
            <FaRegClock className="w-4 h-4" />
            History
          </button>
        </div>
      </div>

      <section className="mx-auto w-full rounded-[32px] border border-borderLight bg-white px-8 py-10">
        <div className="flex flex-col md:flex-row">
          <UnitTowerInfo id={id} />
          <div className="hidden md:block w-px bg-borderLight" />
          <UnitPrimaryContactEditForm
            selectedUnitDetails={selectedUnitDetails}
            onSubmit={onSubmit}
            showModal={showModal}
            setShowModal={setShowModal}
            register={register}
            handleSubmit={handleSubmit}
            setValue={setValue}
            errors={errors}
            isDirty={isDirty}
          />
        </div>
      </section>
    </PageContainer>
  );
};

export default UnitPrimaryContactEdit;
