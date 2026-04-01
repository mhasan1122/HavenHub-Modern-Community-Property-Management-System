
import axiosInstance from "./axiosInstance";

/**
 * Check central permission for a given member type and permission ID.
 *
 * @param {string} type_of_member - The type of member (e.g., "org" or "comm").
 * @param {number|string} permission_id - The permission ID to check.
 * @returns {Promise<boolean>} - Resolves to true if permission is granted, otherwise false.
 */
export const checkPermission = async (type_of_member, permission_id) => {
    try {
        const response = await axiosInstance.get(
            `/user/cental_permission_checker/?type_of_member=${type_of_member}&permission_id=${permission_id}`
        );
        return response.status === 200;
    } catch (error) {
        if (error.response && error.response.status === 401) {
            try {
                // Call logout API (synchronously calling the logout endpoint)
                await axiosInstance.post(`/user/logout/`);
            } catch (logoutError) {
                console.error("Logout API call failed:", logoutError);
            }
            // Clear all session data from localStorage (and any other session storage as needed)
            localStorage.clear();
            // Redirect to the login page immediately
            window.location.href = "/login";
        }
        return false;
    }
};