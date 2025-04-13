import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useReferral } from '../contexts/ReferralContext';
import { Toast } from './Toast';
import SocialShareButton from './SocialShareButton';

interface ReferralStatsProps {
  className?: string;
}

const ReferralStats: React.FC<ReferralStatsProps> = ({ className = '' }) => {
  const { referralCode, totalReferrals } = useReferral();
  const [showToast, setShowToast] = useState(false);
  
  const handleCopyReferralLink = async () => {
    if (!referralCode) return;
    
    const referralLink = `${window.location.origin}?ref=${referralCode}`;
    await navigator.clipboard.writeText(referralLink);
    setShowToast(true);
  };
  
  if (!referralCode) return null;
  
  return (
    <div className={`bg-gray-800 rounded-xl p-4 ${className}`}>
      <h3 className="text-lg font-medium mb-3">Your Referrals</h3>
      
      {/* Stats */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-center">
          <p className="text-sm text-gray-400">Total Referrals</p>
          <p className="text-xl font-semibold text-purple-400">{totalReferrals}</p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-400">Referral Code</p>
          <p className="text-xl font-semibold text-purple-400">{referralCode}</p>
        </div>
      </div>
      
      {/* Actions */}
      <div className="space-y-2">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleCopyReferralLink}
          className="w-full py-2 bg-purple-500/20 hover:bg-purple-500/30 text-white rounded-lg transition-all border border-purple-500/30 hover:border-purple-500/50 text-sm font-medium flex items-center justify-center gap-2"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="16" 
            height="16" 
            fill="currentColor" 
            viewBox="0 0 16 16"
            className="w-4 h-4"
          >
            <path d="M4.715 6.542 3.343 7.914a3 3 0 1 0 4.243 4.243l1.828-1.829A3 3 0 0 0 8.586 5.5L8 6.086a1.002 1.002 0 0 0-.154.199 2 2 0 0 1 .861 3.337L6.88 11.45a2 2 0 1 1-2.83-2.83l.793-.792a4.018 4.018 0 0 1-.128-1.287z"/>
            <path d="M6.586 4.672A3 3 0 0 0 7.414 9.5l.775-.776a2 2 0 0 1-.896-3.346L9.12 3.55a2 2 0 1 1 2.83 2.83l-.793.792c.112.42.155.855.128 1.287l1.372-1.372a3 3 0 1 0-4.243-4.243L6.586 4.672z"/>
          </svg>
          Copy Referral Link
        </motion.button>
        
        <SocialShareButton
          type="clash"
          position={0}
          referralCode={referralCode || undefined}
        />
      </div>
      
      <Toast
        message="Referral link copied to clipboard!"
        isVisible={showToast}
        onClose={() => setShowToast(false)}
      />
    </div>
  );
};

export default ReferralStats; 