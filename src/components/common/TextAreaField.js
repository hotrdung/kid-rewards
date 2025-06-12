// src/components/common/TextAreaField.js
import React from 'react';

const TextAreaField = ({ label, value, onChange, placeholder, name, rows = 3, className = '' }) => (
    <div className="mb-4">
        {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
        <textarea
            name={name}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            rows={rows}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${className}`}
        />
    </div>
);

export default TextAreaField;