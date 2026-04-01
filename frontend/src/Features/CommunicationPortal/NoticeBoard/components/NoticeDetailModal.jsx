import React, { useEffect, useState, useRef } from 'react';
import { FaTimes } from 'react-icons/fa';
import { HiDotsHorizontal } from 'react-icons/hi';
import NoticePreview from './NoticePreview';
import NoticeActionMenu from './NoticeActionMenu';

/**
 * NoticeDetailModal Component
 * Displays full notice details in a modal overlay
 */
const NoticeDetailModal = ({
    isOpen,
    onClose,
    notice,
    currentUser,
    onImageClick,
    onDocumentClick,
    onEdit,
    onMoveToExpired,
    onPinPost,
    onDelete,
    onRestore,
    activeTab,
    canExpire = false
}) => {
    const [openDropdownId, setOpenDropdownId] = useState(null);
    const dropdownRef = useRef(null);

    // Handle click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setOpenDropdownId(null);
            }
        };

        if (openDropdownId) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [openDropdownId]);

    // Handle escape key
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    // Early return after all hooks
    if (!isOpen || !notice) return null;

    // Handle backdrop click
    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    // Prepare notice data for preview component
    const previewData = {
        ...notice,
        postAs: notice.postAs || (notice.post_as || 'creator'),
        authorName: notice.author || notice.authorName,
        creatorName: notice.creatorName || notice.author,
        startDate: notice.startDate || notice.start_date,
        startTime: notice.startTime || notice.start_time,
        endDate: notice.endDate || notice.end_date,
        endTime: notice.endTime || notice.end_time,
        priority: notice.priority,
        label: notice.label,
        description: notice.description || notice.content,
        attachments: notice.attachments || [],
        target_units_data: notice.target_units_data
    };

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[10000] p-4 transition-all duration-300"
            onClick={handleBackdropClick}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col relative animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-white px-6 py-4 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
                    <h2 className="text-lg font-bold text-gray-800">Notice Details</h2>
                    <div className="flex items-center gap-2">
                        {/* Three-dot menu */}
                        {notice && (onEdit || onPinPost || onMoveToExpired || onDelete) && (
                            <div
                                className="relative"
                                ref={openDropdownId === notice.id ? dropdownRef : null}
                                data-action-menu="true"
                            >
                                <HiDotsHorizontal
                                    className="w-5 h-5 text-primary cursor-pointer hover:text-primaryDark"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        setOpenDropdownId(openDropdownId === notice.id ? null : notice.id);
                                    }}
                                    data-action-menu="true"
                                />
                                {openDropdownId === notice.id && (
                                    <NoticeActionMenu
                                        notice={notice}
                                        onEdit={onEdit}
                                        onMoveToExpired={onMoveToExpired}
                                        onPinPost={onPinPost}
                                        onDelete={onDelete}
                                        onRestore={onRestore}
                                        onClose={() => setOpenDropdownId(null)}
                                        activeTab={activeTab}
                                        canExpire={canExpire}
                                    />
                                )}
                            </div>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors group"
                            aria-label="Close"
                        >
                            <FaTimes className="w-5 h-5 text-gray-400 group-hover:text-gray-600" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto custom-scrollbar">
                    <NoticePreview
                        data={previewData}
                        currentUser={currentUser}
                        isInModal={true}
                        onImageClick={onImageClick}
                        onDocumentClick={onDocumentClick}
                    />
                </div>
            </div>
        </div>
    );
};

export default NoticeDetailModal;
