import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";

import {
  updateUnitStaffStatus,
  clearMessage,
  setShowMessage
} from "../../../../redux/slices/unitStaff/unitStaffSlice";
import { setActiveTabs } from "../../../../redux/slices/memberSlice";
import MessageBox from "../../../../Components/MessageBox/MessageBox";
import ModernLoadingAnimation from "../../../../Components/Loaders/ModernLoadingAnimation";
import { checkPermission } from "../../../../utils/permissionUtils";
import ArrowHeading from "../../../../Components/HeadingComponent/ArrowHeading";
import PageContainer from "../../../../Components/Ui/PageContainer";
import SubmitButton from "../../../../Components/FormComponent/ButtonComponent/SubmitButton";

const UnitStaffInformationEdit = () => {
  // Permission state
  const [hasPermission, setHasPermission] = useState(false);
  const [loadingPermission, setLoadingPermission] = useState(true);

  const { staffid, staffstatus } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { message, error, showMessage } = useSelector(
    (state) => state.unitStaff
  );

  const defaultStatus = staffstatus === "true" ? "Live-in" : "Part-time";
  const { register, handleSubmit, watch, reset } = useForm({
    defaultValues: { staffStatus: defaultStatus }
  });
  const selectedStatus = watch("staffStatus");

  useEffect(() => {
    const fetchPermission = async () => {
      const permissionGranted = await checkPermission("org", 23);
      setHasPermission(permissionGranted);
      setLoadingPermission(false);
    };
    fetchPermission();
  }, []);

  useEffect(() => {
    reset({ staffStatus: defaultStatus });
  }, [staffstatus, reset, defaultStatus]);

  if (loadingPermission) return (
    <div className="flex items-center justify-center min-h-screen">
      <ModernLoadingAnimation />
    </div>
  );
  if (!hasPermission) {
    navigate("/not-authorized");
    return null;
  }
  if (!staffid) {
    console.error("staffid is undefined. Check your route.");
    return (
      <div className="flex items-center justify-center min-h-screen">
        <ModernLoadingAnimation />
      </div>
    );
  }

  const onSubmit = async (data) => {
    const nextStatus = data.staffStatus === "Live-in";
    const result = await dispatch(
      updateUnitStaffStatus({ id: staffid, unit_staff_status: nextStatus })
    );

    if (updateUnitStaffStatus.fulfilled.match(result)) {
      // show success
      dispatch(setShowMessage(true));
    } else {
      // show error
      dispatch(setShowMessage(true));
    }
  };

  const handleBack = () => {
    dispatch(setActiveTabs(3));
    navigate(-1);
  };

  return (
    <PageContainer className="min-h-screen bg-surfaceMuted">
      {showMessage && (
        <MessageBox
          message={message}
          error={error}
          clearMessage={() => {
            dispatch(clearMessage());
            dispatch(setShowMessage(false));
          }}
          onOk={() => {
            dispatch(clearMessage());
            dispatch(setShowMessage(false));
            if (!error) {
              dispatch(setActiveTabs(3));
              navigate(-1);
            }
          }}
        />
      )}

      <div className="sticky top-0 z-20 mb-3 flex items-center gap-3 bg-surfaceMuted/95 py-4 backdrop-blur">
        <div
          onClick={handleBack}
          className="inline-flex cursor-pointer items-center gap-3 text-[#0F172A] transition-colors hover:text-primary"
        >
          <ArrowHeading title="Unit Staff Information" size="2xl" color="text-black" />
        </div>
      </div>

      <div className="max-h-[calc(100vh-180px)] overflow-y-auto">
        <section className="mt-2 max-w-xl w-full rounded-[32px] border border-borderLight bg-white px-8 py-10">
          <form onSubmit={handleSubmit(onSubmit)} className="relative">
        <div className="space-y-2 mb-6">
          {["Live-in", "Part-time"].map((status) => (
            <label
              key={status}
              className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${
                selectedStatus === status
                  ? "border-primary "
                  : "border-gray-300 "
              }`}
            >
              <input
                type="radio"
                value={status}
                {...register("staffStatus", { required: true })}
                className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-primary accent-primary"
              />
              <div className="ml-3">
                <span className="block text-sm font-medium text-primary">
                  {status}
                </span>
                {/* <span className="block text-sm text-primary">
                  {status === "Live-in" ? "Full-time staff" : "Scheduled staff"}
                </span> */}
              </div>
            </label>
          ))}
        </div>

            <SubmitButton
              text="Update"
              width="full"
              disabled={selectedStatus === defaultStatus}
            />
          </form>
        </section>
      </div>
    </PageContainer>
  );
};

export default UnitStaffInformationEdit;
