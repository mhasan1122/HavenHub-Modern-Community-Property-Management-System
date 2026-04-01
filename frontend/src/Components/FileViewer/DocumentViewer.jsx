import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Set the worker source - handle both old and new pdfjs-dist versions
if (pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
} else if (pdfjsLib.default && pdfjsLib.default.GlobalWorkerOptions) {
  pdfjsLib.default.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
} else {
  // Fallback for newer versions
  try {
    const pdfjs = pdfjsLib.default || pdfjsLib;
    if (pdfjs.GlobalWorkerOptions) {
      pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    }
  } catch (error) {
    console.warn('Could not set PDF.js worker source:', error);
  }
}

/**
 * DocumentViewer Component
 * Displays PDF and DOC files in a modal frame
 */
const DocumentViewer = ({ fileUrl, fileName, onClose }) => {
  const [pdfDoc, setPdfDoc] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const canvasRef = useRef(null);
  const blobUrlRef = useRef(null);

  if (!fileUrl) return null;

  // Check if it's a PDF file
  const isPDF = fileName?.toLowerCase().endsWith('.pdf') || fileUrl.includes('.pdf');
  
  // For DOC files, we'll show a message since browsers can't display them directly
  const isDoc = fileName?.toLowerCase().match(/\.(doc|docx)$/) || fileUrl.match(/\.(doc|docx)$/);

  const loadPDF = useCallback(async () => {
    if (!fileUrl) return;
    
    try {
      setLoading(true);
      setError(false);
      setPdfDoc(null); // Reset PDF document when loading new one
      setCurrentPage(1); // Reset to first page

      // Handle different import structures for pdfjs-dist
      const pdfjs = pdfjsLib.default || pdfjsLib;
      const getDocument = pdfjs.getDocument || pdfjsLib.getDocument;

      // Ensure URL is absolute
      let absoluteUrl = fileUrl;
      if (fileUrl && !fileUrl.startsWith('http://') && !fileUrl.startsWith('https://') && !fileUrl.startsWith('data:')) {
        // If relative URL, try to make it absolute
        if (fileUrl.startsWith('/')) {
          // Absolute path from root
          absoluteUrl = window.location.origin + fileUrl;
        } else {
          // Relative path
          absoluteUrl = window.location.origin + '/' + fileUrl;
        }
      }

      const accessToken = localStorage.getItem('access_token');
      
      // Try loading with authentication headers first
      let loadingOptions = {};
      
      if (accessToken) {
        loadingOptions = {
          httpHeaders: {
            'Authorization': `Bearer ${accessToken}`
          }
        };
      }

      // Try direct loading first
      try {
        const loadingTask = getDocument(absoluteUrl, loadingOptions);
        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        setCurrentPage(1);
        setLoading(false);
        return;
      } catch (directError) {
        console.warn('Direct PDF loading failed, trying blob method:', directError);
        
        // Fallback: Fetch as blob and create object URL
        if (accessToken) {
          const response = await fetch(absoluteUrl, {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          });
          
          if (!response.ok) {
            throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
          }
          
          const blob = await response.blob();
          const blobUrl = URL.createObjectURL(blob);
          
          // Clean up previous blob URL if exists
          if (blobUrlRef.current) {
            URL.revokeObjectURL(blobUrlRef.current);
          }
          blobUrlRef.current = blobUrl;
          
          const loadingTask = getDocument(blobUrl);
          const pdf = await loadingTask.promise;
          setPdfDoc(pdf);
          setNumPages(pdf.numPages);
          setCurrentPage(1);
          setLoading(false);
        } else {
          throw directError;
        }
      }
    } catch (err) {
      console.error('Error loading PDF:', err);
      setError(true);
      setLoading(false);
    }
  }, [fileUrl]);

  useEffect(() => {
    if (isPDF && fileUrl) {
      loadPDF();
    } else if (!isPDF) {
      setLoading(false);
    }
    
    // Cleanup blob URL on unmount or when fileUrl changes
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [fileUrl, isPDF, loadPDF]);

  const renderPage = useCallback(async () => {
    if (!pdfDoc) return;
    
    // Wait for canvas to be available with retry logic
    let retries = 0;
    const maxRetries = 10;
    
    while (!canvasRef.current && retries < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 50));
      retries++;
    }
    
    if (!canvasRef.current) {
      console.error('Canvas element not available after retries');
      setError(true);
      setLoading(false);
      return;
    }
    
    try {
      const page = await pdfDoc.getPage(currentPage);
      const canvas = canvasRef.current;
      
      // Double-check canvas is still available
      if (!canvas) {
        console.error('Canvas became null during rendering');
        setError(true);
        setLoading(false);
        return;
      }
      
      const context = canvas.getContext('2d');
      
      if (!context) {
        throw new Error('Failed to get canvas context');
      }

      const viewport = page.getViewport({ scale });
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      await page.render(renderContext).promise;
      setLoading(false);
    } catch (err) {
      console.error('Error rendering page:', err);
      setError(true);
      setLoading(false);
    }
  }, [pdfDoc, currentPage, scale]);

  useEffect(() => {
    if (pdfDoc && isPDF && !error) {
      // Use requestAnimationFrame to ensure canvas is rendered in DOM
      const frameId = requestAnimationFrame(() => {
        renderPage();
      });
      return () => cancelAnimationFrame(frameId);
    }
  }, [pdfDoc, currentPage, scale, isPDF, error, renderPage]);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Function to open PDF in new tab
  const openInNewTab = () => {
    window.open(fileUrl, '_blank', 'noopener,noreferrer');
  };

  // Function to handle direct download
  const handleDownload = async () => {
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName || 'document';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback to simple download
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = fileName || 'document';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const nextPage = () => {
    if (currentPage < numPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const zoomIn = () => {
    setScale(scale + 0.2);
  };

  const zoomOut = () => {
    if (scale > 0.4) {
      setScale(scale - 0.2);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10001] p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 truncate">
            {fileName || 'Document Viewer'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 bg-primary hover:bg-primary/80 rounded-full transition-colors"
            aria-label="Close document viewer"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {isPDF ? (
            <div className="w-full h-full relative">
              {loading && !pdfDoc ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="w-8 h-8 border-4 border-[#3D9D9B] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading PDF...</p>
                  </div>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                  <div className="mb-6">
                    <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                    </svg>
                    <h4 className="text-xl font-semibold text-gray-900 mb-2">PDF Preview Unavailable</h4>
                    <p className="text-gray-600 mb-6">
                      Unable to display PDF in browser. Click below to open in a new tab.
                    </p>
                  </div>
                  <button
                    onClick={openInNewTab}
                    className="inline-flex items-center px-6 py-3 bg-primary text-white rounded-lg hover:bg-primaryHover transition-colors"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Open in New Tab
                  </button>
                </div>
              ) : pdfDoc ? (
                <div className="flex flex-col items-center p-4">
                  {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10">
                      <div className="text-center">
                        <div className="w-8 h-8 border-4 border-[#3D9D9B] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-gray-600">Rendering page...</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-center space-x-4 mb-4">
                    <button
                      onClick={prevPage}
                      disabled={currentPage === 1 || loading}
                      className="px-3 py-1 bg-primary text-white rounded disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="text-gray-600">
                      Page {currentPage} of {numPages}
                    </span>
                    <button
                      onClick={nextPage}
                      disabled={currentPage === numPages || loading}
                      className="px-3 py-1 bg-primary text-white rounded disabled:opacity-50"
                    >
                      Next
                    </button>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={zoomOut}
                        disabled={loading}
                        className="px-2 py-1 bg-gray-200 text-gray-700 rounded disabled:opacity-50"
                      >
                        -
                      </button>
                      <span className="text-gray-600">{Math.round(scale * 100)}%</span>
                      <button
                        onClick={zoomIn}
                        disabled={loading}
                        className="px-2 py-1 bg-gray-200 text-gray-700 rounded disabled:opacity-50"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="overflow-auto max-h-[calc(90vh-200px)]">
                    <canvas ref={canvasRef} className="mx-auto" />
                  </div>
                </div>
              ) : null}
            </div>
          ) : isDoc ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <div className="mb-6">
                <svg className="w-16 h-16 text-blue-500 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                </svg>
                <h4 className="text-xl font-semibold text-gray-900 mb-2">Word Document</h4>
                <p className="text-gray-600 mb-6">
                  This is a Word document that cannot be previewed directly in the browser.
                </p>
              </div>
              
              <div className="space-y-4">
                <button
                  onClick={handleDownload}
                  className="inline-flex items-center px-6 py-3 bg-primary text-white rounded-lg hover:bg-primaryHover transition-colors"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download Document
                </button>
                
                <p className="text-sm text-gray-500">
                  Click the download button to save and open the document with your preferred application.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-500">Unable to preview this file type</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {fileName && (
                <span>File: {fileName}</span>
              )}
            </div>
            <div className="flex space-x-2">
              {(isPDF || isDoc) && (
                <button
                  onClick={handleDownload}
                  className="px-4 py-2 text-sm bg-primary text-white rounded hover:bg-primaryHover transition-colors"
                >
                  Download
                </button>
              )}
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentViewer;
