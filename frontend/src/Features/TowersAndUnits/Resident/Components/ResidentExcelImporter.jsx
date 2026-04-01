import React, { useState } from "react";
import { createPortal } from "react-dom";
import {
  FiUpload,
  FiDownload,
  FiX,
  FiCheckCircle,
  FiAlertCircle,
  FiFile,
  FiInfo
} from "react-icons/fi";
import axiosInstance from "utils/axiosInstance";
import { useSnackbar } from "notistack";
import * as XLSX from "xlsx";

const ResidentExcelImporter = ({ onUploadSuccess }) => {
  const { enqueueSnackbar } = useSnackbar();
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResults(null);
      setShowResults(false);
    }
  };

  const handleSubmit = async () => {
    if (!file) {
      enqueueSnackbar("Please select a file first", { variant: "warning" });
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    
    setShowResults(false);

    try {
      const response = await axiosInstance.post(
        "/towers/resident/bulk-upload/",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${localStorage.getItem("access_token")}`
          }
          // No timeout - wait until backend completes
        }
      );

      // Backend now returns data directly (not nested in results)
      // Normalize the response structure to match what the modal expects
      const normalizedData = {
        total_rows: response.data.total_rows || 0,
        success_count: response.data.success_count || 0,
        error_count: response.data.error_count || 0,
        errors: response.data.failed_rows || []  // Map failed_rows to errors
      };
      setResults(normalizedData);
      setShowResults(true); // Set showResults immediately when we have data
      
      console.log("✅ Resident upload success response:", response.data);
      console.log("✅ Normalized data for modal:", normalizedData);
      
      enqueueSnackbar(response.data.message, {
        variant: response.data.status === "success" ? "success" : "error",
        autoHideDuration: 3000
      });
      
      // Dispatch event to instantly refresh notifications
      if (response.data.status === "success") {
        window.dispatchEvent(new Event('residentBulkUploadCompleted'));
      }
      
      // Note: onUploadSuccess callback should be called after user closes the results modal
      // to avoid closing the parent modal before results are shown
    } catch (error) {
      let errorMessage = "Upload failed. Please try again.";
      let showTemplateButton = false;

      // Check for timeout specifically
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        errorMessage = "Upload is taking longer than expected. The process may still be running on the server. Please wait a moment and check if the data was imported.";
        setResults({
          total_rows: 0,
          success_count: 0,
          error_count: 1,
          errors: [
            {
              row: "Timeout",
              errors: { 
                error: errorMessage,
                suggestion: "Try uploading fewer rows at once, or contact support if the issue persists."
              }
            }
          ]
        });
        setShowResults(true);
      } else if (error.response) {
        const { data, status } = error.response;

        if (typeof data === "string") {
          errorMessage = data;
        } else if (data?.error) {
          errorMessage = data.error;
        } else if (data?.detail) {
          errorMessage = data.detail;
        } else if (data?.message) {
          errorMessage = data.message;
        }

        if (status === 401 || status === 403) {
          errorMessage = "Session expired. Please log in again.";
        } else if (
          errorMessage.includes("Excel file format cannot be determined")
        ) {
          errorMessage =
            "Invalid Excel file format. Please ensure the file is not corrupted and try again.";
          showTemplateButton = true;
        } else if (errorMessage.includes("Missing fields")) {
          errorMessage +=
            " Please download the template and ensure all required columns are present.";
          showTemplateButton = true;
        }

        if (
          data?.success_count !== undefined ||
          data?.error_count !== undefined ||
          data?.failed_rows ||
          data?.error
        ) {
          // Backend now returns data directly (not nested in results)
          console.log("❌ Resident upload error response:", data);
          
          setResults({
            total_rows: data.total_rows || 0,
            success_count: data.success_count || 0,
            error_count: data.error_count || data.failed_rows?.length || 1,
            errors: data.failed_rows || [
              {
                row: "N/A",
                errors: { error: data.error || errorMessage }
              }
            ]
          });
          setShowResults(true); // Set showResults immediately when we have error data
        }
      } else if (error.request) {
        errorMessage =
          "No response from server. Please check your network connection.";
        // Set results for network errors
        setResults({
          total_rows: 0,
          success_count: 0,
          error_count: 1,
          errors: [
            {
              row: "Network",
              errors: { error: errorMessage }
            }
          ]
        });
        setShowResults(true);
      } else {
        errorMessage = error.message || "Request setup failed";
        // Set results for other errors
        setResults({
          total_rows: 0,
          success_count: 0,
          error_count: 1,
          errors: [
            {
              row: "Error",
              errors: { error: errorMessage }
            }
          ]
        });
        setShowResults(true);
      }

      enqueueSnackbar(errorMessage, {
        variant: "error",
        autoHideDuration: 7000,
        action: showTemplateButton ? (
          <button
            onClick={handleDownloadTemplate}
            className="text-white hover:underline px-2 py-1 bg-blue-600 rounded ml-2"
          >
            Get Template
          </button>
        ) : null
      });
    } finally {
      console.log("🔄 Resident finally block - finishing up");
      setUploading(false);
    }
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        tower_name: "Example Tower",
        tower_number: 1,
        unit_name: "4A",
        full_name: "",
        general_contact: "",
        permanent_address: "",
        present_address: "",
        date_of_birth: "28-Feb-1990",
        occupation: "",
        marital_status: "Married",
        religion: "Islam",
        gender: "Male",
        delivery_method: "", // "Courier", "Email", etc. if needed
        general_email: "",
        nid_number: "",
        unit_rent_fee: "",
        advance_payment: "",
        notice_period: "",
        is_resident_or_tenant: 1 // 1 = Resident, 0 = Tenant
      }
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateData);
    XLSX.utils.book_append_sheet(wb, ws, "Resident Sample");
    XLSX.writeFile(wb, "resident_sample.xlsx", { compression: true });
  };

  const handleReset = () => {
    setFile(null);
    setResults(null);
    setShowResults(false);
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-6 py-4">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              Resident Upload
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
            {/* <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
              <li>File format: CSV, XLS, or XLSX</li>
              <li>
                Required columns: unit, full_name, general_contact,
                delivery_method
              </li>
              <li>
                Contact number must be exactly 11 digits and must start with:
                018, 019, 013, 017, 015, 016, or 014
              </li>
              <li>NID number must be 10 or 17 digits long.</li>
              <li>
                Fill in the delivery method field only if the user requires
                login credentials
              </li>
              <li>Download the template for proper formatting</li>
            </ul> */}
            <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
              <li>Download the Excel template</li>
              <li>File format: XLSX</li>
              <li> Do not edit headers</li>

              <li>
                Fill required fields: unit_name, tower_name, tower_number,
                full_name, general_contact,general_email
              </li>
              <li>
                Use date format <code>DD-MMM-YYYY</code>
              </li>
              <li>
                Contact number must be exactly 11 digits and must start with:
                018, 019, 013, 017, 015, 016, or 014
              </li>
              <li>NID number must be 10 or 17 digits long.</li>
              <li>
                The is_resident_or_tenant field can be a boolean/integer field:
                1 = Resident,  0 = Tenant
              </li>
              <li>
                Fill in the delivery method field only if the user requires
                login credentials
              </li>
            </ul>
          </div>
        )}

        {/* File Upload Section */}
        <div className=" rounded-lg text-center mb-6">
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
              <div className="flex items-center justify-center gap-4 w-full">
                <input
                  id="resident-file"
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <label
                  htmlFor="resident-file"
                  className="flex items-center justify-center flex-grow px-4 py-3 bg-primary text-white text-sm font-medium rounded-lg shadow  cursor-pointer select-none transition"
                >
                  <FiUpload className="mr-2" />
                  Choose File
                </label>
              </div>
              <p className="text-sm text-gray-500 mt-2 mb-4 sm:mb-0">
                Allowed file type: <span className="font-medium">.xlsx</span> |
                Max size: <span className="font-medium">5MB</span>
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={handleSubmit}
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
            onClick={handleDownloadTemplate}
            className="flex-1 py-2 px-3 bg-secondary text-white rounded-md text-sm font-medium flex items-center justify-center hover:bg-secondary/90 transition-colors"
            type="button"
          >
            <FiDownload className="mr-1.5" size={16} />
            Download Resident Sample
          </button>
        </div>

        {/* {!file && (
          <p className="text-sm text-gray-500 mt-3 text-center">
            Please select a file to enable the upload button
          </p>
        )} */}

        {uploading && (
          <div className="mt-4">
            <p className="text-sm text-gray-600 mb-1 text-center">
              Processing your file, please wait...
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full animate-pulse"
                style={{ width: "45%" }}
              ></div>
            </div>
          </div>
        )}
      </div>
      {/* Results Modal */}
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
                  setFile(null);
                  setResults(null);
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
                      {results.success_count || 0}
                    </p>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 shadow-sm">
                    <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Failed</p>
                    <p className="text-2xl font-bold text-red-600 flex items-center">
                      <FiAlertCircle className="mr-2" size={18} />
                      {results.error_count || 0}
                    </p>
                  </div>
                </div>

                {/* Detailed errors */}
                {results.errors?.length > 0 && (
                  <div className="mt-2">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                      <FiAlertCircle className="mr-2 text-red-500" size={16} />
                      Error Details
                    </h4>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                      {results.errors.map((error, idx) => (
                        <div key={idx} className="border-l-4 border-red-400 bg-red-50 p-3 rounded-r-md shadow-sm">
                          <p className="text-sm font-semibold text-gray-900 mb-1.5">
                            Row {error.row ?? "N/A"}
                          </p>
                          {error.errors && typeof error.errors === "object" ? (
                            <ul className="space-y-1 ml-2">
                              {Object.entries(error.errors).map(([field, msg]) => (
                                <li key={field} className="text-xs text-red-700">
                                  <span className="font-semibold">{field.replace(/_/g, " ")}:</span> {msg || "Invalid"}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-xs text-red-700 ml-2">
                              {typeof error.errors === "string" ? error.errors : "Unknown error"}
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
                  setFile(null);
                  setResults(null);
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

export default ResidentExcelImporter;
