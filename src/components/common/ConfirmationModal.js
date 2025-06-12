// src/components/common/ConfirmationModal.js
import React from 'react';
import Modal from './Modal';
import Button from './Button';
import { AlertTriangle } from 'lucide-react';

const ConfirmationModal = ({
    isOpen,
    onClose,
    title,
    message,
    onConfirm, // This will now receive modalUiState: (modalUiState) => void
    confirmText = "Confirm",
    cancelText = "Cancel",
    children, // This will be the render function: (uiState, setUiState) => JSX
    modalUiState, // UI state specific to the modal's content
    setModalUiState // Function to update modalUiState
}) => {
    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} size="max-w-md">
            {message && <p className="text-gray-600 mb-6">{message}</p>}
            {children && typeof children === 'function' && <div className="mb-4">{children(modalUiState, setModalUiState)}</div>}
            <div className="flex justify-end space-x-3">
                <Button onClick={onClose} className="bg-gray-300 hover:bg-gray-400 text-gray-800" icon={null}>
                    {cancelText}
                </Button>
                <Button onClick={() => onConfirm(modalUiState)} className="bg-red-500 hover:bg-red-600" icon={AlertTriangle}>
                    {confirmText}
                </Button>
            </div>
        </Modal>
    );
};
export default ConfirmationModal;