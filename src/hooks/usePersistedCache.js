import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook para cachear datos con persistencia en localStorage
 * Evita consultas repetidas al cambiar de pestaña
 */
export function usePersistedCache(fetchFunction, dependencies = [], options = {}) {
  const {
    ttl = 5 * 60 * 1000, // 5 minutos por defecto
    cacheKey = null,
    enabled = true,
    persist = true // Nuevo: persistir en localStorage
  } = options;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const abortControllerRef = useRef(null);
  const lastFetchTimeRef = useRef(null);
  const isMountedRef = useRef(true);

  const getCacheKey = useCallback(() => {
    if (cacheKey) return cacheKey;
    return `cache_${JSON.stringify(dependencies)}`;
  }, [cacheKey, dependencies]);

  // Cargar desde localStorage al montar
  useEffect(() => {
    if (!persist) return;

    const key = getCacheKey();
    const stored = localStorage.getItem(key);
    const timeKey = `${key}_time`;
    const storedTime = localStorage.getItem(timeKey);

    if (stored && storedTime) {
      const age = Date.now() - parseInt(storedTime);
      if (age < ttl) {
        try {
          const parsed = JSON.parse(stored);
          setData(parsed);
          setLoading(false);
          lastFetchTimeRef.current = parseInt(storedTime);
          return;
        } catch (e) {
          console.error('Error parsing cached data:', e);
        }
      }
    }
  }, []);

  const clearCache = useCallback(() => {
    const key = getCacheKey();
    localStorage.removeItem(key);
    localStorage.removeItem(`${key}_time`);
    lastFetchTimeRef.current = null;
    setData(null);
  }, [getCacheKey]);

  const fetchData = useCallback(async (force = false) => {
    if (!enabled || !isMountedRef.current) return;

    const key = getCacheKey();
    const now = Date.now();

    // Verificar caché en memoria primero
    if (!force && data && lastFetchTimeRef.current) {
      const age = now - lastFetchTimeRef.current;
      if (age < ttl) {
        setLoading(false);
        return;
      }
    }

    // Cancelar consulta anterior si existe
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Crear nuevo AbortController
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      setError(null);

      const result = await fetchFunction(abortControllerRef.current.signal);
      
      // Solo actualizar si no fue cancelado y el componente está montado
      if (!abortControllerRef.current.signal.aborted && isMountedRef.current) {
        setData(result);
        lastFetchTimeRef.current = now;

        // Persistir en localStorage
        if (persist) {
          try {
            localStorage.setItem(key, JSON.stringify(result));
            localStorage.setItem(`${key}_time`, now.toString());
          } catch (e) {
            console.warn('Error saving to localStorage:', e);
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError' && isMountedRef.current) {
        console.error('Error fetching data:', err);
        setError(err);
      }
    } finally {
      if (!abortControllerRef.current?.signal.aborted && isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [enabled, fetchFunction, getCacheKey, ttl, persist, data]);

  const refetch = useCallback(() => {
    return fetchData(true);
  }, [fetchData]);

  useEffect(() => {
    isMountedRef.current = true;
    
    // Solo hacer fetch si no hay datos en caché
    if (!data) {
      fetchData();
    }

    // Cleanup: cancelar consultas pendientes
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch,
    clearCache
  };
}
