// src/components/common/Card.js
import React from 'react';

const Card = ({ children, className = '' }) => (
    <div className={`bg-white shadow-lg rounded-xl p-6 ${className}`}>
        {children}
    </div>
);
export default Card;