import React, { useMemo } from 'react';
import {
    FaEdit,
    FaThumbtack,
    FaTrash,
    FaUndo
} from 'react-icons/fa';

/**
 * NoticeActionMenu Component
 * Displays different action menus based on notice status (matching announcement pattern)
 */
const NoticeActionMenu = ({
    notice,
    onEdit,
    onMoveToExpired,
    onPinPost,
    onDelete,
    onRestore,
    onClose,
    activeTab,
    canExpire = false
}) => {
    // Map activeTab to status for consistency
    const getStatusFromTab = () => {
        switch (activeTab) {
            case 1: return 'ongoing';
            case 2: return 'upcoming';
            case 3: return 'expired';
            default: return 'ongoing';
        }
    };

    const status = getStatusFromTab();

    // Memoize pin status check to ensure menu updates when notice changes
    const isPinned = useMemo(() => {
        return notice.pinned || notice.isPinned || notice.is_pinned;
    }, [notice.pinned, notice.isPinned, notice.is_pinned]);

    // Define actions based on status
    const getActionsForStatus = () => {
        switch (status) {
            case 'ongoing':
                return [
                    {
                        icon: FaEdit,
                        label: 'Edit',
                        action: onEdit,
                        className: 'text-black-700 hover:text-black-900'
                    },
                    ...(canExpire ? [{
                        icon: FaTrash,
                        label: 'Move Expired',
                        action: onMoveToExpired,
                        className: 'text-black-600 hover:text-black-800'
                    }] : []),
                    {
                        icon: FaThumbtack,
                        label: isPinned ? 'Unpin Post' : 'Pin Post',
                        action: onPinPost,
                        className: 'text-black-600 hover:text-black-800'
                    }
                ];

            case 'upcoming':
                return [
                    {
                        icon: FaEdit,
                        label: 'Edit',
                        action: onEdit,
                        className: 'text-black-700 hover:text-black-900'
                    },
                    {
                        icon: FaTrash,
                        label: 'Move Expired',
                        action: onMoveToExpired,
                        className: 'text-black-600 hover:text-black-800'
                    }
                ];

            case 'expired':
                const actions = [
                    {
                        icon: FaEdit,
                        label: 'Edit',
                        action: onEdit,
                        className: 'text-black-700 hover:text-black-900'
                    }
                ];

                // Add restore option if manually expired and still within valid time range
                if (notice.manuallyExpired) {
                    const now = new Date();
                    const endDateTime = new Date(`${notice.endDate} ${notice.endTime}`);
                    if (now <= endDateTime) {
                        actions.push({
                            icon: FaUndo,
                            label: 'Restore',
                            action: onRestore,
                            className: 'text-blue-600 hover:text-blue-800'
                        });
                    }
                }

                // Always add delete option for expired notices
                actions.push({
                    icon: FaTrash,
                    label: 'Delete',
                    action: onDelete,
                    className: 'text-red-600 hover:text-red-800'
                });

                return actions;

            default:
                return [];
        }
    };

    const actions = getActionsForStatus();

    return (
        <div
            className="absolute right-0 top-6 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[200px]"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            data-action-menu="true"
        >
            {actions.map((action, index) => {
                const IconComponent = action.icon;
                return (
                    <button
                        key={index}
                        className={`flex items-center w-full px-3 py-2 text-sm hover:bg-gray-100 transition-colors whitespace-nowrap ${action.className}`}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            action.action(notice.id);
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

export default NoticeActionMenu;
