import axiosInstance from '../utils/axiosInstance';

/**
 * Pull app updates from GitHub estatelink-testing branch
 * @param {string} branch - Branch name to pull from (default: 'estatelink-testing')
 */
export const pullAppUpdate = async (branch = 'estatelink-testing') => {
  try {
    // Set a timeout of 3 minutes (180000ms) for the git operations
    const response = await axiosInstance.post('/user/system/app-update/', {
      branch
    }, {
      timeout: 180000 // 3 minutes timeout
    });
    return response.data;
  } catch (error) {
    // Handle timeout errors specifically
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      throw {
        error: 'Request timeout',
        message: 'The update operation took too long. Please try again or check the server logs.',
        errors: ['Request timed out after 3 minutes']
      };
    }
    throw error.response?.data || error.message || { error: 'Unknown error occurred' };
  }
};

