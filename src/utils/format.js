export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

// Format date-only fields (no time component)
// Use this for database 'date' fields to avoid timezone issues
export const formatDateOnly = (dateString) => {
  if (!dateString) return '';
  // Parse as local date to avoid timezone conversion
  const [year, month, day] = dateString.split('T')[0].split('-');
  return `${day}/${month}/${year}`;
};

// Format date with time in Colombian timezone
// Use this for database 'timestamptz' fields (like created_at)
export const formatDateTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('es-CO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Bogota'
  }).format(date);
};

// Format timestamp for display (date + time)
// Use this to show when a transaction was created
export const formatDateTimeLocal = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  
  const dateStr = new Intl.DateTimeFormat('es-CO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'America/Bogota'
  }).format(date);
  
  const timeStr = new Intl.DateTimeFormat('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Bogota'
  }).format(date);
  
  return `${dateStr} ${timeStr}`;
};

// Format time only (no date)
// Use this to show only the time component
export const formatTimeOnly = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  
  return new Intl.DateTimeFormat('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Bogota'
  }).format(date);
};

// Export data to CSV with proper Excel compatibility
// Uses semicolon delimiter for Spanish Excel
export const exportToCSV = (data, filename) => {
  if (!data || data.length === 0) {
    return;
  }

  // Get headers from first object
  const headers = Object.keys(data[0]);
  
  // Create CSV content with proper escaping
  // IMPORTANT: Use semicolon (;) as delimiter for Spanish Excel
  const csvRows = [];
  
  // Add headers
  csvRows.push(headers.map(escapeCSVValue).join(';'));
  
  // Add data rows
  data.forEach(row => {
    const values = headers.map(header => {
      const value = row[header];
      return escapeCSVValue(value);
    });
    csvRows.push(values.join(';'));
  });
  
  const csv = csvRows.join('\r\n');
  
  // Add UTF-8 BOM for Excel compatibility
  const BOM = '\uFEFF';
  const csvWithBOM = BOM + csv;
  
  // Create blob and download
  const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Helper function to escape CSV values properly
function escapeCSVValue(value) {
  if (value === null || value === undefined) return '';
  
  const stringValue = String(value);
  
  // Always quote values that contain semicolons, quotes, or newlines
  if (stringValue.includes(';') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  
  return stringValue;
}

// Download file from URL (handles Supabase storage files)
export const downloadFile = async (url, filename) => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename || 'download';
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
  } catch (error) {
    console.error('Error downloading file:', error);
    throw error;
  }
};

// Check if URL is a PDF file
export const isPDF = (url) => {
  if (!url) return false;
  // Check file extension (remove query parameters first)
  const urlWithoutParams = url.split('?')[0];
  return urlWithoutParams.toLowerCase().endsWith('.pdf');
};
