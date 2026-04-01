import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '../../../utils/axiosInstance';
import qs from 'qs';

// -------------------------- Async Thunks --------------------------

// Fetch roles list.
export const fetchRoles = createAsyncThunk(
	'group/fetchRoles',
	async (_, thunkAPI) => {
		try {
			const response = await axiosInstance.get('/group_role/add_group_role_list/');
			return response.data;
		} catch (error) {
			return thunkAPI.rejectWithValue(error.response?.data || error.message);
		}
	}
);

// Create a new group.
export const createGroup = createAsyncThunk(
	'group/createGroup',
	async (formData, thunkAPI) => {
		try {
			const response = await axiosInstance.post('/group_role/create_group/', formData);
			return response.data;
		} catch (error) {
			return thunkAPI.rejectWithValue(error.response?.data || error.message);
		}
	}
);

// Update an existing group.
export const updateGroup = createAsyncThunk(
	'group/updateGroup',
	async ({ id, payload }, thunkAPI) => {
		try {
			const response = await axiosInstance.put(`/group_role/update_group/${id}/`, payload);
			return response.data;
		} catch (error) {
			return thunkAPI.rejectWithValue(error.response?.data || error.message);
		}
	}
);

// Fetch group members.
export const fetchGroupMembers = createAsyncThunk(
	'group/fetchGroupMembers',
	async (filters, thunkAPI) => {
		try {
			const queryStr = qs.stringify(filters, { arrayFormat: 'repeat' });
			const url = queryStr ? `/group_role/group_member_add_list/?${queryStr}` : `/group_role/group_member_add_list/`;
			const response = await axiosInstance.get(url);
			return response.data;
		} catch (error) {
			return thunkAPI.rejectWithValue(error.response?.data || error.message);
		}
	}
);

// Fetch groups list.
export const fetchGroupList = createAsyncThunk(
	'group/fetchGroupList',
	async (filters, thunkAPI) => {
		try {
			const queryStr = qs.stringify(filters, { arrayFormat: 'repeat' });
			const url = queryStr ? `/group_role/group_list/?${queryStr}` : `/group_role/group_list/`;
			const response = await axiosInstance.get(url);
			return response.data;
		} catch (error) {
			return thunkAPI.rejectWithValue(error.response?.data || error.message);
		}
	}
);

// Fetch group detail.
export const fetchGroupDetail = createAsyncThunk(
	'group/fetchGroupDetail',
	async (groupId, thunkAPI) => {
		try {
			const response = await axiosInstance.get(`/group_role/group_details/${groupId}/`);
			return response.data;
		} catch (error) {
			return thunkAPI.rejectWithValue(error.response?.data || error.message);
		}
	}
);

// Fetch member types.
export const fetchMemberTypes = createAsyncThunk(
	'group/fetchMemberTypes',
	async (_, thunkAPI) => {
		try {
			const response = await axiosInstance.get('/user/member_type_list/');
			return response.data;
		} catch (error) {
			return thunkAPI.rejectWithValue(error.response?.data || error.message);
		}
	}
);

// Toggle group status (active/inactive) and update RoleGroup status.
export const toggleGroupStatus = createAsyncThunk(
	'group/toggleGroupStatus',
	async (groupId, thunkAPI) => {
		try {
			const response = await axiosInstance.post(`/group_role/group_status_change/${groupId}/`);
			return response.data;
		} catch (error) {
			return thunkAPI.rejectWithValue(error.response?.data || error.message);
		}
	}
);

// -------------------------- Initial State --------------------------
const initialState = {
	roles: [],
	group: null,
	groupList: [],
	groupDetail: null,
	members: [],
	memberTypes: [],
	selectedMemberIds: [], // For member selection tracking.
	groupFormData: {
		group_name: '',
		group_description: '',
		role_ids: [],
		member_ids: [],
		selectAll: false,
	},
	loading: false,
	error: null,
	message: null,
};

// -------------------------- Slice --------------------------
const groupSlice = createSlice({
	name: 'group',
	initialState,
	reducers: {
		clearGroupMessage(state) {
			state.message = null;
			state.error = null;
		},
		setGroupError(state, action) {
			state.error = action.payload;
		},
		setSelectedMemberIds(state, action) {
			state.selectedMemberIds = action.payload;
			state.groupFormData.member_ids = action.payload;
		},
		toggleSelectAll(state, action) {
			state.selectedMemberIds = action.payload;
			state.groupFormData.member_ids = action.payload;
		},
		updateGroupFormField(state, action) {
			const { field, value } = action.payload;
			state.groupFormData[field] = value;
		},
		setGroupFormData(state, action) {
			state.groupFormData = action.payload;
		},
		clearGroupFormData(state) {
			state.groupFormData = {
				group_name: '',
				group_description: '',
				role_ids: [],
				member_ids: [],
				selectAll: false,
			};
		},
	},
	extraReducers: (builder) => {
		builder
			// fetchRoles
			.addCase(fetchRoles.pending, (state) => {
				state.loading = true;
				state.error = null;
			})
			.addCase(fetchRoles.fulfilled, (state, action) => {
				state.loading = false;
				state.roles = action.payload;
			})
			.addCase(fetchRoles.rejected, (state, action) => {
				state.loading = false;
				state.error = action.payload || 'Failed to fetch roles.';
			})
			// createGroup
			.addCase(createGroup.pending, (state) => {
				state.loading = true;
				state.error = null;
			})
			.addCase(createGroup.fulfilled, (state, action) => {
				state.loading = false;
				state.group = action.payload;
				state.message = 'Group created successfully';
			})
			.addCase(createGroup.rejected, (state, action) => {
				state.loading = false;
				state.error = action.payload || 'Group creation failed.';
			})
			// updateGroup
			.addCase(updateGroup.pending, (state) => {
				state.loading = true;
				state.error = null;
			})
			.addCase(updateGroup.fulfilled, (state, action) => {
				state.loading = false;
				state.group = action.payload;
				state.message = 'Group updated successfully';
			})
			.addCase(updateGroup.rejected, (state, action) => {
				state.loading = false;
				state.error = action.payload || 'Group update failed.';
			})
			// fetchGroupMembers
			.addCase(fetchGroupMembers.pending, (state) => {
				state.loading = true;
				state.error = null;
			})
			.addCase(fetchGroupMembers.fulfilled, (state, action) => {
				state.loading = false;
				state.members = action.payload.map((member) => {
					const rolesArray =
						member.member_roles && member.member_roles.length > 0
							? member.member_roles.map((r) => r.role)
							: [];
					return {
						id: member.id,
						name: member.full_name,
						general_email: member.general_email,
						general_contact: member.general_contact,
						type: member.member_type ? member.member_type.type_name : 'N/A',
						email: member.user_email,
						is_org_member: member.is_org_member,
						roles: rolesArray,
						role: rolesArray.length > 0 ? rolesArray.join(', ') : 'N/A',
						image: member.photo_low_quality || null,
					};
				});
			})
			.addCase(fetchGroupMembers.rejected, (state, action) => {
				state.loading = false;
				state.error = action.payload || 'Failed to fetch group members.';
			})
			// fetchGroupList
			.addCase(fetchGroupList.pending, (state) => {
				state.loading = true;
				state.error = null;
			})
			.addCase(fetchGroupList.fulfilled, (state, action) => {
				state.loading = false;
				state.groupList = action.payload.groups;
			})
			.addCase(fetchGroupList.rejected, (state, action) => {
				state.loading = false;
				state.error = action.payload || 'Failed to fetch groups.';
			})
			// fetchGroupDetail
			.addCase(fetchGroupDetail.pending, (state) => {
				state.loading = true;
				state.error = null;
			})
			.addCase(fetchGroupDetail.fulfilled, (state, action) => {
				state.loading = false;
				state.groupDetail = action.payload;
			})
			.addCase(fetchGroupDetail.rejected, (state, action) => {
				state.loading = false;
				state.error = action.payload || 'Failed to fetch group detail.';
			})
			// fetchMemberTypes
			.addCase(fetchMemberTypes.pending, (state) => {
				state.loading = true;
				state.error = null;
			})
			.addCase(fetchMemberTypes.fulfilled, (state, action) => {
				state.loading = false;
				state.memberTypes = action.payload;
			})
			.addCase(fetchMemberTypes.rejected, (state, action) => {
				state.loading = false;
				state.error = action.payload || 'Failed to fetch member types.';
			})
			// toggleGroupStatus
			.addCase(toggleGroupStatus.pending, (state) => {
				state.loading = true;
				state.error = null;
			})
			.addCase(toggleGroupStatus.fulfilled, (state, action) => {
				state.loading = false;
				state.groupDetail = action.payload;
				state.message = 'Group status updated successfully';
			})
			.addCase(toggleGroupStatus.rejected, (state, action) => {
				state.loading = false;
				state.error = action.payload || 'Failed to toggle group status.';
			});
	},
});

export const {
	clearGroupMessage,
	setGroupError,
	setSelectedMemberIds,
	toggleSelectAll,
	updateGroupFormField,
	setGroupFormData,
	clearGroupFormData,
} = groupSlice.actions;

export default groupSlice.reducer;
