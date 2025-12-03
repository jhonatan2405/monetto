import { Loader2 } from 'lucide-react';

export default function LoadingSpinner({ size = 'md', text = 'Cargando...' }) {
    const sizes = {
        sm: 'h-4 w-4',
        md: 'h-8 w-8',
        lg: 'h-12 w-12',
        xl: 'h-16 w-16'
    };

    return (
        <div className="flex flex-col items-center justify-center p-8 animate-fadeIn">
            <Loader2 className={`${sizes[size]} text-primary-600 animate-spin`} />
            {text && <p className="mt-3 text-sm text-gray-500">{text}</p>}
        </div>
    );
}
