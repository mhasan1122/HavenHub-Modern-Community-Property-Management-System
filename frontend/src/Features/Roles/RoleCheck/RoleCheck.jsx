import { useState } from "react";
import PropTypes from "prop-types";

const RoleCheck = ({ memberFields, formData, setFormData, handleTabChange }) => {
    const [roleType, setRoleType] = useState([]);
    const [selectedRoles, setSelectedRoles] = useState([]);

    const handleCheckboxChange = (event) => {
        const { value, checked } = event.target;

        setRoleType((prevRoleType) => {
            let updatedRoleType = prevRoleType.map((option) =>
                option.value === value ? { ...option, checked } : option
            );

            let currentValues = [...selectedRoles];

            if (value === 'All') {
                if (checked) {
                    // Select all roles
                    const allCheckedOptions = prevRoleType.map((option) => ({
                        ...option,
                        checked: true,
                    }));

                    // Filter out "All" and convert to numbers
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

    return (
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
    );
};
RoleCheck.propTypes = {
    formData: PropTypes.object.isRequired,
    handleChange: PropTypes.func.isRequired,
    memberFields: PropTypes.object.isRequired,  // Ensure memberFields is passed
    errors: PropTypes.object,
    onNext: PropTypes.func.isRequired,
    onBack: PropTypes.func.isRequired,
};
export default RoleCheck;

