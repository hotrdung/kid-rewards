// src/components/common/InputField.js
import React from 'react';

const InputField = ({ label, type = 'text', value, onChange, placeholder, required = false, name, min, max, className = '' }) => (
    <div className="mb-4">
        {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
        <input
            type={type}
            name={name}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            required={required}
            min={min}
            max={max}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${className}`}
        />
    </div>
);

export default InputField;