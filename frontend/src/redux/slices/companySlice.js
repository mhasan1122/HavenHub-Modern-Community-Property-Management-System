import { createSlice } from "@reduxjs/toolkit";
import { createCompany, updateCompany,showCompanyList} from "./api/companyApi";

// const initialState = {
//   company: [],
//   loading: false,
//   error: null,
//   message: null,
//   activeTabs:1

// };




// const companySlice = createSlice({
//   name: "company",
//   initialState,
//   reducers: {
//     setMessage(state, action) {
//       state.message = action.payload;
//     },
//     setError(state, action) {
//       state.error = action.payload;
//     },
//     clearMessage(state) {
//       state.message = null;
//       state.error = null;
//     },
   
//     setActiveTabs(state, action) {
//       state.activeTabs = action.payload; // Update the active tab
//     },
//     setCreatedCompany: (state, action) => {
//       state.createCompany = action.payload;
//     },
//     clearCreatedCompany: (state) => {
//       state.createCompany = null;
//     }
   
//   },
//   extraReducers: (builder) => {
//     builder
   
//        .addCase(showCompanyList.pending, (state) => {
//          state.loading = true;
//          state.error = null;
//        })
//        .addCase(showCompanyList.fulfilled, (state, action) => {
//          state.loading = false;
//          state.company = action.payload;
//        })
//        .addCase(showCompanyList.rejected, (state, action) => {
//          state.loading = false;
//          state.error = action.payload;
//        })
//       // Create Member
//       .addCase(createCompany.pending, (state) => {
//         state.loading = true;
//         state.error = null;
//         state.message = null;
//         state.createdMember = {
//           id: action.payload.member.id,
//           full_name: action.payload.member.full_name
//         };
//       })
//       .addCase(createCompany.fulfilled, (state, action) => {
//         state.loading = false;
//         state.message = "Company created successfully!";
//         // state.company = state.company;
//         state.company_data = action.payload;
//       })
//       .addCase(createCompany.rejected, (state, action) => {
//         state.loading = false;
//         state.error = action.payload || "Failed to create company.";
//       })

  
    
//       .addCase(updateCompany.pending, (state) => {
//         state.loading = true;
//         state.error = null;   // Reset error while loading
//         state.message = null; // Reset message while loading
//       })
      
//       .addCase(updateCompany.fulfilled, (state, action) => {
//         state.loading = false;
//         state.message = "Company updated successfully!";
//         state.company_data = action.payload;
//         // state.selectedMember = action.payload; // Update selectedMember with response data
//         // No need to set error here, as this is a success case
//       })
      
//       .addCase(updateCompany.rejected, (state, action) => {
//         state.loading = false;
//         // In the rejected case, extract the error message properly
//         state.error = action.payload?.Error || "Failed to update company.";
//       })

 
//   }
// });


//   export const { setMessage, setError, clearMessage,setActiveTabs } = companySlice.actions;

// export default companySlice.reducer;
const initialState = {
  company: [],
  loading: false,
  error: null,
  message: null,
  activeTabs: 1,
  createdMember: null,
  company_data: null,
};

const companySlice = createSlice({
  name: "company",
  initialState,
  reducers: {
    setMessage(state, action) {
      state.message = action.payload;
    },
    setError(state, action) {
      state.error = action.payload;
    },
    clearMessage(state) {
      state.message = null;
      state.error = null;
    },
    setActiveTabs(state, action) {
      state.activeTabs = action.payload;
    },
    // setCreatedCompany(state, action) {
    //   state.createdMember = action.payload;
    // },
    clearCreatedCompany(state) {
      state.company_data = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Show Company List
      .addCase(showCompanyList.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(showCompanyList.fulfilled, (state, action) => {
        state.loading = false;
        state.company = action.payload;
      })
      .addCase(showCompanyList.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Create Company
      .addCase(createCompany.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.message = null;
      })
      .addCase(createCompany.fulfilled, (state, action) => {
        state.loading = false;
        state.message = "Company created successfully!";
        state.company_data = action.payload;
      })
      .addCase(createCompany.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Failed to create company.";
      })

      // Update Company
      .addCase(updateCompany.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.message = null;
      })
      .addCase(updateCompany.fulfilled, (state, action) => {
        state.loading = false;
        state.message = "Company updated successfully!";
        state.company_data = action.payload;
      })
      .addCase(updateCompany.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.Error || "Failed to update company.";
      });
  },
});

export const {
  setMessage,
  setError,
  clearMessage,
  setActiveTabs,
  // setCreatedCompany,
  clearCreatedCompany,
} = companySlice.actions;

export default companySlice.reducer;
