import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { getOrCreateReferralCode, getReferralFromUrl, getReferralCode } from '../utils/referralUtils';
import { useAccount } from 'wagmi';

interface ReferralContextType {
  referralCode: string | null;
  referredBy: string | null;
  totalReferrals: number;
  isNewReferral: boolean;
}

const ReferralContext = createContext<ReferralContextType>({
  referralCode: null,
  referredBy: null,
  totalReferrals: 0,
  isNewReferral: false,
});

export const useReferral = () => useContext(ReferralContext);

interface ReferralProviderProps {
  children: ReactNode;
}

// Cache for referral codes
const referralCodeCache = new Map<string, string>();

export const ReferralProvider: React.FC<ReferralProviderProps> = ({ children }) => {
  const { address, isConnected } = useAccount();
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referredBy, setReferredBy] = useState<string | null>(null);
  const [totalReferrals, setTotalReferrals] = useState<number>(0);
  const [isNewReferral, setIsNewReferral] = useState<boolean>(false);
  const [initialized, setInitialized] = useState<boolean>(false);

  // Load or generate referral code
  const loadReferralCode = useCallback(async (userAddress: string) => {
    // Check if code is cached in memory first
    if (referralCodeCache.has(userAddress)) {
      const cachedCode = referralCodeCache.get(userAddress);
      setReferralCode(cachedCode!);
      
      // Load referral usage stats
      const referralUses = JSON.parse(localStorage.getItem('referral-uses') || '{}');
      setTotalReferrals(referralUses[cachedCode!] || 0);
      return;
    }
    
    // Check if code exists in local storage
    const existingCode = getReferralCode(userAddress);
    if (existingCode) {
      referralCodeCache.set(userAddress, existingCode);
      setReferralCode(existingCode);
      
      // Load referral usage stats
      const referralUses = JSON.parse(localStorage.getItem('referral-uses') || '{}');
      setTotalReferrals(referralUses[existingCode] || 0);
      return;
    }
    
    // Generate new code if none exists
    const newCode = getOrCreateReferralCode(userAddress);
    referralCodeCache.set(userAddress, newCode);
    setReferralCode(newCode);
    
    // Initialize referral usage stats
    const referralUses = JSON.parse(localStorage.getItem('referral-uses') || '{}');
    setTotalReferrals(referralUses[newCode] || 0);
  }, []);

  // Initialize the referral system
  useEffect(() => {
    if (initialized) return;
    
    // Check if user came from a referral link
    const urlReferral = getReferralFromUrl();
    if (urlReferral) {
      setReferredBy(urlReferral);
      setIsNewReferral(localStorage.getItem('referred-processed') !== 'true');
      localStorage.setItem('referred-by', urlReferral);
      
      // Mark as processed to avoid showing new referral UI again
      if (isNewReferral) {
        localStorage.setItem('referred-processed', 'true');
      }
    } else {
      setReferredBy(localStorage.getItem('referred-by'));
    }
    
    setInitialized(true);
  }, [isNewReferral, initialized]);

  // Generate or load referral code when user connects their wallet
  useEffect(() => {
    if (isConnected && address) {
      loadReferralCode(address);
    } else {
      setReferralCode(null);
    }
  }, [isConnected, address, loadReferralCode]);

  return (
    <ReferralContext.Provider value={{ 
      referralCode, 
      referredBy,
      totalReferrals,
      isNewReferral,
    }}>
      {children}
    </ReferralContext.Provider>
  );
}; 