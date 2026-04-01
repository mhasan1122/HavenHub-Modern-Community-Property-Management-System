import { getBackendURL } from '../config/environment';
import { getAuthHeaders } from '../utils/authUtils';
import { Contact, CreateContactData, UpdateContactData } from '../types/contact';

const BASE_URL = `${getBackendURL()}/api/contacts`;

export class ContactService {
  // Get all important contacts
  static async getContacts(token?: string): Promise<Contact[]> {
    const url = `${BASE_URL}/`;
    console.log('🔍 Fetching contacts from:', url);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders(token),
      });

      console.log('📡 Contacts response status:', response.status);
      console.log('📡 Contacts response Content-Type:', response.headers.get('Content-Type'));

      if (!response.ok) {
        const contentType = response.headers.get('Content-Type') || '';
        const errorText = await response.text();
        console.error('❌ Contacts API Error:', errorText.substring(0, 500)); // Log first 500 chars
        
        // Check if response is HTML (Django error page)
        if (contentType.includes('text/html')) {
          if (response.status === 500) {
            throw new Error('Server error: The backend encountered an issue. Please check the server logs.');
          } else if (response.status === 404) {
            throw new Error('Contacts endpoint not found. Please verify the API URL.');
          } else {
            throw new Error(`Server error (${response.status}): Received HTML error page instead of JSON response.`);
          }
        }
        
        // Try to parse as JSON if it's not HTML
        let errorMessage = `Failed to fetch contacts: ${response.statusText}`;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorData.detail || errorData.error || errorMessage;
        } catch {
          // If parsing fails, use the text or status text
          if (errorText && errorText.length < 200) {
            errorMessage = errorText;
          }
        }
        
        if (response.status === 403) {
          throw new Error('You do not have permission to view contacts.');
        }
        if (response.status === 401) {
          throw new Error('Authentication required. Please log in again.');
        }
        
        throw new Error(errorMessage);
      }

      // Check if response is actually JSON before parsing
      const contentType = response.headers.get('Content-Type') || '';
      if (!contentType.includes('application/json') && !contentType.includes('text/json')) {
        const responseText = await response.text();
        console.warn('⚠️ Unexpected Content-Type:', contentType);
        console.warn('⚠️ Response preview:', responseText.substring(0, 200));
        throw new Error('Server returned non-JSON response. Please check the API endpoint.');
      }

      const data = await response.json();
      console.log('📥 Contacts API response:', data);
      
      // Handle both array and object with results property
      if (Array.isArray(data)) {
        return data;
      } else if (data.results) {
        return data.results;
      } else if (data.data && Array.isArray(data.data)) {
        return data.data;
      }
      
      return [];
    } catch (error) {
      console.error('❌ Error fetching contacts:', error);
      // Re-throw with more context if it's a generic error
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error: Unable to reach the server. Please check your connection.');
      }
      throw error;
    }
  }

  // Get contact by ID
  static async getContact(id: number, token?: string): Promise<Contact> {
    const url = `${BASE_URL}/${id}/`;
    console.log('🔍 Fetching contact from:', url);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Contact API Error:', errorText);
        
        if (response.status === 403) {
          throw new Error('You do not have permission to view this contact.');
        }
        if (response.status === 404) {
          throw new Error('Contact not found.');
        }
        
        throw new Error(`Failed to fetch contact: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('❌ Error fetching contact:', error);
      throw error;
    }
  }

  // Create contact
  static async createContact(data: CreateContactData, token?: string): Promise<Contact> {
    const url = `${BASE_URL}/`;
    console.log('🔍 Creating contact:', url);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Create Contact API Error:', errorData);
        
        if (response.status === 403) {
          throw new Error('You do not have permission to create contacts.');
        }
        
        const errorMessage = errorData.message || errorData.detail || `Failed to create contact: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      const responseData = await response.json();
      // Backend returns { message, contact } format
      return responseData.contact || responseData;
    } catch (error) {
      console.error('❌ Error creating contact:', error);
      throw error;
    }
  }

  // Update contact
  static async updateContact(id: number, data: UpdateContactData, token?: string): Promise<Contact> {
    const url = `${BASE_URL}/${id}/`;
    console.log('🔍 Updating contact:', url);

    try {
      const response = await fetch(url, {
        method: 'PATCH',
        headers: getAuthHeaders(token),
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Update Contact API Error:', errorData);
        
        if (response.status === 403) {
          throw new Error('You do not have permission to update this contact.');
        }
        if (response.status === 404) {
          throw new Error('Contact not found.');
        }
        
        const errorMessage = errorData.message || errorData.detail || `Failed to update contact: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      const responseData = await response.json();
      // Backend returns { message, contact } format
      return responseData.contact || responseData;
    } catch (error) {
      console.error('❌ Error updating contact:', error);
      throw error;
    }
  }

  // Delete contact
  static async deleteContact(id: number, token?: string): Promise<void> {
    const url = `${BASE_URL}/${id}/`;
    console.log('🔍 Deleting contact:', url);

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Delete Contact API Error:', errorData);
        
        if (response.status === 403) {
          throw new Error('You do not have permission to delete this contact.');
        }
        if (response.status === 404) {
          throw new Error('Contact not found.');
        }
        
        const errorMessage = errorData.message || errorData.detail || `Failed to delete contact: ${response.statusText}`;
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('❌ Error deleting contact:', error);
      throw error;
    }
  }
}

