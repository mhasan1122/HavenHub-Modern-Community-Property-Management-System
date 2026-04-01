import { useEffect, useState } from 'react';
import TextInputComponent from '../../../Components/FormComponent/TextInputComponent';
import NumberInputComponent from '../../../Components/FormComponent/NumberInputComponent';
import Button from '../../../Components/FormComponent/ButtonComponent/Button';
import TextareaComponent from '../../../Components/FormComponent/TextareaComponent';
import SelectComponent from '../../../Components/FormComponent/SelectComponent';
import RadioComponent from '../../../Components/FormComponent/RadioComponent';
import { BiArrowBack } from 'react-icons/bi';
import { FaPlus } from 'react-icons/fa';
import EmailInputComponent from '../../../Components/FormComponent/EmailInputComponent';
import { IoCloseOutline } from "react-icons/io5";
import { Link } from 'react-router-dom';
import EstateTable from '../../../Components/Table/EstateTable';
// import { Createmember } from '../../../api/membersApi/membersApi';
import SingleImageUpload from '../../../utils/SingleImageUpload';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { fetchroleData } from '../../../api/rolesApi/rolesApi';
// import { fetchmemberTypeData } from '../../../api/membersApi/membersApi';
import { RxCross2 } from "react-icons/rx";
import  { formFields } from "./../../../utils/formFields";


import './AddMember.css';
import ErrorMessage from '../../../Components/MessageBox/ErrorMessage';
import { useDispatch, useSelector } from 'react-redux';
import { Createmember, fetchmemberTypeData } from '../../../redux/slices/api/memberApi';
// import { Createmember, fetchmemberTypeData } from '../../../api/membersApi/membersApi';
// import { Createmember } from '../../../api/membersApi/membersApi';
// import { Createmember,fetchmemberTypeData } from './../../../redux/slices/api/memberApi';

// const formFields = {
//     full_name: { name: 'full_name', label: 'Full Name', type: 'text' },
//     email: { name: 'email', label: 'E-mail*', type: 'email' },
//     contact: { name: 'contact', label: 'Contact Number', type: 'number' },
//     nid_number: { name: 'nid_number', label: 'NID Number', type: 'number' },
//     permanent_address: { name: 'permanent_address', label: 'Permanent Address', type: 'text' },
//     present_address: { name: 'present_address', label: 'Present Address', type: 'text' },
//     gender: {
//         name: 'gender',
//         label: 'Gender',
//         type: 'radio',
//         options: [
//             { label: 'Male', value: 'male' },
//             { label: 'Female', value: 'female' },
//             { label: 'Other', value: 'other' },
//         ]
//     },
//     date_of_birth: { name: 'date_of_birth', label: 'Date Of Birth', type: 'Date' },
//     occupation: { name: 'occupation', label: 'Occupation', type: 'text' },
//     marital_status: {
//         name: 'marital_status',
//         label: 'Select Marital Status',
//         options: [
//             { label: 'Single', value: 'single' },
//             { label: 'Married', value: 'married' },
//             { label: 'Divorced', value: 'divorced' },
//             { label: 'Widowed', value: 'widowed' },
//         ]
//     },
//     religion: {
//         name: 'religion',
//         label: 'Select Religion',
//         options: [
//             { label: 'Islam', value: 'islam' },
//             { label: 'Christianity', value: 'christianity' },
//             { label: 'Hinduism', value: 'hinduism' },
//             { label: 'Buddhism', value: 'buddhism' },
//             { label: 'Judaism', value: 'judaism' },
//             { label: 'Other', value: 'other' },
//         ]
//     },
//     about_us: { name: 'about_us', label: 'About Us', type: 'textarea', rows: 6 },
//     facebook_profile: { name: 'facebook_profile', label: 'facebook profile', type: 'text' },
//     linkedin_profile: { name: 'linkedin_profile', label: 'linkedin profile', type: 'text' },
//     delivery_method: { name: 'delivery_method', label: 'User Name', type: 'text' },
//     member_type: {
//         name: 'member_type',
//         label: 'Type',
//         type: 'radio',
//         options: [
//             { label: 'Mandate of birthment', value: 1 },
//             { label: 'Property Staff', value: 2 }
//         ]
//     },
//     role_type: {
//         name: 'members_role',
//         label: 'Type',
//         type: 'CheckBox',
//         // option: []


//     },
//     login: {
//         name: 'login',
//         label: 'login',
//         type: 'radio',
//         options: [
//             { label: 'Email', value: 'Email' },
//             { label: 'Phone Number', value: 'Phone Number' }
//         ]
//     }
// }
const AddMember = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [addRoleModal, setAddRoleModal] = useState(false);
    const openModal = () => setIsModalOpen(true);
    const closeModal = () => setIsModalOpen(false);
    const openAddRoleModal = () => setAddRoleModal(true);
    const closeAddRoleModal = () => setAddRoleModal(false);
    const [activeTab, setActiveTab] = useState(1);
    const [formData, setFormData] = useState([]);
    const [datePicker, setdatePicker] = useState({ date_of_birth: '' });
    // const [role_type, setRole_type] = useState(formFields.role_type.options);
    const [roleType, setRoleType] = useState([]);
    const [selectedRoles, setSelectedRoles] = useState([]);

    const [file1, setFile1] = useState(null);
    const [file2, setFile2] = useState(null);
    const [file3, setFile3] = useState(null);
    const dispatch = useDispatch();
    const { roles } = useSelector((state) => state.role);
    const { members = [], loading, error } = useSelector((state) => state.member || {}); 
    const [errors, setErrors] = useState({});

    // # Member Information Store ....  Function to handle form submission.#
    const handleSubmit = (e) => {
        e.preventDefault();
        const formDataObject = new FormData();

        for (const key in formData) {
            if (formData.hasOwnProperty(key) && key !== "members_role") {
                formDataObject.append(key, formData[key]);
            }
        }
        let single_member_role = [];
        if (Array.isArray(formData.members_role)) {
            single_member_role = [...new Set(formData.members_role)]
                .filter((roleId) => roleId != null && roleId !== "" && roleId !== undefined) // Filter out null, undefined, and empty strings
                .map((roleId) => parseInt(roleId, 10))
                .filter((roleId) => !isNaN(roleId) && roleId > 0); // Filter out NaN and invalid numbers
        }

        single_member_role.forEach(roleId => {
            formDataObject.append("members_role", roleId);
        });
        console.log([...formDataObject.entries()]); 
        dispatch(Createmember(formDataObject));
    };


    const validateForm = () => {
        const newErrors = {};

        // Validate full_name
        if (!formData.full_name) {
            newErrors.full_name = 'Full name is required';
        }

        // Validate NID number
        if (!formData.nid_number) {
            newErrors.nid_number = 'NID Number is required';
        }

        // Validate contact number with the specific regex for allowed prefixes
        const contactRegex = /^(018|019|013|017|015|016|014)\d{8}$/;
        if (!formData.contact) {
            newErrors.contact = 'Contact Number is required';
        } else if (!contactRegex.test(formData.contact)) {
            newErrors.contact = 'Contact number must be 11 digits and start with one of the allowed prefixes (018, 019, 013, 017, 015, 016, 014)';
        }

        // Validate email
        if (!formData.email || !/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = 'Email is required or invalid';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0; // Returns true if no errors
    };

    const handleTabChange = (tabNumber) => {
        if (validateForm()) {
            setActiveTab(tabNumber);
        }
    };
    //  # Input Field Handler .... Handle change for input fields#
   const handleChange = (e) => {
    const { name, value } = e.target;

    // Handle formData update
    setFormData((prevState) => {
        if (name === 'login') {
            let deliveryMethod = '';

            // Check if login type is 'Email' or other (e.g., 'Phone')
            if (value === 'Email') {
                console.log(prevState.email);
                deliveryMethod = prevState.email; // Wrap email in delivery_method
            } else {
                console.log(prevState.contact);
                deliveryMethod = prevState.contact; // Use contact as delivery_method
            }

            return {
                ...prevState,
                [name]: value,          // Update the login method
                delivery_method: deliveryMethod, // Update the delivery_method based on login type
            };
        }

        // If it's not the 'login' field, just return the updated formData
        return {
            ...prevState,
            [name]: value,  // Update the corresponding field in formData
        };
    });

    // Handle datePicker state update separately
    if (name === 'dateField') { // Assuming you want to handle specific fields like 'dateField'
        setdatePicker((prevData) => ({
            ...prevData,
            [name]: value,  // Update the specific date field in datePicker
        }));
    }
};


    // # File Store Handler .... Handle file upload for photo (file1,file2,file3)#
    const handleFile1 = (event) => {
        const file = event.target.files[0];
        // Update the formData object and the file state separately
        setFormData((prevState) => ({
            ...prevState,
            photo: file, // Assuming 'photo' is the field name in formData for the first image
        }));
        setFile1(file);  // Update state for the first image
        console.log(file);
    };
    const handleFile2 = (event) => {
        const file = event.target.files[0];

        // Update the formData object and the file state separately
        setFormData((prevState) => ({
            ...prevState,
            nid_front: file, // Assuming 'nid_front' is the field name for the second image
        }));

        setFile2(file);  // Update state for the second image
        console.log(file);
    };
    const handleFile3 = (event) => {
        const file = event.target.files[0];

        // Update the formData object and the file state separately
        setFormData((prevState) => ({
            ...prevState,
            nid_back: file, // Assuming 'nid_back' is the field name for the third image
        }));

        setFile3(file);  // Update state for the third image
        console.log(file);
    };

    //# File Remove Handler .... Handle file upload for photo (file1,file2,file3)#
    const removeFile1 = () => {
        setFile1(null); // Set to null to show the default image again
    };
    const removeFile2 = () => {
        setFile2(null); // Set to null to show the default image again
    };
    const removeFile3 = () => {
        setFile3(null); // Set to null to show the default image again
    };

    //  # Date Picker Handler .... Handle date change for date of birth#
    const handleDateChange = (date) => {
        setFormData((prevData) => ({
            ...prevData,
            date_of_birth: date ? formatDate(date) : '' // Format the date
        }));
    };

    //  # Date Formatter .... Format date to 'day-month-year' format (en-GB)
    const formatDate = (date) => {
        return date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        }).replace(/ /g, '-'); // Replace spaces with hyphens
    };

    // # Role Management (Roles Fetching and Checkbox Change) .... This hook fetches the roles data from the server and sets the options for the checkbox component.#
    useEffect(() => {
        if (roles && roles.length > 0) {
            const options = [
                { label: 'All', value: 'All', checked: false },
                ...roles.map(role => ({
                    label: role.role_name,
                    value: role.id.toString(),
                    checked: false,
                })),
            ];
            setRoleType(options);
        }
    }, [roles]);


    useEffect(() => {
        dispatch(fetchroleData());
    }, [dispatch]);


    useEffect(() => {
        dispatch(fetchmemberTypeData());
    }, [dispatch]);

    // #Checkbox Handler ... This function handles the changes in the role checkboxes (including 'All' checkbox).
    const handleCheckboxChange = (event) => {
        const { value, checked } = event.target;

        setRoleType((prevRoleType) => {
            let updatedRoleType = prevRoleType.map((option) =>
                option.value === value ? { ...option, checked } : option
            );
            let currentValues = [...selectedRoles];
            if (value === 'All') {
                if (checked) {
                    const allCheckedOptions = prevRoleType.map((option) => ({
                        ...option,
                        checked: true,
                    }));

                    const selectedValues = allCheckedOptions
                        .map((option) => option.value)
                        .filter((role) => role !== 'All')
                        .map(Number);  // Convert to numbers

                    setSelectedRoles(selectedValues);

                    // Update formData with selected roles as an array
                    setFormData((prevState) => ({
                        ...prevState,
                        members_role: selectedValues,
                    }));

                    return allCheckedOptions;
                } else {
                    // Unselect all roles
                    setSelectedRoles([]);

                    // Update formData to reflect empty selected roles
                    setFormData((prevState) => ({
                        ...prevState,
                        members_role: [], // This resets the members_role field
                    }));

                    return prevRoleType.map((option) => ({
                        ...option,
                        checked: false,
                    }));
                }
            } else {
                // Update selected roles for individual checkboxes
                if (checked) {
                    currentValues = [...currentValues, value];
                } else {
                    currentValues = currentValues.filter((role) => role !== value);
                }

                // Filter out "All" and convert values to numbers
                const filteredValues = currentValues
                    .filter((role) => role !== 'All')  // Exclude "All"
                    .map(Number);  // Convert to numbers

                setSelectedRoles(filteredValues);

                // Update formData with the selected roles as an array
                setFormData((prevState) => ({
                    ...prevState,
                    members_role: filteredValues,
                }));

                // Check if 'All' should be checked based on the number of selected roles
                updatedRoleType = updatedRoleType.map((option) =>
                    option.value === 'All'
                        ? { ...option, checked: filteredValues.length === prevRoleType.length - 1 }
                        : option
                );
            }

            return updatedRoleType;
        });
    };

    const radioOptions = members?.map((type) => ({
        label: type.type_name,
        value: type.id // Ensure it's an integer
    }));


    return (
        <div className='h-full p-[14px]'>
            <div className="container">
                <div>
                </div>
                <div className='md:flex justify-between  px-[0px] py-[14px]'>
                    <Link to="/addmember">
                        <p className="flex items-center justify-between  font-medium text-xl">
                            <BiArrowBack className="mr-2 text-gray-600 cursor-pointer" />
                            Add Member
                        </p>
                    </Link>
                    <div onClick={openModal}>
                        {activeTab === 1 && (
                            <Button size="small" className="flex items-center justify-between text-lg font-medium bg-[#3D9D9B] text-white hover:bg-[#34977A] transition-all duration-300 p-2 rounded">
                                <FaPlus className="mr-2" />
                                Add Existing Member
                            </Button>
                        )}
                    </div>
                </div>
                <form className="" onSubmit={handleSubmit}>
                    <div className=' bg-white border px-[14px] border-[#FFFFFF] rounded-[27px]'>
                        <div className="md:flex  grid-cols-2">
                            <div className="p-[10px] pe-[30px] border-r border-[0px] border-[#F9F9FB] ">
                                <h3 className=' font-medium pb-4 text-base'>Upload Picture</h3>
                                <div className=''>
                                    {file3 ? (
                                        <div className='my-[20px] relative'> {/* Set relative position on the parent */}
                                            <SingleImageUpload file={file3} altImg='./login.jpg' customClass="member-profile-image11" />
                                            <button onClick={removeFile3} className=" absolute top-0 right-0 p-1 rounded-full bg-[#3D9D9B] text-[white]">
                                                <RxCross2 />
                                            </button>
                                        </div>
                                    ) : (
                                        <img
                                            src="./login.jpg"
                                            alt="Default user image"
                                            className="rounded-lg shadow-lg member-profile-image11"
                                        />
                                    )}
                                </div>
                                <div className="w-full my-[20px]">
                                    <label htmlFor="photo" className="cursor-pointer bg-[#3C9D9B] text-white py-2 px-4 rounded w-full block text-center">
                                        Upload Photo
                                    </label>

                                    <input
                                        id="photo"
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleFile3}
                                    />
                                </div>
                                <div className="p-4 rounded mb-4">
                                </div>
                                <div>
                                    <TextareaComponent
                                        value={formData.about_us}
                                        onChange={handleChange}
                                        name={formFields.about_us.name}
                                        label={formFields.about_us.label}
                                        rows={formFields.about_us.rows || 6}
                                        field={formFields.about_us}
                                        width="304px" // Example width
                                    />
                                    <TextInputComponent
                                        value={formData.facebook_profile}
                                        onChange={handleChange}
                                        name={formFields.facebook_profile.name}
                                        label={formFields.facebook_profile.label}
                                        field={formFields.facebook_profile}
                                        placeholder={formFields.facebook_profile.label}
                                        width="304px" // Example width
                                    />
                                    <TextInputComponent
                                        value={formData.linkedin_profile}
                                        onChange={handleChange}
                                        name={formFields.linkedin_profile.name}
                                        label={formFields.linkedin_profile.label}
                                        field={formFields.linkedin_profile}
                                        placeholder={formFields.linkedin_profile.label}
                                        width="304px" // Example width

                                    />
                                </div>
                            </div>
                            {activeTab === 1 && (

                                <div className=" md:w[687px]  p-[20px] ">
                                    <h3 className='text-base font-medium pb-4 font-medium'>General Information</h3>
                                    <TextInputComponent
                                        value={formData.full_name}
                                        onChange={handleChange}
                                        name={formFields.full_name.name}
                                        label={<span>{formFields.full_name.label} <span className="text-red-500 text-[20px]">*</span></span>}
                                        placeholder={formFields.full_name.label}
                                        width="687px" // Example width
                                        field={formFields.full_name}
                                    />
                                    <ErrorMessage message={errors.full_name} />


                                    <input name="is_org_member" type='hidden' value="1" />
                                    <EmailInputComponent
                                        width="687px" // Example width
                                        value={formData.email}
                                        onChange={handleChange}
                                        name={formFields.email.name}
                                        label={<span>{formFields.email.label} <span className="text-red-500 text-[20px]">*</span></span>}
                                        field={formFields.email}
                                        placeholder={formFields.email.label} />
                                    <ErrorMessage message={errors.email} />

                                    <NumberInputComponent
                                        value={formData.contact}
                                        onChange={handleChange}
                                        name={formFields.contact.name}
                                        // label={formFields.contact.label}
                                        label={<span>{formFields.contact.label} <span className="text-red-500 text-[20px]">*</span></span>}
                                        placeholder={formFields.contact.label}
                                        width="687px" // Example width
                                        field={formFields.contact} />
                                    <ErrorMessage message={errors.contact} />

                                    <NumberInputComponent
                                        value={formData.nid_number}
                                        onChange={handleChange}
                                        name={formFields.nid_number.name}
                                        label={<span>{formFields.nid_number.label} <span className="text-red-500 text-[20px]">*</span></span>}
                                        placeholder={formFields.nid_number.label}
                                        width="687px" // Example width
                                        field={formFields.nid_number} />
                                    <ErrorMessage message={errors.nid_number} />


                                    <TextInputComponent
                                        value={formData.permanent_address}
                                        onChange={handleChange}
                                        name={formFields.permanent_address.name}
                                        label={formFields.permanent_address.label}
                                        placeholder={formFields.permanent_address.label}
                                        width="687px" // Example width
                                        field={formFields.permanent_address}
                                    />
                                    <TextInputComponent
                                        value={formData.present_address}
                                        onChange={handleChange}
                                        name={formFields.present_address.name}
                                        label={formFields.present_address.label}
                                        placeholder={formFields.present_address.label}
                                        width="687px" // Example width
                                        field={formFields.present_address}
                                    />
                                    <div className="login-field" >

                                        <DatePicker
                                            className="login-field-input "
                                            name='date_of_birth'
                                            selected={formData.date_of_birth ? new Date(formData.date_of_birth) : null}
                                            onChange={handleDateChange}
                                            dateFormat="dd-MMM-yyyy"
                                            placeholderText="Date Of Birth"
                                        />

                                    </div>
                                    {/* <TextInputComponent
                                        value={formData.date_of_birth}
                                        onChange={handleChange}
                                        name={formFields.date_of_birth.name}
                                        label={formFields.date_of_birth.label}
                                        field={formFields.date_of_birth}
                                        width="687px"// Example width
                                        placeholder={formFields.date_of_birth.label}
                                    /> */}




                                    <div className='flex justify-between gap-5 lg:w-[304px]' >
                                        <TextInputComponent
                                            value={formData.occupation}
                                            onChange={handleChange}
                                            name={formFields.occupation.name}
                                            label={formFields.occupation.label}
                                            placeholder={formFields.occupation.label}
                                            width="274px" // Example width
                                            field={formFields.occupation}
                                        />

                                        <RadioComponent
                                            options={formFields.gender.options} // Find options for gender field
                                            selectedValue={formData.gender} // Selected value from form data
                                            onChange={handleChange} // Function to handle changes
                                            name={formFields.gender.name}
                                            label={formFields.gender.label}
                                            width="251px"
                                        />

                                    </div>
                                    <div className='flex justify-between gap-3  lg:w-[687px]' >
                                        <SelectComponent
                                            options={formFields.marital_status.options}
                                            value={formData.marital_status}
                                            name={formFields.marital_status.name}
                                            label={formFields.marital_status.label}
                                            onChange={handleChange}
                                            field={formFields.marital_status}
                                            width="340px"

                                        />
                                        <SelectComponent
                                            options={formFields.religion.options}
                                            value={formData.religion}
                                            name={formFields.religion.name}
                                            label={formFields.religion.label}
                                            onChange={handleChange}
                                            field={formFields.religion}
                                            width="340px"

                                        />
                                    </div>

                                    <div className='flex  justify-center gap-2 pb-5 lg:w-[687px]'>
                                        <div className="profile-picture flex flex-col items-center space-4 px-5  border border-dashed shadow-lg">
                                            <label
                                                htmlFor="file-upload"
                                                className=" cursor-pointer "
                                            >
                                                <div className=' my-[20px]'>
                                                    {file2 ? (
                                                        <div className='relative   py-1 '>

                                                            <SingleImageUpload file={file2} altImg='./nid.png' customClass="member_doc" />
                                                            <button onClick={removeFile2} className="absolute top-1 right-0 p-1 rounded-full bg-[#3D9D9B] text-[white]">
                                                                <RxCross2 />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <img
                                                            src="./nid.png"
                                                            alt="Default user image"
                                                            className="rounded-lg shadow-lg member_doc_defult"
                                                        />
                                                    )}
                                                </div>
                                                {/* <input
                                                    type="file"
                                                    id="nidFront"
                                                    accept="image/*"
                                                    onChange={handleFile2}
                                                /> */}
                                                <div className="my-[20px]">
                                                    {/* Label triggers file input when clicked */}
                                                    <label htmlFor="nidFront" className="cursor-pointer bg-[#3C9D9B] text-white py-2 px-4 rounded  w-full">
                                                        Upload NID Front                                   </label>

                                                    {/* Hidden file input */}
                                                    <input
                                                        id="nidFront"
                                                        type="file"
                                                        accept="image/*"
                                                        className="hidden" // Ensures input is hidden but still functional
                                                        onChange={handleFile2}
                                                    />
                                                </div>
                                            </label>

                                        </div>
                                        <div className="profile-picture flex flex-col items-center space-4 px-5   border border-dashed shadow-lg">
                                            <label
                                                htmlFor="file-upload"
                                                className=" cursor-pointer " >
                                                <div className=' my-[20px]'>
                                                    {file1 ? (
                                                        <div className=' relative py-1'>
                                                            <SingleImageUpload file={file1} altImg='./nid2.png' customClass="member_doc" />
                                                            <button onClick={removeFile1} className="absolute top-1 right-0 p-1 rounded-full bg-[#3D9D9B] text-[white]">
                                                                <RxCross2 />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <img
                                                            name="nid_back"
                                                            src="./nid2.png"
                                                            alt="Default user image"
                                                            className="rounded-lg shadow-lg member_doc_defult"
                                                        />
                                                    )}
                                                </div>
                                                {/* <input
                                                    type="file"
                                                    id="nidBack"
                                                    accept="image/*"
                                                    onChange={handleFile1}
                                                /> */}
                                                <div className="my-[20px]">
                                                    {/* Label triggers file input when clicked */}
                                                    <label htmlFor="nidBack" className="cursor-pointer bg-[#3C9D9B] text-white py-2 px-4 rounded  w-full">
                                                        Upload NID Back                                   </label>

                                                    {/* Hidden file input */}
                                                    <input
                                                        id="nidBack"
                                                        type="file"
                                                        accept="image/*"
                                                        className="hidden" // Ensures input is hidden but still functional
                                                        onChange={handleFile1}
                                                    />
                                                </div>
                                            </label>

                                        </div>
                                    </div>

                                    <div className='lg:w-[687px]'>
                                        <button
                                            className={`${activeTab === 2 ? "bg-[#3D9D9B] text-white hover:bg-[#34977A] py-2 px-6 w-full text-base rounded" : " rounded bg-[#3D9D9B] text-white hover:bg-[#34977A] py-2 px-6 w-full text-base"
                                                }`}
                                            onClick={() => handleTabChange(2)}
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            )}
                            {activeTab === 2 && (
                                <div className=" w-full  lg:w-[687px]    p-[20px]">
                                    <h3 onClick={() => handleTabChange(1)} className='text-base font-medium pb-4 font-medium flex items-center'> <BiArrowBack className="mr-2 text-gray-600 cursor-pointer" />
                                        Organization Member Information</h3>
                                    <div className='mb-3'>
                                       
                                    </div>


                                    <div className=''>
                                        <div className='flex justify-between'>
                                            <p className='my-[14px] text-sm font-medium'>Role</p>
                                            <button onClick={openAddRoleModal}
                                                className="flex items-center justify-between h-[32px] bg-[#3D9D9B] text-white hover:bg-[#34977A] px-6 text-base rounded">
                                                <FaPlus className="mr-2" />   Create New Role
                                            </button>
                                        </div>

                                        <div className='max-h-[196px] overflow-y-auto border border-gray-300 p-4 rounded-md shadow-sm'>

                                            <div>
                                                <label>
                                                    <input
                                                        type="checkbox"
                                                        value="All"
                                                        checked={roleType.find(option => option.value === 'All')?.checked || false}
                                                        onChange={handleCheckboxChange}
                                                        className='mx-2'
                                                    />
                                                    All
                                                </label>
                                            </div>

                                            {roleType.map((roleOption) => (
                                                roleOption.value !== 'All' && (
                                                    <div key={roleOption.value}>
                                                        <label>
                                                            <input
                                                                type="checkbox"
                                                                value={roleOption.value}
                                                                checked={roleOption.checked || false}
                                                                onChange={handleCheckboxChange}
                                                                className='mx-2'
                                                            />
                                                            {roleOption.label}
                                                        </label>
                                                    </div>
                                                )
                                            ))}

                                        </div>
                                    </div>
                                    <div className='lg:w-[687px] mt-[20px]'>
                                        <button type='botton'
                                            className={`${activeTab === 3 ? "bg-[#3D9D9B] text-white hover:bg-[#34977A] py-2 px-6 w-full text-base rounded" : " rounded bg-[#3D9D9B] text-white hover:bg-[#34977A] py-2 px-6 w-full text-base"
                                                }`}
                                            onClick={() => setActiveTab(3)}
                                        >
                                            Next
                                        </button>

                                    </div>
                                </div>
                            )}
                            {activeTab === 3 && (
                                <div className=" w-full  lg:w-[687px]    ">
                                    <h3 onClick={() => handleTabChange(2)} className=' p-[20px] text-base font-medium pb-4 font-medium flex items-center'> <BiArrowBack className="mr-2 text-gray-600 cursor-pointer" />
                                        Login Credential </h3>

                                    <div className='mb-3'>
                                        <RadioComponent
                                            options={formFields.login.options}
                                            selectedValue={formData.login}
                                            onChange={handleChange}
                                            name={formFields.login.name}
                                            label={formFields.login.label}
                                        />
                                    </div>

                                    <TextInputComponent
                                        value={formData.delivery_method}
                                        onChange={handleChange}
                                        name={formFields.delivery_method.name}
                                        label="Phone / Email"
                                        placeholder="Phone / Email"
                                        field={formFields.delivery_method}
                                    />
                                    {/* <Button  size="medium">Save</Button> */}
                                    <button
                                        type="submit"
                                        className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                                    >
                                        save
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </form>
                <div>
                    {isModalOpen && (
                        <div className="fixed inset-0 flex items-center justify-center  bg-[black] bg-opacity-50 z-50">
                            <div className="rounded-lg  relative ">
                                <div className='absolute top-[0px] right-[0px]'>
                                    <IoCloseOutline
                                        onClick={closeModal}
                                        className=" text-2xl cursor-pointer bg-[#3D9D9B] text-white h-[20px] w-[20px] rounded-[50px] "
                                    />
                                </div>
                                <div className='mx-auto max-w-[1082px] '>
                                    <EstateTable />
                                </div>
                            </div>
                        </div>
                    )}
                    {addRoleModal && (
                        <div className="fixed inset-0 flex items-center justify-center  bg-[black] bg-opacity-50 z-50 p-4">
                            <div className="rounded-lg  relative ">
                                <div className='absolute top-[0px] right-[0px]'>
                                    <IoCloseOutline
                                        onClick={closeAddRoleModal}
                                        className=" text-2xl cursor-pointer bg-[#3D9D9B] text-white h-[20px] w-[20px] rounded-[50px] "
                                    />
                                </div>
                                <div className=" bg-white border px-[14px] border-[#FFFFFF] p-[10px] rounded-[27px]  mx-auto">
                                    <form className="">
                                        <div className='max-w-[1082px] pt-[4px]'>

                                            <div className=" w-full  ">
                                                {/* <h3 className='text-base font-medium pb-4 font-medium flex items-center '><BiArrowBack className="mr-2 text-gray-600 cursor-pointer" />
                                        Organization Member Information</h3> */}
                                                <TextInputComponent
                                                    name='role'
                                                    label='Role Name'
                                                    placeholder="Write Role Name"
                                                />



                                                <div className='w-full '>
                                                    <p className='  my-[10px] text-sm w-full font-medium'>Role Description</p>
                                                    <TextareaComponent
                                                        value={formData[formFields.about_us]}
                                                        onChange={handleChange}
                                                        name={formFields.name}
                                                        label={formFields.label}
                                                        rows={formFields.rows || 5}
                                                        field={formFields[1]}
                                                    />

                                                </div>
                                            </div>
                                        </div>
                                        <div className='p-[5px]'>
                                            <div className="">
                                                <h1 className="text-[20px] font-semibold mb-6"> Role Permission </h1>
                                                <div className="grid grid-cols-4 gap-4">
                                                    {/* Dashboard */}
                                                    <div className="">
                                                        <div className='mb-[8px]'>
                                                            <h2 className="text-base font-semibold p-[10px] text-center bg-[#3C9D9B1A] rounded-[8px]">Dashboard</h2>

                                                        </div>
                                                        <div className="flex items-center p-4 rounded-[10px]   bg-white border-[#0000004D] shadow ">
                                                            <div className=""> <div className="inline-flex items-center">
                                                                <input type="checkbox" className="form-checkbox h-4 w-4 text-indigo-600" />
                                                                <label className="ml-2 mb-[3px]">All</label>

                                                            </div>

                                                                <div className="flex items-center ">
                                                                    <input type="checkbox" className="form-checkbox h-4 w-4 text-indigo-600" />
                                                                    <label className="ml-2 mb-[3px]">Grganization Member View</label> </div>

                                                                <div className="flex items-center ">
                                                                    <input type="checkbox" className="form-checkbox h-4 w-4 text-indigo-600" />
                                                                    <label className="ml-2 mb-[3px]">Grganization Member Edit</label> </div>

                                                                <div className="flex items-center">
                                                                    <input type="checkbox" className="form-checkbox h-4 w-4 text-indigo-600" />
                                                                    <label className="ml-2 mb-[3px]">Groups View</label> </div>

                                                                <div className="flex items-center ">
                                                                    <input type="checkbox" className="form-checkbox h-4 w-4 text-indigo-600" />
                                                                    <label className="ml-2 mb-[3px]">Groups Edit</label> </div>

                                                                <div className="flex items-center ">
                                                                    <input type="checkbox" className="form-checkbox h-4 w-4 text-indigo-600" />
                                                                    <label className="ml-2 mb-[3px]">Role Management View</label> </div>

                                                                <div className="flex items-center">
                                                                    <input type="checkbox" className="form-checkbox h-4 w-4 text-indigo-600" />
                                                                    <label className="ml-2 mb-[3px]">Role Management Edit</label>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="">
                                                        <div className='mb-[8px]'>
                                                            <h2 className="text-base font-semibold p-[10px] text-center bg-[#3C9D9B1A] rounded-[8px]">Member Management</h2>

                                                        </div>
                                                        <div className="flex items-center p-4 rounded-[10px] -[10px]  bg-white border-[#0000004D] shadow ">
                                                            <div className=""> <div className="inline-flex items-center">
                                                                <input type="checkbox" className="form-checkbox h-4 w-4 text-indigo-600" />
                                                                <label className="ml-2 mb-[3px]">All</label>

                                                            </div>

                                                                <div className="flex items-center ">
                                                                    <input type="checkbox" className="form-checkbox h-4 w-4 text-indigo-600" />
                                                                    <label className="ml-2 mb-[3px]">Grganization Member View</label> </div>

                                                                <div className="flex items-center ">
                                                                    <input type="checkbox" className="form-checkbox h-4 w-4 text-indigo-600" />
                                                                    <label className="ml-2 mb-[3px]">Grganization Member Edit</label> </div>

                                                                <div className="flex items-center">
                                                                    <input type="checkbox" className="form-checkbox h-4 w-4 text-indigo-600" />
                                                                    <label className="ml-2 mb-[3px]">Groups View</label> </div>

                                                                <div className="flex items-center ">
                                                                    <input type="checkbox" className="form-checkbox h-4 w-4 text-indigo-600" />
                                                                    <label className="ml-2 mb-[3px]">Groups Edit</label> </div>

                                                                <div className="flex items-center ">
                                                                    <input type="checkbox" className="form-checkbox h-4 w-4 text-indigo-600" />
                                                                    <label className="ml-2 mb-[3px]">Role Management View</label> </div>

                                                                <div className="flex items-center">
                                                                    <input type="checkbox" className="form-checkbox h-4 w-4 text-indigo-600" />
                                                                    <label className="ml-2 mb-[3px]">Role Management Edit</label>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="">
                                                        <div className='mb-[8px]'>
                                                            <h2 className="text-base font-semibold p-[10px] text-center bg-[#3C9D9B1A] rounded-[8px]">Tower & Unit Management</h2>

                                                        </div>
                                                        <div className="flex items-center p-4 rounded-[10px]   bg-white border-[#0000004D] shadow ">
                                                            <div className=""> <div className="inline-flex items-center">
                                                                <input type="checkbox" className="form-checkbox h-4 w-4 text-indigo-600" />
                                                                <label className="ml-2 mb-[3px]">All</label>

                                                            </div>

                                                                <div className="flex items-center ">
                                                                    <input type="checkbox" className="form-checkbox h-4 w-4 text-indigo-600" />
                                                                    <label className="ml-2 mb-[3px]">Grganization Member View</label> </div>

                                                                <div className="flex items-center ">
                                                                    <input type="checkbox" className="form-checkbox h-4 w-4 text-indigo-600" />
                                                                    <label className="ml-2 mb-[3px]">Grganization Member Edit</label> </div>

                                                                <div className="flex items-center">
                                                                    <input type="checkbox" className="form-checkbox h-4 w-4 text-indigo-600" />
                                                                    <label className="ml-2 mb-[3px]">Groups View</label> </div>

                                                                <div className="flex items-center ">
                                                                    <input type="checkbox" className="form-checkbox h-4 w-4 text-indigo-600" />
                                                                    <label className="ml-2 mb-[3px]">Groups Edit</label> </div>

                                                                <div className="flex items-center ">
                                                                    <input type="checkbox" className="form-checkbox h-4 w-4 text-indigo-600" />
                                                                    <label className="ml-2 mb-[3px]">Role Management View</label> </div>

                                                                <div className="flex items-center">
                                                                    <input type="checkbox" className="form-checkbox h-4 w-4 text-indigo-600" />
                                                                    <label className="ml-2 mb-[3px]">Role Management Edit</label>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="">
                                                        <div className='mb-[8px]'>
                                                            <h2 className="text-base font-semibold p-[10px] text-center bg-[#3C9D9B1A] rounded-[8px]">Communication Portal</h2>

                                                        </div>
                                                        <div className="flex items-center p-4 rounded-[10px]   bg-white border-[#0000004D] shadow ">
                                                            <div className=""> <div className="inline-flex items-center">
                                                                <input type="checkbox" className="form-checkbox h-4 w-4 text-indigo-600" />
                                                                <label className="ml-2 mb-[3px]">All</label>

                                                            </div>

                                                                <div className="flex items-center ">
                                                                    <input type="checkbox" className="form-checkbox h-4 w-4 text-indigo-600" />
                                                                    <label className="ml-2 mb-[3px]">Grganization Member View</label> </div>

                                                                <div className="flex items-center ">
                                                                    <input type="checkbox" className="form-checkbox h-4 w-4 text-indigo-600" />
                                                                    <label className="ml-2 mb-[3px]">Grganization Member Edit</label> </div>

                                                                <div className="flex items-center">
                                                                    <input type="checkbox" className="form-checkbox h-4 w-4 text-indigo-600" />
                                                                    <label className="ml-2 mb-[3px]">Groups View</label> </div>

                                                                <div className="flex items-center ">
                                                                    <input type="checkbox" className="form-checkbox h-4 w-4 text-indigo-600" />
                                                                    <label className="ml-2 mb-[3px]">Groups Edit</label> </div>

                                                                <div className="flex items-center ">
                                                                    <input type="checkbox" className="form-checkbox h-4 w-4 text-indigo-600" />
                                                                    <label className="ml-2 mb-[3px]">Role Management View</label> </div>

                                                                <div className="flex items-center">
                                                                    <input type="checkbox" className="form-checkbox h-4 w-4 text-indigo-600" />
                                                                    <label className="ml-2 mb-[3px]">Role Management Edit</label>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="">
                                                        <div className='mb-[8px]'>
                                                            <h2 className="text-base font-semibold p-[10px] text-center bg-[#3C9D9B1A] rounded-[8px]">Amenity Management</h2>

                                                        </div>
                                                        <div className="flex items-center p-4 rounded-[10px]   bg-white border-[#0000004D] shadow ">
                                                            <div className=""> <div className="inline-flex items-center">
                                                                <input type="checkbox" className="form-checkbox h-4 w-4 text-indigo-600" />
                                                                <label className="ml-2 mb-[3px]">All</label>

                                                            </div>

                                                                <div className="flex items-center ">
                                                                    <input type="checkbox" className="form-checkbox h-4 w-4 text-indigo-600" />
                                                                    <label className="ml-2 mb-[3px]">Grganization Member View</label> </div>

                                                                <div className="flex items-center ">
                                                                    <input type="checkbox" className="form-checkbox h-4 w-4 text-indigo-600" />
                                                                    <label className="ml-2 mb-[3px]">Grganization Member Edit</label> </div>

                                                                <div className="flex items-center">
                                                                    <input type="checkbox" className="form-checkbox h-4 w-4 text-indigo-600" />
                                                                    <label className="ml-2 mb-[3px]">Groups View</label> </div>

                                                                <div className="flex items-center ">
                                                                    <input type="checkbox" className="form-checkbox h-4 w-4 text-indigo-600" />
                                                                    <label className="ml-2 mb-[3px]">Groups Edit</label> </div>

                                                                <div className="flex items-center ">
                                                                    <input type="checkbox" className="form-checkbox h-4 w-4 text-indigo-600" />
                                                                    <label className="ml-2 mb-[3px]">Role Management View</label> </div>

                                                                <div className="flex items-center">
                                                                    <input type="checkbox" className="form-checkbox h-4 w-4 text-indigo-600" />
                                                                    <label className="ml-2 mb-[3px]">Role Management Edit</label>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="">
                                                        <div className='mb-[8px]'>
                                                            <h2 className="text-base font-semibold p-[10px] text-center bg-[#3C9D9B1A] rounded-[8px]">Service Fee Management</h2>

                                                        </div>
                                                        <div className="flex items-center p-4 rounded-[10px]   bg-white border-[#0000004D] shadow ">
                                                            <div className=""> <div className="inline-flex items-center">
                                                                <input type="checkbox" className="form-checkbox h-4 w-4 text-indigo-600" />
                                                                <label className="ml-2 mb-[3px]">All</label>

                                                            </div>

                                                                <div className="flex items-center ">
                                                                    <input type="checkbox" className="form-checkbox h-4 w-4 text-indigo-600" />
                                                                    <label className="ml-2 mb-[3px]">Grganization Member View</label> </div>

                                                                <div className="flex items-center ">
                                                                    <input type="checkbox" className="form-checkbox h-4 w-4 text-indigo-600" />
                                                                    <label className="ml-2 mb-[3px]">Grganization Member Edit</label> </div>

                                                                <div className="flex items-center">
                                                                    <input type="checkbox" className="form-checkbox h-4 w-4 text-indigo-600" />
                                                                    <label className="ml-2 mb-[3px]">Groups View</label> </div>

                                                                <div className="flex items-center ">
                                                                    <input type="checkbox" className="form-checkbox h-4 w-4 text-indigo-600" />
                                                                    <label className="ml-2 mb-[3px]">Groups Edit</label> </div>

                                                                <div className="flex items-center ">
                                                                    <input type="checkbox" className="form-checkbox h-4 w-4 text-indigo-600" />
                                                                    <label className="ml-2 mb-[3px]">Role Management View</label> </div>

                                                                <div className="flex items-center">
                                                                    <input type="checkbox" className="form-checkbox h-4 w-4 text-indigo-600" />
                                                                    <label className="ml-2 mb-[3px]">Role Management Edit</label>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="">
                                                        <div className='mb-[8px]'>
                                                            <h2 className="text-base font-semibold p-[10px] text-center bg-[#3C9D9B1A] rounded-[8px]">Report</h2>

                                                        </div>
                                                        <div className="flex items-center p-4 rounded-[10px]   bg-white border-[#0000004D] shadow ">
                                                            <div className=""> <div className="inline-flex items-center">
                                                                <input type="checkbox" className="form-checkbox h-4 w-4 text-indigo-600" />
                                                                <label className="ml-2 mb-[3px]">All</label>

                                                            </div>

                                                                <div className="flex items-center ">
                                                                    <input type="checkbox" className="form-checkbox h-4 w-4 text-indigo-600" />
                                                                    <label className="ml-2 mb-[3px]">Grganization Member View</label> </div>

                                                                <div className="flex items-center ">
                                                                    <input type="checkbox" className="form-checkbox h-4 w-4 text-indigo-600" />
                                                                    <label className="ml-2 mb-[3px]">Grganization Member Edit</label> </div>

                                                                <div className="flex items-center">
                                                                    <input type="checkbox" className="form-checkbox h-4 w-4 text-indigo-600" />
                                                                    <label className="ml-2 mb-[3px]">Groups View</label> </div>

                                                                <div className="flex items-center ">
                                                                    <input type="checkbox" className="form-checkbox h-4 w-4 text-indigo-600" />
                                                                    <label className="ml-2 mb-[3px]">Groups Edit</label> </div>

                                                                <div className="flex items-center ">
                                                                    <input type="checkbox" className="form-checkbox h-4 w-4 text-indigo-600" />
                                                                    <label className="ml-2 mb-[3px]">Role Management View</label> </div>

                                                                <div className="flex items-center">
                                                                    <input type="checkbox" className="form-checkbox h-4 w-4 text-indigo-600" />
                                                                    <label className="ml-2 mb-[3px]">Role Management Edit</label>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>


                                                </div>
                                            </div>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default AddMember;





















