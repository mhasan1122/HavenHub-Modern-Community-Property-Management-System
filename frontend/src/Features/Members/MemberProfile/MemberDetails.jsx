import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { setActiveTabs } from "../../../redux/slices/memberSlice";
import ProfileInformationView from "./ProfileInformationView";
import OwnershipDetailsView from "./OwnershipDetailsView";
import ResidentDetailsView from "./ResidentDetailsView";
import OrgLoginCredentialEditView from "./OrgLoginCredentialEditView";
import ComLoginCredentialEditView from "./ComLoginCredentialEditView";
import OrganizationMemberInformationView from "./OrganizationMemberInformationView";
import StaffDetailsView from "./StaffDetailsView";
import AnimatedTabs from "../../../Components/Tabs/AnimatedTabs";

const MemberDetails = ({ 
  selectedMember = {
    member: {},
    residents: [],
    owners: [],
    staff: []
  },
  highlightRoleId,
  highlightRole,
  initialActiveTab
}) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  // Initialize activeTab with initialActiveTab if provided, otherwise default to 1
  const [activeTab, setActiveTab] = useState(initialActiveTab || 1);

  // Set active tab on mount
  useEffect(() => {
    const tabToSet = initialActiveTab || 1;
    setActiveTab(tabToSet);
    dispatch(setActiveTabs(tabToSet));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialActiveTab]); // Re-run if initialActiveTab changes

  const member = selectedMember?.member || {};
  const residents = selectedMember?.residents || [];
  const owners = selectedMember?.owners || [];
  const staff = selectedMember?.staff || [];

  console.log("Member History:", {
    org_member_ever_created: member.org_member_ever_created,
    comm_member_ever_created: member.comm_member_ever_created,
    is_org_member: member.is_org_member,
    is_comm_member: member.is_comm_member
  });

  // Create dynamic tabConfig based on member's history
  // const tabConfig = [
  //   { id: 1, label: "Profile Information" },
  //   ...(member.org_member_ever_created
  //     ? [{ id: 2, label: "Organization Member" }]
  //     : []),
  //   ...(member.comm_member_ever_created
  //     ? [{ id: 3, label: "Community Member" }]
  //     : [])
  // ];
  const tabConfig = [
  { id: 1, label: "Profile Information" },
  ...(member.org_member_ever_created
    ? [{ id: 2, label: "Organization Member" }]
    : []),
  ...(member.comm_member_ever_created &&
    (residents.length || owners.length || staff.length)
    ? [{ id: 3, label: "Community Member" }]
    : [])
];


  const handleTabChange = (tabNumber) => {
    setActiveTab(tabNumber);
    dispatch(setActiveTabs(tabNumber));
  };

  const renderOwnershipSection = () => {
    if (!owners.length) {
      return null;
    }
    return (
      <div className="my-6">
        <h3 className="text-lg font-semibold text-textDark mb-6">
          Ownership Details
        </h3>
        <div className="space-y-4">
          {owners.map((unit) => (
            <OwnershipDetailsView
              key={unit.id || unit._id}
              unit={unit}
              className="ownership-item"
            />
          ))}
        </div>
      </div>
    );
  };

  const renderResidentDetails = () => {
    if (!residents.length) {
      return null;
    }
    return (
      <div className="my-6">
        <h3 className="text-lg font-semibold text-textDark mb-6">
          Resident Details
        </h3>
        <div className="space-y-4">
          {residents.map((resident) => (
            <ResidentDetailsView
              key={resident.id}
              residentData={resident}
              className="ownership-item"
            />
          ))}
        </div>
      </div>
    );
  };

  const renderStaffDetails = () => {
    if (!staff.length) {
      return null;
    }
    return (
      <div className="my-6">
        <h3 className="text-lg font-semibold text-textDark mb-6">
          Unit Staff Details
        </h3>
        <div className="space-y-4">
          {staff.map((unit_staff) => (
            <StaffDetailsView
              key={unit_staff.id}
              unit_staff={unit_staff}
              className="ownership-item"
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col min-w-0">
      <AnimatedTabs
        tabs={tabConfig}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        sticky={true}
      />

      <div role="tabpanel" className="flex-1 min-w-0">
        {activeTab == 1 && (
          <ProfileInformationView
            memberData={member}
            onEditClick={() =>
              navigate(`/general-information-edit/${member?.id}`)
            }
          />
        )}

        {activeTab == 2 && (
          <div className="mx-auto">
            <OrgLoginCredentialEditView
              selectedMember={selectedMember}
              handleLoginCredentialEditClick={() =>
                navigate(`/login-credential-edit/${member?.id}`)
              }
            />
            {member?.is_org_member == 1 && (
              <OrganizationMemberInformationView 
                member={member}
                highlightRoleId={highlightRoleId}
                highlightRole={highlightRole}
              />
            )}
          </div>
        )}

        {activeTab == 3 && (
          <>
            {(residents.length || owners.length || staff.length) && (
              <ComLoginCredentialEditView selectedMember={selectedMember} />
            )}
            {renderOwnershipSection()}
            {renderResidentDetails()}
            {renderStaffDetails()}
          </>
        )}
      </div>
    </div>
  );
};

MemberDetails.propTypes = {
  selectedMember: PropTypes.shape({
    member: PropTypes.object,
    residents: PropTypes.array,
    owners: PropTypes.array,
    staff: PropTypes.array
  })
};

export default MemberDetails;
