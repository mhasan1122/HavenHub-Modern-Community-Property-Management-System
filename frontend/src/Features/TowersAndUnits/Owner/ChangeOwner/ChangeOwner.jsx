import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ArrowHeading from "../../../../Components/HeadingComponent/ArrowHeading";
import PageContainer from "../../../../Components/Ui/PageContainer";
import UnitTowerInfo from "../../UnitDetails/components/UnitTowerInfo";
import { useDispatch } from "react-redux";
import { clearMessage, clearOwnerDetails } from "../../../../redux/slices/owner/ownerSlice";
import ChangeOwnerForm from "./ChangeOwnerForm";
import { setActiveTabs } from "../../../../redux/slices/memberSlice";
import { checkPermission } from "../../../../utils/permissionUtils";
import ModernLoadingAnimation from "../../../../Components/Loaders/ModernLoadingAnimation";

const ChangeOwner = () => {
  const { unitId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Permission state
  const [hasPermission, setHasPermission] = useState(false);
  const [loadingPermission, setLoadingPermission] = useState(true);

  useEffect(() => {
    const fetchPermission = async () => {
      const permissionGranted = await checkPermission("org", 17);
      setHasPermission(permissionGranted);
      setLoadingPermission(false);
    };
    fetchPermission();
  }, []);

  useEffect(() => {
    // Clear messages when component unmounts
    return () => {
      dispatch(clearMessage());
      dispatch(clearOwnerDetails());
    };
  }, [dispatch]);

  if (loadingPermission) return <ModernLoadingAnimation className="min-h-screen" />;
  if (!hasPermission) {
    navigate("/not-authorized");
    return null;
  }

  return (
    <PageContainer className="min-h-screen bg-surfaceMuted">
      <div
        className="flex-shrink-0 sticky top-0 z-20 mb-1.5 flex items-center gap-3 bg-surfaceMuted pt-0 pb-4 backdrop-blur"
        onClick={() => {
          dispatch(setActiveTabs(3));
          navigate(-1);
        }}
      >
        <div className="inline-flex cursor-pointer items-center gap-3 text-ink transition-colors hover:text-primary">
          <ArrowHeading title="Change Ownership" size="2xl" color="text-black" />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <section className="mx-auto w-full rounded-[24px] sm:rounded-[32px] border border-borderLight bg-white px-4 py-6 sm:px-8 sm:py-10">
          <div className="flex flex-col md:flex-row">
            <UnitTowerInfo id={unitId} />
            <div className="hidden md:block w-px bg-borderLight" />
            <ChangeOwnerForm unitId={unitId} />
          </div>
        </section>
      </div>
    </PageContainer>
  );
};

export default ChangeOwner;
