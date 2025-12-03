import { useEffect, useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';

export default function ConnectionStatus() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [showOffline, setShowOffline] = useState(false);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            setShowOffline(false);
        };

        const handleOffline = () => {
            setIsOnline(false);
            setShowOffline(true);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Auto-hide offline message after 5 seconds when back online
    useEffect(() => {
        if (isOnline && showOffline) {
            const timer = setTimeout(() => setShowOffline(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [isOnline, showOffline]);

    if (!showOffline && isOnline) return null;

    return (
        <div
            className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 transition-all duration-300 ${isOnline
                    ? 'bg-green-500 text-white animate-slideInRight'
                    : 'bg-red-500 text-white animate-pulse'
                }`}
        >
            {isOnline ? (
                <>
                    <Wifi className="h-5 w-5" />
                    <span className="font-medium">Conexión restaurada</span>
                </>
            ) : (
                <>
                    <WifiOff className="h-5 w-5" />
                    <span className="font-medium">Sin conexión a internet</span>
                </>
            )}
        </div>
    );
}
