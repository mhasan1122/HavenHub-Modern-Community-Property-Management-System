import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useSnackbar } from "notistack";
import {
  FiInfo,
  FiUpload,
  FiDownload,
  FiFile,
  FiX,
  FiCheckCircle,
  FiAlertCircle
} from "react-icons/fi";
import axiosInstance from "utils/axiosInstance";
import * as XLSX from "xlsx";

const OwnerExcelUploader = ({ onUploadSuccess }) => {
  const { enqueueSnackbar } = useSnackbar();
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState(null);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setShowResults(false);
    setResults(null);
  };

  const downloadTemplate = () => {
    const templateData = [
      {
        unit_name: "1D",
        tower_name: "mm",
        tower_number: 1,
        ownership_percentage: 50,
        date_of_ownership: "28-Feb-1990",

        full_name: "Owner Name",
        general_contact: "01980004321",
        delivery_method: "", // e.g., "Courier", "Email"
        general_email: "owner1@example.com",
        nid_number: "",
        permanent_address: "Example Permanent Address",
        present_address: "Example Present Address",
        date_of_birth: "28-Feb-1990",
        occupation: "Engineer",
        marital_status: "Married",
        religion: "Islam",
        gender: "Male"
      },
      {
        unit_name: "1D",
        tower_name: "mm",
        tower_number: 1,
        ownership_percentage: 50,
        date_of_ownership: "01-Jan-1995",

        full_name: "Another Owner",
        general_contact: "01799990007",
        delivery_method: "",
        general_email: "owner2@example.com",
        nid_number: "",
        permanent_address: "",
        present_address: "",
        date_of_birth: "01-Jan-1995",
        occupation: "",
        marital_status: "",
        religion: "Islam",
        gender: ""
      }
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateData, {
      header: [
        "unit_name",
        "tower_name",
        "tower_number",
        "ownership_percentage",
        "date_of_ownership",
        "full_name",
        "general_contact",
        "delivery_method",
        "general_email",
        "nid_number",
        "permanent_address",
        "present_address",
        "date_of_birth",
        "occupation",
        "marital_status",
        "religion",
        "gender"
      ]
    });

    XLSX.utils.book_append_sheet(wb, ws, "Owners Template");
    XLSX.writeFile(wb, "owner_upload_template.xlsx", { compression: true });
  };

  const handleUpload = async () => {
    if (!file) {
      enqueueSnackbar("Please select a file to upload", { variant: "error" });
      return;
    }
    setUploading(true);
    setShowResults(false);
    try {
      const { data } = await axiosInstance.post(
        "/towers/owners/bulk-upload/",
        (() => {
          const fd = new FormData();
          fd.append("file", file);
          return fd;
        })(),
        {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${localStorage.getItem("access_token")}`
          }
        }
      );
      setResults(data);
      
      console.log("✅ Owner upload success response:", data);
      
      enqueueSnackbar(data.message, {
        variant: data.status === "success" ? "success" : "error"
      });
      
      // Dispatch event to instantly refresh notifications
      if (data.status === "success") {
        window.dispatchEvent(new Event('ownerBulkUploadCompleted'));
      }
      
      // Note: onUploadSuccess callback should be called after user closes the results modal
      // to avoid closing the parent modal before results are shown
    } catch (err) {
      const respData = err.response?.data || {};
      const isValidationError =
        Array.isArray(respData.failed_rows) && respData.failed_rows.length > 0;
      const newResults = isValidationError
        ? respData
        : {
            status: "error",
            message: respData.message || err.message,
            failed_rows: respData.failed_rows || [
              {
                row: "All",
                errors: {
                  generic: respData.details || "Server or network error"
                }
              }
            ],
            total_rows: respData.total_rows || 0,
            created_owners: respData.created_owners || [],
            success_count: respData.created_owners?.length || 0,
            error_count: (respData.failed_rows || []).length || 1
          };
      
      console.log("❌ Owner upload error response:", newResults);
      
      enqueueSnackbar(newResults.message, { variant: "error" });
      setResults(newResults);
    } finally {
      console.log("🔄 Owner finally block - showing results");
      setShowResults(true);
      setUploading(false);
    }
  };

  const handleReset = () => setFile(null);

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-6 py-4">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">
                Owner Upload
              </h2>
            </div>
            <button
              onClick={() => setShowInstructions(!showInstructions)}
              className="flex items-center text-primary text-sm"
              type="button"
            >
              <FiInfo className="mr-1" />
              Instructions
            </button>
          </div>
          {showInstructions && (
            <div className="bg-subprimary border border-primary rounded-lg p-4 mb-6">
              <h3 className="font-semibold mb-2">File Requirements:</h3>
              <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
                <li>Download the Excel template</li>
                <li>File format: XLSX</li>
                <li>Do not edit headers</li>
                <li>
                  Fill required fields: unit_name, tower_name, tower_number,
                  ownership_percentage, date_of_ownership, full_name, general_contact, general_email
                </li>
                <li>You cannot assign more than 100% to a single unit.</li>
                <li>
                  Use date format <code>DD-MMM-YYYY</code>
                </li>
                <li>
                  Contact number must be exactly 11 digits and must start with: 018,
                  019, 013, 017, 015, 016, or 014
                </li>
                <li>NID number must be 10 or 17 digits long.</li>
                <li>
                  Fill in the delivery method field only if the user requires login
                  credentials
                </li>
              </ul>
            </div>
          )}

          {/* File Upload Section */}
          <div className="rounded-lg text-center mb-6">
        {file ? (
          <div className="flex flex-col items-center">
            <FiFile className="text-4xl text-primary mb-2" />
            <p className="font-medium text-gray-700">{file.name}</p>
            <p className="text-sm text-gray-500 mt-1">
              {(file.size / 1024).toFixed(2)} KB
            </p>
            <button
              onClick={handleReset}
              className="mt-4 px-3 py-1 bg-red-100 text-red-600 rounded-md text-sm hover:bg-red-200"
              type="button"
            >
              Remove File
            </button>
          </div>
        ) : (
          <div className="">
            <div className="flex items-center justify-center w-full">
              <input
                id="owner-file"
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={handleFileChange}
              />
              <label
                htmlFor="owner-file"
                className="flex items-center justify-center w-full px-4 py-3 bg-primary text-white text-sm font-medium rounded-lg shadow cursor-pointer select-none transition hover:bg-primaryDark"
              >
                <FiUpload className="mr-2" />
                Choose File
              </label>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Allowed file type: <span className="font-medium">.xlsx</span> |
              Max size: <span className="font-medium">5MB</span>
            </p>
          </div>
        )}
      </div>

      <div className="flex gap-3 mb-6">
        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className={`flex-1 py-2 px-3 bg-primary text-white rounded-md text-sm font-medium flex items-center justify-center ${
            !file || uploading
              ? "bg-primary cursor-not-allowed text-white opacity-75"
              : "bg-primary text-white hover:bg-primary-dark"
          }`}
          type="button"
        >
          {uploading ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-1.5 h-3.5 w-3.5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Processing...
            </>
          ) : (
            <>
              <FiUpload className="mr-1.5" size={16} />
              Upload
            </>
          )}
        </button>

        <button
          onClick={downloadTemplate}
          className="flex-1 py-2 px-3 bg-secondary text-white rounded-md text-sm font-medium flex items-center justify-center hover:bg-secondary/90 transition-colors"
          type="button"
        >
          <FiDownload className="mr-1.5" size={16} />
          Download Owner Sample
        </button>
      </div>
      </div>
      {showResults && results && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[100] backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Sticky Header */}
            <div className="border-b border-gray-200 px-6 py-4 flex-shrink-0 flex items-center justify-between bg-white">
              <h3 className="text-lg font-semibold text-gray-800">
                Upload Results
              </h3>
              <button
                onClick={() => {
                  setShowResults(false);
                  // Refresh if there were any successful rows created
                  if (results?.success_count > 0 && onUploadSuccess) {
                    onUploadSuccess();
                  }
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1.5 hover:bg-gray-100 rounded-full"
                type="button"
                aria-label="Close modal"
              >
                <FiX size={20} />
              </button>
            </div>
            
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0">
              <div className="space-y-5">
                {/* Summary stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 shadow-sm">
                    <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Total Rows</p>
                    <p className="text-2xl font-bold text-gray-800">
                      {results.total_rows || 0}
                    </p>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 shadow-sm">
                    <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Successful</p>
                    <p className="text-2xl font-bold text-green-600 flex items-center">
                      <FiCheckCircle className="mr-2" size={18} />
                      {results.success_count ?? results.created_owners?.length ?? 0}
                    </p>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 shadow-sm">
                    <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Failed</p>
                    <p className="text-2xl font-bold text-red-600 flex items-center">
                      <FiAlertCircle className="mr-2" size={18} />
                      {results.error_count ?? results.failed_rows?.length ?? 0}
                    </p>
                  </div>
                </div>

                {/* Detailed errors */}
                {results.failed_rows?.length > 0 && (
                  <div className="mt-2">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                      <FiAlertCircle className="mr-2 text-red-500" size={16} />
                      Error Details
                    </h4>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                      {results.failed_rows.map((fr, idx) => (
                        <div key={idx} className="border-l-4 border-red-400 bg-red-50 p-3 rounded-r-md shadow-sm">
                          <p className="text-sm font-semibold text-gray-900 mb-1.5">
                            Row {fr.row}
                          </p>
                          {fr.errors && typeof fr.errors === "object" ? (
                            <ul className="space-y-1 ml-2">
                              {Object.entries(fr.errors).map(([field, msg]) => (
                                <li key={field} className="text-xs text-red-700">
                                  <span className="font-semibold">{field.replace(/_/g, " ")}:</span> {msg}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-xs text-red-700 ml-2">
                              {typeof fr.errors === "string" ? fr.errors : "Unknown error"}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Sticky Footer */}
            <div className="border-t border-gray-200 px-6 py-4 flex-shrink-0 flex justify-end bg-gray-50">
              <button
                onClick={() => {
                  setShowResults(false);
                  // Refresh if there were any successful rows created
                  if (results?.success_count > 0 && onUploadSuccess) {
                    onUploadSuccess();
                  }
                }}
                className="px-6 py-2 text-sm font-medium bg-primary text-white rounded-md hover:bg-primaryDark transition-colors shadow-sm"
                type="button"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default OwnerExcelUploader;
