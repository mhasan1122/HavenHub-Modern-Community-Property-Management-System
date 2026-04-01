import React from 'react';
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
 * BulletinActionMenu Component
 * Displays different action menus based on bulletin status
 */
const BulletinActionMenu = ({
    bulletin,
    onEdit,
    onHistory,
    onMoveToArchive,
    onReminder,
    onPinPost,
    onDirectCommunication,
    onDelete,
    onRestore,
    onClose,
    canArchive = false,
    currentUserId = null
}) => {
    const { status } = bulletin;

    // Check if current user is the creator of the bulletin
    const isCreator = currentUserId && bulletin.creator && 
                     (currentUserId.toString() === bulletin.creator.toString());

    // Define actions based on status
    const getActionsForStatus = () => {
        switch (status) {
            case 'current':
                return [
                    {
                        icon: FaBell,
                        label: 'Reminder',
                        action: onReminder,
                        className: 'text-black-600 hover:text-black-800'
                    },
                    {
                        icon: FaEdit,
                        label: 'Edit',
                        action: onEdit,
                        className: 'text-black-700 hover:text-black-900'
                    },
                    {
                        icon: FaHistory,
                        label: 'History',
                        action: onHistory,
                        className: 'text-black-700 hover:text-black-900'
                    },
                    {
                        icon: FaThumbtack,
                        label: bulletin.pinned || bulletin.isPinned || bulletin.is_pinned ? 'Unpin Post' : 'Pin Post',
                        action: onPinPost,
                        className: 'text-black-600 hover:text-black-800'
                    },
                    {
                        icon: FaComments,
                        label: 'Direct Communication',
                        action: onDirectCommunication,
                        className: 'text-black-600 hover:text-black-800'
                    },
                    ...(canArchive ? [{
                        icon: FaFlag,
                        label: 'Move to Archive',
                        action: onMoveToArchive,
                        className: 'text-black-600 hover:text-black-800'
                    }] : [])
                ];

            case 'pending':
                return [
                    // Only show Edit option if current user is the creator
                    ...(isCreator ? [{
                        icon: FaEdit,
                        label: 'Edit',
                        action: onEdit,
                        className: 'text-black-700 hover:text-black-900'
                    }] : []),
                    {
                        icon: FaHistory,
                        label: 'History',
                        action: onHistory,
                        className: 'text-black-700 hover:text-black-900'
                    },
                    ...(canArchive ? [{
                        icon: FaFlag,
                        label: 'Move to Archive',
                        action: onMoveToArchive,
                        className: 'text-black-600 hover:text-black-800'
                    }] : []),
                    {
                        icon: FaTrash,
                        label: 'Delete',
                        action: onDelete,
                        className: 'text-red-600 hover:text-red-800'
                    }
                ];

            case 'archive':
                return [
                    {
                        icon: FaHistory,
                        label: 'History',
                        action: onHistory,
                        className: 'text-black-700 hover:text-black-900'
                    },
                    {
                        icon: FaUndo,
                        label: 'Restore',
                        action: onRestore,
                        className: 'text-black-600 hover:text-black-800'
                    },
                    {
                        icon: FaTrash,
                        label: 'Delete',
                        action: onDelete,
                        className: 'text-red-600 hover:text-red-800'
                    }
                ];

            default:
                return [];
        }
    };

    const actions = getActionsForStatus();

    return (
        <div 
            className="absolute right-0 top-3 mt-2 w-52 bg-white rounded-lg shadow-lg border border-gray-200 py-4 z-50"
            onClick={(e) => e.stopPropagation()}
            data-action-menu="true"
        >
            {actions.map((action, index) => (
                <button
                    key={index}
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        action.action(bulletin.id);
                        onClose();
                    }}
                    className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors ${action.className}`}
                >
                    <action.icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{action.label}</span>
                </button>
            ))}
        </div>
    );

};

export default BulletinActionMenu;
