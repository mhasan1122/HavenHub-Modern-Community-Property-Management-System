import { ProfileService, ProfileData, UpdateProfileData } from '../profileService';

// Mock the API response
const mockProfileData: ProfileData = {
  id: 1,
  full_name: 'Test User',
  general_contact: '+8801234567890',
  general_email: 'test@example.com',
  is_org_member: true,
  is_comm_member: false,
  is_first_login: false,
  member_roles: [
    {
      id: 1,
      role_name: 'Admin',
      is_member: true,
      is_group: false,
    }
  ],
  member_groups: [],
  occupation: 'Developer',
  gender: 'Male',
  religion: 'Islam',
  nid_number: '1234567890123',
  marital_status: 'Single',
  present_address: 'Dhaka, Bangladesh',
  permanent_address: 'Dhaka, Bangladesh',
};

// Mock fetch
global.fetch = jest.fn();

describe('ProfileService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getProfile', () => {
    it('should fetch profile data successfully', async () => {
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockProfileData,
      } as Response);

      const result = await ProfileService.getProfile('test-token');
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/user/my_profile/'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
          }),
        })
      );
      
      expect(result).toEqual(mockProfileData);
    });

    it('should throw error when fetch fails', async () => {
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
        text: async () => 'Not Found',
      } as Response);

      await expect(ProfileService.getProfile('test-token')).rejects.toThrow(
        'Failed to fetch profile: Not Found'
      );
    });
  });

  describe('updateProfile', () => {
    it('should update profile successfully', async () => {
      const updateData: UpdateProfileData = {
        full_name: 'Updated Name',
        general_email: 'updated@example.com',
      };

      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Profile updated successfully' }),
      } as Response);

      const result = await ProfileService.updateProfile(1, updateData, 'test-token');
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/user/my_profile/'),
        expect.objectContaining({
          method: 'PUT',
        })
      );
      
      expect(result).toEqual({ message: 'Profile updated successfully' });
    });
  });
});