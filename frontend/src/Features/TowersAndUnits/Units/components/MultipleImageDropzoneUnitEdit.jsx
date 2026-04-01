import React, { useEffect, useState, useCallback } from "react"; 
import { useDropzone } from "react-dropzone";
import { X } from "lucide-react";

const acceptedFileTypes = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif", // Added gif in accepted types
  "application/pdf"
];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes
const MAX_FILES = 5; // Maximum number of files allowed

const MultipleImageDropzoneUnitEdit = ({ onUpload, initialFiles = [] }) => {
  const [files, setFiles] = useState([]);
  const [error, setError] = useState("");

  // Map backend files so they can be displayed with a preview
  useEffect(() => {
    const mapped = initialFiles.map((file) => ({
      ...file,
      id: file.id,
      isFromBackend: true,
      preview: file.unit_docs,
      name: file.unit_docs.split("/").pop(),
      type:
        file.unit_docs.match(/\.(\w+)$/)?.[1] === "pdf"
          ? "application/pdf"
          : `image/${file.unit_docs.match(/\.(\w+)$/)?.[1] || "jpeg"}`
    }));
    setFiles(mapped);
  
    // ✅ Let parent know about existing backend files
    onUpload([], [], []); // ← you should add mapped here
    onUpload(mapped, [], []);
  }, [initialFiles]);

  const onDrop = useCallback(
    (acceptedFiles) => {
      setError("");

      // Validate file type and size
      const validFiles = acceptedFiles.filter((file) => {
        const isValidType = acceptedFileTypes.includes(file.type);
        const isValidSize = file.size <= MAX_FILE_SIZE;
        if (!isValidType) {
          setError("Only PDF, PNG, JPG, GIF files are allowed.");
          return false;
        }
        if (!isValidSize) {
          setError("File size cannot exceed 5MB.");
          return false;
        }
        return true;
      });
      
      if (validFiles.length === 0) return;

      // Prepare new file objects with a preview URL (except for PDFs)
      const newFiles = validFiles.map((file) =>
        Object.assign(file, {
          preview:
            file.type === "application/pdf" ? null : URL.createObjectURL(file),
          isFromBackend: false
        })
      );

      // Filter out duplicates by checking name and size against existing files
      const uniqueNewFiles = newFiles.filter(
        (newFile) =>
          !files.some(
            (existingFile) =>
              existingFile.name === newFile.name &&
              existingFile.size === newFile.size
          )
      );

      if (uniqueNewFiles.length === 0) {
        setError("All dropped files were duplicates and not added.");
        return;
      }
      
      // Check to ensure the total files won't exceed the limit
      const updatedFiles = [...files, ...uniqueNewFiles];
      if (updatedFiles.length > MAX_FILES) {
        setError(`You can only upload up to ${MAX_FILES} files.`);
        return;
      }
      
      setFiles(updatedFiles);
      // Pass only the new unique files to the parent handler (no removals here)
      onUpload(uniqueNewFiles, [], []);
    },
    [files, onUpload]
  );

  const removeFile = useCallback((index) => {
    const fileToRemove = files[index];
    const updatedFiles = files.filter((_, i) => i !== index);
    setFiles(updatedFiles);
  
    if (fileToRemove.isFromBackend) {
      onUpload([], [], [fileToRemove.id]);
    } else {
      onUpload([], [fileToRemove], []);
    }
  }, [files, onUpload]);

  const { getRootProps, getInputProps } = useDropzone({
    accept: acceptedFileTypes.join(","),
    onDrop,
    multiple: true
  });

  // Cleanup previews to prevent memory leaks
  useEffect(() => {
    return () => {
      files.forEach((file) => {
        if (
          file.preview &&
          !file.isFromBackend &&
          file.type !== "application/pdf"
        ) {
          URL.revokeObjectURL(file.preview);
        }
      });
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
          Drag &amp; drop files here, or click to select
        </p>
      </div>
      {error && <p className="text-red-500 mt-2">{error}</p>}
      <div className="mt-4 grid grid-cols-3 gap-4">
        {files.map((file, index) => (
          <div
            key={
              file.isFromBackend
                ? `backend-${file.id}`
                : `new-${file.name}-${file.size}`
            }
            className="relative group"
          >
            {file.type === "application/pdf" ? (
              <div className="w-full h-32 flex flex-col items-center justify-center bg-gray-200 rounded-md p-2">
                <p className="text-sm text-gray-600 truncate w-full text-center">
                  {file.name || "PDF File"}
                </p>
                <span className="text-xs text-gray-500">PDF Document</span>
              </div>
            ) : (
              <div className="relative">
                <img
                  src={file.preview}
                  alt="Preview"
                  className="w-full h-32 object-cover rounded-md"
                  onLoad={() => {
                    if (!file.isFromBackend) {
                      URL.revokeObjectURL(file.preview);
                    }
                  }}
                />
              </div>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeFile(index);
              }}
              className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MultipleImageDropzoneUnitEdit;



// import React, { useEffect, useState, useCallback } from "react";
// import { useDropzone } from "react-dropzone";
// import { X } from "lucide-react";

// const acceptedFileTypes = [
//   "image/png",
//   "image/jpeg",
//   "image/jpg",
//   "application/pdf"
// ];
// const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes

// const MultipleImageDropzoneUnitEdit = ({ onUpload, initialFiles = [] }) => {
//   const [files, setFiles] = useState([]);
//   const [error, setError] = useState("");

//   // Map backend files so they can be displayed with a preview
//   useEffect(() => {
//     // console.log("Initial files received:", initialFiles);
//     const mapped = initialFiles.map((file) => ({
//       ...file,
//       id: file.id,
//       isFromBackend: true,
//       preview: file.unit_docs,
//       name: file.unit_docs.split("/").pop(),
//       type:
//         file.unit_docs.match(/\.(\w+)$/)?.[1] === "pdf"
//           ? "application/pdf"
//           : `image/${file.unit_docs.match(/\.(\w+)$/)?.[1] || "jpeg"}`
//     }));
//     // console.log("Mapped initial files:", mapped);
//     setFiles(mapped);
  
//     // ✅ Let parent know about existing backend files
//     onUpload([], [], []); // ← you should add mapped here
//     onUpload(mapped, [], []);
//   }, [initialFiles]);
  

//   const onDrop = useCallback(
//     (acceptedFiles) => {
//       // console.log("Files dropped:", acceptedFiles);
//       setError("");

//       // Validate file type and size
//       const validFiles = acceptedFiles.filter((file) => {
//         const isValidType = acceptedFileTypes.includes(file.type);
//         const isValidSize = file.size <= MAX_FILE_SIZE;
//         if (!isValidType) {
//           // setError("Only PDF, PNG, JPG, and JPEG files are allowed.");
//           return false;
//         }
//         if (!isValidSize) {
//           // setError("File size cannot exceed 5MB.");
//           return false;
//         }
//         return true;
//       });
//       // console.log("Valid files after filtering:", validFiles);
//       if (validFiles.length === 0) return;

//       // Prepare new file objects with a preview URL (except for PDFs)
//       const newFiles = validFiles.map((file) =>
//         Object.assign(file, {
//           preview:
//             file.type === "application/pdf" ? null : URL.createObjectURL(file),
//           isFromBackend: false
//         })
//       );
//       // console.log("New files prepared:", newFiles);
//       // console.log("Current files state:", files);

//       // Filter out duplicates by checking name and size against existing files
//       const uniqueNewFiles = newFiles.filter(
//         (newFile) =>
//           !files.some(
//             (existingFile) =>
//               existingFile.name === newFile.name &&
//               existingFile.size === newFile.size
//           )
//       );

//       // console.log("Unique new files after duplicate check:", uniqueNewFiles);
//       if (uniqueNewFiles.length === 0) {
//         setError("All dropped files were duplicates and not added.");
//         return;
//       }

//       const updatedFiles = [...files, ...uniqueNewFiles];
//       // console.log("Updated files before state set:", updatedFiles);
//       setFiles(updatedFiles);
//       // Pass only the new unique files to the parent handler (no removals here)
//       onUpload(uniqueNewFiles, [], []);
//     },
//     [files, onUpload]
//   );
// const removeFile = useCallback((index) => {
//   // console.log("Removing file at index:", index);
//   const fileToRemove = files[index];
//   // console.log("File to remo/ve:", fileToRemove);
  
//   const updatedFiles = files.filter((_, i) => i !== index);
//   setFiles(updatedFiles);
  

//   if (fileToRemove.isFromBackend) {
//     onUpload([], [], [fileToRemove.id]);
//   } else {
//     onUpload([], [fileToRemove], []);
//   }
// }, [files, onUpload]);


//   const { getRootProps, getInputProps } = useDropzone({
//     accept: acceptedFileTypes.join(","),
//     onDrop,
//     multiple: true
//   });

//   // Cleanup previews to prevent memory leaks
//   useEffect(() => {
//     return () => {
//       files.forEach((file) => {
//         if (
//           file.preview &&
//           !file.isFromBackend &&
//           file.type !== "application/pdf"
//         ) {
//           URL.revokeObjectURL(file.preview);
//         }
//       });
//     };
//   }, [files]);

//   return (
//     <div className="p-4 border border-dashed rounded-lg">
//       <div
//         {...getRootProps()}
//         className="border border-dashed border-gray-400 p-6 text-center cursor-pointer"
//       >
//         <input {...getInputProps()} />
//         <p className="text-gray-600">
//           Drag & drop files here, or click to select
//         </p>
//       </div>
//       {error && <p className="text-red-500 mt-2">{error}</p>}
//       <div className="mt-4 grid grid-cols-3 gap-4">
//         {files.map((file, index) => (
//           <div
//             key={
//               file.isFromBackend
//                 ? `backend-${file.id}`
//                 : `new-${file.name}-${file.size}`
//             }
//             className="relative group"
//           >
//             {file.type === "application/pdf" ? (
//               <div className="w-full h-32 flex flex-col items-center justify-center bg-gray-200 rounded-md p-2">
//                 <p className="text-sm text-gray-600 truncate w-full text-center">
//                   {file.name || "PDF File"}
//                 </p>
//                 <span className="text-xs text-gray-500">PDF Document</span>
//               </div>
//             ) : (
//               <div className="relative">
//                 <img
//                   src={file.preview}
//                   alt="Preview"
//                   className="w-full h-32 object-cover rounded-md"
//                   onLoad={() => {
//                     if (!file.isFromBackend) {
//                       URL.revokeObjectURL(file.preview);
//                     }
//                   }}
//                 />
//               </div>
//             )}
//             <button
//               onClick={(e) => {
//                 e.stopPropagation();
//                 removeFile(index);
//               }}
//               className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
//             >
//               <X size={16} />
//             </button>
//           </div>
//         ))}
//       </div>
//     </div>
//   );
// };

// export default MultipleImageDropzoneUnitEdit;
