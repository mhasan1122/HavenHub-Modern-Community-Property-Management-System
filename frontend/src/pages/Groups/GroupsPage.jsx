import React from "react";
import PageContainer from "../../Components/Ui/PageContainer";
import ContentBox from "../../Components/Ui/ContentBox";
import GroupList from "../../Features/Groups/GroupList/GroupList";

const GroupsPage = () => {
  return (
    <>
      <PageContainer>
        <ContentBox>
          <GroupList />
        </ContentBox>
      </PageContainer>
    </>
  );
};

export default GroupsPage;
