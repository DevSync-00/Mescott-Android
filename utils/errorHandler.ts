// Simple error handling utility
export const handleError = (error: any, context: string): Error => {
  console.error(`Error in ${context}:`, error);
  
  if (error instanceof Error) {
    return error;
  }
  
  if (typeof error === 'string') {
    return new Error(error);
  }
  
  if (error?.message) {
    return new Error(error.message);
  }
  
  return new Error(`An error occurred in ${context}`);
};

export const formatPhoneNumber = (phone: string): string => {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '251' + cleaned.substring(1);
  }
  if (!cleaned.startsWith('251') && !cleaned.startsWith('+')) {
    cleaned = '251' + cleaned;
  }
  return '+' + cleaned;
};

export const isValidPhoneNumber = (phone: string): boolean => {
  const formatted = formatPhoneNumber(phone);
  return /^\+251[0-9]{9}$/.test(formatted);
};
