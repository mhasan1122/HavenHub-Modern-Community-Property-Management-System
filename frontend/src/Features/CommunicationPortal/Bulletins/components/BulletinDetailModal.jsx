import React, { useEffect, useState, useRef } from 'react';
import { FaTimes } from 'react-icons/fa';
import { HiDotsHorizontal } from 'react-icons/hi';
import BulletinPreview from './BulletinPreview';
import BulletinActionMenu from './BulletinActionMenu';

/**
 * BulletinDetailModal Component
 * Displays full bulletin details in a modal overlay
 */
const BulletinDetailModal = ({
    isOpen,
    onClose,
    bulletin,
    currentUser,
    onImageClick,
    onDocumentClick,
    onEdit,
    onHistory,
    onMoveToArchive,
    onReminder,
    onPinPost,
    onDirectCommunication,
    onDelete,
    onRestore,
    canArchive = false
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
    if (!isOpen || !bulletin) return null;

    // Handle backdrop click
    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    // Prepare bulletin data for preview component
    const previewData = {
        ...bulletin,
        postAs: bulletin.postAs || (bulletin.post_as || 'creator'),
        authorName: bulletin.author || bulletin.authorName,
        creatorName: bulletin.creatorName || bulletin.author,
        startDate: bulletin.startDate || bulletin.start_date,
        startTime: bulletin.startTime || bulletin.start_time,
        endDate: bulletin.endDate || bulletin.end_date,
        endTime: bulletin.endTime || bulletin.end_time,
        priority: bulletin.priority,
        label: bulletin.label,
        description: bulletin.description || bulletin.content,
        attachments: bulletin.attachments || [],
        target_units_data: bulletin.target_units_data
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
                    <h2 className="text-lg font-bold text-gray-800">Bulletin Details</h2>
                    <div className="flex items-center gap-2">
                        {/* Three-dot menu */}
                        {bulletin && (onEdit || onHistory || onPinPost || onMoveToArchive || onDelete) && (
                            <div
                                className="relative"
                                ref={openDropdownId === bulletin.id ? dropdownRef : null}
                                data-action-menu="true"
                            >
                                <HiDotsHorizontal
                                    className="w-5 h-5 text-primary cursor-pointer hover:text-primaryDark"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        setOpenDropdownId(openDropdownId === bulletin.id ? null : bulletin.id);
                                    }}
                                    data-action-menu="true"
                                />
                                {openDropdownId === bulletin.id && (
                                    <BulletinActionMenu
                                        bulletin={bulletin}
                                        onEdit={onEdit}
                                        onHistory={onHistory}
                                        onMoveToArchive={onMoveToArchive}
                                        onReminder={onReminder}
                                        onPinPost={onPinPost}
                                        onDirectCommunication={onDirectCommunication}
                                        onDelete={onDelete}
                                        onRestore={onRestore}
                                        onClose={() => setOpenDropdownId(null)}
                                        canArchive={canArchive}
                                        currentUserId={currentUser?.id}
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
                    <BulletinPreview
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

export default BulletinDetailModal;
