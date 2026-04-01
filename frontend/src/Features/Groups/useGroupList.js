import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import { fetchGroupList } from "../../redux/slices/groups/groupSlice";

const useGroupList = () => {
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();

  const { groupList, loading } = useSelector((state) => state.group);

  const statusFilter = (searchParams.get("status") || "").split(",");
  const searchQuery = searchParams.get("search") || "";

  // fetch groups on initial load or when filters get updated.
  useEffect(() => {
    dispatch(fetchGroupList({ status: statusFilter, search: searchQuery }));
  }, [dispatch, searchParams]);

  return { groupList, loading };
};

export default useGroupList;
