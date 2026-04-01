import React from 'react';
import { Controller } from 'react-hook-form';
import ModernDatePicker from '../../../../Components/FormComponent/ModernDatePicker';
import { Clock } from 'lucide-react';

/**
 * AnnouncementVisibility Component
 * Handles start/end date and time selection with status classification
 */
const AnnouncementVisibility = ({ control, errors, setValue, watch }) => {
  const startDate = watch('startDate');
  const startTime = watch('startTime');
  const endDate = watch('endDate');
  const endTime = watch('endTime');

  // Generate time options (24-hour format)
  const generateTimeOptions = () => {
    const times = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        times.push(timeString);
      }
    }
    return times;
  };

  const timeOptions = generateTimeOptions();

  // Get announcement status based on dates and times
  const getAnnouncementStatus = () => {
    if (!startDate || !startTime || !endDate || !endTime) {
      return {
        status: 'draft',
        textClass: 'text-slate-500',
        dotClass: 'bg-slate-500',
        bgClass: 'bg-slate-50'
      };
    }

    const now = new Date();

    // Convert Date objects to YYYY-MM-DD format for consistent parsing
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    const startDateTime = new Date(`${startDateStr}T${startTime}`);
    const endDateTime = new Date(`${endDateStr}T${endTime}`);

    if (now < startDateTime) {
      return {
        status: 'Upcoming',
        textClass: 'text-amber-600',
        dotClass: 'bg-amber-500',
        bgClass: 'bg-amber-50'
      };
    } else if (now >= startDateTime && now <= endDateTime) {
      return {
        status: 'On-Going',
        textClass: 'text-emerald-600',
        dotClass: 'bg-emerald-500',
        bgClass: 'bg-emerald-50'
      };
    } else {
      return {
        status: 'Expired',
        textClass: 'text-red-600',
        dotClass: 'bg-red-500',
        bgClass: 'bg-red-50'
      };
    }
  };

  const statusInfo = getAnnouncementStatus();

  // Custom time input component
  const TimeInput = ({ value, onChange, placeholder, error }) => (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary appearance-none bg-white"
      >
        <option value="">{placeholder}</option>
        {timeOptions.map((time) => (
          <option key={time} value={time}>
            {time}
          </option>
        ))}
      </select>
      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
        <Clock className="w-4 h-4 text-primary" />
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-600">{error.message}</p>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Start Date and Time */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Start Date <span className="text-primary">*</span>
          </label>
          <Controller
            name="startDate"
            control={control}
            render={({ field: { onChange, value } }) => {
              // Convert Date object to YYYY-MM-DD string if needed
              const dateValue = value instanceof Date 
                ? value.toISOString().split('T')[0] 
                : (value || "");
              
              return (
                <ModernDatePicker
                  label=""
                  value={dateValue}
                  onChange={(dateStr) => {
                    // Convert YYYY-MM-DD string to Date object for form
                    onChange(dateStr ? new Date(dateStr) : null);
                  }}
                  placeholder="Select start date"
                  name="startDate"
                  error={errors.startDate?.message || ""}
                  required
                  inputClassName="h-[38px]"
                  maxYearOffset={10}
                  minDate={new Date().toISOString().split('T')[0]}
                />
              );
            }}
          />
          {errors.startDate && (
            <p className="mt-1 text-sm text-red-600">{errors.startDate.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Start Time <span className="text-primary">*</span>
          </label>
          <Controller
            name="startTime"
            control={control}
            render={({ field: { onChange, value } }) => (
              <TimeInput
                value={value}
                onChange={onChange}
                placeholder="Select start time"
                error={errors.startTime}
              />
            )}
          />
        </div>
      </div>

      {/* End Date and Time */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            End Date <span className="text-primary">*</span>
          </label>
          <Controller
            name="endDate"
            control={control}
            render={({ field: { onChange, value } }) => {
              // Convert Date object to YYYY-MM-DD string if needed
              const dateValue = value instanceof Date 
                ? value.toISOString().split('T')[0] 
                : (value || "");
              
              // Get minDate from startDate
              const minDateValue = startDate instanceof Date
                ? startDate.toISOString().split('T')[0]
                : (startDate || new Date().toISOString().split('T')[0]);
              
              return (
                <ModernDatePicker
                  label=""
                  value={dateValue}
                  onChange={(dateStr) => {
                    // Convert YYYY-MM-DD string to Date object for form
                    onChange(dateStr ? new Date(dateStr) : null);
                  }}
                  placeholder="Select end date"
                  name="endDate"
                  error={errors.endDate?.message || ""}
                  required
                  inputClassName="h-[38px]"
                  maxYearOffset={10}
                  minDate={minDateValue}
                />
              );
            }}
          />
          {errors.endDate && (
            <p className="mt-1 text-sm text-red-600">{errors.endDate.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            End Time <span className="text-primary">*</span>
          </label>
          <Controller
            name="endTime"
            control={control}
            render={({ field: { onChange, value } }) => (
              <TimeInput
                value={value}
                onChange={onChange}
                placeholder="Select end time"
                error={errors.endTime}
              />
            )}
          />
        </div>
      </div>

      {/* Status Preview */}
      {statusInfo.status !== 'draft' && (
        <div className={`p-4 rounded-md border ${statusInfo.bgClass}`}>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${statusInfo.dotClass}`} />
            <span className={`text-sm font-medium ${statusInfo.textClass}`}>
              Status: {statusInfo.status}
            </span>
          </div>
          <p className="text-xs text-gray-600 mt-2">
            {statusInfo.status === 'Upcoming' && 'This announcement will be active in the future.'}
            {statusInfo.status === 'On-Going' && 'This announcement is currently active.'}
            {statusInfo.status === 'Expired' && 'This announcement has ended.'}
          </p>
        </div>
      )}
    </div>
  );
};

export default AnnouncementVisibility;
