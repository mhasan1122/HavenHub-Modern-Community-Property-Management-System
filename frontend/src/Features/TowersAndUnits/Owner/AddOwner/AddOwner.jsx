import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import UnitTowerInfo from "../../UnitDetails/components/UnitTowerInfo";
import { useDispatch } from "react-redux";
import AddOwnerForm from "./AddOwnerForm";
import AddCompany from "../AddCompany/AddCompany";
import { clearMessage } from "../../../../redux/slices/owner/ownerSlice";
import { checkPermission } from "../../../../utils/permissionUtils";
import PageContainer from "../../../../Components/Ui/PageContainer";
import ArrowHeading from "../../../../Components/HeadingComponent/ArrowHeading";
import ModernLoadingAnimation from "../../../../Components/Loaders/ModernLoadingAnimation";

const AddOwner = () => {
  const { unitId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Permission state
  const [hasPermission, setHasPermission] = useState(false);
  const [loadingPermission, setLoadingPermission] = useState(true);

  useEffect(() => {
    const fetchPermission = async () => {
      // Use the correct permission type and id for add owner (comm, 85)
      const permissionGranted = await checkPermission("org", 16);
      setHasPermission(permissionGranted);
      setLoadingPermission(false);
    };
    fetchPermission();
  }, []);

  useEffect(() => {
    // Clear messages when component unmounts
    return () => {
      dispatch(clearMessage());
    };
  }, [dispatch]);

  if (loadingPermission) return <ModernLoadingAnimation className="min-h-screen" />;
  if (!hasPermission) {
    navigate("/not-authorized");
    return null;
  }

  return (
    <PageContainer className="min-h-screen bg-surfaceMuted">
      <div className="flex-shrink-0 sticky top-0 z-20 mb-1.5 flex items-center gap-3 bg-surfaceMuted pt-0 pb-4 backdrop-blur">
        <div
          onClick={() => navigate(`/unit-details/${unitId}?tab=2`)}
          className="inline-flex cursor-pointer items-center gap-3 text-ink transition-colors hover:text-primary"
        >
          <ArrowHeading title="Add Owner" size="2xl" color="text-black" />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <section className="mx-auto w-full rounded-[24px] sm:rounded-[32px] border border-borderLight bg-white px-4 py-6 sm:px-8 sm:py-10">
          <div className="flex flex-col md:flex-row">
            <UnitTowerInfo id={unitId} />
            <div className="hidden md:block w-px bg-borderLight" />
              <AddOwnerForm unitId={unitId} />
          </div>
        </section>
      </div>
    </PageContainer>
  );
};

export default AddOwner;