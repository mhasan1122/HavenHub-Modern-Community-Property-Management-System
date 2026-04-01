import { useEffect, useMemo, useRef, useState } from "react";

import ConfirmationMessageBox from "../../Components/MessageBox/ConfirmationMessageBox";
import ModernLoadingAnimation from "../../Components/Loaders/ModernLoadingAnimation";
import TableSkeleton from "../../Components/Loaders/TableSkeleton";
import useSkeletonLoading from "../../hooks/useSkeletonLoading";
import { SKELETON_MIN_DISPLAY_TIME } from "../../config/skeletonLoadingConfig";
import MessageBox from "../../Components/MessageBox/MessageBox";
import PageContainer from "../../Components/Ui/PageContainer";
import ContentBox from "../../Components/Ui/ContentBox";

import ContactForm from "./components/ContactForm";
import ContactTable from "./components/ContactTable";
import useImportantContacts from "./hooks/useImportantContacts";
import {
  buildContactPayload
} from "./utils/contactHelpers";
import { CONTACT_FORM_DEFAULT_VALUES } from "./utils/contactValidationSchema";

const ImportantContacts = () => {
  const {
    items,
    isLoading,
    error,
    createStatus,
    createError,
    deleteStatus,
    deleteError,
    lastMessage,
    createContact,
    removeContact,
    resetMutations
  } = useImportantContacts();

  const [modalMessage, setModalMessage] = useState({
    message: "",
    error: ""
  });
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [formVersion, setFormVersion] = useState(0);
  const [contactPendingDeletion, setContactPendingDeletion] = useState(null);
  const statusTrackerRef = useRef({
    createStatus: createStatus,
    deleteStatus: deleteStatus
  });

  const formInitialValues = useMemo(() => {
    return { ...CONTACT_FORM_DEFAULT_VALUES };
  }, []);

  const sortedContacts = useMemo(() => {
    return [...items].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [items]);

  const formIsSubmitting = createStatus === "loading";

  const handleFormSubmit = (values) => {
    if (formIsSubmitting) {
      return;
    }
    createContact(buildContactPayload(values));
  };

  const handleDeleteContact = (contact) => {
    if (!contact) {
      return;
    }
    setContactPendingDeletion(contact);
  };

  const handleConfirmDelete = () => {
    if (!contactPendingDeletion) {
      return;
    }
    setPendingDeleteId(contactPendingDeletion.id);
    removeContact(contactPendingDeletion.id);
  };

  const handleCancelDelete = () => {
    setContactPendingDeletion(null);
  };

  const shouldShowMutationLoader =
    createStatus === "loading" ||
    deleteStatus === "loading";

  // Use skeleton loading hook to ensure minimum display time and data validation
  const showSkeleton = useSkeletonLoading(
    isLoading,
    items,
    SKELETON_MIN_DISPLAY_TIME
  );

  useEffect(() => {
    const previousStatuses = statusTrackerRef.current;
    const nextStatuses = {
      createStatus,
      deleteStatus
    };

    const showSuccessMessage = (message) => {
      setModalMessage({
        message: message || "Action completed successfully.",
        error: ""
      });
    };

    const showErrorMessage = (errorMessage) => {
      if (!errorMessage) {
        return;
      }
      setModalMessage({
        message: "",
        error: errorMessage
      });
    };

    if (previousStatuses.createStatus !== createStatus) {
      if (createStatus === "succeeded") {
        setFormVersion((prev) => prev + 1);
        showSuccessMessage(lastMessage || "Contact added successfully.");
      } else if (createStatus === "failed") {
        showErrorMessage(createError);
      }
    }

    if (previousStatuses.deleteStatus !== deleteStatus) {
      if (deleteStatus === "succeeded") {
        setPendingDeleteId(null);
        setContactPendingDeletion(null);
        showSuccessMessage(lastMessage || "Contact deleted successfully.");
      } else if (deleteStatus === "failed") {
        setPendingDeleteId(null);
        setContactPendingDeletion(null);
        showErrorMessage(deleteError);
      }
    }

    statusTrackerRef.current = nextStatuses;
  }, [
    createStatus,
    deleteStatus,
    createError,
    deleteError,
    lastMessage
  ]);

  const handleClearMessage = () => {
    setModalMessage({ message: "", error: "" });
    resetMutations();
  };

  return (
    <div>
      <PageContainer>
        <ContentBox>
          {shouldShowMutationLoader && (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
              <ModernLoadingAnimation />
            </div>
          )}

          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center py-2 sm:py-3 lg:py-4 mb-2 sm:mb-3 lg:mb-4 gap-3 sm:gap-4 lg:gap-0">
            <h1 className="text-xl font-semibold text-gray-900">
              Important Contacts
            </h1>
          </div>

          {/* Main Content */}
          <div className="flex flex-col">
            <div className="space-y-6">
              <div className="rounded-lg border border-gray-100 bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-xl font-semibold text-gray-800">
                  Add Contact
                </h2>
                <ContactForm
                  key={formVersion}
                  mode="create"
                  initialValues={formInitialValues}
                  onSubmit={handleFormSubmit}
                  isSubmitting={formIsSubmitting}
                  existingContacts={sortedContacts}
                />
              </div>

              <div className="rounded-lg border border-gray-100 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-800">
                    Important Contacts List
                  </h2>
                </div>

                {error && (
                  <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                    {error}
                  </div>
                )}

                {showSkeleton ? (
                  <div className="flex justify-center items-center py-12">
                    <TableSkeleton rows={10} columns={7} />
                  </div>
                ) : (
                  <ContactTable
                    contacts={sortedContacts}
                    isLoading={false}
                    onDelete={handleDeleteContact}
                    pendingDeleteId={
                      deleteStatus === "loading" ? pendingDeleteId : undefined
                    }
                  />
                )}
              </div>
            </div>
          </div>

          <MessageBox
            message={modalMessage.message}
            error={modalMessage.error}
            clearMessage={handleClearMessage}
          />

          {contactPendingDeletion && (
            <ConfirmationMessageBox
              message={`Are you sure you want to delete ${contactPendingDeletion.name}?`}
              onConfirm={handleConfirmDelete}
              onCancel={handleCancelDelete}
            />
          )}
        </ContentBox>
      </PageContainer>
    </div>
  );
};

export default ImportantContacts;
