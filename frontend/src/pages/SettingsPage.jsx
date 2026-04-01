import React, { useState, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useForm, Controller } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import {
  getCompanySettings,
  updateSettings,
  getCompanyImages,
  uploadImage,
  removeImage,
  clearError,
} from "../redux/slices/companySettingsSlice/companySettingsSlice";
import TextInputComponent from "../Components/FormComponent/TextInputComponent";
import TextareaComponent from "../Components/FormComponent/TextareaComponent";
import MessageBox from "../Components/MessageBox/MessageBox";
import ModernLoadingAnimation from "../Components/Loaders/ModernLoadingAnimation";
import CompanyImageTable from "../Features/CompanySettings/components/CompanyImageTable";
import { checkPermission } from "../utils/permissionUtils";
import { PERMISSIONS } from "../constants/permissions";
// Images upload in original size, displayed at 193.64×50px in header via CSS

const SettingsPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { settings, images, isLoading, isUpdating, isUploading, error } = useSelector(
    (state) => state.companySettings
  );

  const [hasPermission, setHasPermission] = useState(false);
  const [loadingPermission, setLoadingPermission] = useState(true);

  const [modalMessage, setModalMessage] = useState({
    message: "",
    error: ""
  });

  // State for image previews
  const [logoPreview, setLogoPreview] = useState(null);
  const [loginImagePreview, setLoginImagePreview] = useState(null);
  const [pendingLogoFile, setPendingLogoFile] = useState(null);
  const [pendingLoginImageFile, setPendingLoginImageFile] = useState(null);
  
  // State for marking images for deletion
  const [logoMarkedForDeletion, setLogoMarkedForDeletion] = useState(false);
  const [loginImageMarkedForDeletion, setLoginImageMarkedForDeletion] = useState(false);

  const logoFileInputRef = useRef(null);
  const loginImageFileInputRef = useRef(null);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isValid, isDirty },
  } = useForm({
    mode: "onChange",
    defaultValues: {
      company_name: "",
      company_phone: "",
      company_email: "",
      company_address: "",
    },
  });


  useEffect(() => {
    // Check if the user has permission to view company settings
    const checkUserPermissions = async () => {
      const permissionGranted = await checkPermission("org", PERMISSIONS.VIEW_COMPANY_SETTINGS);
      setHasPermission(permissionGranted);
      setLoadingPermission(false);
    };

    checkUserPermissions();
  }, []);

  // Fetch settings and images if the user has permission
  useEffect(() => {
    if (hasPermission) {
      dispatch(getCompanySettings());
      dispatch(getCompanyImages());
    }
  }, [dispatch, hasPermission]);

  // Redirect if no permission
  useEffect(() => {
    if (!loadingPermission && !hasPermission) {
      navigate("/not-authorized");
    }
  }, [hasPermission, loadingPermission, navigate]);

  // Track if we should skip the next reset (to prevent overwriting user's cleared field)
  const skipNextResetRef = useRef(false);

  useEffect(() => {
    if (settings && !skipNextResetRef.current) {
      reset({
        company_name: settings.company_name || "",
        company_phone: settings.company_phone || "",
        company_email: settings.company_email || "",
        company_address: settings.company_address || "",
      });
    }
    // Reset the flag after processing
    if (skipNextResetRef.current) {
      skipNextResetRef.current = false;
    }
  }, [settings, reset]);

  useEffect(() => {
    if (error) {
      setModalMessage({
        message: "",
        error: typeof error === "string" ? error : "An error occurred"
      });
      dispatch(clearError());
    }
  }, [error, dispatch]);


  const handleLogoFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/svg+xml", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setModalMessage({
        message: "",
        error: "Only JPG, JPEG, PNG, SVG, and WEBP files are allowed."
      });
      if (logoFileInputRef.current) {
        logoFileInputRef.current.value = "";
      }
      return;
    }

    // Validate file size (10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setModalMessage({
        message: "",
        error: "Image size must be less than 10MB."
      });
      if (logoFileInputRef.current) {
        logoFileInputRef.current.value = "";
      }
      return;
    }

    // Create preview URL and store file for later upload
    const previewUrl = URL.createObjectURL(file);
    setLogoPreview(previewUrl);
    setPendingLogoFile(file);
  };


  const handleLoginImageFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/svg+xml", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setModalMessage({
        message: "",
        error: "Only JPG, JPEG, PNG, SVG, and WEBP files are allowed."
      });
      if (loginImageFileInputRef.current) {
        loginImageFileInputRef.current.value = "";
      }
      return;
    }

    // Validate file size (10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setModalMessage({
        message: "",
        error: "Image size must be less than 10MB."
      });
      if (loginImageFileInputRef.current) {
        loginImageFileInputRef.current.value = "";
      }
      return;
    }

    // Create preview URL and store file for later upload
    const previewUrl = URL.createObjectURL(file);
    setLoginImagePreview(previewUrl);
    setPendingLoginImageFile(file);
  };


  const handleFormSubmit = async (values) => {
    if (isUpdating) {
      return;
    }

    try {
      // Track if we need to refresh images
      const hasNewImages = !!(pendingLogoFile || pendingLoginImageFile);
      const hasImageDeletions = !!(logoMarkedForDeletion || loginImageMarkedForDeletion);

      // Get current images
      const currentLogoImages = images.filter(img => img.image_type === 'logo');
      const currentLoginImages = images.filter(img => img.image_type === 'login_image');

      // First, update company settings
      const formDataToSend = new FormData();
      // Allow empty string for company_name (user can clear it)
      const companyName = values.company_name?.trim() || "";
      formDataToSend.append("company_name", companyName);
      formDataToSend.append("company_phone", values.company_phone?.trim() || "");
      formDataToSend.append("company_email", values.company_email?.trim() || "");
      formDataToSend.append("company_address", values.company_address?.trim() || "");

      // Set flag to skip reset if company_name was cleared
      skipNextResetRef.current = (companyName === "" && settings?.company_name);

      await dispatch(updateSettings(formDataToSend)).unwrap();

      // Delete logo if marked for deletion
      if (logoMarkedForDeletion && currentLogoImages.length > 0) {
        await dispatch(removeImage(currentLogoImages[0].id)).unwrap();
        setLogoMarkedForDeletion(false);
      }

      // Delete login image if marked for deletion
      if (loginImageMarkedForDeletion && currentLoginImages.length > 0) {
        await dispatch(removeImage(currentLoginImages[0].id)).unwrap();
        setLoginImageMarkedForDeletion(false);
      }

      // Then, upload logo if there's a pending file
      if (pendingLogoFile) {
        const logoFormData = new FormData();
        logoFormData.append("image", pendingLogoFile);
        logoFormData.append("image_type", "logo");
        await dispatch(uploadImage(logoFormData)).unwrap();
        
        // Clear preview and pending file
        setLogoPreview(null);
        setPendingLogoFile(null);
        if (logoFileInputRef.current) {
          logoFileInputRef.current.value = "";
        }
      }

      // Upload login image if there's a pending file
      if (pendingLoginImageFile) {
        const loginImageFormData = new FormData();
        loginImageFormData.append("image", pendingLoginImageFile);
        loginImageFormData.append("image_type", "login_image");
        await dispatch(uploadImage(loginImageFormData)).unwrap();
        
        // Clear preview and pending file
        setLoginImagePreview(null);
        setPendingLoginImageFile(null);
        if (loginImageFileInputRef.current) {
          loginImageFileInputRef.current.value = "";
        }
      }

      // Refresh images if we uploaded new ones or deleted any
      if (hasNewImages || hasImageDeletions) {
        await Promise.all([
          dispatch(getCompanyImages()),
          dispatch(getCompanySettings())
        ]);
      } else {
        // Only refresh settings if we didn't clear company_name
        // If company_name was cleared, the form already has the correct value
        // and we don't want to reset it from the backend
        if (!skipNextResetRef.current) {
          await dispatch(getCompanySettings());
        }
        // If skipNextResetRef is true, we've already updated the form with empty company_name
        // so we don't need to refresh settings (which would reset the form)
      }

      setModalMessage({
        message: "Settings updated successfully!",
        error: ""
      });
    } catch (err) {
      console.error("Error updating settings:", err);
      setModalMessage({
        message: "",
        error: typeof err === "string" ? err : err?.message || "Failed to update settings. Please try again."
      });
    }
  };

  const handleClearMessage = () => {
    setModalMessage({ message: "", error: "" });
  };

  const handleRemoveLogoPreview = () => {
    setLogoPreview(null);
    setPendingLogoFile(null);
    if (logoFileInputRef.current) {
      logoFileInputRef.current.value = "";
    }
  };

  const handleRemoveLoginImagePreview = () => {
    setLoginImagePreview(null);
    setPendingLoginImageFile(null);
    if (loginImageFileInputRef.current) {
      loginImageFileInputRef.current.value = "";
    }
  };

  const handleToggleLogoMarkedForDeletion = () => {
    setLogoMarkedForDeletion(!logoMarkedForDeletion);
  };

  const handleToggleLoginImageMarkedForDeletion = () => {
    setLoginImageMarkedForDeletion(!loginImageMarkedForDeletion);
  };

  const logoImages = images.filter(img => img.image_type === 'logo');
  const loginImages = images.filter(img => img.image_type === 'login_image');

  if (loadingPermission) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <ModernLoadingAnimation />
      </div>
    );
  }

  if (!hasPermission) {
    return null; // Will redirect via useEffect
  }

  if (isLoading && !settings) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <ModernLoadingAnimation />
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {(isUpdating || isUploading) && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
          <ModernLoadingAnimation />
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 p-4 pb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">
            Company Settings
          </h1>
        </div>
      </div>

      {/* Main Content - Scrollable */}
      <div className="flex-1 min-h-0 overflow-hidden px-4 pb-4">
        <div className="h-full rounded-[27px] bg-white flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
            <div className="space-y-6 max-w-7xl mx-auto">
        <div className="rounded-lg border border-gray-100 bg-white p-4 sm:p-6 shadow-sm">
          <h2 className="mb-4 text-lg sm:text-xl font-semibold text-gray-800">
            Company Information
          </h2>
          
          <form onSubmit={handleSubmit(handleFormSubmit)}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Controller
              control={control}
              name="company_name"
              render={({ field }) => {
                const { ref, ...fieldProps } = field;
                return (
                  <div className="md:col-span-1">
                    <TextInputComponent
                      label="Company Name"
                      placeholder="Enter company name"
                      error={errors.company_name?.message}
                      inputRef={ref}
                      {...fieldProps}
                    />
                  </div>
                );
              }}
            />

            <Controller
              control={control}
              name="company_phone"
              render={({ field }) => {
                const { ref, ...fieldProps } = field;
                return (
                  <div className="md:col-span-1">
                    <TextInputComponent
                      label="Company Phone"
                      placeholder="+8801XXXXXXXXX"
                      type="tel"
                      error={errors.company_phone?.message}
                      inputRef={ref}
                      {...fieldProps}
                    />
                  </div>
                );
              }}
            />

            <Controller
              control={control}
              name="company_email"
              render={({ field }) => {
                const { ref, ...fieldProps } = field;
                return (
                  <div className="md:col-span-1">
                    <TextInputComponent
                      label="Company Email"
                      placeholder="contact@example.com"
                      type="email"
                      error={errors.company_email?.message}
                      inputRef={ref}
                      {...fieldProps}
                    />
                  </div>
                );
              }}
            />

            <Controller
              control={control}
              name="company_address"
              render={({ field }) => {
                const { ref, ...fieldProps } = field;
                return (
                  <div className="md:col-span-1">
                    <TextInputComponent
                      label="Company Address"
                      placeholder="Enter company address"
                      error={errors.company_address?.message}
                      inputRef={ref}
                      {...fieldProps}
                    />
                  </div>
                );
              }}
            />
            </div>
          </form>
        </div>

      {/* Image Upload Sections - Side by Side */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Logo Upload Section */}
        <div className="rounded-lg border border-gray-100 bg-white p-4 sm:p-6 shadow-sm">
          <h2 className="mb-4 text-lg sm:text-xl font-semibold text-gray-800">
            Company Logo
          </h2>
          
          <CompanyImageTable
            images={logoImages}
            allImages={images}
            imageType="logo"
            isLoading={isLoading}
            onUploadClick={() => logoFileInputRef.current?.click()}
            previewUrl={logoPreview}
            onRemovePreview={handleRemoveLogoPreview}
            markedForDeletion={logoMarkedForDeletion}
            onMarkForDeletion={handleToggleLogoMarkedForDeletion}
          />
          
          <input
            id="logo-upload"
            ref={logoFileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.svg,.webp"
            className="hidden"
            onChange={handleLogoFileSelect}
          />
        </div>

        {/* Login Page Image Upload Section */}
        <div className="rounded-lg border border-gray-100 bg-white p-4 sm:p-6 shadow-sm">
          <h2 className="mb-4 text-lg sm:text-xl font-semibold text-gray-800">
            Login Page Images
          </h2>
          
          <CompanyImageTable
            images={loginImages}
            allImages={images}
            imageType="login_image"
            isLoading={isLoading}
            onUploadClick={() => loginImageFileInputRef.current?.click()}
            previewUrl={loginImagePreview}
            onRemovePreview={handleRemoveLoginImagePreview}
            markedForDeletion={loginImageMarkedForDeletion}
            onMarkForDeletion={handleToggleLoginImageMarkedForDeletion}
          />
          
          <input
            id="login-image-upload"
            ref={loginImageFileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.svg,.webp"
            className="hidden"
            onChange={handleLoginImageFileSelect}
          />
        </div>
      </div>
            </div>
          </div>
          
          {/* Save Changes Button - Fixed at bottom */}
          <div className="flex-shrink-0 flex justify-end bg-white pt-4 pb-4 px-4 sm:px-6 border-t border-gray-100">
            <div className="w-full sm:w-auto sm:min-w-[160px]">
              <button
                type="button"
                onClick={handleSubmit(handleFormSubmit)}
                disabled={isUpdating || (!isDirty && !pendingLogoFile && !pendingLoginImageFile && !logoMarkedForDeletion && !loginImageMarkedForDeletion)}
                className={`px-4 py-2 font-semibold border border-primary rounded transition-all duration-200
                  w-full sm:w-auto
                  ${isUpdating ? 'bg-primary cursor-not-allowed' : 'bg-primary hover:bg-primary'}
                  ${isUpdating || (!isDirty && !pendingLogoFile && !pendingLoginImageFile && !logoMarkedForDeletion && !loginImageMarkedForDeletion) ? 'opacity-50' : 'opacity-100'}
                  text-white
                `}
              >
                {isUpdating ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <MessageBox
        message={modalMessage.message}
        error={modalMessage.error}
        clearMessage={handleClearMessage}
      />
    </div>
  );
};

export default SettingsPage;
