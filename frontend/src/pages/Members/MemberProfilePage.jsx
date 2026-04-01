// import React, { useEffect, useMemo } from "react";
// import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
// import ArrowHeading from "../../Components/HeadingComponent/ArrowHeading";
// import PageContainer from "../../Components/Ui/PageContainer";
// import { useDispatch, useSelector } from "react-redux";
// import ContentBox from "../../Components/Ui/ContentBox";
// import Row from "../../Components/Ui/Row";
// import MemberSummary from "../../Features/Members/MemberProfile/MemberSummary";
// import MemberDetails from "../../Features/Members/MemberProfile/MemberDetails";
// import Line from "../../Components/Ui/Line";
// import { fetchMemberById } from "../../redux/slices/api/memberApi";

// const MemberProfilePage = () => {
//   const { id } = useParams();
//   const dispatch = useDispatch();
//   const navigate = useNavigate();
//   const location = useLocation();

//   // use shallowEqual to avoid unnecessary re-renders when selectedMember hasn't changed
//   const selectedMember = useSelector((state) => state.member.selectedMember);

//   const memberId = useMemo(() => Number(id), [id]);
//   const handleGoBack = () => {
//     navigate(-1);

//   };

//   useEffect(() => {
//     if (!selectedMember || selectedMember.member?.id !== memberId) {
//       dispatch(fetchMemberById(memberId));
//     }
//   }, [selectedMember, memberId, dispatch]);

//   if (!selectedMember) {
//     return <LoadingAnimation />;
//   }

//   // console.log(selectedMember,"selectedMember abr")
//   return (
//     <PageContainer>
//       <div onClick={handleGoBack} style={{ cursor: "pointer" }}>
//         <ArrowHeading title="Profile" size="xl" color="text-black" />
//       </div>
//       <ContentBox className="max-w-content">
//         <Row>
//           <MemberSummary member={selectedMember.member} />
//           <MemberDetails selectedMember={selectedMember} />
//         </Row>
//       </ContentBox>
//     </PageContainer>
//   );
// };

// export default React.memo(MemberProfilePage);

import React, { useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import ArrowHeading from "../../Components/HeadingComponent/ArrowHeading";
import PageContainer from "../../Components/Ui/PageContainer";
import { useDispatch, useSelector } from "react-redux";
import MemberSummary from "../../Features/Members/MemberProfile/MemberSummary";
import MemberDetails from "../../Features/Members/MemberProfile/MemberDetails";
import { fetchMemberById } from "../../redux/slices/api/memberApi";
import ModernLoadingAnimation from "../../Components/Loaders/ModernLoadingAnimation";

const MemberProfilePage = () => {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const selectedMember = useSelector((state) => state.member.selectedMember);
  const memberId = Number(id);

  useEffect(() => {
    dispatch(fetchMemberById(memberId));
  }, [dispatch, memberId, location.key]); // Add location.key to dependencies

  const handleGoBack = () => {
    const from = location.state?.from;
    if (from) {
      navigate(from);
    } else {
      navigate(-1);
    }
  };

  if (!selectedMember || selectedMember.member?.id !== memberId) {
    return <ModernLoadingAnimation className="min-h-screen" />;
  }

  // Extract navigation state for role highlighting
  const highlightRoleId = location.state?.roleId;
  const highlightRole = location.state?.highlightRole;
  const initialActiveTab = location.state?.activeTab;

  return (
    <PageContainer className="h-full bg-surfaceMuted flex flex-col min-h-0">
      <div className="flex-shrink-0 sticky top-0 z-20 mb-1.5 flex items-center justify-between gap-3 bg-surfaceMuted/95 py-2 md:py-4 backdrop-blur">
        <div
          onClick={handleGoBack}
          className="inline-flex cursor-pointer items-center gap-3 text-ink transition-colors hover:text-primary"
        >
          <ArrowHeading title="Profile" size="2xl" color="text-black" />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        <section className="mx-auto w-full rounded-[20px] md:rounded-[32px] border border-borderLight bg-white px-4 py-6 md:px-8 md:py-10">
          <div className="flex flex-col md:flex-row gap-6 md:gap-0">
            <aside className="w-full md:w-[320px] shrink-0 p-0 md:p-6 flex flex-col min-w-0">
              <MemberSummary member={selectedMember.member} />
            </aside>

            <div className="hidden md:block w-px bg-borderLight" />

            <div className="w-full md:flex-1 p-0 md:p-6 flex flex-col min-w-0">
              <MemberDetails
                selectedMember={selectedMember}
                highlightRoleId={highlightRoleId}
                highlightRole={highlightRole}
                initialActiveTab={initialActiveTab}
              />
            </div>
          </div>
        </section>
      </div>
    </PageContainer>
  );
};

export default React.memo(MemberProfilePage);
