import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useClashPoints, CPActionType } from '../contexts/ClashPointsContext';
import { Toast } from './Toast';

interface SocialShareButtonProps {
  type: 'race' | 'clash';
  position: number;
  reward?: string;
  referralCode?: string;
}

const SocialShareButton: React.FC<SocialShareButtonProps> = ({
  type,
  position,
  reward,
  referralCode,
}) => {
  const isWinner = position === 1;
  const { awardPoints, hasPerformedAction } = useClashPoints();
  const [showPointsToast, setShowPointsToast] = useState(false);
  
  const getShareText = (): string => {
    const baseUrl = window.location.origin;
    const gameType = type.charAt(0).toUpperCase() + type.slice(1);
    
    let shareText = '';
    
    // More exciting messages based on position
    if (isWinner) {
      if (reward) {
        // Random winner messages with reward
        const winnerMessages = [
          `🏆 BOOM! Just won ${reward} MON in Clash of Critters, the FIRST NFT betting arena on Monad! 💰`,
          `🚀 Just crushed a ${gameType} and won ${reward} MON in Clash of Critters - first ever NFT betting arena on Monad! 💸`,
          `💎 ${reward} MON winner! Just dominated in Clash of Critters - Monad's first NFT betting arena! Who's next?`
        ];
        shareText = winnerMessages[Math.floor(Math.random() * winnerMessages.length)];
      } else {
        // Winner but no specific reward amount
        const generalWinMessages = [
          `🏆 Just claimed victory in Clash of Critters, the FIRST NFT betting arena on Monad! Who dares challenge me next? 🔥`,
          `🚀 Victorious in Clash of Critters - pioneering NFT betting on Monad! My critters are unstoppable!`,
          `💯 Winning feels good! Just took first place in Clash of Critters, Monad's premiere NFT betting arena!`
        ];
        shareText = generalWinMessages[Math.floor(Math.random() * generalWinMessages.length)];
      }
    } else if (position === 2) {
      // Second place messages
      const runnerUpMessages = [
        `🥈 So close! Just got runner-up in Clash of Critters, the first NFT betting arena on Monad!`,
        `🔥 Second place in Clash of Critters on Monad! Almost had it - coming for that top spot next time!`,
        `👀 Just missed the top prize in Clash of Critters, the hottest NFT betting arena on Monad! Watch me next round!`
      ];
      shareText = runnerUpMessages[Math.floor(Math.random() * runnerUpMessages.length)];
    } else {
      // Participated but didn't place in top 2
      const participationMessages = [
        `Just battled in Clash of Critters, the FIRST NFT betting arena on Monad! Getting stronger with every match.`,
        `My Critters are warming up in Monad's premiere NFT betting arena! Watch my comeback in the next clash!`,
        `The competition is fierce in Clash of Critters, Monad's revolutionary NFT betting platform! I'm coming back stronger!`
      ];
      shareText = participationMessages[Math.floor(Math.random() * participationMessages.length)];
    }
    
    // Add call to action and referral link
    if (referralCode) {
      shareText += ` Join me and start winning: ${baseUrl}?ref=${referralCode}`;
    } else {
      shareText += ` Join the action: ${baseUrl}`;
    }
    
    return encodeURIComponent(shareText);
  };
  
  const handleShare = () => {
    // Generate a unique ID for this specific share
    const shareId = `${type}-${position}-${Date.now()}`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${getShareText()}`;
    
    // Award Clash Points if not already awarded for this share
    if (!hasPerformedAction(CPActionType.SOCIAL_SHARE, shareId)) {
      awardPoints(CPActionType.SOCIAL_SHARE, shareId);
      setShowPointsToast(true);
    }
    
    // Open Twitter share window
    window.open(twitterUrl, '_blank', 'noopener,noreferrer');
  };
  
  return (
    <>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleShare}
        className="w-full py-2 bg-black hover:bg-gray-900 text-white rounded-lg transition-all border border-gray-800 hover:border-gray-700 text-sm font-medium flex items-center justify-center gap-2"
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="16" 
          height="16" 
          viewBox="0 0 24 24"
          className="w-4 h-4"
          fill="currentColor"
        >
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
        Share on X
      </motion.button>
      
      <Toast
        message="Clash Points awarded for sharing!"
        isVisible={showPointsToast}
        onClose={() => setShowPointsToast(false)}
      />
    </>
  );
};

export default SocialShareButton; 