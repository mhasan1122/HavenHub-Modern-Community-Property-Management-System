import React, { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { X } from "lucide-react";

const acceptedFileTypes = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "application/pdf"
];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const MultipleImageDropzone = ({ onUpload }) => {
  const [files, setFiles] = useState([]);
  const [error, setError] = useState("");

  const handleDrop = useCallback((acceptedFiles) => {
    setError("");
    // Filter by file type
    const typeValidFiles = acceptedFiles.filter(file =>
      acceptedFileTypes.includes(file.type)
    );
    if (typeValidFiles.length !== acceptedFiles.length) {
      setError("Only PDF, PNG, JPG, and JPEG files are allowed.");
      return;
    }

    // Filter by size
    const sizeValidFiles = typeValidFiles.filter(file => file.size <= MAX_FILE_SIZE);
    if (sizeValidFiles.length !== typeValidFiles.length) {
      setError("File size must be less than 5MB.");
      return;
    }

    // Create preview for images (placeholder for PDFs)
    const newFiles = sizeValidFiles.map(file =>
      Object.assign(file, {
        preview: file.type === "application/pdf" ? null : URL.createObjectURL(file)
      })
    );

    setFiles(prev => [...prev, ...newFiles]);
    onUpload(newFiles);
  }, [onUpload]);

  const handleDropRejected = useCallback((fileRejections) => {
    fileRejections.forEach(({ file, errors }) => {
      errors.forEach(err => {
        if (err.code === "file-too-large") {
          setError("File size must be less than 5MB.");
        }
        if (err.code === "file-invalid-type") {
          setError("Only PDF, PNG, JPG, and JPEG files are allowed.");
        }
      });
    });
  }, []);

  const { getRootProps, getInputProps } = useDropzone({
    accept: acceptedFileTypes.reduce((acc, cur) => {
      acc[cur] = [];
      return acc;
    }, {}),
    onDrop: handleDrop,
    onDropRejected: handleDropRejected,
    multiple: true,
    maxSize: MAX_FILE_SIZE
  });

  const removeFile = index => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Cleanup previews on unmount
  useEffect(() => {
    return () => {
      files.forEach(file => URL.revokeObjectURL(file.preview));
    };
  }, [files]);

  return (
    <div className="p-4 border border-dashed rounded-lg">
      <div
        {...getRootProps()}
        className="border border-dashed border-gray-400 p-6 text-center cursor-pointer"
      >
        <input {...getInputProps()} />
        <p className="text-gray-600">
          Drag & drop files here, or click to select
        </p>
      </div>

      {error && <p className="text-red-500 mt-2">{error}</p>}

      <div className="mt-4 grid grid-cols-3 gap-4">
        {files.map((file, index) => (
          <div key={index} className="relative">
            {file.type.startsWith("image/") ? (
              <img
                src={file.preview}
                alt="Preview"
                className="w-full h-32 object-cover rounded-md"
              />
            ) : (
              <div className="w-full h-32 flex items-center justify-center bg-gray-200 rounded-md">
                <p className="text-sm text-gray-600">PDF File</p>
              </div>
            )}
            <button
              onClick={() => removeFile(index)}
              className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MultipleImageDropzone;
