// utils/validateForm.js
export const validateMemberForm = (formData, activeTab) => {
    const newErrors = {};

    if (!formData.full_name) {
        newErrors.full_name = 'Full name is required';
    }

    if (!formData.nid_number) {
        newErrors.nid_number = 'NID Number is required';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email) {
        newErrors.email = 'Email is required';
    } else if (!emailRegex.test(formData.email)) {
        newErrors.email = 'Invalid email format';
    }

    const contactRegex = /^(018|019|013|017|015|016|014)\d{8}$/;
    if (!formData.contact) {
        newErrors.contact = 'Contact Number is required';
    } else if (!contactRegex.test(formData.contact)) {
        newErrors.contact = 'Contact number must be 11 digits and start with one of the allowed prefixes (018, 019, 013, 017, 015, 016, 014)';
    }

    if (activeTab === 2 && !formData.memberType) {
        newErrors.memberType = "Member Type is required.";
    }

    return newErrors;
};
