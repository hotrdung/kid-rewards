// src/components/common/DayOfWeekSelector.js
import React from 'react';
import { DAYS_OF_WEEK, DAY_LABELS_SHORT } from '../../constants/dateTime';

const DayOfWeekSelector = ({ selectedDays, onChange, name = "daysOfWeek" }) => {
    const toggleDay = (day) => {
        const newSelectedDays = selectedDays.includes(day)
            ? selectedDays.filter(d => d !== day)
            : [...selectedDays, day];
        onChange({ target: { name, value: newSelectedDays } });
    };
    return (
        <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Days of Week (for Weekly)</label>
            <div className="flex space-x-1 sm:space-x-2">
                {DAYS_OF_WEEK.map((day, index) => (
                    <button
                        type="button"
                        key={day}
                        onClick={() => toggleDay(day)}
                        className={`px-2 py-1.5 sm:px-3 sm:py-2 rounded-md border text-xs sm:text-sm font-medium transition-colors w-full ${selectedDays.includes(day) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300'}`}
                    >
                        {DAY_LABELS_SHORT[index]}
                    </button>
                ))}
            </div>
        </div>
    );
};
export default DayOfWeekSelector;