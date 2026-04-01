import { useEffect, useState } from "react";
import { FaHistory } from "react-icons/fa";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import ArrowHeading from "../../../../Components/HeadingComponent/ArrowHeading";
import PageContainer from "../../../../Components/Ui/PageContainer";

import UnitInformationTab from "../components/UnitInformationTab";
import UnitOwnerTab from "../components/UnitOwnerTab";
import ResidentsTab from "../components/ResidentsTab";
import UnitStaffTab from "../components/UnitStaffTab";
import UnitContactsTab from "../components/UnitContactsTab";
import UnitTowerInfo from "../components/UnitTowerInfo";
import AnimatedTabs from "../../../../Components/Tabs/AnimatedTabs";

import { checkPermission } from "../../../../utils/permissionUtils";

const UnitDetails = () => {
  const [activeTab, setActiveTab] = useState(1);
  const { id: unitId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  // Permission state
  const [hasPermission, setHasPermission] = useState(false);
  const [loadingPermission, setLoadingPermission] = useState(true);

  // Handle tab from query string like ?tab=2
  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const tab = parseInt(query.get("tab"));
    if (tab && tab >= 1 && tab <= 5) {
      setActiveTab(tab);
    }
  }, [location.search]);

  // Check permission on mount
  useEffect(() => {
    const fetchPermission = async () => {
      const permissionGranted = await checkPermission("org", 13);
      setHasPermission(permissionGranted);
      setLoadingPermission(false);
    };
    fetchPermission();
  }, []);

  // Redirect if permission denied
  useEffect(() => {
    if (!loadingPermission && !hasPermission) {
      navigate("/not-authorized");
    }
  }, [loadingPermission, hasPermission, navigate]);

  // Only block rendering if permission is still loading
  // Don't use skeleton loading hook here as it causes infinite loading
  if (loadingPermission) {
    return null; // Or a simple loading spinner if preferred
  }

  // Don't render if no permission and navigation is pending
  if (!hasPermission) {
    return null;
  }

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    // Update URL with new tab
    navigate(`/unit-details/${unitId}?tab=${tabId}`, { replace: true });
  };

  const tabs = [
    { id: 1, label: "Unit Information" },
    { id: 2, label: "Unit Owners" },
    { id: 3, label: "Residents" },
    { id: 4, label: "Unit Staff" },
    { id: 5, label: "Unit Contacts" },
  ];

  return (
    <PageContainer className="h-full bg-surfaceMuted flex flex-col min-h-0">
      <div className="flex-shrink-0 sticky top-0 z-20 mb-1.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-surfaceMuted py-2 backdrop-blur">
        <div
          onClick={() => navigate("/ViewTowers")}
          className="inline-flex cursor-pointer items-center gap-3 text-ink transition-colors hover:text-primary"
        >
          <ArrowHeading title="Unit Details" size="2xl" color="text-black" />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            className="flex flex-row justify-center items-center gap-1.5 w-full sm:w-auto min-w-[120px] h-12 px-4 bg-primary text-white rounded-lg text-base font-medium leading-[140%]"
            style={{
              boxShadow: 'inset 0px 7px 12px rgba(255, 255, 255, 0.08), inset 0px -2px 2px rgba(48, 48, 48, 0.1)'
            }}
            onClick={() => navigate(`/unit-history/${unitId}`)}
          >
            <FaHistory className="w-4 h-4" />
            History
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <section className="mx-auto w-full rounded-[24px] sm:rounded-[32px] border border-borderLight bg-white px-4 py-6 sm:px-8 sm:py-10">
          {/* Content Section */}
          <div className="flex flex-col md:flex-row">
            <UnitTowerInfo id={unitId} />
            <div className="hidden md:block w-px bg-borderLight" />
            <div className="w-full md:w-3/4 p-4 sm:p-6 flex flex-col min-w-0">
              <AnimatedTabs
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={handleTabChange}
                sticky={true}
              />
              
              {/* Tab Content */}
              <div className="flex-1 min-w-0 mt-4">
                {activeTab === 1 && <UnitInformationTab id={unitId} />}
                {activeTab === 2 && <UnitOwnerTab unitId={unitId} />}
                {activeTab === 3 && <ResidentsTab unitId={unitId} />}
                {activeTab === 4 && <UnitStaffTab unitId={unitId} />}
                {activeTab === 5 && <UnitContactsTab id={unitId} />}
              </div>
            </div>
          </div>
        </section>
      </div>
    </PageContainer>
  );
};

export default UnitDetails;
