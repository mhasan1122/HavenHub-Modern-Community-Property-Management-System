import { useDispatch, useSelector } from "react-redux";
import { useEffect } from "react";
import MemberList from "../../Features/Members/MemberList/MemberList";
import LoadingAnimation from "../../Components/Loaders/LoadingAnimation";
import { fetchRoleData } from "../../redux/slices/api/roleApi";
// import { fetchRoleData } from "../../redux/slices/api/roleApi";

const MemberListPage = () => {

  
  return (
    <div className="w-full">
      <MemberList />
    </div>
  );
};

export default MemberListPage;
