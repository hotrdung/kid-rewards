// src/components/common/Modal.js
import React from 'react';

const Modal = ({ isOpen, onClose, title, children, size = "max-w-md" }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
            <div
                className={`bg-white p-6 rounded-lg shadow-xl w-full ${size} max-h-[90vh] overflow-y-auto`}
            >
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold text-gray-700">{title}</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
                </div>
                {children}
            </div>
        </div>
    );
};
export default Modal;