// Responsive table wrapper component
export default function ResponsiveTable({ children, className = '' }) {
    return (
        <div className={`bg-white shadow overflow-hidden sm:rounded-lg ${className}`}>
            <div className="overflow-x-auto">
                {children}
            </div>
        </div>
    );
}

// Mobile card view for table rows
export function MobileCard({ title, items, actions }) {
    return (
        <div className="bg-white p-4 rounded-lg shadow mb-4 sm:hidden hover-lift">
            <div className="flex justify-between items-start mb-3">
                <h3 className="font-medium text-gray-900">{title}</h3>
                {actions && <div className="flex gap-2">{actions}</div>}
            </div>
            <div className="space-y-2">
                {items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                        <span className="text-gray-500">{item.label}:</span>
                        <span className="text-gray-900 font-medium">{item.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
