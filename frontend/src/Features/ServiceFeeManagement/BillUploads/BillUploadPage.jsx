import React, { useState, useMemo, useEffect, useRef } from 'react';
import MonthYearPicker from '../components/MonthYearPicker';
import { FaFilter, FaChevronDown, FaDownload, FaUpload, FaCaretDown, FaCheck } from 'react-icons/fa';
import { fetchServiceFeesByTowers, fetchBillUploadItems } from '../../../redux/slices/api/billUploadApi';
import axiosInstance from '../../../utils/axiosInstance';
import MessageBox from '../../../Components/MessageBox/MessageBox';
import { stringify } from 'qs';
import { useSelector } from 'react-redux';
import { PERMISSIONS } from '../../../constants/permissions';
import Heading from '../../../Components/HeadingComponent/Heading';
import SelectComponent from "../../../Components/FormComponent/SelectComponent";

// Demo units (to be replaced by API)
const demoTowers = [];
const demoUnitsByTower = {
  1: [
    { id: 101, unitName: "A-1" },
    { id: 102, unitName: "A-2" }
  ],
  2: [
    { id: 201, unitName: "B-1" },
    { id: 202, unitName: "B-2" }
  ]
};
export default function BillUploadPage() {
  const user = useSelector((state) => state.auth?.user);
  const permissionIds = user?.permission_ids?.map(String) || [];
  const canAdd = permissionIds.includes(String(PERMISSIONS.BILL_UPLOADS));
  const canEdit = permissionIds.includes(String(PERMISSIONS.BILL_UPLOADS));
  const isEditable = canAdd || canEdit;

  const [tab, setTab] = useState('manual'); // 'csv' | 'manual'
  const [selectedTowers, setSelectedTowers] = useState([]);
  const [selectedServiceFees, setSelectedServiceFees] = useState([]);
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1
  });
  const [showFilters, setShowFilters] = useState(true);

  // Towers state
  const [towers, setTowers] = useState([]);
  const [loadingTowers, setLoadingTowers] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // Service fees state
  const [serviceFees, setServiceFees] = useState([]);
  const [loadingServiceFees, setLoadingServiceFees] = useState(false);

  // Dropdown state
  const [showTowerDropdown, setShowTowerDropdown] = useState(false);
  const [showServiceFeeDropdown, setShowServiceFeeDropdown] = useState(false);
  const [tempSelectedTowers, setTempSelectedTowers] = useState([]);
  const [tempSelectedServiceFees, setTempSelectedServiceFees] = useState([]);
  const [notification, setNotification] = useState(null);
  const [message, setMessage] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [error, setError] = useState("");
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [modalErrors, setModalErrors] = useState([]);
  const isFirstLoad = useRef(true);
  const fileInputRef = useRef(null);

  const towerId = selectedTowers[0];
  const units = useMemo(() => demoUnitsByTower[towerId] || [], [towerId]);

  // Fetch categories on component mount
  useEffect(() => {
    const loadCategories = async () => {
      // setLoadingCategories(true); // Initialized to true
      try {
        const response = await axiosInstance.get('/api/bill-categories/active/');
        const categoryList = response?.data || [];
        setCategories(categoryList);
        // Set first active category as default
        if (categoryList.length > 0 && !category) {
          setCategory(categoryList[0].id);
        }
      } catch (error) {
        console.error("Error loading categories:", error);
        setCategories([]);
      } finally {
        setLoadingCategories(false);
      }
    };

    loadCategories();
  }, []);

  // Fetch towers on component mount
  useEffect(() => {
    const loadTowers = async () => {
      setLoadingTowers(true);
      try {
        const response = await axiosInstance.get('/api/service-fee-management/api/towers/');
        const raw = response?.data;
        const list = Array.isArray(raw) ? raw : (raw?.results || []);
        const towerData = list.map(tower => ({
          id: tower.id,
          name: tower.name || tower.tower_name || `Tower ${tower.id}`,
        }));
        setTowers(towerData);

        // Do not auto-select a tower on load. Let the user choose.
      } catch (error) {
        console.error("Error loading towers:", error);
        setTowers([]);
      } finally {
        setLoadingTowers(false);
      }
    };

    loadTowers();
  }, []);

  // Fetch service fees when tower selection changes
  useEffect(() => {
    const loadServiceFees = async () => {
      if (selectedTowers.length === 0) {
        setServiceFees([]);
        return;
      }

      setLoadingServiceFees(true);
      try {
        const towerIds = selectedTowers.join(",");
        const response = await fetchServiceFeesByTowers(towerIds);

        if (response.success) {
          setServiceFees(response.service_fees || []);
        } else {
          console.error("Failed to fetch service fees:", response.message);
          setServiceFees([]);
        }
      } catch (error) {
        console.error("Error loading service fees:", error);
        setServiceFees([]);
      } finally {
        setLoadingServiceFees(false);
      }
    };

    loadServiceFees();
  }, [selectedTowers]);

  // Auto-fetch items when filters change
  useEffect(() => {
    // Prevent fetching while categories are still loading to avoid duplicate calls
    // (one without category, one with category after auto-select)
    if (loadingCategories) return;

    // Build params using whatever filters are available. We intentionally
    // allow any subset of filters so the backend can handle optional params.
    const params = {};
    if (selectedServiceFees && selectedServiceFees.length > 0) params.service_fee_ids = selectedServiceFees.join(',');
    if (selectedTowers && selectedTowers.length > 0) params.tower_ids = selectedTowers.join(',');
    if (selectedMonth && selectedMonth.month) {
      params.month = selectedMonth.month;
      params.year = selectedMonth.year;
    }
    if (category) params.category_id = category;

    // If no filters are set, do not fetch to avoid large result sets.
    if (Object.keys(params).length === 0) return;

    loadBillUploadItems(params);
  }, [selectedServiceFees, selectedTowers, selectedMonth, category, loadingCategories]);

  // Helper to process both API and CSV upload responses
  const processUploadResponse = (data, isCsv = false) => {
    if (!data || !data.success) {
      if (!isCsv) setRows([]);
      return;
    }

    const results = data.results || data.rows || [];
    if (!Array.isArray(results) || results.length === 0) {
      setRows([]);
      setTab("manual");
      return;
    }

    if (data.categories && Array.isArray(data.categories) && data.categories.length > 0) {
      setCategories(data.categories);
      if (!category) setCategory(data.categories[0].id);
    }

    // Filter out rows with errors for the table
    // A row is not loaded if it has backend-provided errors
    const validResults = results.filter(r => !r.errors || r.errors.length === 0);

    // For CSV, we additionally require correct values (amount > 0)
    let finalResults = validResults;
    if (isCsv) {
      finalResults = validResults.filter(r => {
        const amountVal = r.amount ?? r.amountBDT ?? 0;
        return amountVal !== null && amountVal !== undefined && Number(amountVal) > 0;
      });
    }

    // If there are errors, show the validation modal (for CSV only)
    if (isCsv) {
      const allErrors = results
        .filter(r => {
          const hasErrors = r.errors && r.errors.length > 0;
          const invalidAmount = r.amount === null || r.amount === undefined || Number(r.amount) <= 0;
          return hasErrors || invalidAmount;
        })
        .map((r, idx) => {
          const rowErrors = [...(r.errors || [])];
          if (r.amount === null || r.amount === undefined || Number(r.amount) <= 0) {
            if (!rowErrors.includes('Amount must be greater than zero')) {
              rowErrors.push('Amount must be greater than zero');
            }
          }
          return {
            row: r.index || idx + 1,
            unit: r.unit_name || r.unitName || "Unknown Unit",
            errors: rowErrors
          };
        });

      if (allErrors.length > 0) {
        setModalErrors(allErrors);
        setShowErrorModal(true);
      }
    }

    // Load the validated results into the table
    const normalized = finalResults.map(r => ({
      unit_id: r.unit_id ?? r.unitId ?? r.id,
      unit_name: r.unit_name ?? r.unitName ?? r.unit_name,
      tower_name: r.tower_name ?? r.towerName ?? r.towerNumber,
      unit_of_measurement: r.unit_of_measurement ?? r.uom ?? '',
      price_per_unit: r.price_per_unit ?? r.pricePerUnit ?? r.price_per_unit ?? '',
      previous_reading: r.previous_reading ?? r.previousReading ?? r.prevReading ?? '',
      current_reading: r.current_reading ?? r.currentReading ?? '',
      consumption: r.consumption ?? r.consumption ?? '',
      amount: r.amount ?? r.amountBDT ?? r.amount ?? '',
      bill_category_id: r.category_id ?? r.bill_category_id ?? null,
      upload_month: r.upload_month ?? r.uploadMonth ?? selectedMonth.month,
      upload_year: r.upload_year ?? r.uploadYear ?? selectedMonth.year,
      service_fee_id: r.service_fee_id ?? null,
      tower_id: r.tower_id ?? null,
      fee_amount: r.fee_amount ?? r.feeAmount ?? "",
      is_generated: !!r.is_generated, // Capture is_generated flag from backend
      category_name: r.category_name ?? r.categoryName ?? "" // Capture category name for hover title
    }));

    setRows(normalized);
    setInitialRows(isCsv ? [] : normalized.map((r) => ({ ...r })));
    setTab("manual");
  };

  // Reusable loader: fetch items from backend and populate rows
  const loadBillUploadItems = async (params) => {
    try {
      const res = await fetchBillUploadItems(params);
      processUploadResponse(res, false);
    } catch (err) {
      console.error("Error fetching bill upload items:", err);
      setRows([]);
    }
  };

  // Manual grid state
  const [rows, setRows] = useState(() => (demoUnitsByTower[towerId] || []).map(u => ({
    towerNumber: demoTowers.find(t => t.id === towerId)?.towerNumber || '',
    unitName: u.unitName,
    uom: "",
    pricePerUnit: "",
    prevReading: "",
    currentReading: "",
    consumption: "",
    amountBDT: ""
  }))
  );
  // Keep a copy of the rows as they were loaded from the server so we can
  // detect which rows were changed by the user and send only those.
  const [initialRows, setInitialRows] = useState([]);

  // Check if any row differs from its initial server state
  const hasChanges = useMemo(() => {
    if (!rows || rows.length === 0) return false;
    return rows.some((r, i) => {
      if (r.is_generated) return false; // Ignore generated rows
      const init = initialRows[i];
      if (!init) {
        // New rows are considered "changed" if they have any significant value
        return (r.amount && Number(r.amount) !== 0) ||
          (r.current_reading && Number(r.current_reading) !== 0) ||
          (r.unit_of_measurement && r.unit_of_measurement !== '');
      }

      const keysToCheck = ['unit_of_measurement', 'price_per_unit', 'previous_reading', 'current_reading', 'consumption', 'amount', 'bill_category_id'];
      return keysToCheck.some(k => {
        const a = init[k] ?? init[k.replace('_', '')] ?? '';
        const b = r[k] ?? r[k.replace('_', '')] ?? '';

        const numericKeys = ['price_per_unit', 'previous_reading', 'current_reading', 'consumption', 'amount', 'bill_category_id'];
        if (numericKeys.includes(k)) {
          return (Number(a) || 0) !== (Number(b) || 0);
        }
        return String(a ?? "").trim() !== String(b ?? "").trim();
      });
    });
  }, [rows, initialRows]);

  const resetRowsForTower = (tid) => {
    const t = towers.find(t => t.id === tid);
    const tname = t ? (t.name || t.tower_name || `Tower ${tid}`) : '';
    setRows((demoUnitsByTower[tid] || []).map(u => ({
      towerNumber: tname,
      unitName: u.unitName,
      uom: "",
      pricePerUnit: "",
      prevReading: "",
      currentReading: "",
      consumption: "",
      amountBDT: ""
    }))
    );
    // Reset initialRows as well (no server data yet)
    setInitialRows((demoUnitsByTower[tid] || []).map(u => ({
      unit_id: u.id,
      unit_name: u.unitName,
      tower_name: tname,
      unit_of_measurement: "",
      price_per_unit: "",
      previous_reading: "",
      current_reading: "",
      consumption: "",
      amount: "",
      bill_category_id: null,
      upload_month: null,
      upload_year: null,
      fee_amount: ""
    }))
    );
  };

  const downloadTemplate = () => {
    // Build a filter-aware template and pre-fill rows where possible.
    // If `rows` is populated (from CSV or API), use that as the source.
    // Otherwise build rows from selected towers -> units (demo fallback)
    // and selected service fees. Include the fee amount and selected month.
    const headers = ['Tower Name', 'Unit Name', 'Category Name', 'Service Fee', 'Month', 'Year', 'Unit of measurement', 'Price per unit', 'Prev Reading', 'Current Reading', 'Consumption', 'Amount in BDT'];

    // Helper to safely quote CSV values
    const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

    const catName = (categories || []).find(c => String(c.id) === String(category))?.name || '';
    const monthVal = (selectedMonth && selectedMonth.month)
      ? new Date(selectedMonth.year || 2000, Number(selectedMonth.month) - 1).toLocaleString(undefined, { month: 'long' })
      : '';
    const yearVal = selectedMonth?.year || '';

    // Build data rows
    const dataRows = [];

    if (Array.isArray(rows) && rows.length > 0) {
      // Use existing `rows` state as the source
      rows.forEach((r) => {
        if (r.is_generated) return; // Skip items that have already been generated/billed

        const towerName = r.tower_name || r.towerNumber || "";
        // Prefer provided name; otherwise fallback to unit_id as string.
        // Ensure it's a plain trimmed string (no invisible chars or extra spaces).
        let unitName = String(r.unit_name ?? r.unitName ?? (r.unit_id != null ? String(r.unit_id) : '')).trim();

        // Use the per-row fee_amount directly from API response (may be null/empty)
        // and represent it as a trimmed string so CSV cells are consistent.
        const serviceFee = r.fee_amount == null ? '' : String(r.fee_amount).trim();

        // Ensure header fields are strings and trimmed
        const tName = String(towerName).trim();
        const uName = String(unitName).trim();
        const cName = String(catName).trim();
        const mVal = String(monthVal).trim();

        dataRows.push([
          tName,
          uName,
          cName,
          serviceFee,
          mVal,
          yearVal,
          r.unit_of_measurement ?? r.uom ?? 0,
          r.price_per_unit ?? r.pricePerUnit ?? 0,
          r.previous_reading ?? r.previousReading ?? 0,
          r.current_reading ?? r.currentReading ?? 0,
          r.consumption ?? 0,
          r.amount ?? r.amountBDT ?? 0
        ]);
      });
    }

    // Compose CSV: header row followed by data rows (metadata removed)
    const out = [];
    out.push(headers.map(h => q(h)).join(','));
    dataRows.forEach(dr => out.push(dr.map(c => q(c)).join(',')));

    const csv = out.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const filenameMonth = selectedMonth?.year && selectedMonth?.month ? `_${selectedMonth.year}_${String(selectedMonth.month).padStart(2, '0')}` : '';
    a.download = `monthly_bill_template${filenameMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onCsvUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset UI state
    setError("");
    setMessage("");
    setUploadedFileName(file.name);

    // Validate parameters
    // We relax the requirement for pre-selected filters as per user request to rely on CSV content
    if (!selectedMonth.month || !selectedMonth.year) {
      alert("Please select Month and Year before uploading");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    // Send selected filters if available - NO, per user request, we remove reliance on filters.
    // We only send month and year for context.

    formData.append("month", selectedMonth.month);
    formData.append("year", selectedMonth.year);

    try {
      // setMessage('Parsing CSV...');
      const res = await axiosInstance.post(
        "/api/service-fee-management/bill-uploads/csv-parser/",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" }
        }
      );

      if (res.data.success) {
        processUploadResponse(res.data, true);

        // Message only if everything was perfect (no errors)
        const errorCount = (res.data.rows || []).filter(r => (r.errors && r.errors.length > 0) || (r.amount === null || r.amount === undefined || Number(r.amount) <= 0)).length;
        if (errorCount === 0 && res.data.rows?.length > 0) {
          setMessage(`Successfully loaded ${res.data.rows.length} rows from CSV.`);
        }
      } else {
        setError(res.data.message || "Failed to parse CSV");
      }
    } catch (err) {
      console.error("CSV Upload Error:", err);
      // Ensure we catch the 400 Bad Request message here for validation errors
      const errorMsg = err.response?.data?.message || err.message || 'Error uploading CSV';
      setError(errorMsg);
    } finally {
      // Reset file input to allow re-uploading the same file if needed (e.g. after fixing it)
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleCellChange = (idx, key, value) => {
    setRows(prev => prev.map((r, i) => {
      if (i !== idx) return r;

      // Numeric fields that should only accept positive numbers
      const numericFields = ['price_per_unit', 'previous_reading', 'current_reading', 'consumption', 'amount'];

      // Validate numeric fields: only allow positive numbers (no symbols, no negatives)
      if (numericFields.includes(key) && value !== "") {
        // Remove any non-numeric characters except decimal point
        const cleanValue = value.replace(/[^0-9.]/g, "");

        // Check if value is a valid positive number
        if (cleanValue === '' || isNaN(Number(cleanValue)) || Number(cleanValue) < 0) {
          // Invalid input - keep previous value or set to empty
          const newRow = { ...r, errors: [`${key.replace('_', ' ')} must be a positive number`], isValid: false };
          return newRow;
        }

        // Only use cleaned value
        value = cleanValue;
      }

      const newRow = { ...r, [key]: value, errors: [], isValid: true };

      // Auto-calculate consumption and amount based on readings
      const prevReading =
        key === "previous_reading"
          ? Number(value) || 0
          : Number(newRow.previous_reading ?? newRow.previousReading ?? 0) ||
          0;
      const curReading =
        key === "current_reading"
          ? Number(value) || 0
          : Number(newRow.current_reading ?? newRow.currentReading ?? 0) || 0;
      const pricePerUnit =
        key === "price_per_unit"
          ? Number(value) || 0
          : Number(newRow.price_per_unit ?? newRow.pricePerUnit ?? 0) || 0;
      const consumption =
        key === "consumption"
          ? Number(value) || 0
          : curReading - prevReading > 0
            ? curReading - prevReading
            : 0;

      // Auto-calculate amount if consumption or price changed
      let amount = Number(newRow.amount ?? newRow.amountBDT ?? 0) || 0;

      if (key === 'consumption' || key === 'price_per_unit' || key === 'current_reading' || key === 'previous_reading') {
        const calcConsumption = key === 'consumption' ? Number(value) || 0 : consumption;
        amount = (calcConsumption * pricePerUnit) > 0 ? calcConsumption * pricePerUnit : 0;
      } else if (key === 'amount') {
        // Validate amount is not negative
        amount = Number(value) || 0;
        if (amount < 0) {
          newRow.errors = ["Amount cannot be negative"];
          newRow.isValid = false;
          amount = 0;
        }
      }

      newRow.consumption = consumption;
      newRow.amount = amount;
      newRow.amountBDT = amount;

      return newRow;
    }));
  };

  // Update a field and optionally recalculate consumption and amount
  const handleFieldInputChange = (idx, key, value) => {
    setRows(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      // Clear errors on edit
      const newRow = { ...r, [key]: value, errors: [], isValid: true };

      // Normalize keys for calculation
      const price = Number(newRow.price_per_unit ?? newRow.pricePerUnit ?? newRow.pricePerUnitRaw ?? 0) || 0;
      const prevReading = Number(newRow.previous_reading ?? newRow.previousReading ?? newRow.prevReading ?? 0) || 0;
      const curReading = Number(newRow.current_reading ?? newRow.currentReading ?? 0) || 0;

      // Calculate consumption and amount when any of these fields are updated
      const consumption = (curReading - prevReading) > 0 ? (curReading - prevReading) : 0;
      const amount = +(consumption * price).toFixed(0);

      newRow.consumption = consumption;
      // keep both amount and amountBDT in sync for compatibility
      newRow.amount = amount;
      newRow.amountBDT = amount;

      return newRow;
    }));
  };

  const autoCalculate = (idx) => {
    setRows(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      const price = Number(r.pricePerUnit) || 0;
      const prevR = Number(r.prevReading) || 0;
      const curR = Number(r.currentReading) || 0;
      const cons = curR - prevR;
      const amt = cons > 0 ? cons * price : 0;
      return { ...r, consumption: cons || '', amountBDT: amt || '' };
    }));
  };

  // Validate a single row. Returns array of error messages (empty if valid).
  // NOTE: amount is now MANDATORY and must be non-negative.
  // All numeric fields must be positive (no negative values, no symbols)
  const validateRow = (r) => {
    const errs = [];
    if (!r.unit_id && !(r.unit_name || r.unitName)) {
      errs.push("Missing unit identifier");
    }

    // Price per unit validation: NON-NEGATIVE if provided
    const priceVal = r.price_per_unit ?? r.pricePerUnit ?? '';
    if (priceVal !== '' && priceVal !== null && priceVal !== undefined) {
      if (isNaN(Number(priceVal))) {
        errs.push("Price per unit must be a valid number");
      } else if (Number(priceVal) < 0) {
        errs.push("Price per unit cannot be negative");
      }
    }

    // Previous reading validation: NON-NEGATIVE if provided
    const prev = r.previous_reading ?? r.previousReading ?? r.prevReading ?? "";
    if (prev !== "" && prev !== null && prev !== undefined) {
      if (isNaN(Number(prev))) {
        errs.push("Previous reading must be a valid number");
      } else if (Number(prev) < 0) {
        errs.push("Previous reading cannot be negative");
      }
    }

    // Current reading validation: NON-NEGATIVE if provided
    const cur = r.current_reading ?? r.currentReading ?? '';
    if (cur !== '' && cur !== null && cur !== undefined) {
      if (isNaN(Number(cur))) {
        errs.push("Current reading must be a valid number");
      } else if (Number(cur) < 0) {
        errs.push("Current reading cannot be negative");
      }
    }

    // Consumption validation: NON-NEGATIVE if provided
    const consumption = r.consumption ?? '';
    if (consumption !== '' && consumption !== null && consumption !== undefined) {
      if (isNaN(Number(consumption))) {
        errs.push("Consumption must be a valid number");
      } else if (Number(consumption) < 0) {
        errs.push("Consumption cannot be negative");
      }
    }

    // Amount validation: MANDATORY and MUST BE GREATER THAN ZERO
    const amountVal = (r.amount !== undefined && r.amount !== null && r.amount !== '') ? r.amount : (r.amountBDT !== undefined && r.amountBDT !== null && r.amountBDT !== '') ? r.amountBDT : '';
    if (amountVal === '' || amountVal === null || amountVal === undefined) {
      errs.push('Amount must be greater than zero');
    } else if (isNaN(Number(amountVal))) {
      errs.push("Amount must be a valid number");
    } else if (Number(amountVal) <= 0) {
      errs.push("Amount must be greater than zero");
    }

    return errs;
  };

  const submitManual = () => {
    // Build payload for backend; we will only send rows that actually changed
    // if (selectedServiceFees.length === 0 || selectedTowers.length === 0 || !category) {

    //     const message="Please select at least one tower, service fee, and category"
    //     setError(message)
    //     return;
    // }

    // Build a lookup of initial rows by unit_id for quick comparison
    const initByUnit = {};
    initialRows.forEach(ir => {
      if (ir && ir.unit_id) initByUnit[String(ir.unit_id)] = ir;
    });

    const numericKeys = ['price_per_unit', 'previous_reading', 'current_reading', 'consumption', 'amount', 'bill_category_id'];
    const stringKeys = ['unit_of_measurement'];

    const isNumericKey = (k) => numericKeys.includes(k);

    const normalizeCompare = (a, b, key) => {
      // Treat empty/null/undefined and 0 as equivalent for numeric fields
      if (isNumericKey(key)) {
        const aNum = Number(a);
        const bNum = Number(b);
        const aIsNum = !isNaN(aNum);
        const bIsNum = !isNaN(bNum);

        if (aIsNum && bIsNum) return aNum === bNum;

        // if one side is not numeric but the other is 0, treat empty as 0
        if ((!aIsNum && bIsNum) || (aIsNum && !bIsNum)) {
          const num = aIsNum ? aNum : bNum;
          const other = aIsNum ? b : a;
          if (num === 0 && (other === '' || other === null || other === undefined)) return true;
          return false;
        }

        // both not numeric -> compare as trimmed strings
        return String(a ?? "").trim() === String(b ?? "").trim();
      }

      // string keys
      return String(a ?? "").trim() === String(b ?? "").trim();
    };

    if (!hasChanges) {
      setError("No changes to submit");
      return;
    }

    // Filter changed rows by comparing against initial state
    const changedRows = rows.filter((r, i) => {
      if (r.is_generated) return false; // Never include generated rows in submission
      const init = initialRows[i];
      if (!init) return true;

      const keysToCheck = ['unit_of_measurement', 'price_per_unit', 'previous_reading', 'current_reading', 'consumption', 'amount', 'bill_category_id'];
      return keysToCheck.some(k => {
        const a = init[k] ?? init[k.replace('_', '')] ?? '';
        const b = r[k] ?? r[k.replace('_', '')] ?? '';
        return !normalizeCompare(a, b, k);
      });
    });

    // Filter changed rows to get valid ones (with amount > 0)
    // Only include rows where amount is a valid number greater than 0
    const validRows = changedRows.filter(r => {
      const amountVal = (r.amount !== undefined && r.amount !== null && r.amount !== '') ? r.amount : (r.amountBDT !== undefined && r.amountBDT !== null && r.amountBDT !== '') ? r.amountBDT : '';
      const amountNum = amountVal === '' || amountVal === null || amountVal === undefined ? 0 : parseFloat(amountVal);
      return !isNaN(amountNum) && amountNum > 0;
    });

    // Check if there are any valid rows to submit
    if (validRows.length === 0) {
      setError("No rows with valid amounts (greater than zero) to submit");
      return;
    }
    const payload = {
      month: selectedMonth.month,
      year: selectedMonth.year,
      upload_method: "manual",
      file_name: uploadedFileName || null,
      details: validRows
        .map(r => {
          const finalAmount = r.amount === '' || r.amount === null || r.amount === undefined ? 0 : parseFloat(r.amount || r.amountBDT) || 0;
          return {
            service_fee_id: r.service_fee_id ?? selectedServiceFees[0] ?? null,
            tower_id: r.tower_id ?? selectedTowers[0] ?? null,
            bill_category_id: r.bill_category_id ?? r.category_id ?? category,
            unit_id: r.unit_id,
            unit_of_measurement: r.unit_of_measurement || "",
            price_per_unit: parseFloat(r.price_per_unit) || 0,
            previous_reading: parseFloat(r.previous_reading) || 0,
            current_reading: parseFloat(r.current_reading) || 0,
            consumption: parseFloat(r.consumption) || 0,
            amount: finalAmount
          };
        })
        .filter(detail => detail.amount > 0)
    };

    // Check if there are any valid details to send
    if (payload.details.length === 0) {
      setError("No rows with valid amounts (greater than zero) to submit");
      return;
    }

    // Send to backend API using shared axios instance
    console.log('[submitManual] Sending payload:', JSON.stringify(payload, null, 2));

    axiosInstance.post(
      '/api/service-fee-management/bill-uploads/service-fee-items/',
      payload
    )
      .then((res) => {
        console.log("[submitManual] Response received:", res.data);
        if (res.data.success) {
          const skippedRecords = res.data.skipped_records || res.data.data?.skipped_records || [];
          const created = res.data.details_count || 0;
          const updated = res.data.details_updated || 0;

          if (skippedRecords.length > 0) {
            const mainMsg = res.data.message || 'Records were processed with some skips';
            const detailMsgs = skippedRecords.map(rec => `${rec.unit_name || 'Unit'}: ${rec.reason}`);
            setError([mainMsg, ...detailMsgs]);
          } else {
            const msg = created > 0 && updated > 0
              ? `Successfully saved! ${created} details created, ${updated} updated`
              : created > 0
                ? `Successfully saved! ${created} details created`
                : `Successfully saved! ${updated} details updated`;
            setMessage(msg);

            // OPTIMISTIC UPDATE: Mark current state as "clean" immediately to clear dirty/changed flags
            // Only done when there are NO errors/skips
            setInitialRows(rows.map(r => ({ ...r })));
          }

          // Reload data to show updated values from backend
          const params = {};
          if (selectedMonth.month && selectedMonth.year) {
            params.month = selectedMonth.month;
            params.year = selectedMonth.year;
          }
          if (category) params.category_id = category;
          if (selectedTowers.length > 0) params.tower_ids = selectedTowers.join(',');
          if (selectedServiceFees.length > 0) params.service_fee_ids = selectedServiceFees.join(',');

          if (Object.keys(params).length > 0) {
            loadBillUploadItems(params);
          } else {
            // Fallback for CSV upload without filters: mark as clean locally
            setInitialRows(rows.map(r => ({ ...r })));
          }

          // Force reset of file input if present
          const fileInput = document.querySelector('input[type="file"]');
          if (fileInput) fileInput.value = "";
        } else {
          console.error('[submitManual] Server returned success=false:', res.data);
          setError(res.data.message || 'Failed to save bill upload');
        }
      })
      .catch((err) => {
        console.error("[submitManual] Request failed:", err);
        console.error("[submitManual] Response data:", err.response?.data);
        const errMsg = err.response?.data?.message || err.message;
        setError(`Failed to submit: ${errMsg}`);
      });
  };

  // Tower dropdown handlers
  const handleTowerCheckboxChange = (id, isChecked) => {
    if (isChecked) {
      setTempSelectedTowers([...tempSelectedTowers, id]);
    } else {
      setTempSelectedTowers(tempSelectedTowers.filter(tId => tId !== id));
    }
  };

  const handleTowerSelectAll = () => {
    if (tempSelectedTowers.length === towers.length) {
      setTempSelectedTowers([]);
    } else {
      setTempSelectedTowers(towers.map(t => t.id));
    }
  };

  const handleTowerDone = () => {
    if (tempSelectedTowers.length > 0) {
      setSelectedTowers(tempSelectedTowers);
      const firstTowerId = tempSelectedTowers[0];
      resetRowsForTower(firstTowerId);
    }
    setShowTowerDropdown(false);
  };

  const handleTowerClear = () => {
    // Clear both the temporary selection (dropdown) and the applied selection
    // so the button label/count updates immediately. Also clear any loaded
    // rows that were tied to a previously selected tower.
    setTempSelectedTowers([]);
    setSelectedTowers([]);
    setRows([]);
    setInitialRows([]);
  };

  const handleDropdownOpen = () => {
    setTempSelectedTowers(selectedTowers);
    setShowTowerDropdown(!showTowerDropdown);
  };

  const getTowerDisplayText = () => {
    if (selectedTowers.length === 0) return 'Select Tower';
    if (towers.length > 0 && selectedTowers.length === towers.length) return 'All Towers';
    return `${selectedTowers.length} Tower${selectedTowers.length > 1 ? 's' : ''} Selected`;
  };

  // Service Fee dropdown handlers
  const handleServiceFeeCheckboxChange = (id, isChecked) => {
    if (isChecked) {
      setTempSelectedServiceFees([...tempSelectedServiceFees, id]);
    } else {
      setTempSelectedServiceFees(tempSelectedServiceFees.filter(fId => fId !== id));
    }
  };

  const handleServiceFeeSelectAll = () => {
    if (tempSelectedServiceFees.length === serviceFees.length) {
      setTempSelectedServiceFees([]);
    } else {
      setTempSelectedServiceFees(serviceFees.map(f => f.id));
    }
  };

  const handleServiceFeeDone = () => {
    setSelectedServiceFees(tempSelectedServiceFees);
    setShowServiceFeeDropdown(false);
    // The useEffect will automatically fetch items when selectedServiceFees changes
  };

  const handleServiceFeeClear = () => {
    setTempSelectedServiceFees([]);
  };

  const handleServiceFeeDropdownOpen = () => {
    setTempSelectedServiceFees(selectedServiceFees);
    setShowServiceFeeDropdown(!showServiceFeeDropdown);
  };

  const getServiceFeeDisplayText = () => {
    if (selectedServiceFees.length === 0) return 'Select Service Fees';
    if (serviceFees.length > 0 && selectedServiceFees.length === serviceFees.length) return 'All Service Fees';
    return `${selectedServiceFees.length} Fee${selectedServiceFees.length > 1 ? 's' : ''} Selected`;
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showTowerDropdown && !event.target.closest(".tower-dropdown")) {
        setShowTowerDropdown(false);
      }
      if (showServiceFeeDropdown && !event.target.closest('.servicefee-dropdown')) {
        setShowServiceFeeDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showTowerDropdown, showServiceFeeDropdown]);

  const formatMonthYear = (month, year) => {
    if (!month || !year) return "N/A";
    const m = Number(month);
    if (m < 1 || m > 12) return "N/A";

    return `${new Date(year, m - 1).toLocaleString(undefined, {
      month: "long"
    })} ${year}`;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] overflow-y-auto md:overflow-hidden bg-gray-50">
      <div className="p-3 md:p-6 flex flex-col md:h-full md:overflow-hidden">
        <div className="flex-shrink-0"></div>

        {/* Single Main Card */}
        {/* Section 1: Header/Filters Card */}
        <div className="bg-white rounded-lg shadow mb-4 flex-shrink-0">
          <div className="p-3 md:p-4 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <Heading title="Bill Uploads" size="2xl" color="black" />
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded transition text-sm font-medium w-full sm:w-auto ${showFilters ? "bg-primary text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
              >
                <FaFilter /> {showFilters ? "Filters" : "Filter"}
              </button>
            </div>
            {notification && (
              <div className="mt-4 p-3 rounded border-l-4 border-yellow-400 bg-yellow-50 text-yellow-800 relative z-0">
                <div className="flex justify-between items-center">
                  <div className="text-sm">{notification.message}</div>
                  <button onClick={() => setNotification(null)} className="ml-4 text-sm font-semibold text-yellow-800">Dismiss</button>
                </div>
              </div>
            )}
          </div>

          {/* Filters Section (Inside Card) */}
          {showFilters && (
            <div className="border-b border-gray-200 flex-shrink-0 md:flex-shrink-0 relative z-20">
              <div className="p-3 md:p-4">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 md:gap-4 items-end">
                  {/* Category */}
                  <div className="flex-1 min-w-0">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                    <SelectComponent
                      options={categories.map(cat => ({ label: cat.name, value: cat.id }))}
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      disabled={loadingCategories || categories.length === 0}
                      className="!mt-0"
                    />
                  </div>

                  {/* Tower Select - Multi-select Dropdown */}
                  <div className="relative tower-dropdown">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Tower</label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={handleDropdownOpen}
                        className={`w-full h-[42px] pl-3 pr-3 border rounded focus:outline-none text-sm bg-white text-left flex items-center justify-between ${showTowerDropdown
                          ? '!border-primary !shadow-ring-primary'
                          : 'border-gray-300 focus:border-primary focus:shadow-ring-primary'
                          }`}
                      >
                        <span className="truncate text-primary font-medium">
                          {getTowerDisplayText()}
                        </span>
                        <FaCaretDown className={`w-3 h-3 text-primary transition-transform ${showTowerDropdown ? 'rotate-180' : ''}`} />
                      </button>
                      {showTowerDropdown && (
                        <div className="absolute top-full left-0 right-0 z-40 mt-1 bg-white border border-gray-300 rounded shadow-lg overflow-hidden">
                          <div className="max-h-40 overflow-y-auto p-2">
                            {loadingTowers ? (
                              <div className="px-2 py-4 text-center text-sm text-gray-500">
                                Loading towers...
                              </div>
                            ) : towers.length === 0 ? (
                              <div className="px-2 py-4 text-center text-sm text-gray-500">
                                No towers available
                              </div>
                            ) : (
                              <>
                                {/* Select All Option */}
                                <label className="flex items-center px-2 py-2 hover:bg-gray-50 cursor-pointer rounded border-b border-gray-100 mb-1">
                                  <input
                                    type="checkbox"
                                    checked={tempSelectedTowers.length === towers.length}
                                    onChange={handleTowerSelectAll}
                                    className="w-4 h-4 mr-3 text-primary focus:ring-primary accent-primary rounded cursor-pointer"
                                  />
                                  <span className="text-sm text-gray-700 font-medium">Select All</span>
                                </label>
                                {towers.map((tower) => (
                                  <label key={tower.id} className="flex items-center px-2 py-2 hover:bg-gray-50 cursor-pointer rounded">
                                    <input
                                      type="checkbox"
                                      checked={tempSelectedTowers.includes(tower.id)}
                                      onChange={(e) => handleTowerCheckboxChange(tower.id, e.target.checked)}
                                      className="w-4 h-4 mr-3 text-primary focus:ring-primary accent-primary rounded cursor-pointer"
                                    />
                                    <span className="text-sm text-gray-700">{tower.name}</span>
                                  </label>
                                ))}
                              </>
                            )}
                          </div>
                          <div className="flex justify-between gap-2 p-2 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                            <button
                              onClick={handleTowerClear}
                              className="px-4 py-1.5 text-sm font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 rounded transition-colors"
                            >
                              Clear
                            </button>
                            <button
                              onClick={handleTowerDone}
                              className="px-4 py-1.5 text-sm font-medium bg-primary text-white rounded hover:bg-primaryDark transition-colors"
                            >
                              Done
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Service Fee Select - Multi-select Dropdown */}
                  <div className="relative servicefee-dropdown">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Service Fee</label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={handleServiceFeeDropdownOpen}
                        className={`w-full h-[42px] pl-3 pr-3 border rounded focus:outline-none text-sm bg-white text-left flex items-center justify-between ${showServiceFeeDropdown
                          ? '!border-primary !shadow-ring-primary'
                          : 'border-gray-300 focus:border-primary focus:shadow-ring-primary'
                          }`}
                      >
                        <span className="truncate text-primary font-medium">
                          {getServiceFeeDisplayText()}
                        </span>
                        <FaCaretDown className={`w-3 h-3 text-primary transition-transform ${showServiceFeeDropdown ? 'rotate-180' : ''}`} />
                      </button>
                      {showServiceFeeDropdown && (
                        <div className="absolute top-full left-0 right-0 z-40 mt-1 bg-white border border-gray-300 rounded shadow-lg overflow-hidden">
                          <div className="max-h-40 overflow-y-auto p-2">
                            {/* Select All Option */}
                            {loadingServiceFees ? (
                              <div className="px-2 py-4 text-center text-sm text-gray-500">
                                Loading service fees...
                              </div>
                            ) : serviceFees.length === 0 ? (
                              <div className="px-2 py-4 text-center text-sm text-gray-500">
                                No service fees available for selected towers
                              </div>
                            ) : (
                              <>
                                <label className="flex items-center px-2 py-2 hover:bg-gray-50 cursor-pointer rounded border-b border-gray-100 mb-1">
                                  <input
                                    type="checkbox"
                                    checked={tempSelectedServiceFees.length === serviceFees.length}
                                    onChange={handleServiceFeeSelectAll}
                                    className="w-4 h-4 mr-3 text-primary focus:ring-primary accent-primary rounded cursor-pointer"
                                  />
                                  <span className="text-sm text-gray-700 font-medium">Select All</span>
                                </label>
                                {serviceFees.map((fee) => {
                                  // Determine a display tower name for the fee: prefer tower that is selected in UI
                                  let feeTowerDisplay = "";
                                  if (fee.towers && fee.towers.length) {
                                    // try to find tower matching selectedTowers[0]
                                    const matched = fee.towers.find(t => selectedTowers.includes(t.id));
                                    if (matched) feeTowerDisplay = matched.tower_name || '';
                                    else feeTowerDisplay = fee.towers[0].tower_name || '';
                                  }
                                  return (
                                    <label key={fee.id} className="flex items-center px-2 py-2 hover:bg-gray-50 cursor-pointer rounded">
                                      <input
                                        type="checkbox"
                                        checked={tempSelectedServiceFees.includes(fee.id)}
                                        onChange={(e) => handleServiceFeeCheckboxChange(fee.id, e.target.checked)}
                                        className="w-4 h-4 mr-3 text-primary focus:ring-primary accent-primary rounded cursor-pointer"
                                      />
                                      <span className="text-sm text-gray-700">
                                        {feeTowerDisplay ? `${feeTowerDisplay} — ${fee.name}` : fee.name}
                                      </span>
                                    </label>
                                  );
                                })}
                              </>
                            )}
                          </div>
                          <div className="flex justify-between gap-2 p-2 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                            <button
                              onClick={handleServiceFeeClear}
                              className="px-4 py-1.5 text-sm font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 rounded transition-colors"
                            >
                              Clear
                            </button>
                            <button
                              onClick={handleServiceFeeDone}
                              className="px-4 py-1.5 text-sm font-medium bg-primary text-white rounded hover:bg-primaryDark transition-colors"
                            >
                              Done
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Month Picker */}
                  <div className="relative">
                    <MonthYearPicker
                      label="Select Month"
                      value={selectedMonth}
                      onChange={setSelectedMonth}
                      showFutureMonths={true}
                    />
                  </div>

                  {/* Upload Method Tabs */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Upload Method</label>
                    <div className="flex flex-col sm:flex-row border border-gray-300 rounded overflow-hidden w-full h-auto">
                      <button
                        onClick={() => {
                          setTab("manual");
                          // Build current filter params
                          const params = {};
                          if (selectedServiceFees && selectedServiceFees.length > 0) params.service_fee_ids = selectedServiceFees.join(',');
                          if (selectedTowers && selectedTowers.length > 0) params.tower_ids = selectedTowers.join(',');
                          if (selectedMonth && selectedMonth.month) {
                            params.month = selectedMonth.month;
                            params.year = selectedMonth.year;
                          }
                          if (category) params.category_id = category;

                          if (Object.keys(params).length > 0) {
                            // loadBillUploadItems will fetch and use processUploadResponse
                            loadBillUploadItems(params);
                          }
                        }}
                        className={`flex-1 px-3 py-2 text-sm font-medium transition ${tab === 'manual'
                          ? 'bg-primary text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                          }`}
                      >
                        Manual Entry
                      </button>
                      <button
                        onClick={() => setTab('csv')}
                        className={`flex-1 px-3 py-2 text-sm font-medium transition ${tab === 'csv'
                          ? 'bg-primary text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                          }`}
                      >
                        CSV Upload
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Content Card (Manual Entry / CSV Upload) */}
        <div className="bg-white rounded-lg shadow flex flex-col md:flex-1 md:overflow-hidden md:min-h-0">
          {/* CSV Upload Section */}
          {tab === "csv" && (
            <div className="p-4 md:p-6">
              <div className="mb-4">
                <div>
                  <h3 className="font-semibold text-base md:text-lg text-gray-800">Upload CSV File</h3>
                  <p className="text-xs md:text-sm text-gray-600 mt-1">Download the template, fill it with bill data, and upload it back</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
                <button
                  onClick={downloadTemplate}
                  className="px-4 py-2 border border-gray-300 rounded bg-white text-gray-700 hover:bg-gray-50 font-medium transition flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                  <FaDownload /> Download Template
                </button>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                  <label className="px-4 py-2 border border-primary rounded bg-primary text-white hover:bg-primaryHover font-medium cursor-pointer transition flex items-center justify-center gap-2">
                    <FaUpload /> Click to upload CSV
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept=".csv"
                      onChange={onCsvUpload}
                    />
                  </label>
                  {uploadedFileName && (
                    <span className="text-sm font-medium text-gray-700 bg-gray-100 px-3 py-2 rounded w-full sm:w-auto truncate">
                      {uploadedFileName}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded">
                <strong>Required columns:</strong> Tower Name, Unit Name, Category Name, Service Fee Name, Amount in BDT<br />
                <strong>Optional columns:</strong> Unit of measurement, Price per unit, Consumption
              </div>
            </div>
          )}

          {/* Manual Entry Section - Matching Service Fee List Table Style */}
          {tab === "manual" && (
            <div className="flex flex-col md:flex-1 md:overflow-hidden md:min-h-0">
              <div className="p-3 md:p-4 border-b border-gray-200 flex-shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-base md:text-lg text-gray-800">Manual Entry</h3>
                  <p className="text-xs md:text-sm text-gray-600 mt-1">Enter monthly bill data for units in the selected tower</p>
                </div>
                {(canAdd || canEdit) && (
                  <button
                    onClick={submitManual}
                    disabled={!hasChanges}
                    className={`px-6 py-2 rounded font-medium transition flex items-center gap-2 ${hasChanges
                      ? 'bg-primary text-white hover:bg-primaryHover cursor-pointer'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
                      }`}
                  >
                    <FaCheck /> Save
                  </button>
                )}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block flex-1 overflow-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 relative">
                <table className="w-full text-sm min-w-[1000px]">
                  <thead className="bg-gray-100 border-b border-gray-200 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap bg-gray-100">#</th>

                      <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap bg-gray-100">Tower</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap bg-gray-100">Unit</th>

                      <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap bg-gray-100">Month</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap bg-gray-100">UoM</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap bg-gray-100">Price/Unit</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap bg-gray-100">Prev Reading</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap bg-gray-100">Current Reading</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap bg-gray-100">Consumption</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap bg-gray-100">Amount (৳)</th>
                      {/* <th className="px-4 py-3 text-center font-semibold text-gray-700">Actions</th> */}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {rows.map((r, idx) => (
                      <tr
                        key={idx}
                        title={r.is_generated ? `Already generated for ${formatMonthYear(r.upload_month, r.upload_year) || ''}` : ''}
                        className={`transition ${r.is_generated ? 'bg-emerald-50' : r.isValid === false ? 'bg-red-50' : 'hover:bg-gray-50'}`}
                      >
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                          {r.tower_name ?? r.towerNumber ?? ""}
                        </td>

                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                          <div>{r.unit_name ?? r.unitName ?? ""}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                          {formatMonthYear(r.upload_month, r.upload_year)}
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap">
                          <input
                            disabled={r.is_generated || !isEditable}
                            className={`w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 ${r.is_generated ? 'bg-gray-100 text-gray-500 italic cursor-not-allowed' : 'text-gray-700'}`}
                            value={r.unit_of_measurement ?? r.uom ?? r.uni ?? ''}
                            onChange={e => handleCellChange(idx, 'unit_of_measurement', e.target.value)}
                            placeholder="0"
                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <input
                            disabled={r.is_generated || !isEditable}
                            className={`w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 ${r.is_generated ? 'bg-gray-100 text-gray-500 italic cursor-not-allowed' : 'text-gray-700'}`}
                            type="number"
                            step="1"
                            min="0"
                            value={r.price_per_unit ?? r.pricePerUnit ?? ''}
                            onChange={e => handleCellChange(idx, 'price_per_unit', e.target.value)}
                            onKeyDown={e => {
                              // Block minus key, plus key, and other invalid characters
                              if (["-", "+", "e", "E"].includes(e.key)) {
                                e.preventDefault();
                              }
                            }}
                            placeholder="0.00"
                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <input
                            disabled={r.is_generated || !isEditable}
                            className={`w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 ${r.is_generated ? 'bg-gray-100 text-gray-500 italic cursor-not-allowed' : 'text-gray-700'}`}
                            type="number"
                            step="1"
                            min="0"
                            value={r.previous_reading ?? r.previousReading ?? ''}
                            onChange={e => handleCellChange(idx, 'previous_reading', e.target.value)}
                            onKeyDown={e => {
                              if (['-', '+', 'e', 'E'].includes(e.key)) {
                                e.preventDefault();
                              }
                            }}
                            placeholder="0"
                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <input
                            disabled={r.is_generated || !isEditable}
                            className={`w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 ${r.is_generated ? 'bg-gray-100 text-gray-500 italic cursor-not-allowed' : 'text-gray-700'}`}
                            type="number"
                            min="0"
                            value={r.current_reading ?? r.currentReading ?? ''}
                            onChange={e => handleCellChange(idx, 'current_reading', e.target.value)}
                            onKeyDown={e => {
                              if (['-', '+', 'e', 'E'].includes(e.key)) {
                                e.preventDefault();
                              }
                            }}
                            placeholder="0"
                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <input
                            disabled={r.is_generated || !isEditable}
                            className={`w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 ${r.is_generated ? 'bg-gray-100 text-gray-500 italic cursor-not-allowed' : 'text-gray-700'}`}
                            type="number"
                            min="0"
                            value={r.consumption ?? ''}
                            onChange={e => handleCellChange(idx, 'consumption', e.target.value)}
                            onKeyDown={e => {
                              if (['-', '+', 'e', 'E'].includes(e.key)) {
                                e.preventDefault();
                              }
                            }}
                            placeholder="0"
                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <input
                            disabled={r.is_generated || !isEditable}
                            className={`w-28 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 ${r.is_generated ? 'bg-gray-100 text-gray-500 italic cursor-not-allowed' : 'text-gray-700'}`}
                            type="number"
                            step="1"
                            min="0"
                            value={r.amount ?? r.amountBDT ?? ''}
                            onChange={e => handleCellChange(idx, 'amount', e.target.value)}
                            onKeyDown={e => {
                              if (['-', '+', 'e', 'E'].includes(e.key)) {
                                e.preventDefault();
                              }
                            }}
                            placeholder="0.00"
                          />
                        </td>
                        {/* <td className="px-4 py-3 text-center">
                        <button 
                          className="px-3 py-1 bg-primary text-white rounded text-xs hover:bg-primaryHover transition" 
                          onClick={() => autoCalculate(idx)}
                        >
                          Auto-calc
                        </button>
                      </td> */}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden flex-1 p-4 space-y-4">
                {rows.map((r, idx) => (
                  <div key={idx} className={`bg-white border rounded-lg p-4 shadow-sm ${r.isValid === false ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                    <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-200">
                      <div>
                        <p className="text-xs text-gray-500">#{idx + 1}</p>
                        <p className="font-semibold text-gray-900">{r.unit_name ?? r.unitName ?? ''}</p>
                        <p className="text-sm text-gray-600">{r.tower_name ?? r.towerNumber ?? ''}</p>
                      </div>
                      <p className="text-xs text-gray-500">{formatMonthYear(r.upload_month, r.upload_year)}</p>
                    </div>

                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">UoM</label>
                          <input
                            disabled={!isEditable}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-gray-700"
                            value={r.unit_of_measurement ?? r.uom ?? ''}
                            onChange={e => handleCellChange(idx, 'unit_of_measurement', e.target.value)}
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Price/Unit</label>
                          <input
                            disabled={!isEditable}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-gray-700"
                            type="number"
                            step="1"
                            min="0"
                            value={r.price_per_unit ?? r.pricePerUnit ?? ''}
                            onChange={e => handleCellChange(idx, 'price_per_unit', e.target.value)}
                            onKeyDown={e => {
                              if (['-', '+', 'e', 'E'].includes(e.key)) {
                                e.preventDefault();
                              }
                            }}
                            placeholder="0.00"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Prev Reading</label>
                          <input
                            disabled={!isEditable}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-gray-700"
                            type="number"
                            step="1"
                            min="0"
                            value={r.previous_reading ?? r.previousReading ?? ''}
                            onChange={e => handleCellChange(idx, 'previous_reading', e.target.value)}
                            onKeyDown={e => {
                              if (['-', '+', 'e', 'E'].includes(e.key)) {
                                e.preventDefault();
                              }
                            }}
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Current Reading</label>
                          <input
                            disabled={!isEditable}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-gray-700"
                            type="number"
                            min="0"
                            value={r.current_reading ?? r.currentReading ?? ''}
                            onChange={e => handleCellChange(idx, 'current_reading', e.target.value)}
                            onKeyDown={e => {
                              if (['-', '+', 'e', 'E'].includes(e.key)) {
                                e.preventDefault();
                              }
                            }}
                            placeholder="0"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Consumption</label>
                          <input
                            disabled={!isEditable}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-gray-700"
                            type="number"
                            min="0"
                            value={r.consumption ?? ''}
                            onChange={e => handleCellChange(idx, 'consumption', e.target.value)}
                            onKeyDown={e => {
                              if (['-', '+', 'e', 'E'].includes(e.key)) {
                                e.preventDefault();
                              }
                            }}
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Amount (৳)</label>
                          <input
                            disabled={!isEditable}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-gray-700 font-semibold"
                            type="number"
                            step="1"
                            min="0"
                            value={r.amount ?? r.amountBDT ?? ''}
                            onChange={e => handleCellChange(idx, 'amount', e.target.value)}
                            onKeyDown={e => {
                              if (['-', '+', 'e', 'E'].includes(e.key)) {
                                e.preventDefault();
                              }
                            }}
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {rows.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <p>No data available. Please select filters to load data.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <MessageBox
          message={message}
          error={error}
          clearMessage={() => {
            setMessage("");
            setError("");
          }}
        />

        {/* Validation Errors Modal */}
        {showErrorModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
              <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-red-50 rounded-t-lg">
                <h3 className="text-lg font-semibold text-red-700">Validation Errors</h3>
                <button
                  onClick={() => setShowErrorModal(false)}
                  className="text-gray-500 hover:text-gray-700 transition"
                >
                  ✕
                </button>
              </div>
              <div className="p-4 overflow-y-auto flex-1">
                <p className="text-sm text-gray-600 mb-4">
                  The following rows have errors and need attention. Please correct the CSV or manual entries.
                </p>
                <div className="space-y-3">
                  {modalErrors.map((err, idx) => (
                    <div key={idx} className="p-3 bg-red-50 border border-red-100 rounded text-sm">
                      <div className="flex justify-between font-medium text-red-800 mb-1">
                        <span>Row {err.row} — Unit: {err.unit}</span>
                      </div>
                      <ul className="list-disc list-inside text-red-600 pl-2">
                        {err.errors.map((e, i) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4 border-t border-gray-200 flex justify-end">
                <button
                  onClick={() => setShowErrorModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 font-medium transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
