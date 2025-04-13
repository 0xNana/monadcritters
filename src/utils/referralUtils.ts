import { keccak256, stringToHex } from 'viem';

/**
 * Generates a referral code based on user's address and current timestamp
 * @param address User's wallet address
 * @returns A short referral code
 */
export const generateReferralCode = (address: string): string => {
  // Create a hash based on address and current timestamp for uniqueness
  const hash = keccak256(
    stringToHex(`${address}-${Date.now()}`)
  );
  
  // Convert to a shorter, URL-friendly code (8 characters)
  return hash.slice(2, 10);
};

/**
 * Stores the user's referral code in local storage
 * @param address User's wallet address
 * @param code Referral code
 */
export const storeReferralCode = (address: string, code: string): void => {
  localStorage.setItem(`referral-code-${address.toLowerCase()}`, code);
};

/**
 * Retrieves the user's referral code from local storage
 * @param address User's wallet address
 * @returns The stored referral code or null if not found
 */
export const getReferralCode = (address: string): string | null => {
  return localStorage.getItem(`referral-code-${address.toLowerCase()}`);
};

/**
 * Creates or retrieves a referral code for the user
 * @param address User's wallet address
 * @returns A referral code
 */
export const getOrCreateReferralCode = (address: string): string => {
  let code = getReferralCode(address);
  
  if (!code) {
    code = generateReferralCode(address);
    storeReferralCode(address, code);
  }
  
  return code;
};

/**
 * Tracks a referral when someone joins via a referral link
 * @param referralCode The referral code used
 */
export const trackReferralUse = (referralCode: string): void => {
  // Get existing referral uses
  const referralUses = JSON.parse(localStorage.getItem('referral-uses') || '{}');
  
  // Increment the count for this code
  referralUses[referralCode] = (referralUses[referralCode] || 0) + 1;
  
  // Store updated counts
  localStorage.setItem('referral-uses', JSON.stringify(referralUses));
};

/**
 * Gets the referral code from the URL if present
 * @returns The referral code from URL or null
 */
export const getReferralFromUrl = (): string | null => {
  const params = new URLSearchParams(window.location.search);
  return params.get('ref');
};

/**
 * Process incoming referral from URL
 * Should be called on app initialization
 */
export const processIncomingReferral = (): void => {
  const referralCode = getReferralFromUrl();
  
  if (referralCode) {
    // Store that this user came from a referral
    localStorage.setItem('referred-by', referralCode);
    
    // Track the referral use
    trackReferralUse(referralCode);
  }
}; 