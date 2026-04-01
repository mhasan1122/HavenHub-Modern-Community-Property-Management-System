import PageContainer from "../Components/Ui/PageContainer";
import OrganizationMemberForm from "../Features/Members/OrganizationMemberForm/OrganizationMemberForm";

const AddMemberPage = () => {
  return (
    <PageContainer className="min-h-screen bg-surfaceMuted">
      <OrganizationMemberForm/>
    </PageContainer>
  );
};

export default AddMemberPage;