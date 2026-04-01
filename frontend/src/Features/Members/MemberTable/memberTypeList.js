
export const fetchMemberTypeOptions = async () => {
  const selectUnit = [
    { value: "owner", label: "Owner" },
    { value: "resident", label: "Resident" },
    { value: "resident_tenant", label: "Resident (Tenant)" },
    { value: "unit_staff", label: "Unit Staff" },
  ];

  return selectUnit;
};
