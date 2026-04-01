import {useState,useEffect} from "react";
import { useDispatch, useSelector } from "react-redux";
import { clearMessage } from "../../../../redux/slices/companySlice";
import { setCreatedMember, setPendingCompanyData } from "../../../../redux/slices/owner/ownerSlice";
import { useNavigate } from "react-router-dom";


const useCompanySubmit = (formData, validateForm, activeTab, unitId,onClose) => {
const dispatch = useDispatch();
const { message, error,company} = useSelector((state) => state.company);
const [showMessage, setShowMessage] = useState(false);
const [loading, setLoading] = useState(false);




  const handleSubmitCompany = (e) => {
    e.preventDefault();

    const validationPassed = validateForm(formData, activeTab);
    if (!validationPassed) return;

    // Normalize required fields
    const cleanedFormData = { ...formData };
    cleanedFormData.full_name = cleanedFormData.company_name;
    cleanedFormData.unit_id = unitId;
    cleanedFormData.is_comm_member = 1;
    cleanedFormData.comm_member_ever_created = 1;
    cleanedFormData.is_org_member = 0;

   
    // Handle existing company case
    if((cleanedFormData.is_first_login || cleanedFormData.delivery_method) && !(cleanedFormData.login=='email' || cleanedFormData.login=='contact')){
      // This is an existing company, just use the member_id
      dispatch(
        setCreatedMember({
          id: cleanedFormData.member_id,
          full_name: cleanedFormData.full_name
        })
      );
      onClose();
      return;
    }
     
    if(cleanedFormData.login=='email'){
      cleanedFormData.login_email = cleanedFormData.email || cleanedFormData.login_email || cleanedFormData.general_email;
    }

    if(cleanedFormData.login=='contact'){
      cleanedFormData.login_contact = cleanedFormData.contact || cleanedFormData.login_contact || cleanedFormData.general_contact;
    }

    // Instead of creating the company immediately, store the form data as pending
    // The company will be created when the owner is saved
    dispatch(setPendingCompanyData(cleanedFormData));
    
    // Set a temporary ID for the pending company (will be replaced with real ID after creation)
    const tempId = `pending_company_${Date.now()}`;
    dispatch(
      setCreatedMember({
        id: tempId,
        full_name: cleanedFormData.company_name || cleanedFormData.full_name,
        isPending: true,
        pendingData: cleanedFormData
      })
    );
    
    // Close the modal on success
    onClose();
  };

  useEffect(() => {

    // console.log('company_data',company)
    if (message || error) {
      setShowMessage(true);
    }
  }, [message, error]);

  const handleDismissMessage = () => {
    dispatch(clearMessage());
    setShowMessage(false);
  };


  return {
    handleSubmitCompany,
    loading,
    showMessage,
    message,
    error,
    handleDismissMessage
  };
};

export default useCompanySubmit;
