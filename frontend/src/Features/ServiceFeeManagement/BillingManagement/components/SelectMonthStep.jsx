import { BsCalendar, BsChevronLeft, BsChevronRight } from 'react-icons/bs';
import { IoCheckmarkCircle } from 'react-icons/io5';

const SelectMonthStep = ({ selectedMonth, onMonthSelect, availableMonths, onNext, onPrev, monthOffset }) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <BsCalendar className="w-5 h-5 text-gray-700" />
            <h2 className="text-lg md:text-xl font-semibold text-gray-900">Select Billing Month</h2>
          </div>
          <p className="text-gray-600 text-sm">
            Choose the month for which you want to generate bills.
          </p>
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onPrev}
            className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 transition-all text-gray-600 shadow-sm"
            title="Older Months"
          >
            <BsChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={onNext}
            disabled={monthOffset >= 0}
            className={`p-2 rounded-lg border transition-all shadow-sm ${monthOffset >= 0
              ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
              : 'border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 text-gray-600'
              }`}
            title="Newer Months"
          >
            <BsChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {availableMonths.map((month) => {
          const isSelected = selectedMonth === month.value;
          return (
            <button
              key={month.value}
              onClick={() => onMonthSelect(month.value)}
              className={`relative p-4 rounded-lg border-2 transition-all text-left cursor-pointer ${isSelected
                ? 'border-teal-500 bg-white shadow-sm'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                }`}
            >
              <span className="font-medium text-gray-900 block pr-8">{month.value}</span>
              {isSelected ? (
                <IoCheckmarkCircle className="absolute top-3 right-3 w-5 h-5 text-teal-500" />
              ) : (
                <BsCalendar className="absolute top-3 right-3 w-4 h-4 text-gray-400" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SelectMonthStep;
