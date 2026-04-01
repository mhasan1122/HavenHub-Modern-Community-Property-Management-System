import { useState, useEffect } from "react";

const useMemberSelections = (setFormData) => {
    const [selectedRoleValues, setSelectedRoleValues] = useState([]);
    const [selectedTypeValues, setSelectedTypeValues] = useState([]);

    useEffect(() => {
        setFormData((prevFormData) => ({
            ...prevFormData,
            // member_type: selectedTypeValues,
            members_role: selectedRoleValues,
        }));
    }, [selectedTypeValues, selectedRoleValues, setFormData]);

    // Fix: Define handleRoleSelection
    const handleRoleSelection = (selectedRoles) => {
        setSelectedRoleValues(selectedRoles);
    };

    return { selectedRoleValues, setSelectedRoleValues, selectedTypeValues, setSelectedTypeValues, handleRoleSelection };
};

export default useMemberSelections;
