import React from "react";
import ServiceFeeSettingsList from "./ServiceFeeSettings/ServiceFeeList/ServiceFeeList";
import PageContainer from "../../Components/Ui/PageContainer";
import ContentBox from "../../Components/Ui/ContentBox";

const ServiceFeeSettings = () => {
  return (
    <PageContainer>
      <ContentBox>
        <ServiceFeeSettingsList />
      </ContentBox>
    </PageContainer>
  );
};

export default ServiceFeeSettings;
