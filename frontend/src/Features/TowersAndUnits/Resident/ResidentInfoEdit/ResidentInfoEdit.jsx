import React, { useEffect, useState, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { useDispatch, useSelector } from "react-redux";
import NumberInputComponent from "../../../../Components/FormComponent/NumberInputComponent";
import SelectComponent from "../../../../Components/FormComponent/SelectComponent";
import MultipleImageDropzoneResidentEdit from "../Components/MultipleImageDropzoneResidentEdit";
import SubmitButton from "../../../../Components/FormComponent/ButtonComponent/SubmitButton";
import { useNavigate, useParams } from "react-router-dom";
import {
  fetchResidentDetails,
  updateResident
} from "../../../../redux/slices/residents/residentSlice";
import MessageBox from "../../../../Components/MessageBox/MessageBox";
import ArrowHeading from "../../../../Components/HeadingComponent/ArrowHeading";
import PageContainer from "../../../../Components/Ui/PageContainer";
import _ from "lodash";
import { fetchMemberById } from "../../../../redux/slices/api/memberApi";
import { checkPermission } from "../../../../utils/permissionUtils";
import { BiArrowBack } from "react-icons/bi";
import ModernLoadingAnimation from "../../../../Components/Loaders/ModernLoadingAnimation";

const ResidentInfoEdit = () => {
  const { residentId, unitId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  // console.log(residentId,unitId)
  const { residentDetails } = useSelector((state) => state.resident);

  const { control, handleSubmit, setValue, watch, reset } = useForm({
    defaultValues: {
      is_resident_or_tenant: true,
      unit_rent_fee: 0,
      advance_payment: 0,
      notice_period: 0,
      docs: [],
      member: {}
    }
  });

  // Local state for message handling
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Track initial values and changes
  const initialValuesRef = useRef(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Backend base URL to prefix file paths
  const baseURL = import.meta.env.VITE_BASE_API || "http://127.0.0.1:8000";

  // Permission state
  const [hasPermission, setHasPermission] = useState(false);
  const [loadingPermission, setLoadingPermission] = useState(true);

  useEffect(() => {
    const fetchPermission = async () => {
      const permissionGranted = await checkPermission("org", 20);
      setHasPermission(permissionGranted);
      setLoadingPermission(false);
    };
    fetchPermission();
  }, []);

  useEffect(() => {
    if (residentId) {
      dispatch(
        fetchResidentDetails({
          unitId: unitId || 0,
          // unitId: residentDetails?.unit || 0,
          residentId
        })
      );
    }
  }, [dispatch, residentId]);

  useEffect(() => {
    if (residentDetails) {
      const existingDocs =
        residentDetails.resident_docs?.map((doc) => ({
          id: doc.id,
          name: doc.rental_docs.split("/").pop(),
          url: `${baseURL}${doc.rental_docs}`,
          isExisting: true,
          path: doc.rental_docs // Keep the original path for reference
        })) || [];

      const initialValues = {
        is_resident_or_tenant: residentDetails.is_resident_or_tenant,
        unit_rent_fee: residentDetails.unit_rent_fee || 0,
        advance_payment: residentDetails.advance_payment || 0,
        notice_period: residentDetails.notice_period || 0,
        member: residentDetails.member,
        docs: existingDocs
      };

      reset(initialValues);
      initialValuesRef.current = initialValues;
    }
  }, [residentDetails, reset, baseURL]);

  // Watch for form changes
  const formValues = watch();
  useEffect(() => {
    if (initialValuesRef.current) {
      const isChanged = !_.isEqual(formValues, initialValuesRef.current);
      setHasChanges(isChanged);
    }
  }, [formValues]);

  const handleCheckboxChange = (e) => {
    const isChecked = e.target.checked;
    setValue("is_resident_or_tenant", !isChecked);
  };

  const handleFileUpload = (newFiles) => {
    const currentFiles = watch("docs") || [];
    const updatedFiles = [...currentFiles, ...newFiles];
    setValue("docs", updatedFiles);
  };

  const handleFileRemove = (fileToRemove) => {
    const currentFiles = watch("docs") || [];
    const updatedFiles = currentFiles.filter((file) => {
      // For existing files, compare by id
      if (file.isExisting && fileToRemove.isExisting) {
        return file.id !== fileToRemove.id;
      }
      // For new files, compare by uploadId if available, otherwise by name and size
      if (!file.isExisting && !fileToRemove.isExisting) {
        if (file.uploadId && fileToRemove.uploadId) {
          return file.uploadId !== fileToRemove.uploadId;
        }
        // Fallback to name and size comparison
        return file.name !== fileToRemove.name || file.size !== fileToRemove.size;
      }
      // Mixed case: one is existing, one is not - keep the file
      return true;
    });
    setValue("docs", updatedFiles, { shouldDirty: true });
  };

  const onSubmit = (data) => {
    const { is_resident_or_tenant } = data;
    console.log(data, "datahasan");
    // 1) Zero out tenant‑only fields when it's a resident
    const unit_rent_fee = is_resident_or_tenant ? 0 : data.unit_rent_fee || 0;
    const advance_payment = is_resident_or_tenant
      ? 0
      : data.advance_payment || 0;
    const notice_period = is_resident_or_tenant ? 0 : data.notice_period || 0;

    const formData = new FormData();
    formData.append("is_resident_or_tenant", data.is_resident_or_tenant);
    formData.append("unit_rent_fee", unit_rent_fee);
    formData.append("advance_payment", advance_payment);
    formData.append("notice_period", notice_period);

    // 2) If member exists, include it
    if (data.member) {
      formData.append("member", JSON.stringify(data.member));
    }

    // 3) Handle docs removal/append
    const initialDocIds =
      residentDetails.resident_docs?.map((doc) => doc.id) || [];

    if (is_resident_or_tenant) {
      // User is a resident: remove *all* existing docs
      if (initialDocIds.length > 0) {
        formData.append("removed_doc_ids", JSON.stringify(initialDocIds));
      }
    } else {
      // User is a tenant: figure out which to remove vs keep, and append any new ones
      const existingDocs = data.docs.filter((file) => file.isExisting);
      const remainingDocIds = existingDocs.map((doc) => doc.id);

      const removedDocIds = initialDocIds.filter(
        (id) => !remainingDocIds.includes(id)
      );
      if (removedDocIds.length > 0) {
        formData.append("removed_doc_ids", JSON.stringify(removedDocIds));
      }

      // Append newly uploaded files
      data.docs.forEach((file) => {
        if (!file.isExisting) {
          formData.append("docs", file);
        }
      });
    }

    dispatch(updateResident({ residentId, formData }))
      .unwrap()
      .then((res) => {
        console.log("Resident updated:", res);
        setMessage("Resident updated successfully.");
        setError("");

        initialValuesRef.current = data;
        setHasChanges(false);

        if (data.member?.id) {
          dispatch(fetchMemberById(data.member.id));
        }
      })
      .catch((err) => {
        console.error("Update failed:", err);
        setError("Update failed. Please try again.");
        setMessage("");
      });
  };

  const isResidentOrTenant = watch("is_resident_or_tenant");

  if (loadingPermission) return <ModernLoadingAnimation className="min-h-screen" />;
  if (!hasPermission) {
    navigate("/not-authorized");
    return null;
  }

  return (
    <PageContainer className="min-h-screen bg-surfaceMuted">
      <MessageBox
        message={message}
        error={error}
        clearMessage={() => {
          setMessage("");
          setError("");
        }}
        onOk={() => navigate(-1)}
      />

      <div className="sticky top-0 z-20 mb-3 flex items-center gap-3 bg-surfaceMuted/95 py-4 backdrop-blur">
        <div
          onClick={() => navigate(-1)}
          className="inline-flex cursor-pointer items-center gap-3 text-[#0F172A] transition-colors hover:text-primary"
        >
          <ArrowHeading title="Resident Information" size="2xl" color="text-black" />
        </div>
      </div>

      <div className="max-h-[calc(100vh-180px)] overflow-y-auto">
        <section className="mt-2 max-w-3xl w-full rounded-[32px] border border-borderLight bg-white px-8 py-10">
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="relative"
          >
        {/* Back Button */}

        <p className="py-3">Status</p>
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={!isResidentOrTenant}
            onChange={handleCheckboxChange}
            className="mr-3 accent-primary w-6 h-6"
          />
          <span>Resident is also a tenant</span>
        </label>

        {!isResidentOrTenant && (
          <div>
            <p className="py-3">Tenant Information</p>
            <div className="mb-2 flex flex-col md:flex-row gap-4 items-start">
              <div style={{ width: '220px', flexShrink: 0 }}>
                <Controller
                  name="unit_rent_fee"
                  control={control}
                  render={({ field }) => (
                    <NumberInputComponent
                      {...field}
                      label="Unit Rent Fee"
                      placeholder="Unit Rent Fee"
                      width="100%"
                    />
                  )}
                />
              </div>
              <div style={{ width: '220px', flexShrink: 0 }}>
                <Controller
                  name="advance_payment"
                  control={control}
                  render={({ field }) => (
                    <NumberInputComponent
                      {...field}
                      label="Advance Payment"
                      placeholder="Advance Payment"
                      width="100%"
                    />
                  )}
                />
              </div>
              <div style={{ width: '220px', flexShrink: 0 }}>
                <Controller
                  name="notice_period"
                  control={control}
                  render={({ field }) => (
                    <SelectComponent
                      {...field}
                      options={[
                        { value: "", label: "Select Months", disabled: true },
                        ...Array.from({ length: 12 }, (_, i) => ({
                          value: i + 1,
                          label: `${i + 1} Months`
                        }))
                      ]}
                      label="Notice Period"
                      width="100%"
                    />
                  )}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2">
              <div>
                <p className="py-3">Upload Rental Document (Image or PDF)</p>
                <Controller
                  name="docs"
                  control={control}
                  render={({ field: { value } }) => (
                    <MultipleImageDropzoneResidentEdit
                      onUpload={handleFileUpload}
                      onRemove={handleFileRemove}
                      initialFiles={value}
                    />
                  )}
                />
              </div>
            </div>
          </div>
        )}

        <SubmitButton text="Update" width="full" disabled={!hasChanges} />
          </form>
        </section>
      </div>
    </PageContainer>
  );
};

export default ResidentInfoEdit;
