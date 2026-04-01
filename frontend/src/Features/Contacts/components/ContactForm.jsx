import PropTypes from "prop-types";
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Controller, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { RxCross2 } from "react-icons/rx";
import { useDispatch, useSelector } from "react-redux";
import { fetchMembers } from "../../../redux/slices/api/memberApi";

import TextInputComponent from "../../../Components/FormComponent/TextInputComponent";
import SubmitButton from "../../../Components/FormComponent/ButtonComponent/SubmitButton";
import Button from "../../../Components/FormComponent/ButtonComponent/Button";
import SingleImageUpload from "../../../utils/SingleImageUpload";
import ErrorMessage from "../../../Components/MessageBox/ErrorMessage";
import userPlaceholder from "../../../assets/user/user.png";

import {
  CONTACT_FORM_DEFAULT_VALUES,
  contactValidationSchema,
} from "../utils/contactValidationSchema";
import { urlToFile } from "../utils/contactHelpers";

const ContactForm = ({
  mode = "create",
  initialValues = CONTACT_FORM_DEFAULT_VALUES,
  onSubmit,
  onCancel,
  isSubmitting = false,
  existingContacts = [],
}) => {
  const isEditMode = mode === "edit";
  const submitLabel = isEditMode ? "Update Contact" : "Add Contact";
  const submittingLabel = isEditMode ? "Updating..." : "Saving...";

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isValid, isDirty },
  } = useForm({
    mode: "onChange",
    resolver: yupResolver(contactValidationSchema),
    defaultValues: initialValues,
  });

  const photoFileInputRef = useRef(null);
  const nameInputRef = useRef(null);
  const dropdownRef = useRef(null);
  const photoValue = watch("photo");
  const memberValue = watch("member");
  const nameValue = watch("name");
  const [photoUploadError, setPhotoUploadError] = useState("");
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [memberSearchTerm, setMemberSearchTerm] = useState("");
  const [duplicateError, setDuplicateError] = useState("");
  const dispatch = useDispatch();
  const memberState = useSelector((state) => state.member || {});
  const members = useMemo(() => {
    return Array.isArray(memberState.members) ? memberState.members : [];
  }, [memberState.members]);
  const membersLoading = memberState.loading || false;

  useEffect(() => {
    reset(initialValues);
    setPhotoUploadError("");
  }, [initialValues, reset]);

  // Fetch members when component mounts
  useEffect(() => {
    dispatch(fetchMembers({ search: '' }));
  }, [dispatch]);

  // Filter organization members based on search term and exclude already added members
  const filteredMembers = useMemo(() => {
    if (!Array.isArray(members)) return [];
    
    // Get list of member IDs that are already added as contacts (check both org_member and member for compatibility)
    const existingMemberIds = Array.isArray(existingContacts)
      ? existingContacts.map(contact => contact.org_member || contact.member).filter(Boolean)
      : [];
    
    return members.filter(member =>
      member?.full_name?.toLowerCase().includes(memberSearchTerm.toLowerCase()) &&
      member?.is_org_member === true &&
      !existingMemberIds.includes(member.id)
    );
  }, [members, memberSearchTerm, existingContacts]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
          nameInputRef.current && !nameInputRef.current.contains(event.target)) {
        setShowMemberDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Check for duplicate member - memoized to avoid dependency issues
  const checkDuplicate = useCallback((memberId) => {
    if (!memberId || !Array.isArray(existingContacts)) {
      return false;
    }
    // Check both org_member and member for compatibility
    return existingContacts.some(contact => 
      (contact.org_member === memberId) || (contact.member === memberId)
    );
  }, [existingContacts]);

  // Handle member selection from dropdown
  const handleMemberSelect = (member) => {
    // Check for duplicate before selecting
    if (checkDuplicate(member.id)) {
      setDuplicateError(`This member (${member.full_name}) is already added as an important contact.`);
      setShowMemberDropdown(false);
      setMemberSearchTerm("");
      return;
    }
    
    setDuplicateError("");
    setValue("name", member.full_name || "", { shouldValidate: true, shouldDirty: true });
    setValue("member", member.id, { shouldValidate: true, shouldDirty: true });
    setShowMemberDropdown(false);
    setMemberSearchTerm("");
  };

  // Handle name input change
  const handleNameChange = (value) => {
    setValue("name", value, { shouldValidate: true, shouldDirty: true });
    setMemberSearchTerm(value);
    setDuplicateError(""); // Clear duplicate error when typing
    if (value && value.length > 0) {
      setShowMemberDropdown(true);
      // Fetch members with search term
      dispatch(fetchMembers({ search: value }));
    } else {
      setShowMemberDropdown(false);
      setValue("member", null, { shouldValidate: true, shouldDirty: true });
    }
  };

  // Check for duplicate when member value changes
  useEffect(() => {
    if (memberValue) {
      if (checkDuplicate(memberValue)) {
        const selectedMember = members.find(m => m?.id === memberValue);
        if (selectedMember) {
          setDuplicateError(`This member (${selectedMember.full_name}) is already added as an important contact.`);
        } else {
          setDuplicateError("This member is already added as an important contact.");
        }
      } else {
        setDuplicateError("");
      }
    } else {
      setDuplicateError("");
    }
  }, [memberValue, checkDuplicate, members]);

  // Auto-fill contact details when a member is selected
  useEffect(() => {
    if (memberValue && Array.isArray(members) && members.length > 0) {
      const selectedMember = members.find(m => m?.id === memberValue);
      if (selectedMember) {
        const currentEmail = watch("email");
        const currentPhone = watch("phoneNumber");
        const currentDesignation = watch("designation");
        const currentPhoto = watch("photo");
        
        // Auto-fill email if empty
        if (!currentEmail || currentEmail.trim() === "") {
          setValue("email", selectedMember.general_email || "", { shouldValidate: true, shouldDirty: true });
        }
        // Auto-fill phone if empty
        if (!currentPhone || currentPhone.trim() === "") {
          setValue("phoneNumber", selectedMember.phone_number || selectedMember.general_contact || "", { shouldValidate: true, shouldDirty: true });
        }
        // Auto-fill designation with organization member type
        if (!currentDesignation || currentDesignation.trim() === "") {
          let designation = "";
          // Prioritize member type name for organization members
          if (selectedMember.member_type_name) {
            designation = selectedMember.member_type_name;
          } else if (selectedMember.member_roles && selectedMember.member_roles.length > 0) {
            // Fallback to first role name if member type is not available
            designation = selectedMember.member_roles[0].role_name || "";
          } else if (selectedMember.occupation) {
            // Fallback to occupation if neither member type nor role is available
            designation = selectedMember.occupation;
          }
          if (designation) {
            setValue("designation", designation, { shouldValidate: true, shouldDirty: true });
          }
        }
        // Auto-fill photo if empty
        if (!currentPhoto) {
          // Use photo_low_quality or photo URL if available
          const photoUrl = selectedMember.photo_low_quality || selectedMember.photo;
          if (photoUrl) {
            // Ensure it's a full URL
            const fullPhotoUrl = photoUrl.startsWith("http") 
              ? photoUrl 
              : `${import.meta.env.VITE_BASE_API || "http://127.0.0.1:8000"}${photoUrl}`;
            
            // Convert URL to File object for form submission
            urlToFile(fullPhotoUrl, `member-${selectedMember.id}-photo.jpg`)
              .then((file) => {
                if (file) {
                  setValue("photo", file, { shouldValidate: true, shouldDirty: true });
                } else {
                  // Fallback: use URL string if conversion fails
                  setValue("photo", fullPhotoUrl, { shouldValidate: true, shouldDirty: true });
                }
              })
              .catch((error) => {
                console.error("Error loading member photo:", error);
                // Fallback: use URL string if conversion fails
                setValue("photo", fullPhotoUrl, { shouldValidate: true, shouldDirty: true });
              });
          }
        }
      }
    }
  }, [memberValue, members, setValue, watch]);

  const handleFormSubmit = (values) => {
    if (isSubmitting) {
      return;
    }
    
    // Final duplicate check before submission
    if (values.member && checkDuplicate(values.member)) {
      const selectedMember = members.find(m => m?.id === values.member);
      setDuplicateError(`This member (${selectedMember?.full_name || 'selected member'}) is already added as an important contact.`);
      return;
    }
    
    const sanitizedValues = {
      name: values.name?.trim() ?? "",
      phoneNumber: values.phoneNumber?.trim() ?? "",
      email: values.email?.trim() ?? "",
      designation: values.designation?.trim() ?? "",
      photo: values.photo ?? null,
      member: values.member ?? null,
    };
    onSubmit?.(sanitizedValues);
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setPhotoUploadError("");
      return;
    }

    // Clear any previous errors
    setPhotoUploadError("");

    // Validate file type
    const validTypes = ["image/jpeg", "image/jpg", "image/png"];
    if (!validTypes.includes(file.type)) {
      setValue("photo", null, { shouldValidate: true });
      if (photoFileInputRef.current) {
        photoFileInputRef.current.value = "";
      }
      setPhotoUploadError("Only JPG, JPEG, and PNG files are allowed.");
      return;
    }

    // Validate file size (5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setValue("photo", null, { shouldValidate: true });
      if (photoFileInputRef.current) {
        photoFileInputRef.current.value = "";
      }
      setPhotoUploadError("File size must be less than 5MB.");
      return;
    }

    // File is valid, clear any errors and set the value
    setPhotoUploadError("");
    setValue("photo", file, { shouldValidate: true, shouldDirty: true });
  };

  const handleRemovePhoto = () => {
    setValue("photo", null, { shouldValidate: true, shouldDirty: true });
    setPhotoUploadError("");
    if (photoFileInputRef.current) {
      photoFileInputRef.current.value = "";
    }
  };

  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit)}
      className="flex flex-col md:flex-row gap-6"
    >
      {/* Profile Picture Upload Section - Left Side */}
      <div className="w-full md:w-64 flex-shrink-0">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Profile Picture
        </label>
        <div className="flex flex-col items-center gap-4 p-6 border border-dashed border-gray-300 rounded-lg bg-gray-50 opacity-60">
          <div className="relative">
            <div className="w-32 h-32 flex items-center justify-center overflow-hidden rounded-full border-2 border-gray-200 bg-white">
              <SingleImageUpload
                file={photoValue}
                altImg={userPlaceholder}
                customClass="w-full h-full object-cover rounded-full"
              />
            </div>
            {photoValue && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                disabled={true}
                className="absolute top-0 right-0 p-1.5 rounded-full bg-gray-400 text-white cursor-not-allowed transition-colors shadow-lg"
                aria-label="Remove photo"
              >
                <RxCross2 className="w-4 h-4" />
              </button>
            )}
          </div>
          {(errors.photo || photoUploadError) && (
            <ErrorMessage message={photoUploadError || errors.photo?.message} />
          )}
          <div className="w-full">
            <label
              htmlFor="contact-photo-upload"
              className="cursor-not-allowed bg-gray-400 text-white py-2 px-4 rounded-lg w-full block text-center transition-colors"
            >
              {photoValue ? "Change Photo" : "Upload Photo"}
            </label>
            <input
              id="contact-photo-upload"
              ref={photoFileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png"
              className="hidden"
              onChange={handlePhotoChange}
              disabled={true}
            />
            <p className="mt-2 text-xs text-center text-gray-500">
              JPG, JPEG, PNG only. Max 5MB (Disabled)
            </p>
          </div>
        </div>
      </div>

      {/* Form Fields - Right Side */}
      <div className="flex-1 grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Contact Name with Member Search */}
        <div className="md:col-span-1 relative">
          {/* Hidden member field controller */}
          <Controller
            control={control}
            name="member"
            render={({ field }) => {
              return <input type="hidden" {...field} />;
            }}
          />
          <Controller
            control={control}
            name="name"
            render={({ field }) => {
              const { ref, ...fieldProps } = field;
              return (
                <div>
                  <TextInputComponent
                    label="Contact Name"
                    placeholder="Search by organization member name..."
                    error={errors.name?.message || duplicateError}
                    inputRef={(el) => {
                      ref(el);
                      nameInputRef.current = el;
                    }}
                    {...fieldProps}
                    onChange={(e) => {
                      field.onChange(e);
                      handleNameChange(e.target.value);
                    }}
                    onFocus={() => {
                      if (nameValue && nameValue.length > 0) {
                        setShowMemberDropdown(true);
                      }
                    }}
                  />
                  {/* Member Dropdown */}
                  {showMemberDropdown && filteredMembers.length > 0 && (
                    <div
                      ref={dropdownRef}
                      className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-60 overflow-y-auto"
                    >
                      {membersLoading ? (
                        <div className="p-4 text-center text-gray-500">Loading members...</div>
                      ) : (
                        filteredMembers.map((member) => (
                          <div
                            key={member.id}
                            className="px-3 py-2 hover:bg-primary cursor-pointer border-b border-gray-100 last:border-b-0 group"
                            onClick={() => handleMemberSelect(member)}
                          >
                            <div className="flex flex-col">
                              <div className="text-sm font-medium text-gray-900 group-hover:text-white">
                                {member.full_name}
                              </div>
                              {member.general_email && (
                                <div className="text-xs text-gray-500 group-hover:text-white">
                                  {member.general_email}
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Start typing to search organization members (only org members can be added)
                  </p>
                  {duplicateError && (
                    <div className="mt-1">
                      <ErrorMessage message={duplicateError} />
                    </div>
                  )}
                </div>
              );
            }}
          />
        </div>

        <Controller
          control={control}
          name="phoneNumber"
          render={({ field }) => {
            const { ref, ...fieldProps } = field;
            return (
              <div className="md:col-span-1">
                <TextInputComponent
                  label="Phone Number"
                  placeholder="+8801XXXXXXXXX"
                  type="tel"
                  error={errors.phoneNumber?.message}
                  inputRef={ref}
                  disabled={true}
                  {...fieldProps}
                />
              </div>
            );
          }}
        />

        <Controller
          control={control}
          name="email"
          render={({ field }) => {
            const { ref, ...fieldProps } = field;
            return (
              <div className="md:col-span-1">
                <TextInputComponent
                  label="Email Address"
                  placeholder="contact@example.com"
                  type="email"
                  error={errors.email?.message}
                  inputRef={ref}
                  disabled={true}
                  {...fieldProps}
                />
              </div>
            );
          }}
        />

        <Controller
          control={control}
          name="designation"
          render={({ field }) => {
            const { ref, ...fieldProps } = field;
            return (
              <div className="md:col-span-1">
                <TextInputComponent
                  label="Designation"
                  placeholder="e.g. Security Supervisor"
                  error={errors.designation?.message}
                  inputRef={ref}
                  disabled={true}
                  {...fieldProps}
                />
              </div>
            );
          }}
        />

        <div className="flex flex-col items-stretch gap-3 pt-2 md:col-span-2 md:flex-row md:items-center md:justify-end">
          <div className="w-full md:w-auto md:min-w-[160px]">
            <SubmitButton
              text={isSubmitting ? submittingLabel : submitLabel}
              loading={isSubmitting}
              disabled={!isValid || isSubmitting || !isDirty || !!duplicateError}
              width="full"
              className="my-0"
            />
          </div>
          {isEditMode && (
            <div className="w-full md:w-auto md:min-w-[160px] flex items-center">
              <Button
                size="medium"
                variant="black"
                onClick={onCancel}
                disabled={isSubmitting}
                className="justify-center"
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>
    </form>
  );
};

ContactForm.propTypes = {
  mode: PropTypes.oneOf(["create", "edit"]),
  initialValues: PropTypes.shape({
    name: PropTypes.string,
    phoneNumber: PropTypes.string,
    email: PropTypes.string,
    designation: PropTypes.string,
    photo: PropTypes.oneOfType([
      PropTypes.instanceOf(File),
      PropTypes.string,
      PropTypes.oneOf([null]),
    ]),
    member: PropTypes.oneOfType([
      PropTypes.number,
      PropTypes.oneOf([null]),
    ]),
  }),
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func,
  isSubmitting: PropTypes.bool,
  existingContacts: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      member: PropTypes.oneOfType([PropTypes.number, PropTypes.oneOf([null])]),
    })
  ),
};

export default ContactForm;
