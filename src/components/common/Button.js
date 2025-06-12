// src/components/common/Button.js
import React from 'react';

const Button = ({ onClick, children, className = 'bg-blue-500 hover:bg-blue-600', icon: Icon, disabled = false, type = "button", title }) => (
    <button
        type={type}
        onClick={onClick}
        disabled={disabled}
        title={title}
        className={`flex items-center justify-center text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-opacity-50 ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
        {Icon && <Icon size={18} className="mr-2" />}
        {children}
    </button>
);

export default Button;
