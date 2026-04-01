import React, { useEffect, useRef } from 'react';
import {
  FaEdit,
  FaHistory,
  FaFlag,
  FaBell,
  FaThumbtack,
  FaComments,
  FaTrash,
  FaUndo
} from 'react-icons/fa';

/**
 * AnnouncementActionMenu Component
 * Displays different action menus based on announcement status
 */
const AnnouncementActionMenu = ({
  announcement,
  onEdit,
  onHistory,
  onMoveToExpired,
  onReminder,
  onPinPost,
  onDirectCommunication,
  onDelete,
  onRestore,
  onClose,
  canEdit = false,
  canExpire = false,
  canPin = false
}) => {
  const menuRef = useRef(null);
  const { status } = announcement;

  // Define actions based on status
  const getActionsForStatus = () => {
    switch (status) {
      case "ongoing":
        return [
          {
            icon: FaBell,
            label: "Reminder",
            action: onReminder,
            className: "text-black-600 hover:text-black-800",
            requiresEdit: true
          },
          {
            icon: FaEdit,
            label: "Edit",
            action: onEdit,
            className: "text-black-700 hover:text-black-900",
            requiresEdit: true
          },
          {
            icon: FaHistory,
            label: "History",
            action: onHistory,
            className: "text-black-700 hover:text-black-900",
            requiresEdit: false
          },
          {
            icon: FaTrash,
            label: "Move Expired",
            action: onMoveToExpired,
            className: "text-black-600 hover:text-black-800",
            requiresPermission: canExpire
          },
          {
            icon: FaThumbtack,
            label: announcement.pinned ? "Unpin Post" : "Pin Post",
            action: onPinPost,
            className: announcement.pinned
              ? "text-black-600 hover:text-black-800"
              : "text-black-600 hover:text-black-800",
            requiresPermission: canPin
          },
          {
            icon: FaComments,
            label: "Direct Communication",
            action: onDirectCommunication,
            className: "text-black-600 hover:text-black-800  ",
            requiresEdit: true
          }
        ];

      case "upcoming":
        return [
          {
            icon: FaEdit,
            label: "Edit",
            action: onEdit,
            className: "text-black-700 hover:text-black-900",
            requiresEdit: true
          },
          {
            icon: FaHistory,
            label: "History",
            action: onHistory,
            className: "text-black-700 hover:text-black-900",
            requiresEdit: false
          },
          {
            icon: FaTrash,
            label: "Move Expired",
            action: onMoveToExpired,
            className: "text-black-600 hover:text-black-800",
            requiresPermission: canExpire
          }
        ];

      case "expired":
        const actions = [
          {
            icon: FaEdit,
            label: "Edit",
            action: onEdit,
            className: "text-black-700 hover:text-black-900",
            requiresEdit: true
          },
          {
            icon: FaHistory,
            label: "History",
            action: onHistory,
            className: "text-black-700 hover:text-black-900",
            requiresEdit: false
          }
        ];

        // Add restore option if manually expired and still within valid time range
        if (announcement.manuallyExpired) {
          const now = new Date();
          const endDateTime = new Date(
            `${announcement.endDate} ${announcement.endTime}`
          );
          if (now <= endDateTime) {
            actions.push({
              icon: FaUndo,
              label: "Restore",
              action: onRestore,
              className: "text-blue-600 hover:text-blue-800",
              requiresEdit: true
            });
          }
        }

        // Always add delete option for expired announcements
        actions.push({
          icon: FaTrash,
          label: "Delete",
          action: onDelete,
          className: "text-red-600 hover:text-red-800",
          requiresEdit: true
        });

        return actions;

      default:
        return [];
    }
  };

  const actions = getActionsForStatus();
  const filteredActions = actions.filter((action) => {
    // If action requires a specific permission, check that permission
    if (action.requiresPermission !== undefined) {
      return action.requiresPermission;
    }
    // Otherwise, use canEdit for backward compatibility
    return canEdit || !action.requiresEdit;
  });

  // Adjust menu position to prevent overflow and overlap with card content
  useEffect(() => {
    if (menuRef.current) {
      const menu = menuRef.current;
      // Use requestAnimationFrame to ensure DOM is fully rendered
      requestAnimationFrame(() => {
        const rect = menu.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Reset positioning
        menu.style.right = "";
        menu.style.left = "";
        menu.style.top = "";
        menu.style.bottom = "";
        menu.style.marginBottom = "";

        // Check if menu overflows right edge - position to left of button
        if (rect.right > viewportWidth - 10) {
          menu.style.right = "auto";
          menu.style.left = "0";
        } else {
          menu.style.right = "0";
          menu.style.left = "auto";
        }

        // Check if menu overflows bottom edge - position above button
        if (rect.bottom > viewportHeight - 10) {
          menu.style.top = "auto";
          menu.style.bottom = "100%";
          menu.style.marginBottom = "4px";
        } else {
          menu.style.top = "24px";
          menu.style.bottom = "auto";
        }
      });
    }
  }, [filteredActions.length]);

  return (
    <div
      ref={menuRef}
      className="absolute right-0 top-6 bg-white border border-gray-200 rounded-lg shadow-xl py-1 min-w-[200px]"
      onClick={(e) => e.stopPropagation()}
      data-action-menu="true"
      style={{
        position: "absolute",
        isolation: 'isolate'
      }}
    >
      {filteredActions.map((action, index) => {
        const IconComponent = action.icon;
        return (
          <button
            key={index}
            type="button"
            className={`flex items-center w-full px-3 py-2 text-sm hover:bg-gray-100 transition-colors whitespace-nowrap ${action.className}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (action.action) {
                action.action(announcement.id);
              }
              onClose();
            }}
          >
            <IconComponent className="w-3 h-3 mr-2 flex-shrink-0" />
            <span className="truncate">{action.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default AnnouncementActionMenu;
