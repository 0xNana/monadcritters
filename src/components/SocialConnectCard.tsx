import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useClashPoints, CPActionType } from '../contexts/ClashPointsContext';
import { Toast } from './Toast';
import { Tooltip } from './Tooltip';

interface SocialConnectCardProps {
  className?: string;
}

const SocialConnectCard: React.FC<SocialConnectCardProps> = ({ className = '' }) => {
  const { socialVerifications, addSocialVerification, awardPoints, hasPerformedAction } = useClashPoints();
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const handleTelegramConnect = () => {
    // Open Telegram bot in new window
    window.open('https://t.me/clashofcritters', '_blank', 'noopener,noreferrer');
    
    // For demo purposes, we'll simulate verification
    // In production, this would be handled by the bot
    const verification = {
      platform: 'TELEGRAM' as const,
      username: '@user',
      timestamp: Date.now(),
      verified: true
    };
    
    // Add verification and award points
    if (!hasPerformedAction(CPActionType.TELEGRAM_JOIN, 'telegram-join')) {
      addSocialVerification(verification);
      awardPoints(CPActionType.TELEGRAM_JOIN, 'telegram-join', 'TELEGRAM');
      setToastMessage('Connected to Telegram! +500 Clash Points');
      setShowToast(true);
    }
  };

  const handleXConnect = () => {
    // Open X auth flow in new window
    window.open('https://x.com/0xElegant', '_blank', 'noopener,noreferrer');
    
    // For demo purposes, we'll simulate verification
    // In production, this would use X's OAuth
    const verification = {
      platform: 'X' as const,
      username: '@user',
      timestamp: Date.now(),
      verified: true
    };
    
    // Add verification and award points
    if (!hasPerformedAction(CPActionType.X_FOLLOW, 'x-follow')) {
      addSocialVerification(verification);
      awardPoints(CPActionType.X_FOLLOW, 'x-follow', 'X');
      setToastMessage('Connected to X! +500 Clash Points');
      setShowToast(true);
    }
  };

  const isTelegramConnected = socialVerifications.some(v => v.platform === 'TELEGRAM' && v.verified);
  const isXConnected = socialVerifications.some(v => v.platform === 'X' && v.verified);

  return (
    <div className={`bg-gray-800 rounded-xl p-4 ${className}`}>
      <h3 className="text-lg font-medium mb-3">Social Connections</h3>
      
      <div className="space-y-3">
        {/* Telegram Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleTelegramConnect}
          disabled={isTelegramConnected}
          className={`w-full py-2 rounded-lg transition-all text-sm font-medium flex items-center justify-center gap-2 ${
            isTelegramConnected
              ? 'bg-green-500/20 text-green-400 cursor-not-allowed'
              : 'bg-blue-500/20 hover:bg-blue-500/30 text-white border border-blue-500/30 hover:border-blue-500/50'
          }`}
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="16" 
            height="16" 
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-4 h-4"
          >
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
          </svg>
          {isTelegramConnected ? 'Connected to Telegram' : 'Join Telegram'}
          {!isTelegramConnected && (
            <Tooltip content="+500 Clash Points">
              <span className="text-xs bg-yellow-400/20 text-yellow-400 px-2 py-0.5 rounded">+CP</span>
            </Tooltip>
          )}
        </motion.button>

        {/* X Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleXConnect}
          disabled={isXConnected}
          className={`w-full py-2 rounded-lg transition-all text-sm font-medium flex items-center justify-center gap-2 ${
            isXConnected
              ? 'bg-green-500/20 text-green-400 cursor-not-allowed'
              : 'bg-black hover:bg-gray-900 text-white border border-gray-800 hover:border-gray-700'
          }`}
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="16" 
            height="16" 
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-4 h-4"
          >
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
          {isXConnected ? 'Connected to X' : 'Follow on X'}
          {!isXConnected && (
            <Tooltip content="+500 Clash Points">
              <span className="text-xs bg-yellow-400/20 text-yellow-400 px-2 py-0.5 rounded">+CP</span>
            </Tooltip>
          )}
        </motion.button>
      </div>

      <Toast
        message={toastMessage}
        isVisible={showToast}
        onClose={() => setShowToast(false)}
        type="success"
      />
    </div>
  );
};

export default SocialConnectCard; 