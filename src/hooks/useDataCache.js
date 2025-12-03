import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook para cachear datos y evitar consultas repetidas
 * @param {Function} fetchFunction - Función que obtiene los datos
 * @param {Array} dependencies - Dependencias que invalidan el caché
 * @param {Object} options - Opciones de configuración
 * @returns {Object} - { data, loading, error, refetch, clearCache }
 */
export function useDataCache(fetchFunction, dependencies = [], options = {}) {
  const {
    ttl = 5 * 60 * 1000, // 5 minutos por defecto
    cacheKey = null,
    enabled = true
  } = options;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const cacheRef = useRef(new Map());
  const abortControllerRef = useRef(null);
  const lastFetchTimeRef = useRef(null);

  const getCacheKey = useCallback(() => {
    if (cacheKey) return cacheKey;
    return JSON.stringify(dependencies);
  }, [cacheKey, dependencies]);

  const clearCache = useCallback(() => {
    const key = getCacheKey();
    cacheRef.current.delete(key);
    lastFetchTimeRef.current = null;
  }, [getCacheKey]);

  const fetchData = useCallback(async (force = false) => {
    if (!enabled) return;

    const key = getCacheKey();
    const now = Date.now();
    const cached = cacheRef.current.get(key);

    // Usar caché si existe y no ha expirado
    if (!force && cached && lastFetchTimeRef.current) {
      const age = now - lastFetchTimeRef.current;
      if (age < ttl) {
        setData(cached);
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
      
      // Solo actualizar si no fue cancelado
      if (!abortControllerRef.current.signal.aborted) {
        cacheRef.current.set(key, result);
        lastFetchTimeRef.current = now;
        setData(result);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error fetching data:', err);
        setError(err);
      }
    } finally {
      if (!abortControllerRef.current?.signal.aborted) {
        setLoading(false);
      }
    }
  }, [enabled, fetchFunction, getCacheKey, ttl]);

  const refetch = useCallback(() => {
    return fetchData(true);
  }, [fetchData]);

  useEffect(() => {
    fetchData();

    // Cleanup: cancelar consultas pendientes
    return () => {
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
