/**
 * Maps Firebase auth error codes to user-friendly messages
 */
export function mapAuthError(error: any): string {
  const code = error?.code || '';
  
  // Email/Password errors
  if (code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return 'Invalid email or password';
  }
  
  if (code === 'auth/invalid-email') {
    return 'Please enter a valid email address';
  }
  
  if (code === 'auth/email-already-in-use') {
    return 'An account with this email already exists';
  }
  
  if (code === 'auth/weak-password') {
    return 'Password must be at least 6 characters';
  }
  
  if (code === 'auth/too-many-requests') {
    return 'Too many attempts. Please try again later';
  }
  
  // Provider errors
  if (code === 'auth/account-exists-with-different-credential') {
    return 'An account already exists with this email using a different sign-in method';
  }
  
  if (code === 'auth/invalid-credential') {
    return 'Invalid credentials. Please try again';
  }
  
  // Network errors
  if (code === 'auth/network-request-failed') {
    return 'Network error. Please check your connection';
  }
  
  // User cancellations - these should not show error alerts
  if (code === 'auth/popup-closed-by-user' || 
      code === 'auth/cancelled-popup-request' ||
      code === 'ERR_REQUEST_CANCELED' ||
      error?.message?.includes('user cancelled')) {
    return 'CANCELLED'; // Special flag for UI to ignore
  }
  
  // Default
  return error?.message || 'Authentication failed. Please try again';
}

/**
 * Checks if the error was a user cancellation (should not show error alert)
 */
export function isUserCancellation(error: any): boolean {
  return mapAuthError(error) === 'CANCELLED';
}
