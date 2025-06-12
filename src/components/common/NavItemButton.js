// src/components/common/NavItemButton.js
import React from 'react';

const NavItemButton = ({ tabName, icon: Icon, label, count, isMoreItem = false, currentActiveTab, onTabClick }) => {
    const isActive = currentActiveTab === tabName;

    console.log(`NavItemButton - tabName: ${tabName}, currentActiveTab: ${currentActiveTab}, isActive: ${isActive}`);
    let buttonClasses = "flex items-center w-full text-left px-3 py-2 rounded-lg transition-colors duration-150 text-sm ";
    if (isActive) {
        buttonClasses += isMoreItem ? 'bg-purple-500 text-white' : 'bg-purple-600 text-white shadow-md';
    } else {
        buttonClasses += 'text-gray-600 hover:bg-purple-100';
    }

    return (
        <button
            onClick={() => onTabClick(tabName, isMoreItem)}
            className={buttonClasses}
        >
            {Icon && <Icon size={18} className="mr-2 flex-shrink-0" />}
            <span className="flex-grow">{label}</span>
            {count > 0 && (
                <span className="ml-2 bg-red-500 text-white text-xs font-semibold px-1.5 py-0.5 rounded-full">
                    {count}
                </span>
            )}
        </button>
    );
};
export default NavItemButton;