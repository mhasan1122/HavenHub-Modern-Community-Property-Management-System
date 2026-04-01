import React, { useEffect } from "react";
import PageContainer from "../../Components/Ui/PageContainer";
import { useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchGroupDetail,
  toggleGroupStatus
} from "../../redux/slices/groups/groupSlice";
import ArrowHeading from "../../Components/HeadingComponent/ArrowHeading";
import ModernLoadingAnimation from "../../Components/Loaders/ModernLoadingAnimation";
import ContentBox from "../../Components/Ui/ContentBox";
import Button from "../../Components/FormComponent/ButtonComponent/Button";
import { Paragraph } from "../../Components/Ui/Paragraph";
import { FaEdit } from "react-icons/fa";
import GroupProfile from "../../Features/Groups/GroupProfile/GroupProfile";
import { checkPermission } from "../../utils/permissionUtils"; // Newly added import
import editIcon from "../../assets/edit/edit-02.png";
const GroupProfilePage = () => {
  const { id } = useParams(); // Get group id from URL.
  const dispatch = useDispatch();
  const { groupDetail, loading, error } = useSelector((state) => state.group);
  const navigate = useNavigate();

  useEffect(() => {
    if (id) {
      dispatch(fetchGroupDetail(id));
    }
  }, [dispatch, id]);

  // const handleToggleStatus = async () => {
  //   // Check central permission before toggling the group status
  //   const permissionGranted = await checkPermission("org", 8);
  //   if (!permissionGranted) {
  //     navigate("/not-authorized");
  //     return;
  //   }
  //   dispatch(toggleGroupStatus(id));
  // };

  if (loading || !groupDetail) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <ModernLoadingAnimation />
      </div>
    );
  }

  if (error) {
    return <Paragraph>Error: {error}</Paragraph>;
  }

  // const { group_name, is_active } = groupDetail;

  return (
    <PageContainer className="min-h-screen bg-surfaceMuted">
      <div className="flex-shrink-0 sticky top-0 z-20 mb-1.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-surfaceMuted pt-0 pb-4 backdrop-blur">
        <div
          onClick={() => navigate("/group-list")}
          className="inline-flex cursor-pointer items-center gap-2 sm:gap-3 text-[#0F172A] transition-colors hover:text-primary"
        >
          <ArrowHeading title="View Group" size="2xl" color="text-black" />
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <button
            className="flex items-center justify-center bg-primary rounded-lg py-2.5 sm:py-2 px-4 text-sm sm:text-base font-medium text-white cursor-pointer whitespace-nowrap w-full sm:w-auto hover:bg-primaryDark transition-colors"
            onClick={() => navigate(`/edit-group/${id}`)}
          >
            <span className="text-base sm:text-lg mr-2">
              <img src={editIcon} alt="Edit" className="w-4 h-4 sm:w-5 sm:h-5" />
            </span>
            <span>Edit</span>
          </button>
        </div>
      </div>

      <div className="max-h-[calc(100vh-180px)] overflow-y-auto custom-scrollbar">
        <section className="mx-auto w-full rounded-[16px] sm:rounded-[24px] lg:rounded-[32px] border border-borderLight bg-white px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
          <GroupProfile groupDetail={groupDetail} />
        </section>
      </div>
    </PageContainer>
  );
};

export default GroupProfilePage;
