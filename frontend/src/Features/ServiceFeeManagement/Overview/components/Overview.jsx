import { useState, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { FaDownload, FaPrint } from "react-icons/fa";
import OverviewTable from "./OverviewTable";
import FilterControls from "./FilterControls";
import ViewReceiptModal from "../../components/ViewReceiptModal";
import PaymentHistoryModal from "../../Payments/components/PaymentHistoryModal";
import RecordPaymentModal from "../../Payments/components/RecordPaymentModal";
import BillDetailView from "../../BillingManagement/components/BillDetailView";
import TableSkeleton from "../../../../Components/Loaders/TableSkeleton";
import useSkeletonLoading from "../../../../hooks/useSkeletonLoading";
import { SKELETON_MIN_DISPLAY_TIME } from "../../../../config/skeletonLoadingConfig";
import {
  fetchServiceFeeResidents,
  fetchFilterOptions
} from "../../../../redux/slices/api/serviceFeeManagement/serviceFeeManagementApi";
import {
  clearAllStates,
  clearErrors
} from "../../../../redux/slices/serviceFeeManagement/serviceFeeManagementSlice";
import * as XLSX from "xlsx";
import Button from "../../../../Components/FormComponent/ButtonComponent/Button";
import FilterButton from "../../../../Components/FormComponent/ButtonComponent/FilterButton";
import PageContainer from "../../../../Components/Ui/PageContainer";
import ContentBox from "../../../../Components/Ui/ContentBox";
import Heading from "../../../../Components/HeadingComponent/Heading";

const Overview = () => {
  const dispatch = useDispatch();

  // Refs for measuring sticky section heights
  const headerRef = useRef(null);
  const filterSectionRef = useRef(null);
  // Initialize with reasonable defaults to prevent layout issues
  const [headerHeight, setHeaderHeight] = useState(250);
  const [isMobile, setIsMobile] = useState(false);

  // Redux state - Updated to use serviceFees slice with safe defaults
  const serviceFeeState =
    useSelector((state) => state.serviceFeeManagement) || {};
  const {
    residents: payments = [],
    residentsLoading: residentsLoading = false
  } = serviceFeeState;

  // Only show loading animation on initial window load
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Get current month and year for service period
  const getCurrentServicePeriod = () => {
    const today = new Date();
    return {
      year: today.getFullYear(),
      month: today.getMonth() + 1
    };
  };

  const currentServicePeriod = getCurrentServicePeriod();

  // Local state - Initialize with current service period for both from and to
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTower, setSelectedTower] = useState("All Towers");
  const [selectedStatus, setSelectedStatus] = useState("All Status");
  const [selectedMethod, setSelectedMethod] = useState("All Methods");
  const [selectedTowers, setSelectedTowers] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [selectedMethods, setSelectedMethods] = useState([]);
  const [servicePeriodFrom, setServicePeriodFrom] =
    useState(currentServicePeriod);
  const [servicePeriodTo, setServicePeriodTo] = useState(currentServicePeriod);
  const [isFilterExpanded, setIsFilterExpanded] = useState(true);
  const [showViewReceiptModal, setShowViewReceiptModal] = useState(false);
  const [selectedPaymentForReceipt, setSelectedPaymentForReceipt] =
    useState(null);
  const [showPaymentHistoryModal, setShowPaymentHistoryModal] = useState(false);
  const [selectedPaymentForHistory, setSelectedPaymentForHistory] =
    useState(null);
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);
  const [selectedPaymentForRecord, setSelectedPaymentForRecord] =
    useState(null);
  const [showBillDetail, setShowBillDetail] = useState(false);
  const [selectedPaymentForBillDetail, setSelectedPaymentForBillDetail] =
    useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  // Get selected service period display (using from period for title)
  const getSelectedServicePeriod = () => {
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December"
    ];
    if (servicePeriodFrom && servicePeriodTo) {
      if (
        servicePeriodFrom.year === servicePeriodTo.year &&
        servicePeriodFrom.month === servicePeriodTo.month
      ) {
        return `${monthNames[servicePeriodFrom.month - 1]} ${servicePeriodFrom.year}`;
      } else {
        return `${monthNames[servicePeriodFrom.month - 1]} ${servicePeriodFrom.year} - ${monthNames[servicePeriodTo.month - 1]} ${servicePeriodTo.year}`;
      }
    }
    return `${monthNames[servicePeriodFrom?.month - 1 || 0]} ${servicePeriodFrom?.year || new Date().getFullYear()}`;
  };

  useEffect(() => {
    // Clear any previous errors
    dispatch(clearAllStates());

    // Fetch filter options first
    dispatch(fetchFilterOptions());
  }, [dispatch]);

  // Initialize page loading - Updated to use new API
  useEffect(() => {
    const initializePage = async () => {
      // Clear any previous errors
      dispatch(clearErrors());

      // Use checkbox arrays if they exist, otherwise fall back to single selection
      const towerIds =
        selectedTowers.length > 0
          ? selectedTowers
          : selectedTower === "All Towers"
            ? []
            : [selectedTower];
      const statusValues =
        selectedStatuses.length > 0
          ? selectedStatuses
          : selectedStatus === "All Status"
            ? []
            : [selectedStatus];
      const methodValues =
        selectedMethods.length > 0
          ? selectedMethods
          : selectedMethod === "All Methods"
            ? []
            : [selectedMethod];

      // Fetch service fee residents with current filters (combined data + statistics)
      const filterParams = {
        tower_ids: towerIds.length > 0 ? towerIds : [],
        statuses: statusValues.length > 0 ? statusValues : [],
        payment_methods: methodValues.length > 0 ? methodValues : [],
        service_period_month_from: servicePeriodFrom?.month,
        service_period_year_from: servicePeriodFrom?.year,
        service_period_month_to: servicePeriodTo?.month,
        service_period_year_to: servicePeriodTo?.year,
        search: searchQuery,
        stats: true,
        include_payment_details: true
      };

      await dispatch(fetchServiceFeeResidents(filterParams));
    };

    initializePage();
  }, [
    dispatch,
    searchQuery,
    selectedTower,
    selectedStatus,
    selectedMethod,
    selectedTowers,
    selectedStatuses,
    selectedMethods,
    servicePeriodFrom,
    servicePeriodTo
  ]);

  // Handle initial load completion
  useEffect(() => {
    if (!residentsLoading && payments) {
      setIsInitialLoad(false);
    }
  }, [residentsLoading, payments]);

  // Check if mobile and measure sticky section heights for proper stacking (desktop only)
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();

    const measureHeights = () => {
      // Only measure on desktop (md and above)
      if (window.innerWidth >= 768 && headerRef.current) {
        // Use offsetHeight which includes padding and border for accurate sticky positioning
        const height = headerRef.current.offsetHeight;
        setHeaderHeight(height);
      } else {
        // On mobile, set to 0 to disable sticky positioning
        setHeaderHeight(0);
      }
    };

    // Initial measurement with a small delay to ensure DOM is ready
    const initialTimeout = setTimeout(() => {
      measureHeights();
    }, 100);

    // Re-measure on window resize
    const handleResize = () => {
      checkMobile();
      measureHeights();
    };
    window.addEventListener("resize", handleResize);

    // Re-measure when filter expansion changes (with delay to allow DOM update)
    const filterTimeout = setTimeout(() => {
      measureHeights();
    }, 200);

    // Use ResizeObserver for more accurate measurements if available
    let resizeObserver = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        measureHeights();
      });

      // Observe elements when they're available
      const observeElements = () => {
        if (headerRef.current) {
          resizeObserver.observe(headerRef.current);
        }
        if (filterSectionRef.current) {
          resizeObserver.observe(filterSectionRef.current);
        }
      };

      // Try to observe immediately and also after a delay
      observeElements();
      setTimeout(observeElements, 100);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(initialTimeout);
      clearTimeout(filterTimeout);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [isFilterExpanded]);

  const handleFilterChange = (filterType, value) => {
    switch (filterType) {
      case "searchQuery":
        setSearchQuery(value);
        break;
      case "servicePeriodFrom":
        setServicePeriodFrom(value);
        break;
      case "servicePeriodTo":
        setServicePeriodTo(value);
        break;
      case "selectedTower":
      case "tower":
        setSelectedTower(value);
        break;
      case "selectedStatus":
      case "status":
        setSelectedStatus(value);
        break;
      case "selectedMethod":
      case "method":
        setSelectedMethod(value);
        break;
      case "selectedTowers":
        setSelectedTowers(value);
        break;
      case "selectedStatuses":
        setSelectedStatuses(value);
        break;
      case "selectedMethods":
        setSelectedMethods(value);
        break;
      default:
        break;
    }
  };

  const handleClearAllFilters = () => {
    setSearchQuery("");
    setSelectedTower("All Towers");
    setSelectedStatus("All Status");
    setSelectedMethod("All Methods");
    setSelectedTowers([]);
    setSelectedStatuses([]);
    setSelectedMethods([]);
    // Reset to current service period
    const currentPeriod = getCurrentServicePeriod();
    setServicePeriodFrom(currentPeriod);
    setServicePeriodTo(currentPeriod);
  };

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const handleViewReceipt = (payment) => {
    setSelectedPaymentForReceipt(payment);
    setShowViewReceiptModal(true);
  };

  const handleViewHistory = (payment) => {
    setSelectedPaymentForBillDetail(payment);
    setShowBillDetail(true);
  };

  const handleRecordPayment = (payment) => {
    setSelectedPaymentForRecord(payment);
    setShowRecordPaymentModal(true);
  };

  const handleRecordPaymentSuccess = () => {
    // Refresh the data after successful payment recording
    const filterParams = {
      tower_ids: selectedTowers.length > 0 ? selectedTowers : [],
      statuses: selectedStatuses.length > 0 ? selectedStatuses : [],
      payment_methods: selectedMethods.length > 0 ? selectedMethods : [],
      service_period_month_from: servicePeriodFrom?.month,
      service_period_year_from: servicePeriodFrom?.year,
      service_period_month_to: servicePeriodTo?.month,
      service_period_year_to: servicePeriodTo?.year,
      search: searchQuery,
      stats: true,
      include_payment_details: true
    };
    dispatch(fetchServiceFeeResidents(filterParams));
  };

  // Helper function to handle null/undefined values
  const getDisplayValue = (value, fallback = "N/A") => {
    if (value === null || value === undefined || value === "") {
      return fallback;
    }
    return value;
  };

  // Helper function to format dates safely
  const formatDate = (dateValue) => {
    if (
      !dateValue ||
      dateValue === "1970-01-01T00:00:00Z" ||
      dateValue === "1970-01-01"
    ) {
      return "N/A";
    }
    try {
      const date = new Date(dateValue);
      const day = String(date.getDate()).padStart(2, "0");
      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec"
      ];
      const month = monthNames[date.getMonth()];
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    } catch {
      return "N/A";
    }
  };

  const handleExport = () => {
    try {
      if (!filteredPayments || filteredPayments.length === 0) {
        alert("No data to export");
        return;
      }

      // Prepare data for Excel export
      const exportData = filteredPayments.map((payment, index) => {
        // Extract bill category amount - try direct property first, then bill_category_details JSON
        let billCategoryAmount = parseFloat(payment.bill_category_amount || 0);
        if (!billCategoryAmount && payment.bill_category_details) {
          try {
            let billDetails;
            if (typeof payment.bill_category_details === "string") {
              billDetails = JSON.parse(payment.bill_category_details);
            } else {
              billDetails = payment.bill_category_details;
            }
            // If it's an array, sum all amounts
            if (Array.isArray(billDetails)) {
              billCategoryAmount = billDetails.reduce((sum, item) => {
                return sum + parseFloat(item.total_amount || item.amount || 0);
              }, 0);
            } else if (billDetails && typeof billDetails === "object") {
              // If it's a single object, extract amount
              billCategoryAmount = parseFloat(
                billDetails.total_amount || billDetails.amount || 0
              );
            }
          } catch (e) {
            billCategoryAmount = 0;
          }
        }

        return {
          "#": index + 1,
          Tower: getDisplayValue(payment.tower_name),
          Unit: getDisplayValue(payment.unit_display),
          Name: getDisplayValue(payment.primary_name),
          Contact: getDisplayValue(payment.primary_number),
          "Fee Amount": getDisplayValue(
            payment.fee_amount ||
            payment.original_amount ||
            payment.service_fee_amount,
            "0"
          ),
          "Bill Category": getDisplayValue(billCategoryAmount, "0"),
          Penalty: getDisplayValue(payment.penalty_amount, "0"),
          Waived: getDisplayValue(payment.waived_amount, "0"),
          "Paid Amount": getDisplayValue(payment.paid_amount, "0"),
          "Due Date": formatDate(payment.due_date),
          Status: getDisplayValue(
            payment.service_status?.charAt(0).toUpperCase() +
            payment.service_status?.slice(1)
          )
        };
      });

      // Create worksheet
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      const colWidths = [
        { wch: 5 }, // #
        { wch: 15 }, // Tower
        { wch: 10 }, // Unit
        { wch: 20 }, // Name
        { wch: 15 }, // Contact
        { wch: 15 }, // Fee Amount
        { wch: 15 }, // Bill Category
        { wch: 12 }, // Penalty
        { wch: 12 }, // Waiver
        { wch: 15 }, // Paid Amount
        { wch: 15 }, // Due Date
        { wch: 10 } // Status
      ];
      ws["!cols"] = colWidths;

      // Create workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Service Fee Overview");

      // Generate filename
      const filename = `Service_Fee_Overview_${getSelectedServicePeriod().replace(/\s+/g, "_").replace(/[-]/g, "_")}_${new Date().toISOString().split("T")[0]}.xlsx`;

      // Save file
      XLSX.writeFile(wb, filename);

      console.log("Excel file exported successfully:", filename);
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      alert("Error exporting data to Excel. Please try again.");
    }
  };

  const handlePrint = () => {
    // Create print-friendly content
    const printContent = `
      <html>
        <head>
          <title>Service Fee Overview - ${getSelectedServicePeriod()}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; font-size: 12px; }
            .header { text-align: center; margin-bottom: 30px; }
            .company-name { font-size: 24px; font-weight: bold; color: #3D9D9B; margin-bottom: 10px; }
            .report-title { font-size: 18px; font-weight: 600; color: #374151; margin-bottom: 5px; }
            .period { font-size: 14px; color: #6B7280; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #E5E7EB; padding: 8px; text-align: left; }
            th { background-color: #F3F4F6; font-weight: bold; }
            .status-paid { background-color: #DEF7EC; color: #047857; }
            .status-due { background-color: #FEF3C7; color: #92400E; }
            .status-overdue { background-color: #FEE2E2; color: #DC2626; }
            .status-partial { background-color: #DBEAFE; color: #1E40AF; }
            @media print {
              body { margin: 0; }
              table { font-size: 10px; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-name">Estate Link</div>
            <div class="report-title">Service Fee Overview</div>
            <div class="period">${getSelectedServicePeriod()}</div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Tower</th>
                <th>Unit</th>
                <th>Name</th>
                <th>Contact</th>
                <th>Fee Amount</th>
                <th>Bill Category</th>
                <th>Penalty</th>
                <th>Waiver</th>
                <th>Paid Amount</th>
                <th>Due Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${filteredPayments
        .map((payment, index) => {
          let billCategoryAmount = parseFloat(
            payment.bill_category_amount || 0
          );
          if (!billCategoryAmount && payment.bill_category_details) {
            try {
              let billDetails;
              if (typeof payment.bill_category_details === "string") {
                billDetails = JSON.parse(payment.bill_category_details);
              } else {
                billDetails = payment.bill_category_details;
              }
              // If it's an array, sum all amounts
              if (Array.isArray(billDetails)) {
                billCategoryAmount = billDetails.reduce((sum, item) => {
                  return (
                    sum +
                    parseFloat(item.total_amount || item.amount || 0)
                  );
                }, 0);
              } else if (
                billDetails &&
                typeof billDetails === "object"
              ) {
                // If it's a single object, extract amount
                billCategoryAmount = parseFloat(
                  billDetails.total_amount || billDetails.amount || 0
                );
              }
            } catch (e) {
              billCategoryAmount = 0;
            }
          }
          return `
                <tr>
                  <td>${index + 1}</td>
                  <td>${getDisplayValue(payment.tower_name)}</td>
                  <td>${getDisplayValue(payment.unit_display)}</td>
                  <td>${getDisplayValue(payment.primary_name)}</td>
                  <td>${getDisplayValue(payment.primary_number)}</td>
                  <td>৳ ${getDisplayValue(payment.fee_amount || payment.original_amount || payment.service_fee_amount, "0")}</td>
                  <td>৳ ${getDisplayValue(billCategoryAmount, "0")}</td>
                  <td>৳ ${getDisplayValue(payment.penalty_amount, "0")}</td>
                  <td>৳ ${getDisplayValue(payment.waived_amount, "0")}</td>
                  <td>৳ ${getDisplayValue(payment.paid_amount, "0")}</td>
                  <td>${formatDate(payment.due_date)}</td>
                  <td class="status-${(payment.service_status || "due").toLowerCase()}">${getDisplayValue(payment.service_status?.charAt(0).toUpperCase() + payment.service_status?.slice(1))}</td>
                </tr>
              `;
        })
        .join("")}
            </tbody>
          </table>
          
          <div style="margin-top: 30px; text-align: center; color: #6B7280; font-size: 10px;">
            Generated on ${new Date().toLocaleString()}
          </div>
        </body>
      </html>
    `;

    // Open print window
    const printWindow = window.open("", "_blank");
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();

    // Print after content is loaded
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  // Sort and filter payments
  const getSortedPayments = () => {
    let sortedPayments = [...payments];

    if (sortConfig.key) {
      sortedPayments.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        // Handle null/undefined values
        if (aValue === null || aValue === undefined) aValue = "";
        if (bValue === null || bValue === undefined) bValue = "";

        // Convert to strings for comparison if they're not already
        if (typeof aValue !== "string") aValue = String(aValue);
        if (typeof bValue !== "string") bValue = String(bValue);

        // For numeric columns, parse as numbers
        if (
          ["fee_amount", "amount", "due_amount", "payment_id"].includes(
            sortConfig.key
          )
        ) {
          aValue = parseFloat(aValue) || 0;
          bValue = parseFloat(bValue) || 0;
        }

        // For date columns, parse as dates
        if (sortConfig.key === "payment_date") {
          aValue = new Date(aValue);
          bValue = new Date(bValue);
        }

        if (aValue < bValue) {
          return sortConfig.direction === "asc" ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === "asc" ? 1 : -1;
        }
        return 0;
      });
    }

    return sortedPayments;
  };

  const filteredPayments = getSortedPayments();

  // Calculate stats from payments in a single loop (grouped by unit/period)
  const calculateStats = () => {
    const stats = {
      totalPayments: 0,
      totalFeeAmount: 0,
      totalBillCategoryAmount: 0,
      totalPaidAmount: 0,
      totalDueAmount: 0,
      completedCount: 0,
      completedAmount: 0,
      dueCount: 0,
      dueAmount: 0,
      partialCount: 0,
      partialAmount: 0,
      overdueCount: 0,
      overdueAmount: 0,
      totalPenaltyAmount: 0,
      totalWaivedAmount: 0
    };

    // Track unique unit-period combinations to avoid double counting
    const serviceFeePeriodMap = {};

    filteredPayments.forEach((payment) => {
      const unitId = payment.unit_id;
      const paymentId = payment.payment_id || payment.service_fee_id;
      const feePeriodKey = `${unitId}-${paymentId}`;

      const feeAmount = parseFloat(
        payment.fee_amount ||
        payment.original_amount ||
        payment.service_fee_amount ||
        0
      );
      const paidAmount = parseFloat(payment.paid_amount) || 0;
      const penaltyAmount = parseFloat(payment.penalty_amount) || 0;
      const waivedAmount = parseFloat(payment.waived_amount) || 0;

      // Extract bill category amount and actual gross penalty
      let billCategoryAmount = parseFloat(payment.bill_category_amount || 0);
      let actualGrossPenalty = 0;

      if (payment.service_fee_items) {
        try {
          let items;
          if (typeof payment.service_fee_items === "string") {
            items = JSON.parse(payment.service_fee_items);
          } else {
            items = payment.service_fee_items;
          }
          if (Array.isArray(items)) {
            // Sum bill categories
            billCategoryAmount = items.reduce((sum, item) => {
              if (item.item_type === "bill_category") {
                return sum + parseFloat(item.amount || 0);
              }
              return sum;
            }, 0);

            // Get actual gross penalty
            const penaltyItem = items.find(
              (item) => item.item_type === "penalty"
            );
            if (penaltyItem) {
              actualGrossPenalty = parseFloat(penaltyItem.amount || 0);
            }
          }
        } catch (e) {
          console.error("Error parsing service_fee_items:", e);
        }
      }
      if (!billCategoryAmount && payment.bill_category_details) {
        try {
          let billDetails;
          if (typeof payment.bill_category_details === "string") {
            billDetails = JSON.parse(payment.bill_category_details);
          } else {
            billDetails = payment.bill_category_details;
          }
          // If it's an array, sum all amounts
          if (Array.isArray(billDetails)) {
            billCategoryAmount = billDetails.reduce((sum, item) => {
              return sum + parseFloat(item.total_amount || item.amount || 0);
            }, 0);
          } else if (billDetails && typeof billDetails === "object") {
            // If it's a single object, extract amount
            billCategoryAmount = parseFloat(
              billDetails.total_amount || billDetails.amount || 0
            );
          }
        } catch (e) {
          billCategoryAmount = 0;
        }
      }

      if (!serviceFeePeriodMap[feePeriodKey]) {
        serviceFeePeriodMap[feePeriodKey] = {
          fee: feeAmount,
          bill: billCategoryAmount,
          penalty:
            actualGrossPenalty > 0
              ? actualGrossPenalty
              : penaltyAmount + waivedAmount,
          waived: 0,
          paid: 0,
          status: payment.service_status
        };
      }

      const period = serviceFeePeriodMap[feePeriodKey];
      period.fee = Math.max(period.fee, feeAmount);
      period.bill = Math.max(period.bill, billCategoryAmount);
      period.penalty = Math.max(period.penalty, penaltyAmount);
      period.waived += waivedAmount;
      period.paid += paidAmount;
      period.status = payment.service_status || period.status;
    });

    Object.values(serviceFeePeriodMap).forEach((period) => {
      const totalBilled =
        period.fee + period.bill + period.penalty - period.waived;
      const outstanding = Math.max(0, totalBilled - period.paid);

      stats.totalPayments += 1;
      stats.totalFeeAmount += period.fee;
      stats.totalBillCategoryAmount += period.bill;
      stats.totalPenaltyAmount += period.penalty;
      stats.totalWaivedAmount += period.waived;
      stats.totalPaidAmount += period.paid;

      const paymentStatus = (period.status || "").toLowerCase();

      if (paymentStatus === "paid") {
        stats.completedCount += 1;
        stats.completedAmount += period.paid;
      } else if (paymentStatus === "overdue") {
        stats.overdueCount += 1;
        stats.overdueAmount += outstanding;
      } else if (paymentStatus === "due" || paymentStatus === "partial") {
        stats.dueCount += 1;
        stats.dueAmount += outstanding;
        stats.totalDueAmount += outstanding;
      }
    });

    return stats;
  };

  const calculatedStats = calculateStats();

  // Use skeleton loading hook to ensure minimum display time and data validation
  const showSkeleton = useSkeletonLoading(
    residentsLoading || isInitialLoad,
    payments,
    SKELETON_MIN_DISPLAY_TIME
  );

  return (
    <PageContainer className="min-h-[calc(100vh-7rem)]">
      <ContentBox className="flex flex-col">
        {/* Current Collection Period Header */}
        <div
          ref={headerRef}
          className="mb-3 md:sticky top-0 z-10 bg-white pb-4 md:backdrop-blur"
        >
          <div className="mb-4">
            <Heading title="Service Fee Overview" size="2xl" color="black" />
          </div>
          <div className="flex flex-wrap sm:flex-nowrap items-baseline gap-2 mb-4 sm:mb-6">
            <h2 className="text-sm sm:text-base font-semibold text-gray-900">
              Current Collection Period
            </h2>
            <h3 className="text-lg sm:text-2xl md:text-3xl font-bold text-primary">
              {getSelectedServicePeriod()}
            </h3>
          </div>

          {/* Statistics Cards in Grid - With borders and light icons */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-8 gap-3 mb-6">
            {/* Total Service Fee Card */}
            <div className="border border-gray-200 rounded-lg p-3 sm:p-4 bg-white relative">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-xs sm:text-sm font-medium text-gray-600 mb-1 sm:mb-2">
                    Total Service Fee
                  </div>
                  <div className="text-lg sm:text-xl md:text-2xl font-bold text-purple-600 mb-1">
                    {(() => {
                      const totalFee = Number(
                        calculatedStats.totalFeeAmount || 0
                      );
                      const totalBillCategory = Number(
                        calculatedStats.totalBillCategoryAmount || 0
                      );
                      const totalPenalty = Number(
                        calculatedStats.totalPenaltyAmount || 0
                      );
                      const totalWaived = Number(
                        calculatedStats.totalWaivedAmount || 0
                      );
                      const totalBilled =
                        totalFee +
                        totalBillCategory +
                        totalPenalty -
                        totalWaived;
                      return totalBilled.toLocaleString();
                    })()}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {calculatedStats.totalPayments || "0"} units
                  </div>
                </div>
              </div>
            </div>

            {/* Total Bill Category Card */}
            <div className="border border-gray-200 rounded-lg p-3 sm:p-4 bg-white relative">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-xs sm:text-sm font-medium text-gray-600 mb-1 sm:mb-2">
                    Additional Charges
                  </div>
                  <div className="text-lg sm:text-xl md:text-2xl font-bold text-indigo-600 mb-1">
                    {Number(
                      calculatedStats.totalBillCategoryAmount || 0
                    ).toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    Misc fees
                  </div>
                </div>
              </div>
            </div>

            {/* Total Collected Card */}
            <div className="border border-gray-200 rounded-lg p-3 sm:p-4 bg-white relative">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-xs sm:text-sm font-medium text-gray-600 mb-1 sm:mb-2">
                    Total Collected
                  </div>
                  <div className="text-lg sm:text-xl md:text-2xl font-bold text-primary mb-1">
                    {Number(
                      calculatedStats.totalPaidAmount || 0
                    ).toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {(calculatedStats.completedCount || 0) +
                      (calculatedStats.partialCount || 0)}{" "}
                    paid
                  </div>
                </div>
              </div>
            </div>

            {/* Total Penalty Card */}
            <div className="border border-gray-200 rounded-lg p-3 sm:p-4 bg-white relative">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-xs sm:text-sm font-medium text-gray-600 mb-1 sm:mb-2">
                    Total Penalty
                  </div>
                  <div className="text-lg sm:text-xl md:text-2xl font-bold text-orange-600 mb-1">
                    {Number(
                      calculatedStats.totalPenaltyAmount || 0
                    ).toLocaleString()}
                  </div>
                  <div className="text-xs text-orange-500 truncate">
                    Late fees
                  </div>
                </div>
              </div>
            </div>

            {/* Total Waived Card */}
            <div className="border border-gray-200 rounded-lg p-3 sm:p-4 bg-white relative">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-xs sm:text-sm font-medium text-gray-600 mb-1 sm:mb-2">
                    Total Waived
                  </div>
                  <div className="text-lg sm:text-xl md:text-2xl font-bold text-emerald-600 mb-1">
                    {Number(
                      calculatedStats.totalWaivedAmount || 0
                    ).toLocaleString()}
                  </div>
                  <div className="text-xs text-emerald-500 truncate">
                    Forgiven
                  </div>
                </div>
              </div>
            </div>

            {/* Total Due Card */}
            <div className="border border-gray-200 rounded-lg p-3 sm:p-4 bg-white relative">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-xs sm:text-sm font-medium text-gray-600 mb-1 sm:mb-2">
                    Total Due
                  </div>
                  <div className="text-lg sm:text-xl md:text-2xl font-bold text-teal-600 mb-1">
                    {(() => {
                      const totalDue = Number(
                        calculatedStats.totalDueAmount || 0
                      );
                      return totalDue.toLocaleString();
                    })()}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    To collect
                  </div>
                </div>
              </div>
            </div>

            {/* Total Overdue Card */}
            <div className="border border-gray-200 rounded-lg p-3 sm:p-4 bg-white relative">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-xs sm:text-sm font-medium text-gray-600 mb-1 sm:mb-2">
                    Total Overdue
                  </div>
                  <div className="text-lg sm:text-xl md:text-2xl font-bold text-red-600 mb-1">
                    {Number(
                      calculatedStats.overdueAmount || 0
                    ).toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {calculatedStats.overdueCount || "0"} overdue
                  </div>
                </div>
              </div>
            </div>

            {/* Collection Rate Card */}
            <div className="border border-gray-200 rounded-lg p-3 sm:p-4 bg-white relative">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-xs sm:text-sm font-medium text-gray-600 mb-1 sm:mb-2">
                    Collection Rate
                  </div>
                  <div className="text-lg sm:text-xl md:text-2xl font-bold text-indigo-600 mb-1">
                    {(() => {
                      const totalFee = Number(
                        calculatedStats.totalFeeAmount || 0
                      );
                      const totalBillCategory = Number(
                        calculatedStats.totalBillCategoryAmount || 0
                      );
                      const totalPenalty = Number(
                        calculatedStats.totalPenaltyAmount || 0
                      );
                      const totalWaived = Number(
                        calculatedStats.totalWaivedAmount || 0
                      );
                      const totalBilled =
                        totalFee +
                        totalBillCategory +
                        totalPenalty -
                        totalWaived;
                      const collected = Number(
                        calculatedStats.totalPaidAmount || 0
                      );
                      if (totalBilled > 0) {
                        return ((collected / totalBilled) * 100).toFixed(2);
                      }
                      return "0.00";
                    })()}
                    %
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {(calculatedStats.completedCount || 0) +
                      (calculatedStats.partialCount || 0)}
                    /{calculatedStats.totalPayments || "0"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ContentBox>

      <ContentBox className="flex flex-col mt-4 sm:mt-6">
        {/* All Units Payment Status Section - Inside a bordered card */}
        <div className="border border-gray-200 rounded-[10px] py-4 sm:py-[23px] px-4 sm:px-[13px] flex flex-col gap-4">
          {/* Sticky Filter Section (header only) */}
          <div
            ref={filterSectionRef}
            className="z-30 bg-white -mx-4 sm:-mx-[13px] px-4 sm:px-[13px] pt-0 pb-0 mb-0 min-h-12"
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center w-full gap-3 sm:gap-0 py-2 sm:py-0">
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 leading-[140%]">
                All Units Payment Status
              </h2>

              {/* Filter and Search Controls */}
              <div className="flex flex-col md:flex-row items-center gap-2 sm:gap-[15px] w-full sm:w-auto">
                <div className="flex w-full md:w-auto justify-end items-end gap-2">
                  <Button
                    icon={FaDownload}
                    variant="download"
                    size="large"
                    onClick={handleExport}
                    disabled={
                      !filteredPayments || filteredPayments.length === 0
                    }
                    iconSize="medium"
                    tooltip="Excel"
                    tooltipId="service-fee-overview-excel-tooltip"
                  ></Button>
                  <Button
                    variant="download"
                    size="large"
                    icon={FaPrint}
                    onClick={handlePrint}
                    disabled={
                      !filteredPayments || filteredPayments.length === 0
                    }
                    iconSize="medium"
                    tooltip="Print"
                    tooltipId="service-fee-overview-print-tooltip"
                  ></Button>
                  <FilterButton
                    active={isFilterExpanded}
                    onClick={() => setIsFilterExpanded(!isFilterExpanded)}
                  >
                    Filter
                  </FilterButton>
                </div>

                {/* Search Input */}
                <div className="flex items-center bg-white border border-borderLight rounded-lg py-[11px] px-[15px] gap-[10px] w-full sm:w-[238px] h-12 focus-within:border-primary focus-within:shadow-ring-primary">
                  <svg
                    className="w-[16.93px] h-[16.93px] text-primary flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search list..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="outline-none placeholder-primary text-primary w-full text-sm placeholder:text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Sticky expanded Filters Section */}
          {isFilterExpanded && (
            <div
              className="pb-4 border-b border-gray-200 -mx-4 sm:-mx-[13px] px-4 sm:px-[13px] bg-white z-30"
            >
              <FilterControls
                searchQuery={searchQuery}
                servicePeriodFrom={servicePeriodFrom}
                servicePeriodTo={servicePeriodTo}
                selectedTowers={selectedTowers}
                selectedStatuses={selectedStatuses}
                selectedMethods={selectedMethods}
                onChange={handleFilterChange}
                onClearAll={handleClearAllFilters}
              />
            </div>
          )}

          {/* Overview Table Section */}
          {showSkeleton ? (
            <div className="flex-1 min-h-0 flex justify-center items-center py-12">
              <TableSkeleton rows={10} columns={10} />
            </div>
          ) : (
            <div className="flex-1">
              <OverviewTable
                payments={filteredPayments}
                onViewReceipt={handleViewReceipt}
                onViewHistory={handleViewHistory}
                onRecordPayment={handleRecordPayment}
                onSort={handleSort}
                sortConfig={sortConfig}
              />
            </div>
          )}
        </div>
      </ContentBox>

      {/* Modals - Outside Card */}
      {showBillDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center z-10">
              <h2 className="text-xl font-bold text-gray-900">Bill Details</h2>
              <button
                onClick={() => {
                  setShowBillDetail(false);
                  setSelectedPaymentForBillDetail(null);
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <BillDetailView
                bill={selectedPaymentForBillDetail}
                onBack={() => {
                  setShowBillDetail(false);
                  setSelectedPaymentForBillDetail(null);
                }}
              />
            </div>
          </div>
        </div>
      )}

      <ViewReceiptModal
        isOpen={showViewReceiptModal}
        onClose={() => {
          setShowViewReceiptModal(false);
          setSelectedPaymentForReceipt(null);
        }}
        payment={selectedPaymentForReceipt}
      />

      <PaymentHistoryModal
        isOpen={showPaymentHistoryModal}
        onClose={() => {
          setShowPaymentHistoryModal(false);
          setSelectedPaymentForHistory(null);
        }}
        payment={selectedPaymentForHistory}
      />

      <RecordPaymentModal
        isOpen={showRecordPaymentModal}
        onClose={() => {
          setShowRecordPaymentModal(false);
          setSelectedPaymentForRecord(null);
        }}
        payment={selectedPaymentForRecord}
        residentId={selectedPaymentForRecord?.resident_id}
        unitId={selectedPaymentForRecord?.unit_id}
        onSuccess={handleRecordPaymentSuccess}
      />
    </PageContainer>
  );
};

export default Overview;
