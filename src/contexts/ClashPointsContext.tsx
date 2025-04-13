import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAccount } from 'wagmi';
import { useReferral } from './ReferralContext';

// Define action types that earn Clash Points
export enum CPActionType {
  SOCIAL_SHARE = 'SOCIAL_SHARE',
  REFERRAL = 'REFERRAL',
  TELEGRAM_JOIN = 'TELEGRAM_JOIN',
  X_FOLLOW = 'X_FOLLOW'
}

// Define point values for each action
export const CP_POINT_VALUES = {
  [CPActionType.SOCIAL_SHARE]: 100,
  [CPActionType.REFERRAL]: 1000,
  [CPActionType.TELEGRAM_JOIN]: 500,
  [CPActionType.X_FOLLOW]: 500
};

// Track actions to avoid duplicate awards
export interface CPAction {
  type: CPActionType;
  timestamp: number;
  id: string;
  points: number;
  platform?: 'X' | 'TELEGRAM';
  proof?: string;
}

export interface SocialVerification {
  platform: 'X' | 'TELEGRAM';
  username: string;
  timestamp: number;
  verified: boolean;
  proof?: string;
}

interface ClashPointsContextType {
  totalPoints: number;
  actionsHistory: CPAction[];
  socialVerifications: SocialVerification[];
  awardPoints: (type: CPActionType, id: string, platform?: 'X' | 'TELEGRAM', proof?: string) => void;
  hasPerformedAction: (type: CPActionType, id: string) => boolean;
  addSocialVerification: (verification: SocialVerification) => void;
}

const ClashPointsContext = createContext<ClashPointsContextType>({
  totalPoints: 0,
  actionsHistory: [],
  socialVerifications: [],
  awardPoints: () => {},
  hasPerformedAction: () => false,
  addSocialVerification: () => {}
});

export const useClashPoints = () => useContext(ClashPointsContext);

interface ClashPointsProviderProps {
  children: ReactNode;
}

export const ClashPointsProvider: React.FC<ClashPointsProviderProps> = ({ children }) => {
  const { address } = useAccount();
  const { totalReferrals } = useReferral();
  const [totalPoints, setTotalPoints] = useState<number>(0);
  const [actionsHistory, setActionsHistory] = useState<CPAction[]>([]);
  const [socialVerifications, setSocialVerifications] = useState<SocialVerification[]>([]);

  // Initialize points from localStorage when component mounts or address changes
  useEffect(() => {
    if (address) {
      const storageKey = `clash-points-${address.toLowerCase()}`;
      const storedData = localStorage.getItem(storageKey);
      
      if (storedData) {
        try {
          const parsedData = JSON.parse(storedData);
          setTotalPoints(parsedData.totalPoints || 0);
          setActionsHistory(parsedData.actionsHistory || []);
          setSocialVerifications(parsedData.socialVerifications || []);
        } catch (error) {
          console.error('Error parsing stored Clash Points data:', error);
        }
      }
    } else {
      // Reset points when disconnected
      setTotalPoints(0);
      setActionsHistory([]);
      setSocialVerifications([]);
    }
  }, [address]);

  // Save points to localStorage whenever they change
  useEffect(() => {
    if (address) {
      const storageKey = `clash-points-${address.toLowerCase()}`;
      localStorage.setItem(storageKey, JSON.stringify({
        totalPoints,
        actionsHistory,
        socialVerifications,
        lastUpdated: Date.now()
      }));
    }
  }, [address, totalPoints, actionsHistory, socialVerifications]);

  // Effect to award points for referrals automatically
  useEffect(() => {
    if (address && totalReferrals > 0) {
      const awardedReferrals = actionsHistory.filter(
        action => action.type === CPActionType.REFERRAL
      ).length;
      
      if (totalReferrals > awardedReferrals) {
        const newReferrals = totalReferrals - awardedReferrals;
        const pointsToAward = newReferrals * CP_POINT_VALUES[CPActionType.REFERRAL];
        
        const newActions: CPAction[] = [];
        for (let i = 0; i < newReferrals; i++) {
          newActions.push({
            type: CPActionType.REFERRAL,
            timestamp: Date.now(),
            id: `referral-${awardedReferrals + i + 1}`,
            points: CP_POINT_VALUES[CPActionType.REFERRAL]
          });
        }
        
        setTotalPoints(prev => prev + pointsToAward);
        setActionsHistory(prev => [...prev, ...newActions]);
      }
    }
  }, [address, totalReferrals, actionsHistory]);

  // Check if user has already performed an action
  const hasPerformedAction = (type: CPActionType, id: string): boolean => {
    return actionsHistory.some(action => action.type === type && action.id === id);
  };

  // Award points for an action
  const awardPoints = (type: CPActionType, id: string, platform?: 'X' | 'TELEGRAM', proof?: string) => {
    if (hasPerformedAction(type, id)) {
      return;
    }
    
    const pointsToAdd = CP_POINT_VALUES[type];
    const newAction: CPAction = {
      type,
      timestamp: Date.now(),
      id,
      points: pointsToAdd,
      platform,
      proof
    };
    
    setTotalPoints(prev => prev + pointsToAdd);
    setActionsHistory(prev => [...prev, newAction]);
  };

  // Add social verification
  const addSocialVerification = (verification: SocialVerification) => {
    setSocialVerifications(prev => [...prev, verification]);
  };

  return (
    <ClashPointsContext.Provider value={{
      totalPoints,
      actionsHistory,
      socialVerifications,
      awardPoints,
      hasPerformedAction,
      addSocialVerification
    }}>
      {children}
    </ClashPointsContext.Provider>
  );
}; 