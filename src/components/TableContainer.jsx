import React from 'react';

export default function TableContainer({ children, className = '' }) {
    return (
        <div className={`bg-white shadow overflow-hidden sm:rounded-lg ${className}`}>
            <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                {children}
            </div>
        </div>
    );
}
