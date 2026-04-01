import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

import {
  createOwner,
  updateOwner,
  deleteOwner,
  fetchOwnerList,
  clearCreatedMember,
  clearMessage,
  setSuccessMessage,
  CreatememberForUnit,
  clearPendingMemberData,
  clearPendingCompanyData
} from "../../../../redux/slices/owner/ownerSlice";
import { createCompany } from "../../../../redux/slices/api/companyApi";

import {
  clearCreatedCompany,
  clearMessage as clearCompanyMessage
} from "../../../../redux/slices/companySlice";

import {
  ownerValidationSchema,
  getOrdinal,
  formatDate,
  parseOwnerError
} from "../utils/ownerUtils";

import { Paragraph } from "../../../../Components/Ui/Paragraph";
import FileDropzone from "../Components/FileDropzone";
import AddMemberForm from "../Components/Modals/AddMemberForm";
import AddCompany from "../AddCompany/AddCompany";
import MessageBox from "../../../../Components/MessageBox/MessageBox";
import MemberSearchAutocomplete from "../../../../Components/MemberSearchAutocomplete/MemberSearchAutocomplete";
import OwnerTransferFromAutocomplete from "../../../../Components/OwnerTransferFromAutocomplete/OwnerTransferFromAutocomplete";
import { fetchMemberById } from "../../../../redux/slices/api/memberApi";
import { setActiveTabs } from "../../../../redux/slices/memberSlice";
import ModernDatePicker from "../../../../Components/FormComponent/ModernDatePicker";
import PropTypes from "prop-types";

const ChangeOwnerForm = ({ unitId }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const ownerState = useSelector((state) => state.owner);

  const [searchTerms, setSearchTerms] = useState({});
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [docsToDelete, setDocsToDelete] = useState({});
  const changeCompanyData = useSelector((state) => state.company.company_data);
  const [localError, setLocalError] = useState(null);
  const [hasFileChanges, setHasFileChanges] = useState(false);
  const [initialValues, setInitialValues] = useState(null);
  const [transferValidationError, setTransferValidationError] = useState(null);
  const [transferredPercentages, setTransferredPercentages] = useState({});
  const [originalPercentages, setOriginalPercentages] = useState({});
  const [hasTransfers, setHasTransfers] = useState(false);
  const [dateValidationErrors, setDateValidationErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const ownerRefs = useRef([]);

  const {
    control,
    register,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    watch,
    formState: { errors }
  } = useForm({
    resolver: yupResolver(ownerValidationSchema),
    defaultValues: {
      owners: [],
      document: [],
      docLinks: []
    }
  });

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: "owners"
  });

  // Get watched owners - watch function reference changes, so we can't memoize with it
  // Instead, we'll use watch directly where needed
  const owners = watch("owners") || [];

  // Track file changes - use a ref to avoid dependency on watch function
  const watchRef = useRef(watch);
  useEffect(() => {
    watchRef.current = watch;
  });

  useEffect(() => {
    const subscription = watchRef.current((value, { name }) => {
      if (name?.includes("document") || name?.includes("docLinks")) {
        setHasFileChanges(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []); // Empty deps - watchRef is stable

  // Memoize the search terms update effect
  useEffect(() => {
    if (!owners.length) return;

    const newTerms = { ...searchTerms };
    let hasChanges = false;

    owners.forEach((owner, idx) => {
      // Update owner name
      if (owner.memberId) {
        const member = ownerState.ownerList?.owners?.find(
          (o) => o.member.id === owner.memberId
        )?.member;
        if (member && newTerms[idx] !== member.full_name) {
          newTerms[idx] = member.full_name;
          hasChanges = true;
        }
      }

      // Update transfer from name
      if (owner.ownershipTransferFromId) {
        const transferFrom = ownerState.ownerList?.owners?.find(
          (o) => o.member.id === owner.ownershipTransferFromId
        )?.member;
        if (
          transferFrom &&
          newTerms[`from_${idx}`] !== transferFrom.full_name
        ) {
          newTerms[`from_${idx}`] = transferFrom.full_name;
          hasChanges = true;
        }
      }
    });

    if (hasChanges) {
      setSearchTerms(newTerms);
    }
  }, [owners, ownerState.ownerList, searchTerms]);

  // Add this effect to handle ownership transfer changes
  useEffect(() => {
    const subscription = watch((value, { name }) => {
      if (name?.includes("ownershipTransferFromId")) {
        const index = parseInt(name.split(".")[1]);
        const transferFromId = watch(`owners.${index}.ownershipTransferFromId`);

        if (transferFromId) {
          const transferFrom = ownerState.ownerList?.owners?.find(
            (o) => o.member.id === transferFromId
          )?.member;

          if (transferFrom) {
            setSearchTerms((prev) => ({
              ...prev,
              [`from_${index}`]: transferFrom.full_name
            }));
          }

          // Re-validate the date when transfer-from owner changes
          const currentDate = watch(`owners.${index}.dateofOwnership`);
          if (currentDate) {
            const transferFromOwner = ownerState.ownerList?.owners?.find(
              (o) => o.member.id === transferFromId
            );
            if (transferFromOwner && transferFromOwner.date_of_ownership) {
              const newDateObj = new Date(currentDate);
              const transferFromDateObj = new Date(
                transferFromOwner.date_of_ownership
              );
              transferFromDateObj.setHours(0, 0, 0, 0);
              newDateObj.setHours(0, 0, 0, 0);

              if (newDateObj < transferFromDateObj) {
                const errorMessage = `New ownership date cannot be older than the transfer-from owner's ownership date (${formatDate(
                  transferFromOwner.date_of_ownership
                )}).`;
                setDateValidationErrors((prev) => ({
                  ...prev,
                  [index]: errorMessage
                }));
                setError(`owners.${index}.dateofOwnership`, {
                  type: "manual",
                  message: errorMessage
                });
              } else {
                setDateValidationErrors((prev) => {
                  const newErrors = { ...prev };
                  delete newErrors[index];
                  return newErrors;
                });
                clearErrors(`owners.${index}.dateofOwnership`);
              }
            }
          }
        } else {
          // Clear the transfer from name if no transfer from is selected
          setSearchTerms((prev) => ({
            ...prev,
            [`from_${index}`]: ""
          }));
          
          // Clear date validation error if transfer-from is cleared
          setDateValidationErrors((prev) => {
            const newErrors = { ...prev };
            delete newErrors[index];
            return newErrors;
          });
          clearErrors(`owners.${index}.dateofOwnership`);
          
          // Reset ownership percentage for this new owner since it's no longer a transfer
          setValue(`owners.${index}.ownershipPercentage`, "", {
            shouldValidate: false
          });
          
          // Recalculate transferred percentages without this transfer
          const newTransferredPercentages = {};
          fields.forEach((_, idx) => {
            if (!watch(`owners.${idx}.isExisting`)) {
              const transferFromId = watch(`owners.${idx}.ownershipTransferFromId`);
              const transferPercentage = parseFloat(
                watch(`owners.${idx}.ownershipPercentage`) || 0
              );
              
              if (transferFromId) {
                newTransferredPercentages[transferFromId] =
                  (newTransferredPercentages[transferFromId] || 0) + transferPercentage;
              }
            }
          });
          
          // Update transferred percentages state
          setTransferredPercentages(newTransferredPercentages);
          
          // Reset all existing owners' displayed percentages back to original
          fields.forEach((_, idx) => {
            if (watch(`owners.${idx}.isExisting`)) {
              const memberId = watch(`owners.${idx}.memberId`);
              const originalPercentage = parseFloat(
                originalPercentages[memberId] || 0
              );
              const totalTransferred = newTransferredPercentages[memberId] || 0;
              const adjustedPercentage = originalPercentage - totalTransferred;
              
              setValue(
                `owners.${idx}.ownershipPercentage`,
                adjustedPercentage.toFixed(2),
                { shouldValidate: false }
              );
            }
          });
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [watch, ownerState.ownerList, setError, clearErrors, fields, originalPercentages, setValue]);

  // Memoize the owner list transformation effect
  useEffect(() => {
    if (!ownerState.ownerList?.owners) return;

    let owners = [...(ownerState.ownerList.owners || [])];

    if (owners.length > 0) {
      const transformed = owners.map((owner) => ({
        id: owner.id,
        memberId: owner.member.id,
        ownershipPercentage: owner.ownership_percentage,
        dateofOwnership: owner.date_of_ownership
          ? new Date(owner.date_of_ownership).toISOString().split("T")[0]
          : "",
        document: [],
        docLinks:
          owner.docs?.map((doc) => ({
            id: doc.id,
            url: doc.url
          })) || [],
        ownershipTransferFromId: owner.ownership_transfer_from?.id || "",
        isExisting: true
      }));

      // Always ensure there's at least one new owner form available
      const hasNewOwner = transformed.some((owner) => !owner.isExisting);
      let newOwnerIndex = -1;
      if (!hasNewOwner) {
        const newOwner = {
          memberId: "",
          ownershipPercentage: "",
          dateofOwnership: "",
          document: [],
          docLinks: [],
          ownershipTransferFromId: "",
          isExisting: false
        };
        transformed.push(newOwner);
        newOwnerIndex = transformed.length - 1;
      } else {
        // Find the first new owner form
        newOwnerIndex = transformed.findIndex((owner) => !owner.isExisting);
      }

      // Autofill transfer from field if there's a single owner with 100% ownership
      if (owners.length === 1 && newOwnerIndex !== -1) {
        const singleOwner = owners[0];
        const ownershipPercentage = parseFloat(singleOwner.ownership_percentage || 0);
        // Check if ownership is exactly 100% (with small tolerance for floating point)
        if (Math.abs(ownershipPercentage - 100) < 0.01) {
          transformed[newOwnerIndex].ownershipTransferFromId = singleOwner.member.id;
        }
      }

      replace(transformed);

      const initialTerms = {};
      owners.forEach((owner, idx) => {
        initialTerms[idx] = owner.member.full_name;
        initialTerms[`from_${idx}`] =
          owner.ownership_transfer_from?.full_name || "";
      });
      
      // Set search term for transfer from if autofilled
      if (newOwnerIndex !== -1 && transformed[newOwnerIndex].ownershipTransferFromId) {
        const transferFromOwner = owners.find(
          (o) => o.member.id === transformed[newOwnerIndex].ownershipTransferFromId
        );
        if (transferFromOwner) {
          initialTerms[`from_${newOwnerIndex}`] = transferFromOwner.member.full_name;
        }
      }
      
      setSearchTerms(initialTerms);
    }
  }, [ownerState.ownerList, replace]);

  // Add this effect to handle company data
  useEffect(() => {
    if (
      changeCompanyData?.data?.member &&
      changeCompanyData?.data?.company_name &&
      !fields.some((field) => field.memberId === changeCompanyData.data.member)
    ) {
      // Find an empty slot or create a new one
      const emptyIndex = fields.findIndex(
        (_, index) => !watch(`owners.${index}.memberId`)
      );

      if (emptyIndex === -1) {
        // Only append if there's no empty slot
        const newOwner = {
          id: changeCompanyData.data.member,

          memberId: changeCompanyData.data.member,
          ownershipPercentage: "",
          dateofOwnership: "",
          document: [],
          docLinks: [],
          ownershipTransferFromId: "",
          isExisting: false
        };

        append(newOwner);
        setSearchTerms((prev) => ({
          ...prev,
          [fields.length]: changeCompanyData.data.company_name
        }));
      } else {
        // Use the existing empty slot
        setValue(
          `owners.${emptyIndex}.memberId`,
          changeCompanyData.data.member
        );
        setValue(`owners.${emptyIndex}.isExisting`, false);
        setSearchTerms((prev) => ({
          ...prev,
          [emptyIndex]: changeCompanyData.data.company_name
        }));
      }

      setShowCompanyModal(false);
      dispatch(clearCreatedCompany());
      dispatch(clearCompanyMessage());
    }
  }, [changeCompanyData, append, fields, watch, setValue, dispatch]);

  // Add effect to sync form with Redux state
  useEffect(() => {
    if (!ownerState.ownerList?.owners) {
      // If Redux state is cleared, reset the form
      replace([]);
      setSearchTerms({});
    }
  }, [ownerState.ownerList, replace]);

  // Add effect to store original percentages when owners are loaded
  useEffect(() => {
    if (ownerState.ownerList?.owners) {
      const initialPercentages = {};
      ownerState.ownerList.owners.forEach((owner) => {
        initialPercentages[owner.member.id] = owner.ownership_percentage;
      });
      setOriginalPercentages(initialPercentages);
    }
  }, [ownerState.ownerList]);

  // Add this effect to check if there are any transfers
  const watchedOwners = watch("owners");
  useEffect(() => {
    const hasAnyTransfers = fields.some(
      (_, index) =>
        !watch(`owners.${index}.isExisting`) &&
        watch(`owners.${index}.ownershipTransferFromId`)
    );
    setHasTransfers(hasAnyTransfers);
  }, [watchedOwners, fields, watch]);

  const handleRemoveOwner = (index) => {
    const isExistingOwner = watch(`owners.${index}.isExisting`);
    const existingOwnersCount = fields.filter((_, idx) =>
      watch(`owners.${idx}.isExisting`)
    ).length;
    if (isExistingOwner && existingOwnersCount <= 1) {
      setLocalError(
        "Cannot remove the last owner. At least one owner must remain."
      );
      return;
    }
    if (!isExistingOwner) {
      remove(index);
      const newTerms = {};
      fields.forEach((_, idx) => {
        if (idx !== index) {
          const adjustedIdx = idx > index ? idx - 1 : idx;
          newTerms[adjustedIdx] = searchTerms[idx] || "";
          newTerms[`from_${adjustedIdx}`] = searchTerms[`from_${idx}`] || "";
        }
      });
      setSearchTerms(newTerms);
      ownerRefs.current = ownerRefs.current.filter((_, idx) => idx !== index);
      const updatedOwners = fields.filter((_, idx) => idx !== index);
      setValue("owners", updatedOwners);
    }
  };

  // Clear messages when component mounts and unmounts
  useEffect(() => {
    dispatch(clearMessage());
    return () => {
      dispatch(clearMessage());
    };
  }, [dispatch]);

  // Fetch owners for the given unit when component mounts
  useEffect(() => {
    dispatch(fetchOwnerList(unitId));
  }, [dispatch, unitId]);

  // Add another effect to clear messages when navigating
  useEffect(() => {
    const handleBeforeUnload = () => {
      dispatch(clearMessage());
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [dispatch]);

  // Updates form fields when a new member is added
  useEffect(() => {
    if (ownerState.createdMember) {
      // Check if member already exists in any ownership block
      // const isDuplicate = fields.some(
      //   (_, index) =>
      //     watch(`owners.${index}.memberId`) === ownerState.createdMember.id
      // );

      // if (isDuplicate) {
      //   setLocalError("This member has already been added as an owner.");
      //   dispatch(clearCreatedMember());
      //   dispatch(clearMessage());
      //   setIsMemberModalOpen(false);
      //   return;
      // }

      const emptyIndex = fields.findIndex(
        (_, index) => !watch(`owners.${index}.memberId`)
      );
      const indexToUse = emptyIndex !== -1 ? emptyIndex : fields.length;

      if (emptyIndex === -1) {
        append({
          memberId: "",
          ownershipPercentage: "",
          dateofOwnership: "",
          document: [],
          docLinks: [],
          ownershipTransferFromId: "",
          isExisting: false
        });
      }

      setTimeout(() => {
        setValue(`owners.${indexToUse}.memberId`, ownerState.createdMember.id, {
          shouldValidate: true
        });
        // Store pending data if this is a pending member/company
        if (ownerState.createdMember.isPending && ownerState.createdMember.pendingData) {
          setValue(`owners.${indexToUse}.pendingData`, ownerState.createdMember.pendingData);
          setValue(`owners.${indexToUse}.isPending`, true);
        }
        setValue(`owners.${indexToUse}.isExisting`, false);
        setSearchTerms((prev) => ({
          ...prev,
          [indexToUse]: ownerState.createdMember.full_name
        }));

        ownerRefs.current[indexToUse]?.current?.scrollIntoView({
          behavior: "smooth"
        });
        // Focus on the "Transfer Ownership From" input field
        requestAnimationFrame(() => {
          setTimeout(() => {
            const ownerRef = ownerRefs.current[indexToUse]?.current;
            if (ownerRef) {
              // Find the "Transfer Ownership From" field by looking for the label text
              const allLoginFields = ownerRef.querySelectorAll(".login-field");
              let transferFromInput = null;
              allLoginFields.forEach((field) => {
                const label = field.querySelector("p");
                if (
                  label &&
                  label.textContent.includes("Transfer Ownership From")
                ) {
                  transferFromInput = field.querySelector(
                    'input[placeholder="Enter Name"]'
                  );
                }
              });
              if (transferFromInput) {
                // Blur any other focused elements first
                if (
                  document.activeElement &&
                  document.activeElement !== transferFromInput
                ) {
                  document.activeElement.blur();
                }
                // Small delay to ensure blur completes
                setTimeout(() => {
                  transferFromInput.focus({ preventScroll: false });
                }, 50);
              }
            }
          }, 100);
        });

        dispatch(clearCreatedMember());
        dispatch(clearMessage());
        setIsMemberModalOpen(false);
      }, 100);
    }
  }, [ownerState.createdMember, fields, watch, setValue, append, dispatch]);

  // Add this effect to set initial values when owners are loaded
  useEffect(() => {
    if (ownerState.ownerList?.owners?.length > 0 && !initialValues) {
      const owners = ownerState.ownerList.owners.map((owner) => ({
        id: owner.id,
        memberId: owner.member.id,
        ownershipPercentage: owner.ownership_percentage,
        dateofOwnership: owner.date_of_ownership
          ? new Date(owner.date_of_ownership).toISOString().split("T")[0]
          : "",
        document: [],
        docLinks:
          owner.docs?.map((doc) => ({ id: doc.id, url: doc.url })) || [],
        ownershipTransferFromId: owner.ownership_transfer_from?.id || "",
        isExisting: true
      }));
      setInitialValues({ owners });
    }
  }, [ownerState.ownerList, initialValues]);

  // Get current owners to watch for changes
  const currentOwners = watch("owners") || [];
  
  // Create a stable serialized version for comparison to trigger useMemo updates
  // This ensures changes to owner fields are detected even if array reference stays the same
  const currentOwnersJson = JSON.stringify(
    currentOwners.map(o => ({
      memberId: o?.memberId,
      ownershipPercentage: o?.ownershipPercentage,
      dateofOwnership: o?.dateofOwnership,
      ownershipTransferFromId: o?.ownershipTransferFromId,
      isExisting: o?.isExisting,
      docLinksLength: o?.docLinks?.length
    }))
  );

  // Memoize check if form has actual changes
  const hasActualChanges = useMemo(() => {
    if (!initialValues) return false;

    const currentOwnersList = currentOwners;
    const initialOwners = initialValues.owners || [];

    // Filter out empty new owner slots (not existing and no memberId)
    // These are just placeholders and don't count as actual changes
    const filledCurrentOwners = currentOwnersList.filter(
      (owner) => owner.isExisting || owner.memberId
    );

    // Check if number of filled owners changed
    if (filledCurrentOwners.length !== initialOwners.length) return true;

    // Check each existing owner's fields for changes
    return currentOwnersList.some((owner, index) => {
      // Skip empty new owner slots
      if (!owner.isExisting && !owner.memberId) return false;

      const initialOwner = initialOwners.find(
        (io) => io.memberId === owner.memberId
      );
      
      // If this is a new owner with a memberId, it's a change
      if (!initialOwner) return true;

      return (
        owner.ownershipPercentage !== initialOwner.ownershipPercentage ||
        owner.dateofOwnership !== initialOwner.dateofOwnership ||
        owner.ownershipTransferFromId !==
          initialOwner.ownershipTransferFromId ||
        JSON.stringify(owner.docLinks) !== JSON.stringify(initialOwner.docLinks)
      );
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOwnersJson, initialValues, currentOwners]);

  // Memoize check if there are any validation errors visible under input fields
  const hasValidationErrors = useMemo(() => {
    // Check for top-level owners array error
    if (
      errors.owners &&
      typeof errors.owners === "object" &&
      "message" in errors.owners
    ) {
      return true;
    }

    // Check for string error on owners
    if (errors.owners && typeof errors.owners === "string") {
      return true;
    }

    // Check for field-level errors in each owner
    if (errors.owners && Array.isArray(errors.owners)) {
      const hasFieldErrors = errors.owners.some((ownerError, index) => {
        if (!ownerError) return false;

        // Get the owner data for this index
        const owner = currentOwners[index];
        
        // Skip validation errors for empty new owner slots
        // A slot is considered "empty" if it has no memberId set
        // This allows the form to be saved when user hasn't filled the new owner slot
        if (owner && !owner.isExisting && !owner.memberId) {
          return false; // Don't count errors for unused new owner slots
        }

        // Check all possible field errors
        return !!(
          ownerError.memberId ||
          ownerError.ownershipPercentage ||
          ownerError.dateofOwnership ||
          ownerError.document ||
          ownerError.ownershipTransferFromId
        );
      });

      if (hasFieldErrors) return true;
    }

    // Check for date validation errors
    if (Object.keys(dateValidationErrors).length > 0) {
      return true;
    }

    return false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errors.owners, dateValidationErrors, currentOwnersJson, currentOwners]);

  // Add this function to validate ownership dates
  const validateOwnershipDates = (data) => {
    const owners = data.owners || [];

    for (let i = 0; i < owners.length; i++) {
      const owner = owners[i];
      const newDate = owner.dateofOwnership;

      if (!newDate) continue;

      const newDateObj = new Date(newDate);

      // For existing owners: new date must not be older than current date
      if (owner.isExisting) {
        const initialOwner = initialValues?.owners?.find(
          (o) => o.memberId === owner.memberId
        );
        if (initialOwner && initialOwner.dateofOwnership) {
          const currentDateObj = new Date(initialOwner.dateofOwnership);
          // Compare dates (ignore time)
          currentDateObj.setHours(0, 0, 0, 0);
          newDateObj.setHours(0, 0, 0, 0);

          if (newDateObj < currentDateObj) {
            return `The new ownership date for ${
              searchTerms[i] || "this owner"
            } cannot be older than the current ownership date (${formatDate(
              initialOwner.dateofOwnership
            )}).`;
          }
        }
      } else {
        // For new owners with transfer: new date must not be older than transfer-from owner's date
        if (owner.ownershipTransferFromId) {
          const transferFromOwner = ownerState.ownerList?.owners?.find(
            (o) => o.member.id === owner.ownershipTransferFromId
          );
          if (transferFromOwner && transferFromOwner.date_of_ownership) {
            const transferFromDateObj = new Date(
              transferFromOwner.date_of_ownership
            );
            // Compare dates (ignore time)
            transferFromDateObj.setHours(0, 0, 0, 0);
            newDateObj.setHours(0, 0, 0, 0);

            if (newDateObj < transferFromDateObj) {
              return `The new ownership date cannot be older than the transfer-from owner's ownership date (${formatDate(
                transferFromOwner.date_of_ownership
              )}).`;
            }
          }
        }
      }
    }

    return null;
  };

  // Add handler for date change validation
  const handleDateChange = (e, index) => {
    const newDate = e.target.value;
    setValue(`owners.${index}.dateofOwnership`, newDate, {
      shouldValidate: true
    });

    if (!newDate) {
      setDateValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[index];
        return newErrors;
      });
      return;
    }

    const newDateObj = new Date(newDate);
    const owner = watch(`owners.${index}`);
    let errorMessage = null;

    // For existing owners: new date must not be older than current date
    if (owner?.isExisting) {
      const initialOwner = initialValues?.owners?.find(
        (o) => o.memberId === owner.memberId
      );
      if (initialOwner && initialOwner.dateofOwnership) {
        const currentDateObj = new Date(initialOwner.dateofOwnership);
        // Compare dates (ignore time)
        currentDateObj.setHours(0, 0, 0, 0);
        newDateObj.setHours(0, 0, 0, 0);

        if (newDateObj < currentDateObj) {
          errorMessage = `New ownership date cannot be older than the current ownership date (${formatDate(
            initialOwner.dateofOwnership
          )}).`;
        }
      }
    } else {
      // For new owners with transfer: new date must not be older than transfer-from owner's date
      if (owner?.ownershipTransferFromId) {
        const transferFromOwner = ownerState.ownerList?.owners?.find(
          (o) => o.member.id === owner.ownershipTransferFromId
        );
        if (transferFromOwner && transferFromOwner.date_of_ownership) {
          const transferFromDateObj = new Date(
            transferFromOwner.date_of_ownership
          );
          // Compare dates (ignore time)
          transferFromDateObj.setHours(0, 0, 0, 0);
          newDateObj.setHours(0, 0, 0, 0);

          if (newDateObj < transferFromDateObj) {
            errorMessage = `New ownership date cannot be older than the transfer-from owner's ownership date (${formatDate(
              transferFromOwner.date_of_ownership
            )}).`;
          }
        }
      }
    }

    setDateValidationErrors((prev) => {
      const newErrors = { ...prev };
      if (errorMessage) {
        newErrors[index] = errorMessage;
      } else {
        delete newErrors[index];
      }
      return newErrors;
    });

    // Also set error in form validation
    if (errorMessage) {
      setError(`owners.${index}.dateofOwnership`, {
        type: "manual",
        message: errorMessage
      });
    } else {
      clearErrors(`owners.${index}.dateofOwnership`);
    }
  };

  // Add this function to validate ownership transfer
  const validateOwnershipTransfer = (data) => {
    const owners = data.owners || [];
    const transferMap = new Map(); // Map to track transfers from each owner

    // First pass: collect all transfers (only from NEW owners, not existing)
    owners.forEach((owner) => {
      // Only count transfers from NEW owners being added, not existing ones
      if (!owner.isExisting && owner.ownershipTransferFromId) {
        const fromId = owner.ownershipTransferFromId;
        const percentage = parseFloat(owner.ownershipPercentage) || 0;

        if (!transferMap.has(fromId)) {
          transferMap.set(fromId, 0);
        }
        transferMap.set(fromId, transferMap.get(fromId) + percentage);
      }
    });

    // Second pass: validate transfers
    for (const [fromId, totalTransferred] of transferMap) {
      const originalOwner = initialValues?.owners?.find(
        (o) => o.memberId === fromId
      );
      if (originalOwner) {
        const originalPercentage =
          parseFloat(originalOwner.ownershipPercentage) || 0;
        if (totalTransferred > originalPercentage) {
          return `Total transfer amount (${totalTransferred}%) exceeds original ownership (${originalPercentage}%)`;
        }
      }
    }

    // Validate that no owner is transferring to themselves
    const selfTransfer = owners.some(
      (owner) => owner.ownershipTransferFromId === owner.memberId
    );
    if (selfTransfer) {
      return "An owner cannot transfer ownership to themselves";
    }

    // NEW VALIDATION: Prevent multiple owners transferring to the same new owner
    const transferRecipients = {};
    owners.forEach((owner) => {
      if (
        !owner.isExisting &&
        owner.ownershipTransferFromId &&
        owner.memberId
      ) {
        transferRecipients[owner.memberId] =
          (transferRecipients[owner.memberId] || 0) + 1;
      }
    });
    const duplicateRecipient = Object.entries(transferRecipients).find(
      ([, count]) => count > 1
    );
    if (duplicateRecipient) {
      // Remove all new owners from the form and clear their associated state
      if (typeof replace === "function" && typeof fields !== "undefined") {
        // Only keep existing owners
        const onlyExisting = fields.filter((_, idx) =>
          watch(`owners.${idx}.isExisting`)
        );
        replace(onlyExisting);
        setSearchTerms((prev) => {
          const newTerms = {};
          onlyExisting.forEach((_, idx) => {
            newTerms[idx] = prev[idx] || "";
            newTerms[`from_${idx}`] = prev[`from_${idx}`] || "";
          });
          return newTerms;
        });
      }
      return "Cannot transfer ownership from multiple owners to the same new owner in one operation.";
    }

    return null;
  };

  // Add this function to calculate transferred percentages
  const calculateTransferredPercentages = React.useCallback(() => {
    const newTransferredPercentages = {};

    // Calculate total transferred percentage for each owner
    // IMPORTANT: Use the actual field index, not a filtered array index
    // Track transfers FROM owners - any entry (new or existing) can indicate a transfer
    fields.forEach((_, index) => {
      const transferFromId = watch(`owners.${index}.ownershipTransferFromId`);
      const transferPercentage = parseFloat(
        watch(`owners.${index}.ownershipPercentage`) || 0
      );

      // Track transfers FROM owners (when an entry has ownershipTransferFromId set)
      // This works for both new entries receiving transfers AND existing owners receiving transfers
      if (transferFromId && transferPercentage > 0) {
        newTransferredPercentages[transferFromId] =
          (newTransferredPercentages[transferFromId] || 0) + transferPercentage;
      }
    });

    setTransferredPercentages(newTransferredPercentages);
  }, [fields, watch]);

  // Add effect to recalculate transferred percentages when ownership changes
  const watchedOwnersForTransfer = watch("owners");
  useEffect(() => {
    calculateTransferredPercentages();
  }, [watchedOwnersForTransfer, calculateTransferredPercentages]);

  // Add this function to update transferred percentages when new owner percentage changes
  // const updateTransferredPercentage = (newOwnerIndex, newPercentage) => {
  //   const transferFromId = watch(`owners.${newOwnerIndex}.ownershipTransferFromId`);
  //   if (!transferFromId) return;

  //   const newTransferredPercentages = { ...transferredPercentages };

  //   // Reset all transfers from this old owner
  //   Object.keys(newTransferredPercentages).forEach(key => {
  //     if (key === transferFromId) {
  //       newTransferredPercentages[key] = 0;
  //     }
  //   });

  //   // Add up all transfers from this old owner
  //   fields.forEach((_, index) => {
  //     if (!watch(`owners.${index}.isExisting`)) {
  //       const currentTransferFromId = watch(`owners.${index}.ownershipTransferFromId`);
  //       if (currentTransferFromId === transferFromId) {
  //         const currentPercentage = parseFloat(watch(`owners.${index}.ownershipPercentage`) || 0);
  //         newTransferredPercentages[transferFromId] = (newTransferredPercentages[transferFromId] || 0) + currentPercentage;
  //       }
  //     }
  //   });

  //   setTransferredPercentages(newTransferredPercentages);
  // };

  // Add effect to watch all ownership changes
  useEffect(() => {
    const subscription = watch((value, { name }) => {
      if (
        name?.includes("ownershipPercentage") ||
        name?.includes("ownershipTransferFromId")
      ) {
        // Reset all transferred percentages
        const newTransferredPercentages = {};

        // Calculate transferred percentages from ALL new owners (not existing)
        // IMPORTANT: Use the actual field index, not a filtered array index
        fields.forEach((_, index) => {
          const isExisting = watch(`owners.${index}.isExisting`);
          if (!isExisting) {
            const transferFromId = watch(
              `owners.${index}.ownershipTransferFromId`
            );
            const transferPercentage = parseFloat(
              watch(`owners.${index}.ownershipPercentage`) || 0
            );

            if (transferFromId) {
              // Update transferred percentage
              newTransferredPercentages[transferFromId] =
                (newTransferredPercentages[transferFromId] || 0) +
                transferPercentage;
            }
          }
        });

        // Update all existing owners' displayed percentages
        fields.forEach((_, index) => {
          if (watch(`owners.${index}.isExisting`)) {
            const memberId = watch(`owners.${index}.memberId`);
            const originalPercentage = parseFloat(
              originalPercentages[memberId] || 0
            );
            const totalTransferred = newTransferredPercentages[memberId] || 0;
            const adjustedPercentage = originalPercentage - totalTransferred;

            // Only update if the value is different to prevent infinite loop
            const currentValue = watch(`owners.${index}.ownershipPercentage`);
            if (currentValue !== adjustedPercentage.toFixed(2)) {
              setValue(
                `owners.${index}.ownershipPercentage`,
                adjustedPercentage.toFixed(2),
                { shouldValidate: false }
              );
            }
          }
        });

        setTransferredPercentages(newTransferredPercentages);
      }
    });

    return () => subscription.unsubscribe();
  }, [watch, fields, setValue, originalPercentages]);

  // Add this function to detect owners that should be removed
  const shouldRemoveOwner = (memberId) => {
    const originalPercentage = parseFloat(originalPercentages[memberId] || 0);
    const transferredPercentage = transferredPercentages[memberId] || 0;
    // Use a small epsilon to handle floating point comparison
    return Math.abs(originalPercentage - transferredPercentage) < 0.01;
  };

  // Modify the handleOwnershipPercentageChange function
  const handleOwnershipPercentageChange = (e, field, index) => {
    const value = e.target.value;
    field.onChange(value);

    // Get the old owner's ID from transfer from
    const transferFromId = watch(`owners.${index}.ownershipTransferFromId`);
    if (transferFromId) {
      // Find the old owner in the existing owners
      const oldOwnerIndex = fields.findIndex(
        (_, idx) =>
          watch(`owners.${idx}.memberId`) === transferFromId &&
          watch(`owners.${idx}.isExisting`)
      );

      if (oldOwnerIndex !== -1) {
        // Get the original percentage of the old owner
        const originalPercentage = parseFloat(
          originalPercentages[transferFromId] || 0
        );

        // Calculate total transferred percentage for this old owner
        const totalTransferred = fields.reduce((sum, _, idx) => {
          if (
            !watch(`owners.${idx}.isExisting`) &&
            watch(`owners.${idx}.ownershipTransferFromId`) === transferFromId
          ) {
            return (
              sum + parseFloat(watch(`owners.${idx}.ownershipPercentage`) || 0)
            );
          }
          return sum;
        }, 0);

        // Calculate the remaining percentage for the old owner
        const remainingPercentage = originalPercentage - totalTransferred;

        // Only update the displayed percentage - DO NOT delete owners during input
        // Deletion should only happen on form submission
        const currentValue = watch(
          `owners.${oldOwnerIndex}.ownershipPercentage`
        );
        if (currentValue !== remainingPercentage.toFixed(2)) {
          setValue(
            `owners.${oldOwnerIndex}.ownershipPercentage`,
            remainingPercentage.toFixed(2),
            { shouldValidate: false }
          );
        }

        // Update transferred percentages
        const newTransferredPercentages = { ...transferredPercentages };
        newTransferredPercentages[transferFromId] = totalTransferred;
        setTransferredPercentages(newTransferredPercentages);
      }
    }
  };

  // Modify the onSubmit function to handle removals
  const onSubmit = async (data) => {
    console.log("➡️ Submitting form data:", data);
    setHasFileChanges(false);

    // First, create any pending members/companies before processing transfers
    // This ensures they exist in the database before ownership is transferred
    const pendingOwners = data.owners.filter((owner) => {
      if (!owner.memberId) return false;
      const memberIdStr = String(owner.memberId);
      return memberIdStr.startsWith('pending_member_') || memberIdStr.startsWith('pending_company_');
    });

    // Check transfer-from IDs - these should not be pending
    const pendingTransferFrom = data.owners.some((owner) => {
      if (!owner.ownershipTransferFromId) return false;
      const transferFromIdStr = String(owner.ownershipTransferFromId);
      return transferFromIdStr.startsWith('pending_member_') || transferFromIdStr.startsWith('pending_company_');
    });

    if (pendingTransferFrom) {
      setLocalError(
        "Cannot transfer ownership from pending members or companies. The source owner must already exist in the database."
      );
      return;
    }

    // Set loading state at the start of submission
    setIsSubmitting(true);
    dispatch(clearMessage());
    
    // Create pending members/companies first
    if (pendingOwners.length > 0) {
      try {
        // Create pending members/companies sequentially
        for (const owner of pendingOwners) {
          if (!owner.pendingData) {
            console.error(`⚠️ Pending owner ${owner.memberId} has no pendingData`);
            setLocalError(`Pending member/company data is missing for ${owner.memberId}`);
            setIsSubmitting(false);
            return;
          }

          const memberIdStr = String(owner.memberId);
          const isCompany = memberIdStr.startsWith('pending_company_');

          if (isCompany) {
            // Create company
            const companyFormData = new FormData();
            for (const key in owner.pendingData) {
              if (
                owner.pendingData.hasOwnProperty(key) &&
                key !== "members_role" &&
                key !== "memberType"
              ) {
                const value = owner.pendingData[key];
                if (key === "photo") {
                  if (value instanceof File || value instanceof Blob) {
                    companyFormData.append("photo", value);
                  } else if (!value) {
                    companyFormData.append("photo_removed", "Removed");
                  }
                } else {
                  companyFormData.append(key, value);
                }
              }
            }

            const companyResult = await dispatch(createCompany(companyFormData)).unwrap();
            const actualMemberId = companyResult.data?.member || companyResult.member || companyResult.data?.member?.id || companyResult.member?.id;

            if (!actualMemberId) {
              throw new Error("Company created but member ID not returned");
            }

            // Replace pending ID with real ID in the data
            owner.memberId = actualMemberId;
            console.log(`✅ Company created with member ID: ${actualMemberId}`);
          } else {
            // Create member
            const memberFormData = new FormData();
            Object.entries(owner.pendingData).forEach(([key, value]) => {
              if (value !== undefined && value !== null && value !== "") {
                if (Array.isArray(value)) {
                  value.forEach((v) => memberFormData.append(key, v));
                } else {
                  memberFormData.append(key, value);
                }
              }
            });

            const memberResult = await dispatch(CreatememberForUnit(memberFormData)).unwrap();
            const actualMemberId = memberResult.member?.id;

            if (!actualMemberId) {
              throw new Error("Member created but ID not returned");
            }

            // Replace pending ID with real ID in the data
            owner.memberId = actualMemberId;
            console.log(`✅ Member created with ID: ${actualMemberId}`);
          }
        }

        // Clear pending data after processing
        dispatch(clearPendingMemberData());
        dispatch(clearPendingCompanyData());
        
        console.log(`✅ All pending members/companies created. Updated data:`, data.owners.map(o => ({
          memberId: o.memberId,
          isPending: o.isPending,
          hasPendingData: !!o.pendingData
        })));
      } catch (error) {
        console.error(`❌ Error creating pending members/companies:`, error);
        setLocalError(
          error?.message ||
            "Failed to create pending members/companies. This may be due to a duplicate email address. Please try again with a different email."
        );
        setIsSubmitting(false);
        return;
      }
    }

    // Validate ownership dates
    const dateError = validateOwnershipDates(data);
    if (dateError) {
      setTransferValidationError(dateError);
      return;
    }

    // Validate ownership transfer
    const transferError = validateOwnershipTransfer(data);
    if (transferError) {
      setTransferValidationError(transferError);
      if (
        transferError ===
        "Cannot transfer ownership from multiple owners to the same new owner in one operation."
      ) {
        resetNewOwnerFields();
      }
      return;
    }
    setTransferValidationError(null);

    // Calculate total ownership with precise decimal handling
    // Track which existing owners are receiving transfers via new entries
    const existingOwnersReceivingTransfers = new Set();
    data.owners.forEach((owner) => {
      if (!owner.isExisting && owner.ownershipTransferFromId && owner.memberId) {
        // Check if this recipient is an existing owner
        const existingOwner = ownerState.ownerList?.owners?.find(
          (o) => o.member.id === owner.memberId
        );
        if (existingOwner) {
          existingOwnersReceivingTransfers.add(owner.memberId);
        }
      }
    });

    const totalOwnership = data.owners.reduce((sum, owner) => {
      // Skip existing owner entries if they're receiving a transfer via a new entry
      // The new entry will handle the combined percentage (original + transfer)
      if (owner.isExisting && existingOwnersReceivingTransfers.has(owner.memberId)) {
        return sum; // Don't count the existing entry, the new entry will be counted
      }

      // For existing owners, use their adjusted percentage (original - transferred)
      if (owner.isExisting) {
        const memberId = owner.memberId;
        const originalPercentage = parseFloat(
          originalPercentages[memberId] || 0
        );
        const transferredPercentage = transferredPercentages[memberId] || 0;
        return sum + (originalPercentage - transferredPercentage);
      }
      
      // For new owners receiving transfers to existing owners, add original + transfer
      if (!owner.isExisting && owner.ownershipTransferFromId && existingOwnersReceivingTransfers.has(owner.memberId)) {
        const memberId = owner.memberId;
        const originalPercentage = parseFloat(
          originalPercentages[memberId] || 0
        );
        const transferAmount = parseFloat(owner.ownershipPercentage || 0);
        return sum + (originalPercentage + transferAmount);
      }
      
      // For new owners (not receiving transfers to existing), add their percentage directly
      return sum + parseFloat(owner.ownershipPercentage || 0);
    }, 0);

    // Round to 2 decimal places for comparison
    const roundedTotal = Math.round(totalOwnership * 100) / 100;

    console.log("📊 Ownership Total:", {
      total: roundedTotal,
      owners: data.owners.map((owner) => ({
        name: searchTerms[data.owners.indexOf(owner)],
        percentage: owner.isExisting
          ? (
              parseFloat(originalPercentages[owner.memberId] || 0) -
              (transferredPercentages[owner.memberId] || 0)
            ).toFixed(2)
          : parseFloat(owner.ownershipPercentage || 0).toFixed(2)
      }))
    });

    // Check if total ownership is exactly 100%
    if (roundedTotal !== 100) {
      setLocalError(
        `Total ownership percentage must be exactly 100%. Current total: ${roundedTotal}%`
      );
      return;
    }

    // Validate individual ownership percentages
    // Skip validation for owners that will be removed (0% means they're transferring everything)
    const invalidOwnership = data.owners.some((owner) => {
      // Skip owners that are being removed (they have 0% after transfer)
      if (owner.isExisting && shouldRemoveOwner(owner.memberId)) {
        return false; // Valid - they will be deleted
      }
      const percentage = parseFloat(owner.ownershipPercentage || 0);
      return percentage <= 0 || percentage > 100;
    });

    if (invalidOwnership) {
      setLocalError(
        "Each ownership percentage must be greater than 0 and less than or equal to 100%"
      );
      return;
    }

    // Get unique member IDs to avoid duplicates
    const memberIds = [...new Set(data.owners.map((owner) => owner.memberId))];
    
    try {
      // First, identify owners to be removed (those with 100% transfer)
      const ownersToRemove = new Set();
      data.owners.forEach((owner) => {
        if (owner.isExisting) {
          const memberId = owner.memberId;
          if (shouldRemoveOwner(memberId)) {
            ownersToRemove.add(memberId);
          }
        }
      });

      // Identify existing owners who are receiving transfers via new entries
      // These should be handled by the transfer entry, not the existing entry
      const transferRecipients = new Set();
      data.owners.forEach((owner) => {
        if (!owner.isExisting && owner.ownershipTransferFromId && owner.memberId) {
          // Check if this recipient is an existing owner
          const existingOwner = ownerState.ownerList?.owners?.find(
            (o) => o.member.id === owner.memberId
          );
          if (existingOwner) {
            transferRecipients.add(owner.memberId);
          }
        }
      });

      const ownerPromises = data.owners.map(async (owner, index) => {
        // Skip if this owner is marked for removal
        if (ownersToRemove.has(owner.memberId)) {
          return Promise.resolve();
        }

        // Skip existing owner entries if they're receiving a transfer via a new entry
        // The transfer entry will handle the update with the correct combined percentage
        if (owner.isExisting && transferRecipients.has(owner.memberId)) {
          console.log(`⏭️ Skipping existing owner ${owner.memberId} - will be updated by transfer entry`);
          return Promise.resolve();
        }

        if (
          !owner.memberId ||
          !owner.ownershipPercentage ||
          !owner.dateofOwnership
        ) {
          console.error(
            `❗ Owner data incomplete at index ${index}. Skipping.`
          );
          return Promise.resolve();
        }

        // Check if this member is already an owner
        const existingOwner = ownerState.ownerList?.owners?.find(
          (o) => o.member.id === owner.memberId
        );

        const formData = new FormData();
        formData.append("member", owner.memberId);
        formData.append("unit", parseInt(unitId, 10));

        // Calculate the final ownership percentage
        let finalPercentage;
        if (owner.isExisting) {
          // For existing owners, subtract transferred amount
          const originalPercentage = parseFloat(
            originalPercentages[owner.memberId] || 0
          );
          const transferredPercentage =
            transferredPercentages[owner.memberId] || 0;
          finalPercentage = originalPercentage - transferredPercentage;
        } else {
          // For new owners, if they are receiving a transfer, add it to their existing ownership
          const existingOwnership = parseFloat(
            originalPercentages[owner.memberId] || 0
          );
          const transferAmount = parseFloat(owner.ownershipPercentage || 0);
          finalPercentage = existingOwnership + transferAmount;
        }

        formData.append("ownership_percentage", finalPercentage);
        formData.append("date_of_ownership", formatDate(owner.dateofOwnership));
        // Send the actual transfer source ID for new owners receiving a transfer
        formData.append("ownership_transfer_from", owner.ownershipTransferFromId || "");
        
        // Debug: Log the calculation
        console.log(`📊 Processing owner ${owner.memberId} (${owner.isExisting ? 'existing' : 'transfer entry'})`);
        console.log(`   originalPercentage: ${originalPercentages[owner.memberId] || 0}%`);
        console.log(`   ownershipPercentage from form: ${owner.ownershipPercentage}%`);
        console.log(`   finalPercentage being sent: ${finalPercentage}%`);
        console.log(`   transferFromId: ${owner.ownershipTransferFromId || 'none'}`);

        // Handle file uploads
        if (owner.document && owner.document.length > 0) {
          owner.document.forEach((file) => {
            if (file instanceof File) {
              formData.append("owner_docs_upload", file);
            }
          });
        }

        // Handle docs to delete
        const dbId = owner.id;
        const removedDocIds = dbId ? docsToDelete[dbId] || [] : [];
        removedDocIds.forEach((docId) => {
          formData.append("docs_to_delete[]", docId);
        });

        console.log(
          `📦 Payload for ${
            dbId ? "Update" : "Create"
          } Owner (index ${index}):`,
          {
            member: owner.memberId,
            unit: unitId,
            ownershipPercentage: finalPercentage.toFixed(2),
            date_of_ownership: formatDate(owner.dateofOwnership),
            documents: owner.document?.length || 0,
            ownership_transfer_from: owner.ownershipTransferFromId,
            docs_to_delete: removedDocIds
          }
        );

        try {
          // If we have an existing owner record, update it instead of creating a new one
          if (existingOwner) {
            return await dispatch(
              updateOwner({ ownerId: existingOwner.id, formData })
            ).unwrap();
          } else if (dbId) {
            return await dispatch(
              updateOwner({ ownerId: dbId, formData })
            ).unwrap();
          } else {
            return await dispatch(createOwner(formData)).unwrap();
          }
        } catch (error) {
          console.error(`Error processing owner at index ${index}:`, error);
          const errorMessage = parseOwnerError(error);
          throw new Error(errorMessage);
        }
      });

      // Add promises to delete owners with 100% transfer
      const deletePromises = Array.from(ownersToRemove).map(
        async (memberId) => {
          const ownerToDelete = ownerState.ownerList?.owners?.find(
            (o) => o.member.id === memberId
          );
          if (ownerToDelete) {
            return await dispatch(deleteOwner(ownerToDelete.id)).unwrap();
          }
        }
      );

      // Wait for creates/updates first, then deletes
      // This ensures new owners exist before old owners are deleted
      // which allows proper history tracking and duplicate detection
      await Promise.all(ownerPromises);
      console.log("✅ All owner creates/updates completed.");
      
      // Clear individual success messages from creates/updates to prevent duplicate notifications
      dispatch(clearMessage());
      
      // Now run deletes after all creates/updates are done
      await Promise.all(deletePromises);
      console.log("✅ All owner deletions completed.");

      // Clear any delete success messages before setting the final success message
      dispatch(clearMessage());

      await dispatch(fetchOwnerList(unitId));
      setDocsToDelete({}); // Clear after submission

      if (memberIds && memberIds.length > 0) {
        // Fetch each member individually to avoid API issues
        memberIds.forEach((memberId) => {
          if (memberId) {
            dispatch(fetchMemberById(memberId));
          }
        });
      }

      // Clear all states after successful submission
      setSearchTerms({});
      setLocalError(null);
      setTransferValidationError(null);
      setHasFileChanges(false);
      setInitialValues(null);
      setTransferredPercentages({});
      setOriginalPercentages({});
      setHasTransfers(false);
      setDateValidationErrors({});
      setIsMemberModalOpen(false);
      setShowCompanyModal(false);

      // Clear form fields array - the useEffect will handle adding new owner form with autofill
      // after fetchOwnerList updates the ownerState
      replace([]);
      ownerRefs.current = [];

      // Show success message and redirect
      dispatch(setSuccessMessage("Unit Owner Change has been successfully Completed"));
    } catch (error) {
      // Error handling
      console.error("🚨 Error submitting form:", error);
      const errorMessage = parseOwnerError(error);
      setLocalError(errorMessage);
    } finally {
      // Always clear loading state
      setIsSubmitting(false);
    }
  };

  // Add this function to clear new owner fields
  const resetNewOwnerFields = () => {
    fields.forEach((field, index) => {
      if (!watch(`owners.${index}.isExisting`)) {
        setValue(`owners.${index}.memberId`, "");
        setValue(`owners.${index}.ownershipTransferFromId`, "");
        setValue(`owners.${index}.ownershipPercentage`, "");
        setValue(`owners.${index}.dateofOwnership`, "");
        setValue(`owners.${index}.document`, []);
        setValue(`owners.${index}.docLinks`, []);
      }
    });
  };

  return (
    <>
      <AddCompany
        isOpen={showCompanyModal}
        onClose={() => setShowCompanyModal(false)}
        fields={fields}
      />

      {/* Only show MessageBox for errors OR our final success message (not intermediate create/update/delete messages) */}
      {(localError ||
        transferValidationError ||
        ownerState.error ||
        (ownerState.successMessage && ownerState.successMessage.includes("Unit Owner Change has been successfully Completed"))) && (
        <MessageBox
          message={
            localError ||
            transferValidationError ||
            (ownerState.successMessage && ownerState.successMessage.includes("Unit Owner Change has been successfully Completed") ? ownerState.successMessage : null) ||
            parseOwnerError(ownerState.error)
          }
          error={!!(localError || transferValidationError || ownerState.error)}
          clearMessage={() => {
            if (localError) {
              setLocalError(null);
            } else if (transferValidationError) {
              setTransferValidationError(null);
              // Clear all new owner fields ONLY if the error is about duplicate recipients
              // For other errors, keep the form data so users can fix the issue
              if (
                transferValidationError ===
                "Cannot transfer ownership from multiple owners to the same new owner in one operation."
              ) {
                if (
                  typeof replace === "function" &&
                  typeof fields !== "undefined"
                ) {
                  const onlyExisting = fields.filter((_, idx) =>
                    watch(`owners.${idx}.isExisting`)
                  );
                  replace(onlyExisting);
                  setSearchTerms((prev) => {
                    const newTerms = {};
                    onlyExisting.forEach((_, idx) => {
                      newTerms[idx] = prev[idx] || "";
                      newTerms[`from_${idx}`] = prev[`from_${idx}`] || "";
                    });
                    return newTerms;
                  });
                }
              }
              // Removed resetNewOwnerFields() call - keep form data for other errors
            } else {
              dispatch(clearMessage());
            }
          }}
          onOk={() => {
            if (localError) {
              setLocalError(null);
            } else if (transferValidationError) {
              setTransferValidationError(null);
              // Clear all new owner fields ONLY if the error is about duplicate recipients
              // For other errors, keep the form data so users can fix the issue
              if (
                transferValidationError ===
                "Cannot transfer ownership from multiple owners to the same new owner in one operation."
              ) {
                if (
                  typeof replace === "function" &&
                  typeof fields !== "undefined"
                ) {
                  const onlyExisting = fields.filter((_, idx) =>
                    watch(`owners.${idx}.isExisting`)
                  );
                  replace(onlyExisting);
                  setSearchTerms((prev) => {
                    const newTerms = {};
                    onlyExisting.forEach((_, idx) => {
                      newTerms[idx] = prev[idx] || "";
                      newTerms[`from_${idx}`] = prev[`from_${idx}`] || "";
                    });
                    return newTerms;
                  });
                }
              }
              // Removed resetNewOwnerFields() call - keep form data for other errors
            } else {
              dispatch(clearMessage());
              // Only navigate on the final success message (not intermediate update/create/delete messages)
              if (
                ownerState.successMessage &&
                ownerState.successMessage.includes("Unit Owner Change has been successfully Completed")
              ) {
                dispatch(setActiveTabs(3));
                navigate(-1);
              }
            }
          }}
        />
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="p-4 sm:p-5">
        {/* Current Ownership Details Section */}
        {fields.some((field) =>
          watch(`owners.${fields.indexOf(field)}.isExisting`)
        ) && (
          <div className="mb-6 sm:mb-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-semibold text-teal-600">
                Current Ownership Details
              </h3>
            </div>
            {fields.map((field, index) => {
              if (!watch(`owners.${index}.isExisting`)) return null;

              const memberId = watch(`owners.${index}.memberId`);
              const originalPercentage = parseFloat(
                originalPercentages[memberId] || 0
              );
              const transferredPercentage =
                transferredPercentages[memberId] || 0;
              const adjustedPercentage =
                originalPercentage - transferredPercentage;

              console.log("📊 Old Owner Details:", {
                ownerId: memberId,
                originalPercentage: originalPercentage.toFixed(2) + "%",
                transferredPercentage: transferredPercentage.toFixed(2) + "%",
                adjustedPercentage: adjustedPercentage.toFixed(2) + "%"
              });

              return (
                <div
                  key={field.id}
                  className="relative bg-gray-50 border rounded-2xl p-4 shadow-sm mb-4"
                >
                  <div className="flex items-start justify-between">
                    <h4 className="text-sm font-medium mb-3 text-gray-600">
                      {getOrdinal(index + 1)} Ownership Details
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-2 lg:w-[687px]">
                    <div className="login-field sm:col-span-5">
                      <Paragraph className="my-2 text-xs font-medium text-gray-600">
                        Unit Owner Name
                      </Paragraph>
                      <input
                        type="text"
                        value={searchTerms[index] || ""}
                        onChange={(e) => {
                          setSearchTerms((prev) => ({
                            ...prev,
                            [index]: e.target.value
                          }));
                        }}
                        className="login-field-input"
                        disabled={true}
                        readOnly={true}
                      />
                    </div>

                    <div className="login-field sm:col-span-3">
                      <Paragraph className="my-2 text-xs font-medium text-gray-600">
                        Ownership Percentage
                      </Paragraph>
                      <input
                        type="text"
                        value={
                          hasTransfers
                            ? adjustedPercentage.toFixed(2) + "%"
                            : originalPercentage.toFixed(2) + "%"
                        }
                        className="login-field-input"
                        disabled={true}
                        readOnly={true}
                      />
                    </div>

                    <div className="login-field sm:col-span-4">
                      <Paragraph className="my-2 text-xs font-medium text-gray-600">
                        Date of Ownership
                      </Paragraph>
                      <input
                        type="date"
                        {...register(`owners.${index}.dateofOwnership`)}
                        className="login-field-input"
                        disabled={true}
                        readOnly={true}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 lg:w-[687px] mt-3">
                    <div className="login-field">
                      {watch(`owners.${index}.docLinks`)?.length > 0 && (
                        <>
                          <Paragraph className="my-2 text-xs font-medium text-gray-600">
                            Ownership Documents
                          </Paragraph>

                          <FileDropzone
                            files={[]}
                            docLinks={watch(`owners.${index}.docLinks`) || []}
                            onDrop={() => {}}
                            onRemove={() => {}}
                            disabled={true}
                            readOnly={true}
                            showRemoveButton={false}
                            showUploadButton={false}
                            showDropzone={false}
                            hideDropzoneMessage={true}
                          />
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* New Ownership Details Section */}
        {fields.some(
          (field) => !watch(`owners.${fields.indexOf(field)}.isExisting`)
        ) && (
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3 sm:gap-0">
              <h3 className="text-base font-semibold text-primary">
                New Ownership Details
              </h3>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
                <button
                  type="button"
                  className={`flex flex-row justify-center items-center gap-1.5 w-full sm:w-[192px] h-12 px-4 bg-primary text-white rounded-lg text-sm sm:text-base font-medium leading-[140%] font-sans disabled:opacity-50 disabled:cursor-not-allowed ${
                    fields.some(
                      (_, index) =>
                        !watch(`owners.${index}.isExisting`) &&
                        !watch(`owners.${index}.memberId`)
                    )
                      ? "shadow-[inset_0px_7px_12px_rgba(255,255,255,0.08),inset_0px_-2px_2px_rgba(48,48,48,0.1)]"
                      : ""
                  }`}
                  onClick={() => setIsMemberModalOpen(true)}
                  disabled={
                    !fields.some(
                      (_, index) =>
                        !watch(`owners.${index}.isExisting`) &&
                        !watch(`owners.${index}.memberId`)
                    )
                  }
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="flex-none"
                  >
                    <line
                      x1="12"
                      y1="6"
                      x2="12"
                      y2="18"
                      stroke="#FFFFFF"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <line
                      x1="6"
                      y1="12"
                      x2="18"
                      y2="12"
                      stroke="#FFFFFF"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="font-sans">
                    Add New Member
                  </span>
                </button>
                <button
                  type="button"
                  className={`flex flex-row justify-center items-center gap-1.5 w-full sm:w-[192px] h-12 px-4 bg-primary text-white rounded-lg text-sm sm:text-base font-medium leading-[140%] font-sans disabled:opacity-50 disabled:cursor-not-allowed ${
                    fields.some(
                      (_, index) =>
                        !watch(`owners.${index}.isExisting`) &&
                        !watch(`owners.${index}.memberId`)
                    )
                      ? "shadow-[inset_0px_7px_12px_rgba(255,255,255,0.08),inset_0px_-2px_2px_rgba(48,48,48,0.1)]"
                      : ""
                  }`}
                  onClick={() => setShowCompanyModal(true)}
                  disabled={
                    !fields.some(
                      (_, index) =>
                        !watch(`owners.${index}.isExisting`) &&
                        !watch(`owners.${index}.memberId`)
                    )
                  }
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="flex-none"
                  >
                    <line
                      x1="12"
                      y1="6"
                      x2="12"
                      y2="18"
                      stroke="#FFFFFF"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <line
                      x1="6"
                      y1="12"
                      x2="18"
                      y2="12"
                      stroke="#FFFFFF"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="font-sans whitespace-nowrap">
                    Add New Company
                  </span>
                </button>
              </div>
            </div>
            {fields.map((field, index) => {
              if (watch(`owners.${index}.isExisting`)) return null;

              const filePath = `owners.${index}.document`;
              const files = watch(filePath) || [];
              const docLinks = watch(`owners.${index}.docLinks`) || [];
              ownerRefs.current[index] =
                ownerRefs.current[index] || React.createRef();

              return (
                <div
                  ref={ownerRefs.current[index]}
                  key={field.id}
                  className="relative bg-white border rounded-2xl p-4 shadow-sm mb-4"
                >
                  <div className="flex items-start justify-between">
                    <h4 className="text-sm font-medium mb-3 text-gray-600">
                      {getOrdinal(index + 1)} Ownership Details
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 gap-2 lg:w-[687px] items-start">
                    <div className="login-field !mt-0">
                      <div className="mb-2 text-left">
                        <label className="text-sm font-medium text-gray-900">
                          Transfer Ownership From*
                        </label>
                      </div>
                      <OwnerTransferFromAutocomplete
                        value={searchTerms[`from_${index}`] || ""}
                        memberId={
                          watch(`owners.${index}.ownershipTransferFromId`) || ""
                        }
                        owners={ownerState.ownerList?.owners || []}
                        onSelect={(member) => {
                          // Handle clearing - when member.id is empty, clear the field
                          if (!member || !member.id) {
                            setSearchTerms((prev) => ({
                              ...prev,
                              [`from_${index}`]: ""
                            }));
                            setValue(
                              `owners.${index}.ownershipTransferFromId`,
                              "",
                              {
                                shouldValidate: true
                              }
                            );
                            return;
                          }

                          // Update the search terms
                          setSearchTerms((prev) => ({
                            ...prev,
                            [`from_${index}`]: member.full_name
                          }));

                          // Update the form field
                          setValue(
                            `owners.${index}.ownershipTransferFromId`,
                            member.id,
                            {
                              shouldValidate: true
                            }
                          );
                        }}
                        disabled={false}
                        hideClearButton={false}
                        hideSearchIcon={true}
                      />

                      {errors.owners?.[index]?.ownershipTransferFromId && (
                        <p className="text-red-500 text-xs mt-1">
                          {errors.owners[index].ownershipTransferFromId.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 lg:w-[687px] items-start">
                    <div className="login-field !mt-0">
                      <div className="mb-2 text-left">
                        <label className="text-sm font-medium text-gray-900">
                          Transfer Ownership To*
                        </label>
                      </div>
                      <MemberSearchAutocomplete
                        value={searchTerms[index] || ""}
                        memberId={watch(`owners.${index}.memberId`) || ""}
                        onSelect={(member) => {
                          // Update the search terms
                          setSearchTerms((prev) => ({
                            ...prev,
                            [index]: member.full_name
                          }));

                          // Update the form field
                          setValue(`owners.${index}.memberId`, member.id, {
                            shouldValidate: true
                          });
                        }}
                        unitId={unitId}
                        isOwnerSearch={false}
                        disabled={false}
                        readOnly={false}
                        isDisabled={false}
                        hideClearButton={false}
                        hideSearchIcon={true}
                        radioGroupId={`transfer-to-${index}`}
                      />

                      {errors.owners?.[index]?.memberId && (
                        <p className="text-red-500 text-xs mt-1">
                          {errors.owners[index].memberId.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:w-[687px] items-start">
                    <div className="login-field !mt-0">
                      <div className="mb-2 text-left">
                        <label className="text-sm font-medium text-gray-900">
                          Ownership Percentage*
                        </label>
                      </div>
                      <Controller
                        name={`owners.${index}.ownershipPercentage`}
                        control={control}
                        render={({ field }) => (
                          <input
                            type="number"
                            {...field}
                            placeholder="%"
                            step="0.01"
                            onChange={(e) => {
                              field.onChange(e);
                              handleOwnershipPercentageChange(e, field, index);
                            }}
                            className="login-field-input"
                            autoFocus={false}
                            tabIndex={-1}
                          />
                        )}
                      />
                      {errors.owners?.[index]?.ownershipPercentage && (
                        <p className="text-red-500 text-sm mt-1">
                          {errors.owners[index].ownershipPercentage.message}
                        </p>
                      )}
                    </div>

                    <div className="login-field !mt-0">
                      <Controller
                        name={`owners.${index}.dateofOwnership`}
                        control={control}
                        render={({ field }) => (
                          <ModernDatePicker
                            label="Date of Ownership"
                            value={field.value || ""}
                            onChange={(value) => {
                              field.onChange(value);
                              // Create a synthetic event object for handleDateChange
                              const syntheticEvent = {
                                target: { value: value }
                              };
                              handleDateChange(syntheticEvent, index);
                            }}
                            placeholder="Select date of ownership"
                            name={`owners.${index}.dateofOwnership`}
                            error={errors.owners?.[index]?.dateofOwnership?.message || dateValidationErrors[index] || ""}
                            required
                            labelClassName="text-sm font-medium text-gray-900"
                          />
                        )}
                      />
                    </div>

                    <div className="login-field sm:col-span-2 !mt-0">
                      <div className="mb-2 text-left">
                        <label className="text-sm font-medium text-gray-900">
                          Upload Ownership Documents
                        </label>
                      </div>

                      <FileDropzone
                        files={files}
                        docLinks={docLinks}
                        onDrop={(acceptedFiles) => {
                          // Get current files value to avoid stale closure
                          const currentFiles = watch(filePath) || [];
                          const newFiles = [...currentFiles, ...acceptedFiles];
                          if (newFiles.length > 5) {
                            setError(`owners.${index}.document`, {
                              type: "manual",
                              message:
                                "You can upload a maximum of 5 documents."
                            });
                            return;
                          }
                          // Use shouldValidate: false for file operations to avoid expensive validation
                          setValue(filePath, newFiles, {
                            shouldDirty: true,
                            shouldValidate: false
                          });
                          clearErrors(`owners.${index}.document`);
                        }}
                        onRemove={(idx, type) => {
                          if (type === "file") {
                            // Get current files value to avoid stale closure
                            const currentFiles = watch(filePath) || [];
                            const updatedFiles = currentFiles.filter(
                              (_, i) => i !== idx
                            );
                            setValue(filePath, updatedFiles, {
                              shouldDirty: true,
                              shouldValidate: false
                            });
                            if (updatedFiles.length <= 5) {
                              clearErrors(`owners.${index}.document`);
                            }
                          } else if (type === "docLink") {
                            // Get current docLinks value to avoid stale closure
                            const currentDocLinks = watch(`owners.${index}.docLinks`) || [];
                            const removedDoc = currentDocLinks[idx];
                            if (removedDoc && removedDoc.id) {
                              const ownerDbId = watch(`owners.${index}.id`);
                              if (ownerDbId) {
                                setDocsToDelete((prev) => ({
                                  ...prev,
                                  [ownerDbId]: [
                                    ...(prev[ownerDbId] || []),
                                    removedDoc.id
                                  ]
                                }));
                              }
                            }
                            const updatedDocLinks = currentDocLinks.filter(
                              (_, i) => i !== idx
                            );
                            setValue(
                              `owners.${index}.docLinks`,
                              updatedDocLinks,
                              {
                                shouldDirty: true,
                                shouldValidate: false
                              }
                            );
                          }
                        }}
                        showRemoveButton={true}
                        showUploadButton={true}
                        showDropzone={true}
                      />

                      {errors.owners?.[index]?.document && (
                        <div className="text-red-500 text-xs mt-2">
                          {errors.owners[index].document.message}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-6">
          <button
            type="submit"
            className={`flex flex-row justify-center items-center gap-1.5 w-full h-12 px-4 bg-primary text-white rounded-lg text-base font-medium leading-[140%] disabled:opacity-50 disabled:cursor-not-allowed font-sans ${
              hasActualChanges || hasFileChanges
                ? "shadow-[inset_0px_7px_12px_rgba(255,255,255,0.08),inset_0px_-2px_2px_rgba(48,48,48,0.1)]"
                : ""
            }`}
            disabled={
              ownerState.loading ||
              isSubmitting ||
              (!hasActualChanges && !hasFileChanges) ||
              hasValidationErrors
            }
          >
            {ownerState.loading || isSubmitting ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </span>
            ) : (
              "Save"
            )}
          </button>
        </div>
      </form>

      <AddMemberForm
        isOpen={isMemberModalOpen}
        onClose={() => setIsMemberModalOpen(false)}
        unitId={unitId}
      />
    </>
  );
};

ChangeOwnerForm.propTypes = {
  unitId: PropTypes.string.isRequired
};

export default ChangeOwnerForm;