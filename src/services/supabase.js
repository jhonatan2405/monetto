import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Create Supabase client with timeout and auto-reconnect configuration
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  global: {
    headers: {
      'x-client-info': 'supabase-js-web'
    }
  },
  db: {
    schema: 'public'
  },
  // Add timeout for queries (30 seconds)
  realtime: {
    timeout: 30000
  }
});

// Monitor connection health
let isOnline = navigator.onLine;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;

window.addEventListener('online', () => {
  console.log('🟢 Conexión restaurada');
  isOnline = true;
  reconnectAttempts = 0;
});

window.addEventListener('offline', () => {
  console.log('🔴 Conexión perdida');
  isOnline = false;
});

// Helper function to add timeout to any query
// Default timeout increased to 60s for complex queries with multiple joins
export const withTimeout = (promise, timeoutMs = 60000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Query timeout - la consulta tardó demasiado')), timeoutMs)
    )
  ]);
};

// Helper function to retry failed queries with exponential backoff
export const withRetry = async (fn, maxRetries = 3, initialDelay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      // Check if online before attempting
      if (!isOnline && i === 0) {
        throw new Error('Sin conexión a internet');
      }

      return await fn();
    } catch (error) {
      const isLastAttempt = i === maxRetries - 1;
      
      // Don't retry on certain errors
      const shouldNotRetry = 
        error.message?.includes('JWT') || 
        error.message?.includes('auth') ||
        error.code === 'PGRST116' || // Row not found
        error.code === '23505'; // Unique violation
      
      if (isLastAttempt || shouldNotRetry) {
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delay = initialDelay * Math.pow(2, i);
      console.warn(`⚠️ Reintento ${i + 1}/${maxRetries} después de error:`, error.message);
      console.warn(`⏳ Esperando ${delay}ms antes de reintentar...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Increment reconnect attempts
      reconnectAttempts++;
      
      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error('❌ Máximo de intentos de reconexión alcanzado');
        throw new Error('No se pudo establecer conexión con el servidor. Por favor, recarga la página.');
      }
    }
  }
};

// Helper to check connection health
export const checkConnection = async () => {
  try {
    const { error } = await withTimeout(
      supabase.from('categorias').select('id').limit(1),
      5000
    );
    return !error;
  } catch {
    return false;
  }
};

