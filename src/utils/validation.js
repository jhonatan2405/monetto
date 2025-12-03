// Validation utilities
export const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

export const validatePassword = (password) => {
  // Min 8 chars, at least 1 uppercase, 1 number
  const minLength = password.length >= 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  
  return {
    isValid: minLength && hasUpperCase && hasNumber,
    errors: {
      minLength: !minLength ? 'Mínimo 8 caracteres' : null,
      hasUpperCase: !hasUpperCase ? 'Al menos 1 mayúscula' : null,
      hasNumber: !hasNumber ? 'Al menos 1 número' : null
    }
  };
};

export const validateAmount = (amount) => {
  const num = parseFloat(amount);
  if (isNaN(num)) return { isValid: false, error: 'Debe ser un número válido' };
  if (num <= 0) return { isValid: false, error: 'Debe ser mayor a 0' };
  if (num > 1000000000) return { isValid: false, error: 'Monto demasiado grande' };
  
  // Check max 2 decimals
  const decimals = (amount.toString().split('.')[1] || '').length;
  if (decimals > 2) return { isValid: false, error: 'Máximo 2 decimales' };
  
  return { isValid: true, error: null };
};

export const validateDate = (date, allowFuture = false) => {
  const selectedDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (!allowFuture && selectedDate > today) {
    return { isValid: false, error: 'No se permiten fechas futuras' };
  }
  
  return { isValid: true, error: null };
};

export const validateDateRange = (startDate, endDate) => {
  if (!startDate || !endDate) return { isValid: true, error: null };
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (start > end) {
    return { isValid: false, error: 'Fecha inicio debe ser menor a fecha fin' };
  }
  
  return { isValid: true, error: null };
};

export const validateFile = (file, maxSizeMB = 5) => {
  if (!file) return { isValid: true, error: null };
  
  // Check file type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'];
  if (!allowedTypes.includes(file.type)) {
    return { isValid: false, error: 'Solo se permiten imágenes (JPG, PNG, GIF) y PDFs' };
  }
  
  // Check file size
  const maxSize = maxSizeMB * 1024 * 1024; // Convert to bytes
  if (file.size > maxSize) {
    return { isValid: false, error: `El archivo no debe superar ${maxSizeMB}MB` };
  }
  
  return { isValid: true, error: null };
};

export const validateTextLength = (text, maxLength = 500) => {
  if (!text) return { isValid: true, error: null };
  
  if (text.length > maxLength) {
    return { isValid: false, error: `Máximo ${maxLength} caracteres` };
  }
  
  return { isValid: true, error: null };
};

// Check if employee can edit record (within 7 days)
export const canEditRecord = (recordDate, userRole) => {
  if (userRole === 'admin') return true;
  
  const record = new Date(recordDate);
  const today = new Date();
  const diffTime = Math.abs(today - record);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays <= 7;
};
