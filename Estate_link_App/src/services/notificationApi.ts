import { API_CONFIG, enhancedFetch } from '../utils/networkUtils';
import { getAuthToken } from '../utils/authUtils';

/**
 * Notification API types
 */
export interface Notification {
    id: number;
    notification_type_code: string;
    notification_type_name: string;
    notification_type_icon?: string;
    entity_type: string;
    entity_id: number;
    title: string;
    message: string;
    priority: 'urgent' | 'high' | 'medium' | 'low';
    is_read: boolean;
    metadata: Record<string, any>;
    created_at: string;
}

export interface NotificationResponse {
    count: number;
    next: number | null;
    previous: number | null;
    hasMore: boolean;
    totalPages: number;
    currentPage: number;
    totalUnread?: number | null;
    results: Notification[];
    load_metrics?: {
        complexity: string;
        load_time_ms: number;
        processed_count: number;
        description: string;
    };
}

export interface UnreadCountResponse {
    unread_count: number;
}

export interface MarkAllReadResponse {
    message: string;
    updated_count: number;
}

/**
 * Notification API Service
 * Provides methods for fetching and managing notifications from the backend
 */
class NotificationAPI {
    private baseUrl = `${API_CONFIG.BASE_URL}/api/notifications`;

    /**
     * Get authentication headers
     */
    private async getHeaders(): Promise<HeadersInit> {
        const token = await getAuthToken();
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        
        // Only add Authorization header if token exists
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        return headers;
    }

    /**
     * Fetch all notifications with optional filters
     * @param params - Query parameters for filtering
     * @returns Promise<NotificationResponse>
     */
    async fetchNotifications(params?: {
        is_read?: boolean;
        page?: number;
        page_size?: number;
        type?: string;
        entity_type?: string;
    }): Promise<NotificationResponse> {
        try {
            const headers = await this.getHeaders();

            // Build query string
            const queryParams = new URLSearchParams();
            // Always add client_type=mobile for mobile app
            queryParams.append('client_type', 'mobile');
            if (params?.is_read !== undefined) {
                queryParams.append('is_read', String(params.is_read));
            }
            if (params?.page !== undefined) {
                queryParams.append('page', String(params.page));
            }
            if (params?.page_size !== undefined) {
                queryParams.append('page_size', String(params.page_size));
            }
            if (params?.type) {
                queryParams.append('type', params.type);
            }
            if (params?.entity_type) {
                queryParams.append('entity_type', params.entity_type);
            }

            const queryString = queryParams.toString();
            const url = `${this.baseUrl}/${queryString ? `?${queryString}` : ''}`;

            console.log('📡 Fetching notifications:', url);

            const response = await enhancedFetch(url, {
                method: 'GET',
                headers,
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch notifications: ${response.status}`);
            }

            const data: NotificationResponse = await response.json();
            console.log(`✅ Fetched ${data.results.length} notifications (total: ${data.count})`);

            return data;
        } catch (error) {
            console.error('❌ Error fetching notifications:', error);
            throw error;
        }
    }

    /**
     * Get unread notification count for badge display
     * @returns Promise<number>
     */
    async getUnreadCount(): Promise<number> {
        try {
            const headers = await this.getHeaders();
            const response = await enhancedFetch(`${this.baseUrl}/unread-count/?client_type=mobile`, {
                method: 'GET',
                headers,
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch unread count: ${response.status}`);
            }

            const data: UnreadCountResponse = await response.json();
            console.log(`🔔 Unread notification count: ${data.unread_count}`);

            return data.unread_count;
        } catch (error) {
            console.error('❌ Error fetching unread count:', error);
            return 0; // Return 0 on error to prevent badge display issues
        }
    }

    /**
     * Mark a single notification as read
     * @param notificationId - ID of the notification to mark as read
     * @returns Promise<Notification>
     */
    async markAsRead(notificationId: number): Promise<Notification> {
        try {
            const headers = await this.getHeaders();
            const response = await enhancedFetch(`${this.baseUrl}/${notificationId}/`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ is_read: true }),
            });

            if (!response.ok) {
                throw new Error(`Failed to mark notification as read: ${response.status}`);
            }

            const data: Notification = await response.json();
            console.log(`✅ Marked notification ${notificationId} as read`);

            return data;
        } catch (error) {
            console.error(`❌ Error marking notification ${notificationId} as read:`, error);
            throw error;
        }
    }

    /**
     * Mark all notifications as read
     * @returns Promise<number> - Number of notifications marked as read
     */
    async markAllAsRead(): Promise<number> {
        try {
            const headers = await this.getHeaders();
            const response = await enhancedFetch(`${this.baseUrl}/mark-all-read/?client_type=mobile`, {
                method: 'POST',
                headers,
            });

            if (!response.ok) {
                throw new Error(`Failed to mark all notifications as read: ${response.status}`);
            }

            const data: MarkAllReadResponse = await response.json();
            console.log(`✅ Marked ${data.updated_count} notifications as read`);

            return data.updated_count;
        } catch (error) {
            console.error('❌ Error marking all notifications as read:', error);
            throw error;
        }
    }

    /**
     * Delete a notification
     * @param notificationId - ID of the notification to delete
     */
    async deleteNotification(notificationId: number): Promise<void> {
        try {
            const headers = await this.getHeaders();
            const response = await enhancedFetch(`${this.baseUrl}/${notificationId}/`, {
                method: 'DELETE',
                headers,
            });

            if (!response.ok) {
                throw new Error(`Failed to delete notification: ${response.status}`);
            }

            console.log(`✅ Deleted notification ${notificationId}`);
        } catch (error) {
            console.error(`❌ Error deleting notification ${notificationId}:`, error);
            throw error;
        }
    }
}

// Export singleton instance
export const notificationAPI = new NotificationAPI();
