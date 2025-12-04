import { useEffect, useCallback } from 'react';

/**
 * Hook para detectar cuando el usuario vuelve a la pestaña
 * y ejecutar una función de recarga
 */
export function usePageVisibility(onVisible) {
  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'visible') {
      console.log('📱 Usuario volvió a la pestaña - recargando datos...');
      onVisible();
    }
  }, [onVisible]);

  useEffect(() => {
    // Escuchar cambios de visibilidad
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Escuchar cuando la ventana recibe foco
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [handleVisibilityChange]);
}

/**
 * Hook para auto-refrescar datos cada X tiempo
 */
export function useAutoRefresh(callback, intervalMs = 30000) {
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        console.log('🔄 Auto-refresh ejecutado');
        callback();
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [callback, intervalMs]);
}
