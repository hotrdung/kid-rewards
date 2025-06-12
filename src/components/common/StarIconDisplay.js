// src/components/common/StarIconDisplay.js
import React from 'react';
import { Star } from 'lucide-react';

const StarIconDisplay = ({ count, className = "text-yellow-400", size = 18 }) => {
    if (count <= 0) return null;
    return (
        <span className="flex items-center">
            {Array.from({ length: count }).map((_, i) => (
                <Star key={i} size={size} className={`${className} fill-current mr-0.5`} />
            ))}
        </span>
    );
};
export default StarIconDisplay;