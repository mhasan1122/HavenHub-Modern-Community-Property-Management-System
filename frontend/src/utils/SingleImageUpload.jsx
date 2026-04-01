import React, { useState, useEffect, useRef } from "react";

const BASE_URL = import.meta.env.VITE_BASE_API || "http://127.0.0.1:8000";

const SingleImageUpload = ({ file, altImg, customClass, wrapperClassName }) => {
  const [previewMedia, setPreviewMedia] = useState(null);
  const objectUrlRef = useRef(null);

  useEffect(() => {
    // Cleanup previous object URL
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    if (file) {
      if (typeof file === "string") {
        // If file is a URL, ensure it's a complete path
        const imageUrl = file.startsWith("http") ? file : `${BASE_URL}${file}`;
        setPreviewMedia({ src: imageUrl, id: file });
      } else if (file instanceof File) {
        // If file is a File object, use object URL for better performance
        try {
          const objectUrl = URL.createObjectURL(file);
          objectUrlRef.current = objectUrl;
          setPreviewMedia({ src: objectUrl, id: file.name + file.lastModified });
        } catch (error) {
          console.error("Error creating object URL:", error);
          // Fallback to FileReader if object URL fails
          const reader = new FileReader();
          reader.onloadend = () => {
            if (reader.result) {
              setPreviewMedia({ src: reader.result, id: file.name + file.lastModified });
            }
          };
          reader.onerror = () => {
            console.error("Error reading file:", error);
            setPreviewMedia({ src: altImg, id: "default" });
          };
          reader.readAsDataURL(file);
        }
      } else {
        // Show the default image for invalid file types
        setPreviewMedia({ src: altImg, id: "default" });
      }
    } else {
      // Show the default image
      setPreviewMedia({ src: altImg, id: "default" });
    }

    // Cleanup function
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [file, altImg]);

  return (
    <div className={wrapperClassName || ""}>
      {previewMedia && (
        <img
          src={previewMedia.src}
          alt="Uploaded Image Preview"
          className={`rounded-lg shadow-lg w-full h-full object-contain ${customClass || ""}`}
          onError={(e) => {
            // Fallback to default image on error
            if (e.target.src !== altImg) {
              e.target.src = altImg;
            }
          }}
        />
      )}
    </div>
  );
};

export default SingleImageUpload;