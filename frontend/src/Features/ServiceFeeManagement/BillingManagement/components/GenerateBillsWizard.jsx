import { useState, useEffect, useRef } from 'react';
import {
  BsCalendar,
  BsBuildings,
  BsClipboardData,
  BsFlag,
  BsChevronRight,
  BsChevronLeft,
  BsCheckCircle
} from 'react-icons/bs';
import { IoCheckmarkCircle } from 'react-icons/io5';
import axiosInstance from '../../../../utils/axiosInstance';
import { fetchBillCategories } from '../../../../api/billCategoriesApi';
import SelectMonthStep from './SelectMonthStep';
import SelectScopeStep from './SelectScopeStep';
import ReviewStep from './ReviewStep';
import ConfirmStep from './ConfirmStep';
import MessageBox from '../../../../Components/MessageBox/MessageBox';

const GenerateBillsWizard = ({ onClose, onBillsGenerated }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [monthOffset, setMonthOffset] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Step 2 - Select Scope state
  const [towers, setTowers] = useState([]);
  const [selectedTower, setSelectedTower] = useState(null);
  const [units, setUnits] = useState([]);
  const [selectedUnits, setSelectedUnits] = useState([]);
  const [billCategories, setBillCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [loadingTowers, setLoadingTowers] = useState(false);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadedTowerId, setLoadedTowerId] = useState(null); // Track which tower's units are loaded
  const [lastFetchedMonth, setLastFetchedMonth] = useState(null); // Track which month's counts were fetched

  const fetchedRef = useRef(null); // Ref-based lock for duplicate towers call
  const fetchedUnitsRef = useRef(null); // Ref-based lock for duplicate units call
  const fetchedCategoriesRef = useRef(null); // Ref-based lock for duplicate categories call

  // Generate months based on offset - show current and past months only
  const getAvailableMonths = (offset = 0) => {
    const months = [];
    const today = new Date();
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    for (let i = 0; i < 6; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() + offset - i, 1);
      months.push({
        month: monthNames[date.getMonth()],
        year: date.getFullYear(),
        value: `${monthNames[date.getMonth()]} ${date.getFullYear()}`,
        date: date
      });
    }
    return months;
  };

  const availableMonths = getAvailableMonths(monthOffset);

  const handleNext6Months = () => setMonthOffset(prev => Math.min(0, prev + 6));
  const handlePrev6Months = () => setMonthOffset(prev => prev - 6);

  const steps = [
    { id: 1, name: 'Select Month', icon: BsCalendar },
    { id: 2, name: 'Select Scope', icon: BsBuildings },
    { id: 3, name: 'Review', icon: BsClipboardData },
    { id: 4, name: 'Confirm', icon: BsFlag }
  ];

  // Fetch towers when step 2 is reached or month changes
  useEffect(() => {
    if (currentStep === 2 && selectedMonth && selectedMonth !== fetchedRef.current) {
      fetchedRef.current = selectedMonth;
      fetchTowers();
      setLastFetchedMonth(selectedMonth);
    }
  }, [currentStep, selectedMonth]);

  // Fetch units/categories when tower is selected
  useEffect(() => {
    if (selectedTower && currentStep === 2) {
      const monthParts = selectedMonth ? availableMonths.find(m => m.value === selectedMonth) : null;
      const monthKey = monthParts ? `${monthParts.month}_${monthParts.year}` : 'none';
      const towersKey = `${selectedTower}_${monthKey}`;

      const selectedObj = towers.find(t =>
        String(t.id) === String(selectedTower) ||
        String(t.service_fee_id) === String(selectedTower) ||
        String(t.tower_id) === String(selectedTower)
      );

      if (selectedObj) {
        const unitsFromServiceFee = selectedObj.units || selectedObj.all_units || [];
        setUnits(unitsFromServiceFee);
        const serviceFeeIdToUse = selectedObj.service_fee_id || selectedObj.id || null;

        if (serviceFeeIdToUse && fetchedCategoriesRef.current !== `${serviceFeeIdToUse}_${towersKey}`) {
          fetchedCategoriesRef.current = `${serviceFeeIdToUse}_${towersKey}`;
          fetchBillCategoriesData(serviceFeeIdToUse);
        }
        setLoadingUnits(false);
      } else {
        if (towersKey !== fetchedUnitsRef.current) {
          fetchedUnitsRef.current = towersKey;
          fetchUnits(selectedTower, monthParts);
        }
      }
    }
  }, [selectedTower, currentStep, towers, selectedMonth, availableMonths]);

  const fetchTowers = async () => {
    try {
      setLoadingTowers(true);
      let queryParams = '';
      if (selectedMonth) {
        let month, year;
        const monthData = availableMonths.find(m => m.value === selectedMonth);
        if (monthData) {
          month = monthData.date.getMonth() + 1;
          year = monthData.date.getFullYear();
        } else {
          const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
          const parts = selectedMonth.split(' ');
          if (parts.length === 2) {
            const mIndex = monthNames.indexOf(parts[0]);
            const yVal = parseInt(parts[1]);
            if (mIndex !== -1 && !isNaN(yVal)) {
              month = mIndex + 1;
              year = yVal;
            }
          }
        }
        if (month && year) queryParams = `?month=${month}&year=${year}`;
      }

      const response = await axiosInstance.get(`/api/service-fee-management/service-fee-unit-counts/${queryParams}`);
      setTowers(response.data?.data || response.data || []);
    } catch (error) {
      console.error('Error fetching towers:', error);
      setTowers([]);
    } finally {
      setLoadingTowers(false);
    }
  };

  const fetchUnits = async (towerId, monthParts = null) => {
    try {
      setLoadingUnits(true);
      let url = `/api/service-fees/tower-units/?tower_ids=${towerId}`;
      if (monthParts) {
        url += `&month=${monthParts.date.getMonth() + 1}&year=${monthParts.date.getFullYear()}`;
      }
      const response = await axiosInstance.get(url);
      setUnits(response.data?.data || response.data?.results || response.data || []);
      setLoadedTowerId(`${towerId}_${monthParts ? `${monthParts.month}_${monthParts.year}` : 'none'}`);
    } catch (error) {
      console.error('Error fetching units:', error);
      setUnits([]);
    } finally {
      setLoadingUnits(false);
    }
  };

  const fetchBillCategoriesData = async (serviceFeeId = null) => {
    try {
      setLoadingCategories(true);
      const params = { is_active: true };
      if (selectedTower) {
        const selectedScopeObj = towers.find(t => String(t.service_fee_id || t.id) === String(selectedTower));
        const primaryTower = selectedScopeObj?.towers?.[0] || {};
        const targetTowerId = primaryTower.id || selectedScopeObj?.tower_id || selectedTower;
        if (targetTowerId) params.tower_id = targetTowerId;
      }
      if (selectedUnits && selectedUnits.length > 0) {
        params.unit_ids = selectedUnits.join(',');
      }
      if (serviceFeeId) params.service_fee_id = serviceFeeId;
      if (selectedMonth) {
        const monthData = availableMonths.find(m => m.value === selectedMonth);
        if (monthData) {
          params.month = monthData.date.getMonth() + 1;
          params.year = monthData.date.getFullYear();
        }
      }
      const data = await fetchBillCategories(params);
      setBillCategories(Array.isArray(data) ? data : (data?.data || data?.results || []));
    } catch (error) {
      console.error('Error fetching bill categories:', error);
      setBillCategories([]);
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleUnitToggle = (unitId) => {
    setSelectedUnits(prev => prev.includes(unitId) ? prev.filter(id => id !== unitId) : [...prev, unitId]);
  };

  const handleSelectAllUnits = () => {
    setSelectedUnits(selectedUnits.length === units.length ? [] : units.map(u => u.id));
  };

  const handleCategoryToggle = (categoryId) => {
    setSelectedCategories(prev => prev.includes(categoryId) ? prev.filter(id => id !== categoryId) : [...prev, categoryId]);
  };

  const handleTowerSelect = (towerId) => {
    if (String(selectedTower) !== String(towerId)) {
      setSelectedUnits([]);
      setSelectedCategories([]);
      setUnits([]);
      setBillCategories([]);
      setLoadedTowerId(null);
      fetchedUnitsRef.current = null;
      fetchedCategoriesRef.current = null;
    }
    setSelectedTower(towerId);
  };

  const handleMonthSelect = (monthValue) => {
    if (monthValue !== selectedMonth) {
      setSelectedTower(null);
      setUnits([]);
      setSelectedUnits([]);
      setSelectedCategories([]);
      setTowers([]);
      setLoadedTowerId(null);
      setLastFetchedMonth(null);
      fetchedRef.current = null;
      fetchedUnitsRef.current = null;
      fetchedCategoriesRef.current = null;
    }
    setSelectedMonth(monthValue);
  };

  const handleContinue = () => {
    if (currentStep === 1 && !selectedMonth) return;
    if (currentStep === 2 && (!selectedTower || selectedUnits.length === 0)) return;
    if (currentStep === 3) handleConfirm();
    else if (currentStep < 4) setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const clearMessage = () => {
    setSuccessMessage('');
    setErrorMessage('');
  };

  const handleConfirm = async () => {
    setIsGenerating(true);
    try {
      const monthData = availableMonths.find(m => m.value === selectedMonth);
      if (!monthData) throw new Error('Invalid month selection');
      const year = monthData.date.getFullYear();
      const month = monthData.date.getMonth() + 1;
      const selectedScopeObj = towers.find(t => String(t.service_fee_id || t.id) === String(selectedTower));
      const targetTowerId = (selectedScopeObj?.towers?.[0]?.id) || selectedScopeObj?.tower_id || selectedTower;

      const payload = {
        year, month, tower_id: targetTowerId,
        unit_ids: selectedUnits.join(','),
        force_regenerate: false
      };
      if (selectedScopeObj?.service_fee_id) payload.service_fee_ids = String(selectedScopeObj.service_fee_id);
      if (selectedCategories.length > 0) payload.bill_category_ids = selectedCategories.join(',');

      const response = await axiosInstance.post('/api/service-fee-management/generate-service-fee/', payload);
      if (response.data?.success) {
        if (onBillsGenerated) onBillsGenerated();
        const skipped = response.data.skipped_records || response.data.data?.skipped_records || [];
        if (skipped.length > 0) {
          setErrorMessage([response.data.message || 'Skipped records found', ...skipped.map(rec => `${rec.unit_name}: ${rec.reason}`)]);
        } else {
          setSuccessMessage(response.data?.message || 'Success!');
          setCurrentStep(4);
        }
      } else throw new Error(response.data?.message || 'Failed');
    } catch (error) {
      setErrorMessage(error.response?.data?.message || error.message || 'Error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateMore = () => {
    setCurrentStep(1);
    setSelectedMonth(null);
    setSelectedTower(null);
    setSelectedUnits([]);
    setSelectedCategories([]);
    setUnits([]);
    setBillCategories([]);
    setLoadedTowerId(null);
    setLastFetchedMonth(null);
    fetchedRef.current = null;
    fetchedUnitsRef.current = null;
    fetchedCategoriesRef.current = null;
  };

  // Merge bill categories into units for display and calculation
  const getUnitsWithCategories = () => {
    return units.map(unit => {
      // Priority 0: If unit already has bill_categories property (even if empty []), 
      // it means the backend has provided the specific bills. Trust it.
      if (unit.bill_categories && Array.isArray(unit.bill_categories)) {
        return unit;
      }

      // Otherwise, find matching categories from billCategories state
      const unitCategories = billCategories
        .map(cat => {
          // Robust ID comparison (handle string vs number)
          const targetUnitId = String(unit.id);
          const hasDetails = cat.unit_details && Array.isArray(cat.unit_details) && cat.unit_details.length > 0;

          // Priority 1: Check unit_details for specific unit amount
          if (hasDetails) {
            const unitDetail = cat.unit_details.find(ud => String(ud.unit_id) === targetUnitId);
            if (unitDetail) {
              return {
                id: cat.id,
                category_id: cat.id,
                name: cat.name,
                category_name: cat.name,
                amount: Number(unitDetail.amount) || 0,
                icon: cat.icon
              };
            }
            // If unit_details exist for this category but current unit isn't in it, 
            // it means there is no bill for this unit (must be 0, don't fallback to default)
            return {
              id: cat.id,
              category_id: cat.id,
              name: cat.name,
              category_name: cat.name,
              amount: 0,
              icon: cat.icon
            };
          }

          // Priority 2: Fallback to global category amount (ONLY if no unit_details exist at all for this category)
          if (cat.amount !== undefined) {
            return {
              id: cat.id,
              category_id: cat.id,
              name: cat.name,
              category_name: cat.name,
              amount: Number(cat.amount) || 0,
              icon: cat.icon
            };
          }

          return null;
        })
        .filter(Boolean);

      return {
        ...unit,
        bill_categories: unitCategories
      };
    });
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <SelectMonthStep
            selectedMonth={selectedMonth}
            onMonthSelect={handleMonthSelect}
            availableMonths={availableMonths}
            onNext={handleNext6Months}
            onPrev={handlePrev6Months}
            monthOffset={monthOffset}
          />
        );
      case 2:
        return (
          <SelectScopeStep
            towers={towers} selectedTower={selectedTower} onTowerSelect={handleTowerSelect}
            units={units} selectedUnits={selectedUnits} onUnitToggle={handleUnitToggle} onSelectAllUnits={handleSelectAllUnits}
            billCategories={billCategories} selectedCategories={selectedCategories} onCategoryToggle={handleCategoryToggle}
            loadingTowers={loadingTowers} loadingUnits={loadingUnits} loadingCategories={loadingCategories}
          />
        );
      case 3:
        return (
          <ReviewStep
            selectedMonth={selectedMonth} towers={towers} selectedTower={selectedTower}
            units={getUnitsWithCategories()} selectedUnits={selectedUnits} billCategories={billCategories} selectedCategories={selectedCategories}
          />
        );
      case 4:
        return (
          <ConfirmStep
            selectedMonth={selectedMonth} towers={towers} selectedTower={selectedTower}
            units={getUnitsWithCategories()} selectedUnits={selectedUnits} selectedCategories={selectedCategories}
            onViewBillsList={onClose} onGenerateMore={handleGenerateMore}
          />
        );
      default: return null;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-8">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = currentStep === step.id;
          const isCompleted = currentStep > step.id;
          return (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isActive ? 'bg-teal-500 text-white' : isCompleted ? 'bg-teal-500 text-white shadow-md' : 'bg-gray-100 text-gray-400'}`}>
                  {isCompleted ? <IoCheckmarkCircle className="w-6 h-6 text-white" /> : <Icon className="w-5 h-5" />}
                </div>
                <span className={`mt-2 text-xs font-semibold ${isActive || isCompleted ? 'text-teal-600' : 'text-gray-400'}`}>{step.name}</span>
              </div>
              {index < steps.length - 1 && <div className="mx-2"><BsChevronRight className={`w-4 h-4 ${isCompleted ? 'text-teal-500' : 'text-gray-300'}`} /></div>}
            </div>
          );
        })}
      </div>
      <div className="mb-6">{renderStepContent()}</div>
      {currentStep !== 4 && (
        <div className={`flex gap-3 pt-4 border-t border-gray-200 ${currentStep === 1 ? 'justify-end' : 'justify-between'}`}>
          {currentStep > 1 && <button onClick={handleBack} className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium">Back</button>}
          <div className={currentStep > 1 ? 'ml-auto' : ''}>
            <button onClick={handleContinue} disabled={isGenerating || (currentStep === 1 && !selectedMonth) || (currentStep === 2 && (!selectedTower || selectedUnits.length === 0))} className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-colors bg-teal-500 text-white hover:bg-teal-600 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed">
              {currentStep === 3 ? <><BsCheckCircle className="w-4 h-4" />{isGenerating ? 'Generating...' : `Generate ${selectedUnits.length} Bills`}</> : <>Continue<BsChevronRight className="w-4 h-4" /></>}
            </button>
          </div>
        </div>
      )}
      <MessageBox message={successMessage} error={errorMessage} clearMessage={clearMessage} />
    </div>
  );
};

export default GenerateBillsWizard;
