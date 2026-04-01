import axiosInstance from '../utils/axiosInstance';

/**
 * Fetch all database tables with row counts
 */
export const fetchDatabaseTables = async () => {
  try {
    const response = await axiosInstance.get('/user/database/tables/');
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

/**
 * Truncate selected database tables
 * @param {string[]} tables - Array of table names to truncate
 * @param {boolean} confirm - Confirmation flag (must be true)
 */
export const truncateDatabaseTables = async (tables, confirm = true) => {
  try {
    const response = await axiosInstance.post('/user/database/tables/truncate/', {
      tables,
      confirm
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

/**
 * Export the entire database as SQL dump file
 * Returns an object with blob and filename
 */
export const exportDatabase = async () => {
  try {
    const response = await axiosInstance.get('/user/database/export/', {
      responseType: 'blob', // Important for file download
    });
    
    // Extract filename from Content-Disposition header
    let filename = null;
    const contentDisposition = response.headers['content-disposition'];
    if (contentDisposition) {
      // Try RFC 5987 format first: filename*=UTF-8''encoded_filename
      const rfc5987Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/);
      if (rfc5987Match && rfc5987Match[1]) {
        try {
          filename = decodeURIComponent(rfc5987Match[1]);
        } catch (e) {
          filename = rfc5987Match[1];
        }
      } else {
        // Fall back to standard format: filename="filename" or filename=filename
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '').trim();
          // Decode URI encoded filename if needed
          try {
            filename = decodeURIComponent(filename);
          } catch (e) {
            // If decoding fails, use as-is
          }
        }
      }
    }
    
    return {
      blob: response.data,
      filename: filename
    };
  } catch (error) {
    // If error response is also a blob (error message), convert it
    if (error.response?.data instanceof Blob) {
      const text = await error.response.data.text();
      try {
        const jsonError = JSON.parse(text);
        throw jsonError.error || jsonError.message || 'Failed to export database';
      } catch (e) {
        throw text || 'Failed to export database';
      }
    }
    throw error.response?.data || error.message;
  }
};

/**
 * Import database from SQL file
 * @param {FormData} formData - FormData containing the SQL file
 */
export const importDatabase = async (formData) => {
  try {
    const response = await axiosInstance.post('/user/database/import/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

