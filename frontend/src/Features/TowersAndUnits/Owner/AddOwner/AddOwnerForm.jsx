import React, { useEffect, useState, useRef } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

import {
  createOwner,
  bulkCreateOwner,
  clearCreatedMember,
  clearMessage,
  fetchOwnerList,
  setSuccessMessage,
  setCreatedMember,
  CreatememberForUnit,
  clearPendingMemberData,
  clearPendingCompanyData,
  deleteOwner
} from "../../../../redux/slices/owner/ownerSlice";
import { createCompany } from "../../../../redux/slices/api/companyApi";

import {
  getOrdinal,
  formatDate,
  ownerValidationSchema,
  parseOwnerError
} from "../utils/ownerUtils";

import { Paragraph } from "../../../../Components/Ui/Paragraph";
import NumberInputComponent from "../../../../Components/FormComponent/NumberInputComponent";
import FileDropzone from "../Components/FileDropzone";
import { FaMinus, FaPlus } from "react-icons/fa";
import AddMemberForm from "../Components/Modals/AddMemberForm";
import AddCompany from "../AddCompany/AddCompany";
import MemberSearchAutocomplete from "../../../../Components/MemberSearchAutocomplete/MemberSearchAutocomplete";
import MessageBox from "../../../../Components/MessageBox/MessageBox";
import { clearCreatedCompany } from "../../../../redux/slices/companySlice";
import ModernLoadingAnimation from "../../../../Components/Loaders/ModernLoadingAnimation";
import ModernDatePicker from "../../../../Components/FormComponent/ModernDatePicker";
import axiosInstance from "../../../../utils/axiosInstance";
import "../../../../Components/FormComponent/FormComponent.css";

const AddOwnerForm = ({ unitId }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const ownerState = useSelector((state) => state.owner);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [searchTerms, setSearchTerms] = useState({});
  const companyData = useSelector((state) => state.company.company_data);
  const [localError, setLocalError] = useState(null);
  const [isFormChanged, setIsFormChanged] = useState(false);
  const [isCreatingOwners, setIsCreatingOwners] = useState(false);
  const [creationProgress, setCreationProgress] = useState({ current: 0, total: 0 });

  // Clear messages when component mounts and unmounts
  useEffect(() => {
    dispatch(clearMessage());
    return () => {
      dispatch(clearMessage());
    };
  }, [dispatch]);

  // Fetch existing owners when component mounts
  useEffect(() => {
    dispatch(fetchOwnerList(unitId));
  }, [dispatch, unitId]);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    setError,
    clearErrors,
    formState: { errors },
    watch
  } = useForm({
    resolver: yupResolver(ownerValidationSchema),
    defaultValues: {
      owners: [
        {
          memberId: "",
          ownershipPercentage: "",
          dateofOwnership: "",
          document: []
        }
      ]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "owners"
  });

  const ownerRefs = useRef([]);
  useEffect(() => {
    if (companyData?.data?.member && companyData?.data?.company_name) {
      // console.log("add owner aaaaaaaaaaaa", companyData);

      dispatch(
        setCreatedMember({
          id: companyData.data.member,
          full_name: companyData.data.company_name
        })
      );
    }
  }, [companyData]);

  useEffect(() => {
    if (ownerState.createdMember) {
      // Check if member already exists in any ownership block
      const existingOwnerIndex = fields.findIndex(
        (_, index) =>
          watch(`owners.${index}.memberId`) === ownerState.createdMember.id
      );

      if (existingOwnerIndex !== -1) {
        // Option 1: Show error message
        setLocalError("This owner has already been added.");
        dispatch(clearCreatedMember());
        dispatch(clearMessage());
        setIsMemberModalOpen(false);
        return;
      }

      const emptyIndex = fields.findIndex(
        (_, index) => !watch(`owners.${index}.memberId`)
      );
      const indexToUse = emptyIndex !== -1 ? emptyIndex : fields.length;

      if (emptyIndex === -1) {
        append({
          memberId: "",
          ownershipPercentage: "",
          dateofOwnership: "",
          document: []
        });
      }

      setTimeout(() => {
        const createdMember = ownerState.createdMember;
        setValue(`owners.${indexToUse}.memberId`, createdMember.id);
        // Store pending data if this is a pending member/company
        // CRITICAL: Always store pendingData if it exists, even if isPending flag is missing
        if (createdMember.pendingData) {
          console.log(`📝 Storing pending data for owner at index ${indexToUse}:`, {
            id: createdMember.id,
            full_name: createdMember.full_name,
            isPending: createdMember.isPending,
            hasPendingData: !!createdMember.pendingData,
            isCompany: !!createdMember.pendingData.company_name
          });
          setValue(`owners.${indexToUse}.pendingData`, createdMember.pendingData);
          setValue(`owners.${indexToUse}.isPending`, createdMember.isPending || true);
        } else if (createdMember.isPending) {
          // Fallback: if isPending is true but no pendingData, log warning
          console.warn(`⚠️ Owner marked as pending but no pendingData:`, createdMember);
          setValue(`owners.${indexToUse}.isPending`, true);
        }
        setSearchTerms((prev) => ({
          ...prev,
          [indexToUse]: createdMember.full_name
        }));

        ownerRefs.current[indexToUse]?.current?.scrollIntoView({
          behavior: "smooth"
        });
        // Focus on the "Unit Owner Name" input field
        requestAnimationFrame(() => {
          setTimeout(() => {
            const ownerRef = ownerRefs.current[indexToUse]?.current;
            if (ownerRef) {
              // Find the "Unit Owner Name" input directly by placeholder
              const unitOwnerNameInput = ownerRef.querySelector('input[placeholder="Enter Name"]');
              if (unitOwnerNameInput) {
                // Blur any other focused elements first
                if (document.activeElement && document.activeElement !== unitOwnerNameInput) {
                  document.activeElement.blur();
                }
                // Small delay to ensure blur completes
                setTimeout(() => {
                  unitOwnerNameInput.focus({ preventScroll: false });
                }, 50);
              }
            }
          }, 100);
        });

        dispatch(clearCreatedMember());
        dispatch(clearCreatedCompany());
        setIsMemberModalOpen(false);
      }, 100);
    }
  }, [ownerState.createdMember, fields, watch, setValue, append, dispatch]);
  const onSubmit = async (data) => {
    if (errors.owners?.message) return;

    // Check if any owners exist
    if (ownerState.ownerList?.owners?.length > 0) {
      setLocalError("Cannot add new owners. Please go to Change Ownership page to modify owners.");
      return;
    }

    // Get all form values including non-validated fields like pendingData
    const allFormValues = getValues();
    const ownersWithPendingData = allFormValues.owners || data.owners;
    
    console.log(`📝 Form submission - Total owners: ${ownersWithPendingData.length}`);
    ownersWithPendingData.forEach((owner, idx) => {
      console.log(`  Owner ${idx + 1}:`, {
        memberId: owner.memberId,
        isPending: owner.isPending,
        hasPendingData: !!owner.pendingData,
        pendingDataType: owner.pendingData?.company_name ? 'company' : (owner.pendingData ? 'member' : 'none')
      });
    });

    // Check for duplicate members and merge their ownership percentages
    const memberOwnershipMap = new Map();
    ownersWithPendingData.forEach(owner => {
      const memberId = owner.memberId;
      const percentage = parseFloat(owner.ownershipPercentage || 0);

      if (memberOwnershipMap.has(memberId)) {
        // Merge ownership percentages for duplicate members
        const existingPercentage = memberOwnershipMap.get(memberId);
        memberOwnershipMap.set(memberId, existingPercentage + percentage);
      } else {
        memberOwnershipMap.set(memberId, percentage);
      }
    });

    // Validate individual ownership percentages
    const invalidOwnership = Array.from(memberOwnershipMap.values()).some(percentage => {
      return percentage <= 0 || percentage > 100;
    });

    if (invalidOwnership) {
      setLocalError("Each ownership percentage must be greater than 0 and less than or equal to 100%");
      return;
    }

    // Calculate total ownership with precise decimal handling (2 decimal places)
    const totalOwnership = Array.from(memberOwnershipMap.values()).reduce((sum, percentage) => {
      return sum + percentage;
    }, 0);

    // Round to 2 decimal places for comparison
    const roundedTotal = parseFloat(totalOwnership.toFixed(2));

    // Check if total ownership is exactly 100%
    if (roundedTotal !== 100) {
      setLocalError(
        `Total ownership percentage must be exactly 100%. Current total: ${roundedTotal}%`
      );
      return;
    }

    // Create a new array with merged ownership percentages
    // Note: If duplicates exist, we take the first occurrence's data (date, documents, pendingData)
    const mergedOwners = Array.from(memberOwnershipMap.entries()).map(([memberId, percentage]) => {
      // Find the original owner - prioritize ones with pendingData to ensure we don't lose pending member/company data
      let originalOwner = ownersWithPendingData.find(owner => 
        owner.memberId === memberId && (owner.pendingData || owner.isPending)
      );
      // If no pending owner found, find any owner with this memberId
      if (!originalOwner) {
        originalOwner = ownersWithPendingData.find(owner => owner.memberId === memberId);
      }
      if (!originalOwner) {
        console.error(`⚠️ Original owner not found for memberId: ${memberId}`);
        return null;
      }
      return {
        ...originalOwner,
        ownershipPercentage: percentage.toString(),
        // Preserve pending data if it exists (use from ownersWithPendingData to ensure we have it)
        pendingData: originalOwner.pendingData,
        isPending: originalOwner.isPending
      };
    }).filter(Boolean); // Remove any null entries
    
    console.log(`📋 Merged owners to create (${mergedOwners.length}):`, mergedOwners.map((o, idx) => ({
      index: idx + 1,
      memberId: o.memberId,
      percentage: o.ownershipPercentage,
      date: o.dateofOwnership,
      hasDocuments: o.document?.length > 0,
      isPending: o.isPending,
      hasPendingData: !!o.pendingData,
      pendingDataType: o.pendingData?.company_name ? 'company' : (o.pendingData ? 'member' : 'none')
    })));

    // Set loading state
    setIsCreatingOwners(true);
    setCreationProgress({ current: 0, total: mergedOwners.length });
    setLocalError(null);
    
    // Clear any existing success messages to prevent premature navigation
    dispatch(clearMessage());

    // Check if ANY owner has pending data
    const hasPendingOwners = mergedOwners.some(owner => 
      (owner.isPending && owner.pendingData) || 
      (typeof owner.memberId === 'string' && owner.memberId.startsWith('pending_'))
    );

    // If no pending owners, use bulk create endpoint for better performance and single notification
    if (!hasPendingOwners) {
      console.log('📦 No pending owners detected, using bulk create endpoint');
      
      try {
        const payload = {
          unit: parseInt(unitId, 10),
          owners: mergedOwners.map(owner => ({
            member: parseInt(owner.memberId, 10),
            ownership_percentage: parseFloat(owner.ownershipPercentage),
            date_of_ownership: formatDate(owner.dateofOwnership)
          }))
        };
        
        console.log('📦 Bulk create payload:', payload);
        
        const result = await dispatch(bulkCreateOwner(payload)).unwrap();
        
        console.log('✅ Bulk create result:', result);
        
        // Refresh owner list
        await dispatch(fetchOwnerList(unitId));
        
        // Set success message
        dispatch(setSuccessMessage(
          result.created === 1 
            ? "Owner created successfully" 
            : `${result.created} owners created successfully`
        ));
        
        // Reset loading state
        setIsCreatingOwners(false);
        setCreationProgress({ current: 0, total: 0 });
        
        return;
        
      } catch (error) {
        console.error('❌ Error in bulk create:', error);
        setLocalError(error?.message || error?.error || "Failed to create owners");
        setIsCreatingOwners(false);
        setCreationProgress({ current: 0, total: 0 });
        return;
      }
    }

    // Legacy sequential creation for owners with pending members/companies
    console.log('📋 Pending owners detected, using sequential creation');
    const results = [];
    const createdOwnerIds = []; // Track created owner IDs for cleanup
    let firstError = null; // Track the first error encountered
    
    for (let i = 0; i < mergedOwners.length; i++) {
      const owner = mergedOwners[i];
      
      // Update progress
      setCreationProgress({ current: i + 1, total: mergedOwners.length });
      
      let actualMemberId = owner.memberId;
      
      // Check if this owner has pending data (needs to create member/company first)
      // Also check if memberId starts with "pending_" as a fallback
      const hasPendingData = (owner.isPending && owner.pendingData) || 
                            (typeof owner.memberId === 'string' && owner.memberId.startsWith('pending_'));
      
      console.log(`🔍 Owner ${i + 1}/${mergedOwners.length}: memberId=${owner.memberId}, isPending=${owner.isPending}, hasPendingData=${!!owner.pendingData}, hasPendingData=${hasPendingData}`);
      
      if (hasPendingData) {
        if (!owner.pendingData) {
          const errorMessage = "Pending member/company data is missing";
          console.error(`❌ Pending owner ${i + 1}/${mergedOwners.length} has no pendingData. Owner data:`, {
            memberId: owner.memberId,
            isPending: owner.isPending,
            ownershipPercentage: owner.ownershipPercentage
          });
          firstError = { owner, error: errorMessage, index: i + 1, step: "validation" };
          break; // Stop processing immediately
        }
        try {
          console.log(`🔄 Creating member/company for pending owner ${i + 1}/${mergedOwners.length}...`);
          
          // Determine if this is a member or company based on pending data
          // Company has company_name field or is_comm_member = 1 and is_org_member = 0
          const isCompany = !!(owner.pendingData.company_name || 
                               (owner.pendingData.is_comm_member === 1 && owner.pendingData.is_org_member === 0) ||
                               (typeof owner.memberId === 'string' && owner.memberId.startsWith('pending_company_')));
          
          console.log(`🔍 Owner ${i + 1}: Detecting type - isCompany=${isCompany}`, {
            hasCompanyName: !!owner.pendingData.company_name,
            isCommMember: owner.pendingData.is_comm_member,
            isOrgMember: owner.pendingData.is_org_member,
            memberIdStartsWith: typeof owner.memberId === 'string' ? owner.memberId.substring(0, 20) : owner.memberId
          });
          
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
            // CompanySerializer returns member as an ID (integer), not a nested object
            actualMemberId = companyResult.data?.member || companyResult.member || companyResult.data?.member?.id || companyResult.member?.id;
            
            if (!actualMemberId) {
              throw new Error("Company created but member ID not returned");
            }
            
            console.log(`✅ Company created with member ID: ${actualMemberId}`);
          } else {
            // Create member (for_owner=1 so backend skips "New Organization Member Added" notification)
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
            memberFormData.append("for_owner", "1");

            const memberResult = await dispatch(CreatememberForUnit(memberFormData)).unwrap();
            actualMemberId = memberResult.member?.id;
            
            if (!actualMemberId) {
              throw new Error("Member created but ID not returned");
            }
            
            console.log(`✅ Member created with ID: ${actualMemberId}`);
          }
        } catch (error) {
          // Extract error message (handle both Axios errors and plain objects)
          const backendError = error?.response?.data || error;
          const errorMessage =
            backendError?.Error ||
            backendError?.error ||
            backendError?.message ||
            error?.message ||
            String(error);

          console.error(`❌ Error creating member/company for owner ${i + 1}/${mergedOwners.length}:`, error);
          firstError = { owner, error: errorMessage, index: i + 1, step: "member/company_creation" };
          break; // Stop processing immediately - block all operations
        }
      }
      
      // Now create the owner with the actual member ID
      const formData = new FormData();
      formData.append("member", actualMemberId);
      formData.append("unit", parseInt(unitId, 10));
      formData.append(
        "ownership_percentage",
        parseFloat(owner.ownershipPercentage)
      );
      formData.append("date_of_ownership", formatDate(owner.dateofOwnership));
      
      // Flag to suppress individual notifications during batch creation
      // We'll create a combined notification at the end instead
      formData.append("skip_notification", "true");

      // Handle file uploads
      if (owner.document && owner.document.length > 0) {
        owner.document.forEach((file) => {
          if (file instanceof File) {
            formData.append("owner_docs_upload", file);
          }
        });
      }

      console.log(`📦 Payload for Create Owner ${i + 1}/${mergedOwners.length}:`, {
        member: actualMemberId,
        unit: unitId,
        ownershipPercentage: owner.ownershipPercentage,
        date_of_ownership: formatDate(owner.dateofOwnership),
        documents: owner.document?.length || 0
      });

      try {
        // Wait for each owner creation to complete before proceeding to the next
        const result = await dispatch(createOwner(formData)).unwrap();
        
        // Extract owner ID from result for cleanup tracking
        const ownerId = result?.data?.id || result?.id;
        if (ownerId) {
          createdOwnerIds.push(ownerId);
        }
        
        // Verify the result contains the expected data
        if (!result || (result && !result.message && !result.data)) {
          console.warn(`⚠️ Owner ${i + 1}/${mergedOwners.length} API response missing expected data:`, result);
        }
        
        results.push({ success: true, owner, result, ownerId });
        console.log(`✅ Owner ${i + 1}/${mergedOwners.length} (Member ID: ${actualMemberId}, ${owner.ownershipPercentage}%) created successfully:`, result);
      } catch (error) {
        // Extract error message (handle both Axios errors and plain objects)
        const backendError = error?.response?.data || error;
        const errorMessage =
          backendError?.Error ||
          backendError?.error ||
          backendError?.message ||
          error?.message ||
          String(error);

        console.error(`❌ Error creating owner ${i + 1}/${mergedOwners.length} (Member ID: ${actualMemberId}):`, error);
        firstError = { owner, error: errorMessage, index: i + 1, step: "owner_creation" };
        break; // Stop processing immediately - block all operations
      }
      
      // Small delay between requests to avoid race conditions
      if (i < mergedOwners.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // CRITICAL: If any error occurred, clean up all created owners and block the operation
    if (firstError) {
      console.error(`🚨 Error occurred during owner creation. Cleaning up ${createdOwnerIds.length} created owners...`);
      
      // Delete all created owners in reverse order
      for (let i = createdOwnerIds.length - 1; i >= 0; i--) {
        try {
          await dispatch(deleteOwner(createdOwnerIds[i])).unwrap();
          console.log(`🗑️ Deleted owner ${createdOwnerIds[i]} as part of cleanup`);
        } catch (deleteError) {
          console.error(`⚠️ Failed to delete owner ${createdOwnerIds[i]} during cleanup:`, deleteError);
        }
      }
      
      // Extract and format error message
      const errorMessage = firstError.error?.Error || 
                          firstError.error?.error || 
                          firstError.error?.message || 
                          firstError.error || 
                          "An error occurred during owner creation";
      
      setLocalError(parseOwnerError(errorMessage));
      setIsCreatingOwners(false);
      setCreationProgress({ current: 0, total: 0 });
      return; // Exit early - don't proceed with success handling
    }
    
    // Clear pending data after successful processing
    dispatch(clearPendingMemberData());
    dispatch(clearPendingCompanyData());
    
    // Create batch notification if multiple owners were created successfully
    if (createdOwnerIds.length > 0) {
      try {
        console.log(`📧 Creating batch notification for ${createdOwnerIds.length} owners:`, createdOwnerIds);
        await axiosInstance.post('/api/notifications/batch_owner_notification/', {
          owner_ids: createdOwnerIds,
          unit_id: parseInt(unitId, 10)
        });
        console.log('✅ Batch notification created successfully');
      } catch (notificationError) {
        console.error('❌ Failed to create batch notification:', notificationError);
        // Don't fail the entire operation if notification fails
      }
    }
    
    // Refresh owner list to verify all owners were created
    const ownerListResult = await dispatch(fetchOwnerList(unitId));
    const actualOwnerCount = ownerListResult?.payload?.owners?.length || 0;
    const creationErrors = []; // Only populated when we collect errors; here we broke on first error so none

    console.log(`📊 Owner creation summary:`, {
      attempted: mergedOwners.length,
      successful: results.length,
      failed: creationErrors.length,
      actualInDatabase: actualOwnerCount,
      expectedInDatabase: results.length
    });
    
    // Verify all owners are actually in the database
    if (results.length !== actualOwnerCount && results.length === mergedOwners.length) {
      console.warn(`⚠️ Mismatch: ${results.length} owners reported as created, but ${actualOwnerCount} found in database`);
      setLocalError(
        `Warning: ${results.length} owners were reported as created, but only ${actualOwnerCount} are in the database. Please refresh and verify.`
      );
    } else if (results.length === mergedOwners.length) {
      // All owners created successfully and verified in database
      console.log("✅ All owners created successfully and verified:", results);
      
      // Set success message only after all owners are created
      dispatch(setSuccessMessage(
        mergedOwners.length === 1 
          ? "Owner created successfully" 
          : `${mergedOwners.length} owners created successfully`
      ));
    } else {
      // This should never happen due to early return on error, but handle it just in case
      console.error(`⚠️ Unexpected state: Only ${results.length} out of ${mergedOwners.length} owners were created`);
      setLocalError("An unexpected error occurred. Not all owners were created.");
    }
    
    // Reset loading state
    setIsCreatingOwners(false);
    setCreationProgress({ current: 0, total: 0 });
  };

  useEffect(() => {
    const subscription = watch((value) => {
      const hasChanged = value?.owners?.some((owner) => {
        return (
          owner.memberId ||
          owner.ownershipPercentage ||
          owner.dateofOwnership ||
          (owner.document && owner.document.length > 0)
        );
      });

      setIsFormChanged(hasChanged); // 🟢 Added for form change detection
    });

    return () => subscription.unsubscribe();
  }, [watch]);
  useEffect(() => {
    if (ownerState.successMessage) {
      setIsFormChanged(false); // 🟢 Reset form change detection after success
    }
  }, [ownerState.successMessage]);

  // Function to check if there are any validation errors visible under input fields
  const hasValidationErrors = () => {
    // Check for top-level owners array error
    if (errors.owners && typeof errors.owners === "object" && "message" in errors.owners) {
      return true;
    }

    // Check for string error on owners
    if (errors.owners && typeof errors.owners === "string") {
      return true;
    }

    // Check for field-level errors in each owner
    if (errors.owners && Array.isArray(errors.owners)) {
      const hasFieldErrors = errors.owners.some((ownerError) => {
        if (!ownerError) return false;
        
        // Check all possible field errors
        return !!(
          ownerError.memberId ||
          ownerError.ownershipPercentage ||
          ownerError.dateofOwnership ||
          ownerError.document
        );
      });
      
      if (hasFieldErrors) return true;
    }

    return false;
  };
  return (
    <>
      {ownerState.loading && (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50 z-50">
          <ModernLoadingAnimation />
        </div>
      )}

      <AddCompany
        isOpen={showCompanyModal}
        onClose={() => setShowCompanyModal(false)}
        fields={fields}
      />

      {(localError || ownerState.successMessage || ownerState.error) && (
        <MessageBox
          message={
            localError || 
            ownerState.successMessage || 
            parseOwnerError(ownerState.error)
          }
          error={!!(localError || ownerState.error)}
          clearMessage={() => {
            if (localError) {
              setLocalError(null);
            } else {
              dispatch(clearMessage());
            }
          }}
          onOk={() => {
            if (localError) {
              setLocalError(null);
              if (ownerState.ownerList?.owners?.length > 0) {
                navigate(`/unit/${unitId}/change-owner`);
              }
            } else {
              dispatch(clearMessage());
              if (ownerState.successMessage) {
                navigate(`/unit-details/${unitId}?tab=2`);
              }
            }
          }}
        />
      )}

      {!ownerState.ownerList?.owners?.length && (
        <form onSubmit={handleSubmit(onSubmit)} className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 mb-6">
            <button
              type="button"
              className={`flex flex-row justify-center items-center gap-1.5 w-full sm:w-[192px] h-12 px-4 bg-primary text-white rounded-lg text-sm sm:text-base font-medium leading-[140%] font-sans disabled:opacity-50 disabled:cursor-not-allowed ${
                fields.some((_, index) => !watch(`owners.${index}.memberId`))
                  ? 'shadow-[inset_0px_7px_12px_rgba(255,255,255,0.08),inset_0px_-2px_2px_rgba(48,48,48,0.1)]'
                  : ''
              }`}
              onClick={() => setIsMemberModalOpen(true)}
              disabled={!fields.some((_, index) => !watch(`owners.${index}.memberId`))}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="flex-none">
                <line x1="12" y1="6" x2="12" y2="18" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
                <line x1="6" y1="12" x2="18" y2="12" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span className="font-sans">Add New Member</span>
            </button>
            <button
              type="button"
              className={`flex flex-row justify-center items-center gap-1.5 w-full sm:w-[192px] h-12 px-4 bg-primary text-white rounded-lg text-sm sm:text-base font-medium leading-[140%] font-sans disabled:opacity-50 disabled:cursor-not-allowed ${
                fields.some((_, index) => !watch(`owners.${index}.memberId`))
                  ? 'shadow-[inset_0px_7px_12px_rgba(255,255,255,0.08),inset_0px_-2px_2px_rgba(48,48,48,0.1)]'
                  : ''
              }`}
              onClick={() => setShowCompanyModal(true)}
              disabled={!fields.some((_, index) => !watch(`owners.${index}.memberId`))}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="flex-none">
                <line x1="12" y1="6" x2="12" y2="18" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
                <line x1="6" y1="12" x2="18" y2="12" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span className="font-sans whitespace-nowrap">Add New Company</span>
            </button>
          </div>

          {fields.map((field, index) => {
            const filePath = `owners.${index}.document`;
            const files = watch(filePath) || [];
            ownerRefs.current[index] =
              ownerRefs.current[index] || React.createRef();

            return (
              <div
                ref={ownerRefs.current[index]}
                key={field.id}
                className="relative bg-white border border-gray-200 rounded-2xl px-6 py-6 shadow-sm mb-6"
              >
                <div className="flex items-start justify-between">
                  <h4 className="text-base font-medium mb-4 text-green">
                    {getOrdinal(index + 1)} Ownership Details
                  </h4>
                  {index === 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const newIndex = fields.length;
                        append({
                          memberId: "",
                          ownershipPercentage: "",
                          dateofOwnership: "",
                          document: []
                        });
                        // Focus on the "Unit Owner Name" field after adding new owner
                        requestAnimationFrame(() => {
                          setTimeout(() => {
                            const newOwnerRef = ownerRefs.current[newIndex]?.current;
                            if (newOwnerRef) {
                              newOwnerRef.scrollIntoView({ behavior: "smooth" });
                              // Find the "Unit Owner Name" input directly by placeholder
                              const unitOwnerNameInput = newOwnerRef.querySelector('input[placeholder="Enter Name"]');
                              if (unitOwnerNameInput) {
                                // Blur any other focused elements first
                                if (document.activeElement && document.activeElement !== unitOwnerNameInput) {
                                  document.activeElement.blur();
                                }
                                // Small delay to ensure blur completes
                                setTimeout(() => {
                                  unitOwnerNameInput.focus({ preventScroll: false });
                                }, 50);
                              }
                            }
                          }, 100);
                        });
                      }}
                      className="w-[36.58px] h-[36.58px] flex items-center justify-center relative transition-transform duration-200 hover:scale-110 active:scale-95"
                    >
                      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[25.87px] h-[25.87px] bg-surfaceTeal rounded-[19.5px] rotate-45 transition-all duration-200 hover:bg-[#D4E8E8]"></div>
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className="relative z-10">
                        <line x1="4" y1="1" x2="4" y2="7" stroke="#14181F" strokeWidth="1" strokeLinecap="round" />
                        <line x1="1" y1="4" x2="7" y2="4" stroke="#14181F" strokeWidth="1" strokeLinecap="round" />
                      </svg>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:w-[687px] items-start">
                  <div className="login-field sm:col-span-2 !mt-0">
                    <div className="mb-2 text-left">
                      <label className="text-sm font-medium text-gray-900">
                        Unit Owner Name*
                      </label>
                    </div>
                    <MemberSearchAutocomplete
                      value={searchTerms[index] || ""}
                      memberId={watch(`owners.${index}.memberId`)}
                      onSelect={(member) => {
                        setValue(`owners.${index}.memberId`, member.id);
                        setSearchTerms((prev) => ({
                          ...prev,
                          [index]: member.full_name
                        }));
                      }}
                      excludedMemberIds={fields
                        .filter((_, i) => i !== index) // Exclude current field itself
                        .map((_, i) => watch(`owners.${i}.memberId`))
                        .filter(Boolean)} // Only non-empty ids
                      hideSearchIcon={true}
                    />
                    {errors.owners?.[index]?.memberId && (
                      <p className="text-red-500 text-sm">
                        {errors.owners[index].memberId.message}
                      </p>
                    )}
                  </div>

                  <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
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
                            className="login-field-input"
                            autoFocus={false}
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
                              setIsFormChanged(true);
                            }}
                            placeholder="Select date of ownership"
                            name={`owners.${index}.dateofOwnership`}
                            error={errors.owners?.[index]?.dateofOwnership?.message || ""}
                            required
                            labelClassName="text-sm font-medium text-gray-900"
                          />
                        )}
                      />
                    </div>
                  </div>
                  </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:w-[687px] items-start">
                  <div className="login-field sm:col-span-2 !mt-0">
                    <div className="mb-2 text-left">
                      <label className="text-sm font-medium text-gray-900">
                        Upload Ownership Documents
                      </label>
                    </div>

                    <FileDropzone
                      files={files}
                      onDrop={(acceptedFiles) => {
                        const currentFiles = watch(filePath) || [];

                        if (currentFiles.length + acceptedFiles.length > 5) {
                          setError(`owners.${index}.document`, {
                            type: "manual",
                            message: "You can upload a maximum of 5 documents."
                          });
                          return;
                        }

                        setValue(filePath, [...currentFiles, ...acceptedFiles]);
                        clearErrors(`owners.${index}.document`);
                      }}
                      onRemove={(fileIndex) => {
                        const updated = files.filter((_, i) => i !== fileIndex);
                        setValue(filePath, updated);
                        if (updated.length <= 5) {
                          clearErrors(`owners.${index}.document`);
                        }
                      }}
                    />
                    {errors?.owners?.[index]?.document && (
                      <div className="text-red-500 text-sm mt-2">
                        {errors.owners[index].document.message}
                      </div>
                    )}
                  </div>
                </div>
                {fields.length > 1 && index !== 0 && (
                  <button
                    type="button"
                    className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-black"
                    onClick={() => remove(index)}
                  >
                    <FaMinus size={12} />
                  </button>
                )}
              </div>
            );
          })}

          {typeof errors.owners === "object" && "message" in errors.owners && (
            <p className="text-red-500 text-sm text-center mb-4">
              {errors.owners.message}
            </p>
          )}

          {typeof errors.owners === "string" && (
            <p className="text-red-500 text-sm text-center mb-4">
              {errors.owners}
            </p>
          )}

          <div className="mt-6">
            <button
              type="submit"
              className={`flex flex-row justify-center items-center gap-1.5 w-full h-12 px-4 bg-primary text-white rounded-lg text-base font-medium leading-[140%] disabled:opacity-50 disabled:cursor-not-allowed font-sans ${
                !(ownerState.loading || !isFormChanged || isCreatingOwners)
                  ? 'shadow-[inset_0px_7px_12px_rgba(255,255,255,0.08),inset_0px_-2px_2px_rgba(48,48,48,0.1)]'
                  : ''
              }`}
              disabled={ownerState.loading || !isFormChanged || isCreatingOwners || hasValidationErrors()}
            >
              {isCreatingOwners 
                ? `Creating Owners... (${creationProgress.current}/${creationProgress.total})`
                : ownerState.loading 
                  ? "Saving..." 
                  : "Save"
              }
            </button>
          </div>
        </form>
      )}

      <AddMemberForm
        isOpen={isMemberModalOpen}
        onClose={() => setIsMemberModalOpen(false)}
        unitId={unitId}
      />
    </>
  );
};

export default AddOwnerForm;
