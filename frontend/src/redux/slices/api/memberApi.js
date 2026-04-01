import { createAsyncThunk } from "@reduxjs/toolkit";
import axiosInstance from "../../../utils/axiosInstance";
import qs from "qs";
import { logoutUser } from "../../../api/authApi/authApi";

// export const fetchMembers = createAsyncThunk(
//   "members/fetchAll",
//   async (filters, thunkAPI) => {
//     try {
//       // Debugging the structure of filters
//       console.log("Original Filters: ", filters);

//       const { role, search } = filters?.filters || {}; // Safely destructure

//       console.log("Role Array: ", role);
//       console.log("Search Query: ", search);

//       const payload = {
//         role: role || [],  // Default to empty array if no role
//         search: search || ""  // Default to empty string if no search
//       };

//       console.log("Payload being sent: ", payload);

//       const queryStr = qs.stringify(payload, { arrayFormat: "repeat" });

//       // Determine URL based on filters
//       const url = queryStr
//         ? `/user/member_list_search_sort/?${queryStr}`
//         : "/user/member_list/?type=org";

//       console.log("Final URL: ", url);

//       // Send the request
//       const response = await axiosInstance.get(url);
//       return response.data;
//     } catch (error) {
//       console.error("Error fetching members: ", error); // Log the error
//       return thunkAPI.rejectWithValue(error.response?.data || error.message);
//     }
//   }
// );

// export const fetchMembers = createAsyncThunk(
//   "members/fetchAll",
//   async (filters, thunkAPI) => {
//     try {
//       // console.log("Original Filters: ", filters);

//       // Destructure member_type and search from filters instead of role.
//       const { member_type, search } = filters?.filters || {};
//       // console.log("Member Type Array: ", member_type);
//       // console.log("Search Query: ", search);

//       // Build the payload using member_type key.
//       const payload = {
//         member_type: member_type || [],
//         search: search || ""
//       };

//       // console.log("Payload being sent: ", payload);

//       // Build the query string.
//       const queryStr = qs.stringify(payload, { arrayFormat: "repeat" });

//       // Use the search/sort endpoint if there is a query string,
//       // otherwise fall back to the default organization member list.
//       const url = queryStr
//         ? `/user/member_list_search_sort/?${queryStr}`
//         : "/user/member_list/?type=org";

//       // console.log("Final URL: ", url);

//       const response = await axiosInstance.get(url);
//       return response.data;
//     } catch (error) {
//       // console.error("Error fetching members: ", error);

//       if (error.response?.status === 404) {
//         return thunkAPI.rejectWithValue(error.response.data);
//       }

//       return thunkAPI.rejectWithValue(error.response?.data || error.message);
//     }
//   }
// );
export const fetchMembers = createAsyncThunk(
  "members/fetchAll",
  async (filters, thunkAPI) => {
    try {
      //  const { member_type, search, role } = filters?.filters || {};
      const { member_type, search, role } = filters || {}; 

      console.log("Selected Roles:", role);

      // Extract values from filter objects
      const extractValues = (arr) => {
        if (!Array.isArray(arr)) return [];
        return arr.map(item => typeof item === "object" && item !== null ? item.value : item);
      };

      const payload = {
        member_type: extractValues(member_type || []),
        search: search || "",
        role: extractValues(role || [])
      };

      const queryStr = qs.stringify(payload, { arrayFormat: "repeat" });
      console.log("Query String:", queryStr);

      const url = queryStr
        ? `/user/member_list_search_sort/?${queryStr}`
        : "/user/member_list/?type=org";

      const response = await axiosInstance.get(url);
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return thunkAPI.rejectWithValue(error.response.data);
      }
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);


// Fetch Member by ID
export const fetchMemberById = createAsyncThunk(
  "members/fetchById",
  async (id, thunkAPI) => {
    try {
      const response = await axiosInstance.get(`/user/member_details/${id}/`);
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data || "Error fetching member details"
      );
    }
  }
);

// Fetch Member Types
export const fetchMemberTypes = createAsyncThunk(
  "memberTypes/fetchAll",
  async (_, thunkAPI) => {
    try {
      const response = await axiosInstance.get("/user/member_type_list/");
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Create Member
export const createMember = createAsyncThunk(
  "members/create",
  async (formData, thunkAPI) => {
    try {
      await axiosInstance.post("/user/create_member/", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      // Optionally refresh the members list after creation
      thunkAPI.dispatch(fetchMembers());
      return "Created successfully";
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);
export const memberUpdate = createAsyncThunk(
  "member/update",
  async ({ id, formData }, {dispatch, rejectWithValue }) => {
    try {
      const response = await axiosInstance.put(
        `/user/update_member/${id}/`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" }
        }
      );
      dispatch(fetchHeadingData());
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response.data);
    }
  }
);

export const resendLoginCredentials = createAsyncThunk(
  "member/resendLoginCredentials",
  async (id, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post(
        `/user/resend_login_credentials/${id}/`
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

// export const changeOrgMemberStatus = createAsyncThunk(
//   "member/changeOrgStatus",
//   async ({ id, is_org_member }, { dispatch, rejectWithValue }) => {
//     try {
//       // Send the request with the status_change payload indicating active (1) or inactive (0)
//       const response = await axiosInstance.post(
//         `/user/change_member_status/${id}/`,
//         {
//           status_change: is_org_member, // 1 for active, 0 for inactive
//           member_type: "org" // Specify the member type
//         }
//       );

//       // // If status is changed to inactive, log out immediately
//       // if (is_org_member === 0) {
//       //   // Dispatch logout action if status is inactive
//       //   dispatch(logoutUser()); // Ensure that navigate is passed to logoutUser if needed
//       // }

//       // Return the updated status received from the response
//       return { id, is_org_member: response.data.is_org_member };
//     } catch (error) {
//       // Handle errors gracefully and return a rejection
//       return rejectWithValue(error.response?.data || "An error occurred");
//     }
//   }
// );
export const changeOrgMemberStatus = createAsyncThunk(
  "member/changeOrgStatus",
  async ({ id, status, member_type }, { dispatch, rejectWithValue }) => {
console.log("new data",status,member_type)
    try {
      const response = await axiosInstance.post(
        `/user/change_member_status/${id}/`,
        {
          status_change: status,
          member_type: member_type // now dynamic
        }
      );

      return { id, is_org_member: response.data.is_org_member };
    } catch (error) {
      return rejectWithValue(error.response?.data || "An error occurred");
    }
  }
);

export const fetchHeadingData = createAsyncThunk(
  "members/fetchHeadingData",
  async (_, thunkAPI) => {
    try {
      const response = await axiosInstance.get("/user/heading_data/");
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const fetchAddExistingMembers = createAsyncThunk(
  "members/addexistingCommMember",
  async (filters, thunkAPI) => {
    try {
      const { member_type, search } = filters?.filters || {};

      // Extract values from filter objects and sanitize
      const sanitizedMemberType = Array.isArray(member_type)
        ? member_type
            .map((type) => {
              // Extract value from object or use string directly
              const value = typeof type === "object" && type !== null ? type.value : type;
              return value;
            })
            .filter(
              (type) => type && type !== "NaN" && type !== "undefined" && type !== "null"
            )
        : [];

      const payload = {
        member_type: sanitizedMemberType,
        search: search?.trim() || ""
      };

      const queryStr = qs.stringify(payload, { arrayFormat: "repeat" });

      // const url = queryStr? `/user/add_existing_comm_member_list/?${queryStr}` : "/user/add_existing_comm_member_list/?type=comm";
      const url =  `/user/add_existing_comm_member_list/?${queryStr}` ;

      console.log("Final URL: ", url);

      const response = await axiosInstance.get(url);
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Optimized endpoint for unit contact list (faster, unit-specific)
export const fetchUnitContacts = createAsyncThunk(
  "members/fetchUnitContacts",
  async ({ unitId, filters = {} }, thunkAPI) => {
    try {
      const { member_type, search } = filters;

      // Extract values from filter objects and sanitize
      const sanitizedMemberType = Array.isArray(member_type)
        ? member_type
            .map((type) => {
              const value = typeof type === "object" && type !== null ? type.value : type;
              return value;
            })
            .filter(
              (type) => type && type !== "NaN" && type !== "undefined" && type !== "null"
            )
        : [];

      const payload = {
        unit_id: unitId,
        ...(sanitizedMemberType.length > 0 && { member_type: sanitizedMemberType }),
        ...(search?.trim() && { search: search.trim() }),
      };

      const queryStr = qs.stringify(payload, { arrayFormat: "repeat" });
      const url = `/towers/unit_contact_list/?${queryStr}`;

      const response = await axiosInstance.get(url);
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

