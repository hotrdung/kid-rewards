// src/components/common/SelectField.js
import React from 'react';

const SelectField = ({ label, value, onChange, options, placeholder, name, required = false, className = '' }) => (
    <div className="mb-4">
        {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
        <select
            name={name}
            value={value}
            onChange={onChange}
            required={required}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${className}`}
        >
            {placeholder && <option value="">{placeholder}</option>}
            {options.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
            ))}
        </select>
    </div>
);

export default SelectField;