// Query deduplication y rate limiting global
const queryCache = new Map();
const pendingQueries = new Map();
const RATE_LIMIT_MS = 1000; // Mínimo 1 segundo entre consultas iguales
const lastQueryTime = new Map();

/**
 * Wrapper para Supabase que previene consultas duplicadas
 * y aplica rate limiting automático
 */
export function dedupeQuery(queryKey, queryFn) {
  // Si ya hay una consulta pendiente con la misma key, retornar esa promesa
  if (pendingQueries.has(queryKey)) {
    console.log(`🔄 Reutilizando consulta pendiente: ${queryKey}`);
    return pendingQueries.get(queryKey);
  }

  // Verificar rate limiting
  const lastTime = lastQueryTime.get(queryKey);
  if (lastTime && Date.now() - lastTime < RATE_LIMIT_MS) {
    console.log(`⏱️ Rate limit aplicado para: ${queryKey}`);
    // Retornar datos cacheados si existen
    if (queryCache.has(queryKey)) {
      return Promise.resolve(queryCache.get(queryKey));
    }
  }

  // Ejecutar la consulta
  const promise = queryFn()
    .then(result => {
      queryCache.set(queryKey, result);
      lastQueryTime.set(queryKey, Date.now());
      pendingQueries.delete(queryKey);
      return result;
    })
    .catch(error => {
      pendingQueries.delete(queryKey);
      throw error;
    });

  pendingQueries.set(queryKey, promise);
  return promise;
}

/**
 * Limpiar caché de consultas
 */
export function clearQueryCache(pattern = null) {
  if (pattern) {
    // Limpiar solo las keys que coincidan con el patrón
    for (const key of queryCache.keys()) {
      if (key.includes(pattern)) {
        queryCache.delete(key);
        lastQueryTime.delete(key);
      }
    }
  } else {
    // Limpiar todo
    queryCache.clear();
    lastQueryTime.clear();
  }
  pendingQueries.clear();
}

/**
 * Hook para limpiar caché cuando se crean/actualizan/eliminan datos
 */
export function useQueryInvalidation() {
  return {
    invalidate: clearQueryCache,
    invalidatePattern: (pattern) => clearQueryCache(pattern)
  };
}
