import React from 'react';
import PropTypes from 'prop-types';
import MonthYearPicker from './MonthYearPicker';

const DateRangePicker = ({ label, fromValue, toValue, onChange }) => {
  return (
    <div className="flex flex-col">
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <div className="flex space-x-2">
        <MonthYearPicker
          label="From"
          value={fromValue}
          onChange={(value) => onChange(value, 'from')}
        />
        <MonthYearPicker
          label="To"
          value={toValue}
          onChange={(value) => onChange(value, 'to')}
        />
      </div>
    </div>
  );
};

DateRangePicker.propTypes = {
  label: PropTypes.string.isRequired,
  fromValue: PropTypes.object.isRequired,
  toValue: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
};

export default DateRangePicker;
