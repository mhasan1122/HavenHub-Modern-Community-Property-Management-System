import React, { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import UnitTowerInfo from "../../UnitDetails/components/UnitTowerInfo";
import { useDispatch } from "react-redux";
import EditOwnerForm from "./EditOwnerForm";
import { clearMessage, clearOwnerDetails } from "../../../../redux/slices/owner/ownerSlice";
import ArrowHeading from "../../../../Components/HeadingComponent/ArrowHeading";
import PageContainer from "../../../../Components/Ui/PageContainer";

const EditOwner = () => {
  const { unitId, ownerId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  useEffect(() => {
    // Clear messages when component unmounts
    return () => {
      dispatch(clearMessage());
      dispatch(clearOwnerDetails());
    };
  }, [dispatch]);

  const handleBack = () => {
    navigate(`/unit-details/${unitId}?tab=2`);
  };

  return (
    <PageContainer className="min-h-screen bg-surfaceMuted">
      <div className="sticky top-0 z-20 mb-3 flex items-center gap-3 bg-surfaceMuted/95 py-4 backdrop-blur">
        <div
          onClick={handleBack}
          className="inline-flex cursor-pointer items-center gap-3 text-[#0F172A] transition-colors hover:text-primary"
        >
          <ArrowHeading title="Edit Owner" size="2xl" color="text-black" />
        </div>
      </div>

      <div className="max-h-[calc(100vh-180px)] overflow-y-auto">
        <section className="mt-2 w-full rounded-[32px] border border-borderLight bg-white px-8 py-10">
          <div className="flex flex-col md:flex-row">
            <UnitTowerInfo id={unitId} />
            <div className="hidden md:block w-px bg-borderLight" />
            <EditOwnerForm unitId={unitId} ownerId={ownerId} />
          </div>
        </section>
      </div>
    </PageContainer>
  );
};

export default EditOwner; 