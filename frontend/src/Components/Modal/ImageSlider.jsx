import React from 'react';
import { X, Download, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useEffect } from 'react';

/**
 * ImageSlider Component
 * Displays multiple images in a modal overlay with navigation, zoom and download functionality
 */
const ImageSlider = ({
    isOpen,
    onClose,
    images = [], // Array of image objects with src, alt, name properties
    initialIndex = 0
}) => {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [isZoomed, setIsZoomed] = useState(false);

    // Reset zoom when image changes
    useEffect(() => {
        setIsZoomed(false);
    }, [currentIndex]);

    // Reset current index when modal opens
    useEffect(() => {
        if (isOpen) {
            setCurrentIndex(initialIndex);
        }
    }, [isOpen, initialIndex]);

    // Handle keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!isOpen) return;

            switch (e.key) {
                case 'Escape':
                    onClose();
                    break;
                case 'ArrowLeft':
                    goToPrevious();
                    break;
                case 'ArrowRight':
                    goToNext();
                    break;
                default:
                    break;
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    // Navigation functions
    const goToNext = (e) => {
        e?.stopPropagation();
        setCurrentIndex((prev) => (prev + 1) % images.length);
    };

    const goToPrevious = (e) => {
        e?.stopPropagation();
        setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    };

    // Handle backdrop click to close modal
    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    // Handle download
    const handleDownload = async () => {
        if (images[currentIndex]) {
            const currentImage = images[currentIndex];
            const imageUrl = currentImage.src || currentImage.url || currentImage.file_url || currentImage;
            const imageName = currentImage.name || currentImage.file_name || `image-${currentIndex + 1}`;

            try {
                const response = await fetch(imageUrl);
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = imageName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
            } catch (error) {
                console.error('Download failed:', error);
                // Fallback to simple download
                const link = document.createElement('a');
                link.href = imageUrl;
                link.download = imageName;
                link.target = '_blank';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        }
    };

    // Handle zoom toggle
    const toggleZoom = (e) => {
        e?.stopPropagation();
        setIsZoomed(!isZoomed);
    };

    // Don't render if modal is not open or no images
    if (!isOpen || !images || images.length === 0) {
        return null;
    }

    const currentImage = images[currentIndex];
    const imageSrc = currentImage?.src || currentImage?.url || currentImage;
    const imageAlt = currentImage?.alt || currentImage?.name || `Image ${currentIndex + 1}`;
    const imageName = currentImage?.name || `image-${currentIndex + 1}`;

    return (
        <div
            className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/90 backdrop-blur-md transition-all duration-300"
            onClick={handleBackdropClick}
        >
            {/* Modal Container */}
            <div className="relative w-full h-full flex flex-col justify-center items-center">
                {/* Header */}
                <div className="absolute top-0 left-0 right-0 z-20 flex justify-between items-start p-6 bg-gradient-to-b from-black/70 to-transparent">
                    <div className="text-white max-w-[70%]">
                        <h3 className="text-lg font-medium truncate drop-shadow-md">{imageName}</h3>
                        <p className="text-sm text-gray-300 drop-shadow-md">
                            {currentIndex + 1} of {images.length}
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-3">
                        <button
                            onClick={toggleZoom}
                            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-all duration-200"
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
                            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-all duration-200"
                            title="Download"
                        >
                            <Download className="w-5 h-5" />
                        </button>

                        <button
                            onClick={onClose}
                            className="p-2.5 rounded-full bg-white/10 hover:bg-red-500/80 text-white backdrop-blur-sm transition-all duration-200 group"
                            title="Close"
                        >
                            <X className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        </button>
                    </div>
                </div>

                {/* Navigation Arrows */}
                {images.length > 1 && (
                    <>
                        <button
                            onClick={goToPrevious}
                            className="absolute left-6 top-1/2 transform -translate-y-1/2 z-20 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-all duration-200"
                            title="Previous"
                        >
                            <ChevronLeft className="w-8 h-8" />
                        </button>

                        <button
                            onClick={goToNext}
                            className="absolute right-6 top-1/2 transform -translate-y-1/2 z-20 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-all duration-200"
                            title="Next"
                        >
                            <ChevronRight className="w-8 h-8" />
                        </button>
                    </>
                )}

                {/* Image Container */}
                <div
                    className={`relative w-full h-full flex items-center justify-center p-4 transition-all duration-300 ${isZoomed ? 'overflow-auto' : 'overflow-hidden'}`}
                    onClick={handleBackdropClick}
                >
                    <img
                        src={imageSrc}
                        alt={imageAlt}
                        className={`transition-all duration-300 ease-out select-none shadow-2xl ${isZoomed
                            ? 'transform scale-150 cursor-zoom-out'
                            : 'cursor-zoom-in max-h-[85vh] max-w-[90vw] object-contain rounded-lg'
                            }`}
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleZoom(e);
                        }}
                        onError={(e) => {
                            e.target.style.display = 'none';
                        }}
                    />
                </div>

                {/* Footer with Indicators */}
                {images.length > 1 && (
                    <div className="absolute bottom-8 left-0 right-0 z-20 flex justify-center space-x-2">
                        {images.map((_, index) => (
                            <button
                                key={index}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setCurrentIndex(index);
                                }}
                                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${index === currentIndex
                                    ? 'bg-white scale-125'
                                    : 'bg-white/40 hover:bg-white/60'
                                    }`}
                                aria-label={`Go to image ${index + 1}`}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ImageSlider;
