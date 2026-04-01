
// export default useMemberList;
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchMembers } from "../../redux/slices/api/memberApi";
import { useSearchParams } from "react-router-dom";
// const useMemberList = () => {
//   const dispatch = useDispatch();
//   const [searchParams] = useSearchParams();
//   const { members = [], loading = false, error  } = useSelector((state) => state.member) || {};
//   // :white_check_mark: Ensure filters are properly initialized
//   const roleFilter = searchParams.get("member_type");
//   const searchQuery = searchParams.get("search");
//   const statusFilter = roleFilter
//     ? roleFilter.split(",").filter(Boolean).map(Number)
//     : [];
//   // :white_check_mark: Avoid undefined filters
//   const filters = {};
//   if (statusFilter.length > 0) filters.member_type = statusFilter;
//   if (searchQuery) filters.search = searchQuery;
//   console.log("Filters Object before Dispatch:", filters); // Debugging log
//   useEffect(() => {
//     dispatch(fetchMembers({ filters: filters }));
//   }, [dispatch, searchParams]);
//   return { members, loading, error };
// };


// export default useMemberList;
const useMemberList = () => {
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();

  const { members = [], loading = false, error } =
    useSelector((state) => state.member) || {};

  const memberTypeFilter = searchParams.get("member_type");
  const searchQuery = searchParams.get("search");
  const roleFilter = searchParams.get("role"); // role param from URL

  const memberTypeIds = memberTypeFilter
    ? memberTypeFilter.split(",").filter(Boolean).map(Number)
    : [];

  const roleIds = roleFilter
    ? roleFilter.split(",").filter(Boolean).map(Number)
    : [];

  const filters = {};
  if (memberTypeIds.length > 0) filters.member_type = memberTypeIds;
  if (roleIds.length > 0) filters.role = roleIds;
  if (searchQuery) filters.search = searchQuery;

  useEffect(() => {
    dispatch(fetchMembers(filters)); 
  }, [dispatch, searchParams]);

  return { members, loading, error };
};

export default useMemberList;



