// import React from "react";
// import { Download } from "lucide-react";

// const baseURL = import.meta.env.VITE_BASE_API;

// const FilePreviewWithDownload = ({ filePath }) => {
//   const isImage = (path) => {
//     const imageExtensions = [".jpg", ".jpeg", ".png", ".gif"];
//     return imageExtensions.some((ext) => path?.toLowerCase().endsWith(ext));
//   };

//   const isPDF = (path) => path?.toLowerCase().endsWith(".pdf");

//   const fullURL = `${baseURL}${filePath}`;

//   if (!filePath) return null;

//   const handleDownload = async () => {
//     try {
//       const response = await fetch(fullURL);
//       const blob = await response.blob();
//       const url = window.URL.createObjectURL(blob);
//       const link = document.createElement("a");
//       link.href = url;
//       link.download = filePath.split("/").pop();
//       document.body.appendChild(link);
//       link.click();
//       link.remove();
//       window.URL.revokeObjectURL(url);
//     } catch (error) {
//       console.error("Download failed", error);
//     }
//   };

//   return (
//     <div className="relative w-24 h-24 border p-2 rounded hover:bg-gray-100 flex flex-col items-center justify-center">
//       {/* Download icon */}
//       <div
//         onClick={handleDownload}
//         className="absolute top-0 right-0 cursor-pointer bg-white p-1 rounded-full shadow hover:bg-gray-200 transition"
//         title="Download"
//       >
//         <Download size={20} className="text-primary" />
//       </div>

//       {/* Preview */}
//       <a
//         href={fullURL}
//         target="_blank"
//         rel="noopener noreferrer"
//         className="w-full h-full flex flex-col items-center justify-center"
//       >
//         {isImage(filePath) ? (
//           <img
//             src={fullURL}
//             alt="Preview"
//             className="w-full h-full object-cover rounded"
//           />
//         ) : isPDF(filePath) ? (
//           <div className="flex flex-col items-center space-y-1">
//             <svg
//               xmlns="http://www.w3.org/2000/svg"
//               fill="none"
//               viewBox="0 0 24 24"
//               strokeWidth={1.5}
//               stroke="currentColor"
//               className="w-12 h-12 text-red-500"
//             >
//               <path
//                 strokeLinecap="round"
//                 strokeLinejoin="round"
//                 d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
//               />
//             </svg>
//             <span className="text-xs font-medium text-gray-700">PDF</span>
//           </div>
//         ) : (
//           <span className="text-sm text-center text-blue-600 font-semibold">
//             Open File
//           </span>
//         )}
//       </a>
//     </div>
//   );
// };

// export default FilePreviewWithDownload;
import React from "react";
import { Download } from "lucide-react";

// Keep base URL handling consistent with the rest of the app
// (matches FileDropzone behaviour).
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_BASE_API ||
  window.location.origin;

const normalizeUrl = (path) => {
  if (!path) return "";

  // Already an absolute URL
  if (/^(?:[a-z]+:)?\/\//i.test(path)) {
    return path;
  }

  // Treat as relative to API base
  const trimmedBase = API_BASE_URL.replace(/\/+$/, "");
  const trimmedPath = path.replace(/^\/+/, "");
  return `${trimmedBase}/${trimmedPath}`;
};

const buildApiDownloadUrl = (filePath) => {
  const fullURL = normalizeUrl(filePath);

  try {
    const url = new URL(fullURL);
    const mediaPrefix = "/media/";
    const idx = url.pathname.indexOf(mediaPrefix);
    if (idx === -1) return null;

    // Convert "/media/unit_docs/foo.png" -> "unit_docs/foo.png"
    const rel = url.pathname.slice(idx + mediaPrefix.length).replace(/^\/+/, "");
    const trimmedBase = API_BASE_URL.replace(/\/+$/, "");
    return `${trimmedBase}/api/media/download/?path=${encodeURIComponent(rel)}`;
  } catch {
    return null;
  }
};

const FilePreviewWithDownload = ({ filePath }) => {
  if (!filePath) return null;

  const isImage = (path) => {
    const imageExtensions = [".jpg", ".jpeg", ".png", ".gif"];
    return imageExtensions.some((ext) => path?.toLowerCase().endsWith(ext));
  };

  const isPDF = (path) => path?.toLowerCase().endsWith(".pdf");

  const fullURL = normalizeUrl(filePath);

  const handleDownload = () => {
    try {
      // Use a backend "download" endpoint to avoid CORS issues when /media/ is
      // served by a reverse proxy without CORS headers (common on live).
      const apiDownloadUrl = buildApiDownloadUrl(filePath);
      const targetUrl = apiDownloadUrl || fullURL;

      const link = document.createElement("a");
      link.href = targetUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Download failed", error);
    }
  };

  return (
    <div className="relative w-24 h-24 border p-2 rounded hover:bg-gray-100 flex flex-col items-center justify-center">
      {/* Download icon */}
      <div
        onClick={handleDownload}
        className="absolute top-0 right-0 cursor-pointer bg-white p-1 rounded-full shadow hover:bg-gray-200 transition"
        title="Download"
      >
        <Download size={20} className="text-primary" />
      </div>

      {/* Preview */}
      <a
        href={fullURL}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full h-full flex flex-col items-center justify-center"
      >
        {isImage(filePath) ? (
          <img
            src={fullURL}
            alt="Preview"
            className="w-full h-full object-cover rounded"
          />
        ) : isPDF(filePath) ? (
          <div className="flex flex-col items-center space-y-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-12 h-12 text-red-500"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
              />
            </svg>
            <span className="text-xs font-medium text-gray-700">PDF</span>
          </div>
        ) : (
          <span className="text-sm text-center text-blue-600 font-semibold">
            Open File
          </span>
        )}
      </a>
    </div>
  );
};

export default FilePreviewWithDownload;

