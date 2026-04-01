import React, { useEffect, useState } from "react";
import RoleListTable from "../../../Components/Table/Role/RoleListTable";
import { checkPermission } from "../../../utils/permissionUtils";
import { useNavigate } from "react-router-dom";
import PageContainer from "../../../Components/Ui/PageContainer";
import ContentBox from "../../../Components/Ui/ContentBox";
const RoleList = () => {
  const navigate = useNavigate();
  const [hasPermission, setHasPermission] = useState(false);
  const [loadingPermission, setLoadingPermission] = useState(true);

  useEffect(() => {
    const fetchPermission = async () => {
      const permissionGranted = await checkPermission("org", 6); 
      setHasPermission(permissionGranted);
      setLoadingPermission(false);
    };
    fetchPermission();
  }, []);

  // Once permission check is done, redirect unauthorized users
  if (!loadingPermission && !hasPermission) {
    navigate("/not-authorized");
    return null;
  }

  return (
    <div>
      <PageContainer>
        <ContentBox>
          <RoleListTable addRole="addRole" roleProfile="roleProfile" />
        </ContentBox>
      </PageContainer>
    </div>
  );
};

export default RoleList;