import { createAsyncThunk } from "@reduxjs/toolkit";
import axiosInstance from "../../../utils/axiosInstance";

// List Company
export const showCompanyList = createAsyncThunk(
  "company/showList",
  async (formData, thunkAPI) => {
    // Construct search query parameter if formData exists
    let searchQuery = formData ? `?search=${formData}` : '';
    console.log(searchQuery)
    // Construct the full URL with the query parameter
    const url = `user/companies/list/${searchQuery}`;

    try {
      const response = await axiosInstance.get(url, {
        headers: { "Content-Type": "multipart/form-data" } 
      });

      // Return the response data
      return response.data;
    } catch (error) {
      // Handle errors and reject with appropriate message
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Create Company
export const createCompany = createAsyncThunk(
  "company/create",
  async (formData, thunkAPI) => {
    console.log(formData.email)
    try {
     const response= await axiosInstance.post("/user/companies/create/", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      // Optionally refresh the members list after creation
      // thunkAPI.dispatch(fetchMembers());
      console.log(response.data);
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);
export const updateCompany = createAsyncThunk(
  "company/update",
  async ({ id, formData }, {dispatch, rejectWithValue }) => {
    try {
      const response = await axiosInstance.put(
        `/user/companies/update/${id}/`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" }
        }
      );
      // dispatch(fetchHeadingData());
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response.data);
    }
  }
);
