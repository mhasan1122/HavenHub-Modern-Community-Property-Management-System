import PageContainer from "../../Components/Ui/PageContainer";
import GeneralInformationEditForm from "../../Features/Members/MemberEdit/GeneralInformationEdit/GeneralInformationEditForm";

const GeneralInformationEditPage = () => {
  return (
    <PageContainer className="min-h-screen bg-surfaceMuted">
      <GeneralInformationEditForm/>
    </PageContainer>
  );
};

export default GeneralInformationEditPage;