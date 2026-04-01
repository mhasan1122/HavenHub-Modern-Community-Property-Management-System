import React from 'react';
import { X, Download, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useEffect } from 'react';

/**
 * ImageModal Component
 * Displays images in a modal overlay with zoom and download functionality
 */
const ImageModal = ({
    isOpen,
    onClose,
    imageSrc,
    imageAlt = "Image",
    imageName = "image"
}) => {
    const [isZoomed, setIsZoomed] = useState(false);

    // Handle backdrop click to close modal
    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    // Handle download
    const handleDownload = () => {
        const link = document.createElement('a');
        link.href = imageSrc;
        link.download = imageName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Handle zoom toggle
    const toggleZoom = () => {
        setIsZoomed(!isZoomed);
    };

    // Handle escape key - Always call useEffect, but conditionally add/remove listeners
    React.useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            // Prevent body scroll when modal is open
            document.body.style.overflow = 'hidden';
        } else {
            // Clean up when modal is closed
            document.body.style.overflow = 'unset';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    // Reset zoom when modal opens/closes
    React.useEffect(() => {
        if (!isOpen) {
            setIsZoomed(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 backdrop-blur-sm"
            onClick={handleBackdropClick}
        >
            {/* Modal Container */}
            <div className="relative max-w-4xl max-h-[90vh] w-full mx-4">
                {/* Header */}
                <div className="absolute top-0 left-0 right-0 z-10 flex justify-between items-center p-4 bg-gradient-to-b from-black/50 to-transparent">
                    <div className="text-white">
                        <h3 className="text-lg font-medium truncate">{imageName}</h3>
                        <p className="text-sm text-gray-300">{imageAlt}</p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={toggleZoom}
                            className="p-2 rounded-full bg-primary text-white hover:bg-primary/80 transition-colors"
                            title={isZoomed ? "Zoom Out" : "Zoom In"}
                        >
                            {isZoomed ? (
                                <ZoomOut className="w-5 h-5" />
                            ) : (
                                <ZoomIn className="w-5 h-5" />
                            )}
                        </button>

                        <button
                            onClick={handleDownload}
                            className="p-2 rounded-full bg-primary text-white hover:bg-primary/80 transition-colors"
                            title="Download"
                        >
                            <Download className="w-5 h-5" />
                        </button>

                        <button
                            onClick={onClose}
                            className="p-2 rounded-full bg-primary text-white hover:bg-primary/80 transition-colors"
                            title="Close"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Image Container */}
                <div className="relative bg-white rounded-lg shadow-2xl overflow-hidden">
                    <div className={`transition-all duration-300 ${isZoomed ? 'overflow-auto' : 'overflow-hidden'}`}>
                        <img
                            src={imageSrc}
                            alt={imageAlt}
                            className={`w-full h-auto transition-transform duration-300 ${
                                isZoomed
                                    ? 'transform scale-150 cursor-zoom-out'
                                    : 'cursor-zoom-in max-h-[80vh] object-contain'
                            }`}
                            onClick={toggleZoom}
                            onError={(e) => {
                                e.target.src = '/placeholder-image.png'; // Fallback image
                            }}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/50 to-transparent">
                    <div className="text-center">
                        <p className="text-white text-sm">
                            Click image to zoom • Press ESC to close • Click outside to close
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ImageModal;
