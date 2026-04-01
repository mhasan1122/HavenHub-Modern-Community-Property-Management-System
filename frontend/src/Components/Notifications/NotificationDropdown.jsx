import React, { useEffect, useRef, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  loadMoreNotifications
} from "../../redux/slices/api/notificationApi";
import { formatDistanceToNow } from "date-fns";

const NotificationDropdown = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const lastFetchTimeRef = useRef(null);
  const {
    notifications,
    unreadCount,
    loading,
    loadingMore,
    pagination,
    loadMetrics
  } = useSelector((state) => state.notifications);

  // Debug: Log the exact state values
  useEffect(() => {
    console.log("[NotificationDropdown] Redux state check:", {
      notifications: notifications,
      notificationsLength: notifications?.length || 0,
      isArray: Array.isArray(notifications),
      unreadCount,
      loading
    });
  }, [notifications, unreadCount, loading]);

  // Debug: Log notifications when they change
  useEffect(() => {
    const roleAssigned = notifications.filter((n) => {
      const code =
        n.notification_type_code ||
        (n.notification_type && n.notification_type.code);
      return code === "role_assigned";
    });
    if (roleAssigned.length > 0) {
      console.log(
        "[NotificationDropdown] 🎭 Role assigned notifications in state:",
        roleAssigned
      );
    } else {
      console.log(
        "[NotificationDropdown] ⚠️ No role_assigned notifications in state. Total notifications:",
        notifications.length
      );
      console.log(
        "[NotificationDropdown] Notification types:",
        notifications.map(
          (n) =>
            n.notification_type_code ||
            (n.notification_type && n.notification_type.code) ||
            "unknown"
        )
      );
    }
  }, [notifications]);

  // Cache duration: only refetch if data is older than 30 seconds
  const CACHE_DURATION = 30000; // 30 seconds

  // Fetch notifications and unread count on mount (only if not already fetched recently)
  useEffect(() => {
    const shouldFetch =
      !lastFetchTimeRef.current ||
      Date.now() - lastFetchTimeRef.current > CACHE_DURATION;

    if (shouldFetch) {
      dispatch(fetchUnreadCount());
      dispatch(fetchNotifications({ page_size: 200 }));
      lastFetchTimeRef.current = Date.now();
    }
  }, [dispatch]);

  // Poll for unread count every 30 seconds (reduced frequency for better performance)
  useEffect(() => {
    const interval = setInterval(() => {
      dispatch(fetchUnreadCount());
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [dispatch]);

  // Refresh count when window regains focus (only if data is stale)
  useEffect(() => {
    const handleFocus = () => {
      const shouldFetch =
        !lastFetchTimeRef.current ||
        Date.now() - lastFetchTimeRef.current > CACHE_DURATION;

      if (shouldFetch) {
        dispatch(fetchUnreadCount());
        dispatch(fetchNotifications({ page_size: 200 }));
        lastFetchTimeRef.current = Date.now();
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [dispatch]);

  // Listen for custom event when announcements are created
  // This allows immediate notification updates without polling
  useEffect(() => {
    const handleAnnouncementCreated = () => {
      console.log(
        "Announcement created event received, refreshing notifications instantly"
      );
      // Instant fetch with minimal delay
      dispatch(fetchUnreadCount());
      dispatch(fetchNotifications({ page_size: 200 }));
      lastFetchTimeRef.current = Date.now();
    };

    const handleBulletinCreated = () => {
      console.log(
        "Bulletin created event received, refreshing notifications instantly"
      );
      // Instant fetch with minimal delay
      dispatch(fetchUnreadCount());
      dispatch(fetchNotifications({ page_size: 200 }));
      lastFetchTimeRef.current = Date.now();
    };

    const handleNoticeCreated = () => {
      console.log(
        "[NotificationDropdown] Notice created event received, refreshing notifications instantly"
      );
      // Add a small delay to ensure backend has time to create the notification
      // This prevents race conditions where we fetch before the notification is fully committed to the database
      setTimeout(() => {
        dispatch(fetchUnreadCount());
        dispatch(fetchNotifications({ page_size: 200 }));
        lastFetchTimeRef.current = Date.now();
      }, 300); // 300ms delay to allow backend to complete notification creation and database commit
    };

    const handleRoleUpdated = () => {
      console.log(
        "[NotificationDropdown] Role updated event received, refreshing notifications instantly"
      );
      // Instant fetch with minimal delay
      dispatch(fetchUnreadCount());
      dispatch(fetchNotifications({ page_size: 200 }));
      lastFetchTimeRef.current = Date.now();
    };

    const handleMemberAdded = () => {
      console.log(
        "[NotificationDropdown] Member added event received, refreshing notifications instantly"
      );
      // Instant fetch with minimal delay
      dispatch(fetchUnreadCount());
      dispatch(fetchNotifications({ page_size: 200 }));
      lastFetchTimeRef.current = Date.now();
    };

    const handleResidentUpdated = () => {
      console.log(
        "[NotificationDropdown] Resident/Owner updated event received, refreshing notifications"
      );
      // Add a small delay to ensure backend has time to create the notification
      // This prevents race conditions where we fetch before the notification is fully committed to the database
      // The delay allows the backend transaction to complete and the notification to be available in queries
      setTimeout(() => {
        dispatch(fetchUnreadCount());
        dispatch(fetchNotifications({ page_size: 200 }));
        lastFetchTimeRef.current = Date.now();
      }, 300); // 300ms delay to allow backend to complete notification creation and database commit
    };

    const handleUnitStaffUpdated = () => {
      console.log(
        "[NotificationDropdown] Unit staff updated event received, refreshing notifications instantly"
      );
      // Small delay to ensure backend transaction is fully committed to database
      // Backend creates notification synchronously but we need to wait for DB commit
      setTimeout(() => {
        dispatch(fetchUnreadCount());
        dispatch(fetchNotifications({ page_size: 200 }));
        lastFetchTimeRef.current = Date.now();
      }, 50); // 50ms delay for database commit - faster than 300ms used for residents
    };

    const handleBulkUploadCompleted = () => {
      console.log(
        "[NotificationDropdown] Bulk upload completed event received, refreshing notifications instantly"
      );
      // Short delay to ensure backend transaction is fully committed to database
      // Backend creates notifications within the transaction, so they're committed when API responds
      setTimeout(() => {
        dispatch(fetchUnreadCount());
        dispatch(fetchNotifications({ page_size: 200 }));
        lastFetchTimeRef.current = Date.now();
      }, 100); // 100ms delay to ensure database commit completes
    };

    const handleServiceFeePaymentRecorded = () => {
      console.log(
        "[NotificationDropdown] Service fee payment recorded event received, refreshing notifications instantly"
      );
      // Short delay to ensure backend notification creation completes
      setTimeout(() => {
        dispatch(fetchUnreadCount());
        dispatch(fetchNotifications({ page_size: 200 }));
        lastFetchTimeRef.current = Date.now();
      }, 100); // 100ms delay to ensure notification is created
    };

    window.addEventListener("announcementCreated", handleAnnouncementCreated);
    window.addEventListener("bulletinCreated", handleBulletinCreated);
    window.addEventListener("noticeCreated", handleNoticeCreated);
    window.addEventListener("roleUpdated", handleRoleUpdated);
    window.addEventListener("memberAdded", handleMemberAdded);
    window.addEventListener("residentUpdated", handleResidentUpdated);
    window.addEventListener("ownerUpdated", handleResidentUpdated); // Use same handler
    window.addEventListener("unitStaffAdded", handleUnitStaffUpdated);
    window.addEventListener("unitStaffRemoved", handleUnitStaffUpdated);
    window.addEventListener("unitStaffUpdated", handleUnitStaffUpdated);
    window.addEventListener(
      "ownerBulkUploadCompleted",
      handleBulkUploadCompleted
    );
    window.addEventListener(
      "residentBulkUploadCompleted",
      handleBulkUploadCompleted
    );
    window.addEventListener(
      "unitStaffBulkUploadCompleted",
      handleBulkUploadCompleted
    );
    window.addEventListener(
      "serviceFeePaymentRecorded",
      handleServiceFeePaymentRecorded
    );

    return () => {
      window.removeEventListener(
        "announcementCreated",
        handleAnnouncementCreated
      );
      window.removeEventListener("bulletinCreated", handleBulletinCreated);
      window.removeEventListener("noticeCreated", handleNoticeCreated);
      window.removeEventListener("roleUpdated", handleRoleUpdated);
      window.removeEventListener("memberAdded", handleMemberAdded);
      window.removeEventListener("residentUpdated", handleResidentUpdated);
      window.removeEventListener("ownerUpdated", handleResidentUpdated);
      window.removeEventListener("unitStaffAdded", handleUnitStaffUpdated);
      window.removeEventListener("unitStaffRemoved", handleUnitStaffUpdated);
      window.removeEventListener("unitStaffUpdated", handleUnitStaffUpdated);
      window.removeEventListener(
        "ownerBulkUploadCompleted",
        handleBulkUploadCompleted
      );
      window.removeEventListener(
        "residentBulkUploadCompleted",
        handleBulkUploadCompleted
      );
      window.removeEventListener(
        "unitStaffBulkUploadCompleted",
        handleBulkUploadCompleted
      );
      window.removeEventListener(
        "serviceFeePaymentRecorded",
        handleServiceFeePaymentRecorded
      );
    };
  }, [dispatch]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      // Only fetch if data is stale (older than cache duration)
      const shouldFetch =
        !lastFetchTimeRef.current ||
        Date.now() - lastFetchTimeRef.current > CACHE_DURATION;

      if (shouldFetch) {
        dispatch(fetchNotifications({ page_size: 200 }));
        dispatch(fetchUnreadCount());
        lastFetchTimeRef.current = Date.now();
      }
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, dispatch]);

  const handleNotificationClick = async (notification) => {
    // Mark as read if not already read
    // Note: No need to refetch - Redux slice already updates optimistically
    if (!notification.is_read) {
      await dispatch(markNotificationAsRead(notification.id));
      // Only fetch unread count to ensure accuracy (notifications list is already updated in Redux)
      dispatch(fetchUnreadCount());
    }

    // Get notification type code
    const notificationType =
      notification.notification_type_code || notification.notification_type;

    // Navigate based on entity type (supports announcements, bulletins, notices, members, etc.)
    if (notification.entity_type === "announcement" && notification.entity_id) {
      // Check if this is an admin notification
      const isAdminNotification = notification.metadata?.is_admin_notification;

      // Determine which tab to show based on notification type
      let activeTab = 1; // Default to Ongoing (tab 1)

      // For admin notifications, use the active_tab from metadata
      if (isAdminNotification && notification.metadata?.active_tab) {
        activeTab = notification.metadata.active_tab;
      } else if (
        notificationType === "announcement_scheduled" ||
        notificationType === "admin_announcement_scheduled"
      ) {
        activeTab = 2; // Upcoming tab
      } else {
        activeTab = 1; // Ongoing tab (for both published and ongoing notifications)
      }

      // Navigate with announcement ID and active tab in state
      navigate("/announcements", {
        state: {
          announcementId: notification.entity_id,
          activeTab: activeTab
        }
      });
    } else if (
      notification.entity_type === "bulletin" &&
      notification.entity_id
    ) {
      // Determine which tab to show based on notification metadata and type
      let activeTab = 1; // Default to Current (tab 1)
      const status = notification.metadata?.status;

      console.log("[NotificationDropdown] Bulletin notification clicked:", {
        entity_id: notification.entity_id,
        metadata: notification.metadata,
        status: status,
        notification_type: notificationType
      });

      // Check notification type and status to determine correct tab
      if (
        status === "pending" ||
        notificationType === "bulletin_needs_approval" ||
        notificationType === "bulletin_updated"
      ) {
        activeTab = 2; // Pending tab
        console.log(
          "[NotificationDropdown] Status is pending or notification type indicates pending, setting activeTab to 2"
        );
      } else if (
        status === "archive" ||
        notificationType === "bulletin_rejected"
      ) {
        activeTab = 3; // Archive tab
        console.log(
          "[NotificationDropdown] Status is archive or notification type indicates rejected, setting activeTab to 3"
        );
      } else {
        activeTab = 1; // Current tab
        console.log(
          "[NotificationDropdown] Status is current or notification type indicates current, setting activeTab to 1"
        );
      }

      console.log("[NotificationDropdown] Navigating to /bulletins with:", {
        bulletinId: notification.entity_id,
        activeTab: activeTab
      });

      // Navigate to bulletins page with bulletin ID and active tab
      navigate("/bulletins", {
        state: {
          bulletinId: notification.entity_id,
          activeTab: activeTab
        }
      });
    } else if (
      notification.entity_type === "notice" &&
      notification.entity_id
    ) {
      // Navigate to notices page - notices show details in modal, so just navigate to notice board
      navigate("/notice-board", {
        state: {
          noticeId: notification.entity_id
        }
      });
    } else if (
      notification.entity_type === "member" &&
      notification.entity_id
    ) {
      // Handle member-related notifications (org_member_added)
      console.log("[NotificationDropdown] Member notification clicked:", {
        entity_id: notification.entity_id,
        notification_type: notificationType
      });

      if (notificationType === "org_member_added") {
        // Navigate to member list with the specific member ID to highlight
        navigate("/member-list", {
          state: {
            highlightMemberId: notification.entity_id,
            memberName: notification.metadata?.member_name
          }
        });
      } else {
        // Default: navigate to member list
        navigate("/member-list");
      }
    } else if (
      notification.entity_type === "resident" &&
      notification.metadata?.unit_id
    ) {
      // Handle resident-related notifications (resident_added, resident_added_self, owner_added)
      console.log(
        "[NotificationDropdown] Resident/Owner notification clicked:",
        {
          entity_id: notification.entity_id,
          unit_id: notification.metadata?.unit_id,
          notification_type: notificationType
        }
      );

      // Determine tab based on notification type
      // owner_added -> Unit Owners tab (tab=2)
      // resident_added, resident_added_self -> Residents tab (tab=3)
      const tab = notificationType === "owner_added" ? 2 : 3;
      const highlightKey =
        notificationType === "owner_added"
          ? "highlightOwnerId"
          : "highlightResidentId";
      const nameKey =
        notificationType === "owner_added"
          ? "highlightOwnerName"
          : "highlightResidentName";

      navigate(`/unit-details/${notification.metadata.unit_id}?tab=${tab}`, {
        state: {
          [highlightKey]:
            notification.metadata?.resident_id ||
            notification.metadata?.owner_id,
          [nameKey]:
            notification.metadata?.resident_name ||
            notification.metadata?.owner_name,
          notificationType: notificationType,
          fromNotification:
            notificationType === "resident_added_self" ? true : undefined,
          timestamp:
            notificationType === "resident_added_self" ? Date.now() : undefined
        }
      });
    } else if (
      notification.entity_type === "owner" &&
      notification.metadata?.unit_id
    ) {
      // Handle owner self-notifications (owner_changed_self, owner_added_self)
      // These are notifications sent to the owner themselves when their ownership changes or they're added
      console.log("[NotificationDropdown] Owner self-notification clicked:", {
        entity_id: notification.entity_id,
        unit_id: notification.metadata?.unit_id,
        owner_id: notification.metadata?.owner_id,
        notification_type: notificationType
      });

      // Both notification types should navigate to Unit Owners tab (tab=2)
      navigate(`/unit-details/${notification.metadata.unit_id}?tab=2`, {
        state: {
          highlightOwnerId:
            notification.metadata?.owner_id || notification.entity_id,
          highlightOwnerName: notification.metadata?.owner_name,
          notificationType: notificationType,
          fromNotification: true,
          timestamp: Date.now() // Force re-highlight on each click
        }
      });
    } else if (notification.entity_type === "unit" && notification.entity_id) {
      // Handle unit-related notifications (resident_removed, owner_removed, owner_updated, unit_staff_removed, bulk uploads)
      console.log("[NotificationDropdown] Unit notification clicked:", {
        entity_id: notification.entity_id,
        notification_type: notificationType,
        metadata: notification.metadata
      });

      // Handle bulk upload summary notifications first
      if (
        notificationType === "owner_bulk_upload" ||
        notificationType === "resident_bulk_upload" ||
        notificationType === "staff_bulk_upload"
      ) {
        const unitId = notification.entity_id;
        let tab = 1; // Default to first tab
        if (notificationType === "owner_bulk_upload") {
          tab = 2; // Unit Owners tab
        } else if (notificationType === "resident_bulk_upload") {
          tab = 3; // Residents tab
        } else if (notificationType === "staff_bulk_upload") {
          tab = 4; // Unit Staff tab
        }

        navigate(`/unit-details/${unitId}?tab=${tab}`, {
          state: {
            fromNotification: true,
            timestamp: Date.now()
          }
        });
        setIsOpen(false);
        return;
      }

      // Determine which tab to navigate to based on notification type
      let tab = 3; // Default to residents tab
      let stateData = {};

      if (notificationType === "unit_staff_removed") {
        tab = 4; // Unit staff tab
        stateData = {
          highlightUnitStaffId: notification.metadata?.unit_staff_id,
          highlightStaffName: notification.metadata?.staff_name,
          notificationType: notificationType,
          fromRemovalNotification: true,
          timestamp: Date.now()
        };
      } else if (notificationType === "owner_removed_self") {
        // Handle self-notification when user is removed as owner
        tab = 2; // Unit Owners tab
        stateData = {
          notificationType: notificationType,
          fromNotification: true,
          timestamp: Date.now()
        };
      } else if (notificationType === "resident_removed_self") {
        // Handle self-notification when user is removed as resident
        tab = 3; // Residents tab
        stateData = {
          notificationType: notificationType,
          fromNotification: true,
          timestamp: Date.now()
        };
      } else if (notificationType === "owner_updated") {
        tab = 2; // Owners tab
        const ownerId = notification.metadata?.owner_id;
        const ownerName = notification.metadata?.owner_name;
        console.log(
          "[NotificationDropdown] Owner updated notification clicked:",
          {
            ownerId,
            ownerName,
            metadata: notification.metadata,
            entity_id: notification.entity_id
          }
        );
        stateData = {
          highlightOwnerId: ownerId,
          highlightOwnerName: ownerName,
          notificationType: notificationType,
          fromNotification: true,
          timestamp: Date.now()
        };
      } else if (notificationType === "owner_removed") {
        // Handle owner removed notification - navigate to Unit Owners tab
        tab = 2; // Unit Owners tab
        stateData = {
          highlightOwnerId: notification.metadata?.owner_id,
          highlightOwnerName: notification.metadata?.owner_name,
          notificationType: notificationType,
          fromRemovalNotification: true,
          timestamp: Date.now()
        };
      } else {
        // For residents (removed) - default to residents tab
        tab = 3; // Residents tab
        stateData = {
          highlightResidentId: notification.metadata?.resident_id,
          highlightResidentName: notification.metadata?.resident_name,
          notificationType: notificationType,
          fromRemovalNotification: true
        };
      }

      // Navigate to unit details page with appropriate tab
      navigate(`/unit-details/${notification.entity_id}?tab=${tab}`, {
        state: stateData
      });
    } else if (
      notification.entity_type === "unit_staff" &&
      notification.metadata?.unit_id
    ) {
      // Handle unit staff added notifications
      console.log("[NotificationDropdown] Unit staff notification clicked:", {
        entity_id: notification.entity_id,
        unit_id: notification.metadata?.unit_id,
        unit_staff_id: notification.metadata?.unit_staff_id,
        notification_type: notificationType
      });

      // Navigate to unit details page, unit staff tab (tab=4)
      // Use metadata.unit_id as the unit ID for navigation
      navigate(`/unit-details/${notification.metadata.unit_id}?tab=4`, {
        state: {
          highlightUnitStaffId: notification.metadata?.unit_staff_id,
          highlightStaffName: notification.metadata?.staff_name,
          notificationType: notificationType,
          fromNotification: true,
          timestamp: Date.now() // Force re-highlight on each click
        }
      });
    } else if (notification.entity_type === "role" && notification.entity_id) {
      // Handle role-related notifications
      navigate("/role-list", {
        state: {
          highlightRoleId: notification.entity_id
        }
      });
    } else if (notification.entity_type === "group" && notification.entity_id) {
      // Handle group-related notifications - navigate to Group Profile page
      navigate(`/groupProfile/${notification.entity_id}`);
    } else if (
      (notification.entity_type === "service_fee" ||
        notification.entity_type === "bill" ||
        notification.entity_type === "payment") &&
      notification.entity_id !== undefined && 
      notification.entity_id !== null
    ) {
      // Handle service fee payment, bill issued, and payment notifications
      console.log("[NotificationDropdown] Service fee notification clicked:", {
        entity_type: notification.entity_type,
        entity_id: notification.entity_id,
        notification_type: notificationType,
        metadata: notification.metadata
      });
      
      // Determine destination based on notification type and entity type
      let destination = "/service-fee-list"; // Default to Record Payment page
      let navigationState = {};
      
      if (
        notificationType === "service_fee_bill_issued" ||
        notification.entity_type === "bill"
      ) {
        // For bill issued notifications, navigate to the actual bill detail view
        destination = "/billing-management";
        navigationState = {
          state: {
            billId: notification.entity_id,
            bill_id: notification.entity_id,
            viewMode: "detail",  // Open bill detail view directly
            selectedBill: {
              id: notification.entity_id,
              payment_id: notification.entity_id
            },
            fromNotification: true
          }
        };
      } else if (
        notificationType === "service_fee_payment_confirmed" ||
        notificationType === "service_fee_payment_received"
      ) {
        // For payment received/confirmed notifications, navigate to Record Payment page with specific payment ID
        destination = "/service-fee-list";
        navigationState = {
          state: {
            paymentId: notification.entity_id,
            payment_id: notification.entity_id,
            highlightPaymentId: notification.entity_id,
            scrollToPayment: true,
            fromNotification: true
          }
        };
      } else if (
        notificationType === "service_fee_bills_generated"
      ) {
        // For bulk bills generated, navigate to billing management
        destination = "/billing-management";
      }
      
      navigate(destination, navigationState);
    } else if (notification.entity_type === "other") {
      // Handle 'other' entity type - check notification type
      if (notificationType === "role_assigned") {
        // For role_assigned, navigate to personal profile with Organization Member tab
        console.log(
          "[NotificationDropdown] Role assigned notification clicked"
        );
        const roleId = notification.metadata?.role_id;
        const roleName = notification.metadata?.role_name;
        const memberId = notification.metadata?.member_id; // ID of person who received the role

        // Navigate to the recipient's profile page with Organization Member tab (activeTab=2)
        if (memberId) {
          navigate(`/member-profile/${memberId}`, {
            state: {
              activeTab: 2, // Organization Member tab
              roleId: roleId,
              roleName: roleName,
              highlightRole: true
            }
          });
        } else {
          // Fallback to member list if member ID not found
          navigate("/member-list");
        }
      } else if (notificationType === "group_added") {
        // For group_added, navigate to Group Profile page
        console.log("[NotificationDropdown] Group added notification clicked");
        const groupId =
          notification.metadata?.group_id || notification.entity_id;

        // Navigate to Group Profile page
        if (groupId) {
          navigate(`/groupProfile/${groupId}`);
        } else {
          // Fallback to group list if group ID not found
          navigate("/group-list");
        }
      } else {
        // Fallback for other types
        navigate("/member-list");
      }
    } else {
      // Fallback: navigate to announcements page
      navigate("/announcements");
    }

    setIsOpen(false);
  };

  const handleMarkAllRead = async () => {
    await dispatch(markAllNotificationsAsRead());
    // No need to refetch - Redux slice already updates optimistically
    // Only fetch unread count to ensure accuracy (notifications list is already updated in Redux)
    dispatch(fetchUnreadCount());
    lastFetchTimeRef.current = Date.now();
  };

  const handleLoadMore = useCallback(() => {
    if (pagination.next && !loadingMore) {
      // Calculate next page number from current page
      const nextPage = (pagination.currentPage || 1) + 1;
      console.log(
        "[NotificationDropdown] Loading more notifications, page:",
        nextPage
      );
      dispatch(loadMoreNotifications({ page: nextPage, page_size: 200 }));
    }
  }, [dispatch, pagination.next, pagination.currentPage, loadingMore]);

  const formatNotificationTime = (dateString) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch (error) {
      return "Recently";
    }
  };

  const getNotificationIcon = (notification) => {
    // Use icon from notification_type_icon if available (from new dynamic system)
    if (
      notification.notification_type_icon &&
      notification.notification_type_icon.trim()
    ) {
      return notification.notification_type_icon;
    }

    // Fallback to notification_type_code or notification_type
    const type =
      notification.notification_type_code || notification.notification_type;

    // Handle member-related notifications
    if (type === "org_member_added") {
      return "👤";
    }
    if (type === "role_assigned") {
      return "🎭";
    }
    if (type === "group_added") {
      return "👥";
    }

    // Handle resident/owner notifications
    if (
      type === "resident_added" ||
      type === "resident_removed" ||
      type === "resident_added_self" ||
      type === "resident_removed_self" ||
      type === "resident_changed_self"
    ) {
      return "🏠";
    }
    if (
      type === "owner_added" ||
      type === "owner_removed" ||
      type === "owner_updated" ||
      type === "owner_changed_self" ||
      type === "owner_added_self" ||
      type === "owner_removed_self"
    ) {
      return "🔑";
    }

    // Handle unit staff notifications
    if (type === "unit_staff_added" || type === "unit_staff_removed") {
      return "👷";
    }

    // Handle bulk upload notifications
    if (
      type === "owner_bulk_upload" ||
      type === "resident_bulk_upload" ||
      type === "staff_bulk_upload"
    ) {
      return "📊";
    }

    // Handle bulletin notifications
    if (type === "bulletin_posted" || type === "bulletin_posted") {
      return "📋";
    }
    if (type === "bulletin_needs_approval") {
      return "⏳";
    }
    if (type === "bulletin_updated") {
      return "✏️";
    }

    // Handle notice notifications
    if (type === "notice_posted") {
      return "📌";
    }

    // Handle announcement notifications
    if (type === "announcement_published" || type === "announcement_ongoing") {
      return "📢";
    }
    if (type === "announcement_scheduled") {
      return "⏰";
    }

    // Default fallback
    return "🔔";
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Notification Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex h-9 w-9 sm:h-10 sm:w-10 lg:h-11 lg:w-11 items-center justify-center rounded-full border border-[#3D9D9B]/50 bg-white/80 text-primary shadow-sm transition-colors duration-200 hover:bg-primary/10 flex-shrink-0"
        aria-label="Notifications"
      >
        <img
          src="/bell.png"
          className="w-5 h-5 sm:w-5 sm:h-5 lg:w-6 lg:h-6"
          alt="Notification Bell"
          loading="lazy"
        />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-red-500 text-[10px] sm:text-xs font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Mobile: Fixed position overlay */}
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm sm:hidden"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Container - Responsive positioning */}
          <div className="fixed sm:absolute right-2 sm:right-0 top-[72px] sm:top-full bottom-4 sm:bottom-auto z-50 mt-0 sm:mt-2 w-[calc(100vw-1rem)] sm:w-[380px] lg:w-96 max-w-[calc(100vw-1rem)] sm:max-w-[380px] lg:max-w-[384px] rounded-lg border border-gray-200 bg-white shadow-xl transform transition-all duration-200 ease-out opacity-100 scale-100 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 sm:px-4 sm:py-3 sticky top-0 bg-white z-10 rounded-t-lg">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                Notifications
              </h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-xs sm:text-sm text-primary hover:text-primaryDark font-medium px-2 py-1 rounded hover:bg-primary/10 transition-colors"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="sm:hidden p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                  aria-label="Close notifications"
                >
                  <svg
                    className="w-5 h-5 text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar sm:max-h-96">
              {(() => {
                console.log("[NotificationDropdown] RENDER DECISION:", {
                  loading,
                  "notifications.length": notifications.length,
                  "notifications === undefined": notifications === undefined,
                  "notifications === null": notifications === null,
                  "Array.isArray(notifications)": Array.isArray(notifications),
                  "first notification": notifications[0]
                    ? { id: notifications[0].id, title: notifications[0].title }
                    : "N/A",
                  "condition (loading && length===0)":
                    loading && notifications.length === 0,
                  "condition (length===0)": notifications.length === 0,
                  "will render list": notifications.length > 0
                });
                return null;
              })()}
              {loading && notifications.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  {console.log(
                    "[NotificationDropdown] Rendering: LOADING SPINNER"
                  )}
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                </div>
              ) : notifications.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  {console.log(
                    "[NotificationDropdown] Rendering: NO NOTIFICATIONS MESSAGE"
                  )}
                  <div className="flex flex-col items-center gap-2">
                    <svg
                      className="w-12 h-12 text-gray-300"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                      />
                    </svg>
                    <p className="text-sm text-gray-500 font-medium">
                      No notifications
                    </p>
                    <p className="text-xs text-gray-400">
                      You're all caught up!
                    </p>
                  </div>
                </div>
              ) : (
                (() => {
                  console.log(
                    "[NotificationDropdown] Rendering: NOTIFICATIONS LIST with",
                    notifications.length,
                    "items"
                  );
                  return notifications.map((notification, index) => {
                    // Debug logging for role_assigned notifications
                    const notificationTypeCode =
                      notification.notification_type_code ||
                      (notification.notification_type &&
                        notification.notification_type.code);
                    if (notificationTypeCode === "role_assigned") {
                      console.log(
                        "[NotificationDropdown] Rendering role_assigned notification:",
                        {
                          id: notification.id,
                          title: notification.title,
                          message: notification.message,
                          entity_type: notification.entity_type,
                          is_read: notification.is_read,
                          notification_type_code: notificationTypeCode
                        }
                      );
                    }

                    return (
                      <div
                        key={`notification-${notification.id}-${index}`}
                        onClick={() => handleNotificationClick(notification)}
                        className={`cursor-pointer border-b border-gray-100 px-4 py-3 sm:px-4 sm:py-3 transition-colors active:bg-gray-50 ${
                          !notification.is_read
                            ? "bg-blue-50/50 sm:bg-blue-100"
                            : "bg-white hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {!notification.is_read && (
                            <span className="mt-1.5 h-2 w-2 rounded-full bg-primary flex-shrink-0"></span>
                          )}
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-sm sm:text-sm font-medium break-words leading-snug ${
                                !notification.is_read
                                  ? "text-gray-900 font-semibold"
                                  : "text-gray-700"
                              }`}
                            >
                              {notification.title}
                            </p>
                            {notification.message &&
                              notification.message !== notification.title && (
                                <p className="mt-1.5 text-xs sm:text-sm text-gray-600 break-words leading-relaxed line-clamp-2">
                                  {notification.message}
                                </p>
                              )}
                            <p className="mt-2 text-[10px] sm:text-xs text-gray-400">
                              {formatNotificationTime(notification.created_at)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()
              )}

              {/* Load More Button */}
              {pagination.next && notifications.length > 0 && (
                <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="w-full px-4 py-2 text-sm font-medium text-primary bg-white border border-primary rounded-md hover:bg-primary hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loadingMore ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                        Loading...
                      </>
                    ) : (
                      <>
                        Load More
                        <span className="text-xs text-gray-500">
                          ({notifications.length} of {pagination.count})
                        </span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationDropdown;
