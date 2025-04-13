import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ClashCountdownProps {
  startTime: bigint;
  onComplete?: () => void;
}

const ClashCountdown: React.FC<ClashCountdownProps> = ({ startTime, onComplete }) => {
  const [phase, setPhase] = useState<'initial' | 'go' | 'main'>('initial');
  const [timeLeft, setTimeLeft] = useState<number>(3); // Start with 3 seconds

  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (phase === 'initial') {
      // Initial 3-2-1 countdown
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setPhase('go');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (phase === 'go') {
      // Show "GO!" for 1 second
      timer = setTimeout(() => {
        setPhase('main');
        setTimeLeft(59); // Start main countdown at 59
      }, 1000);
    } else {
      // Main 59-second countdown
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 0) {
            clearInterval(timer);
            onComplete?.();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      clearInterval(timer);
      clearTimeout(timer);
    };
  }, [phase, onComplete]);

  // Calculate progress percentage based on the current phase
  const progress = phase === 'initial' 
    ? ((3 - timeLeft) / 3) * 100 
    : phase === 'go'
    ? 100
    : ((59 - timeLeft) / 59) * 100;

  return (
    <div className="text-center">
      <div className="space-y-2">
        <div className="text-sm text-gray-400">
          {phase === 'initial' ? 'Clash is starting in' : 
           phase === 'go' ? 'Get ready!' :
           'Clash in Progress'}
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={`${phase}-${timeLeft}`}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ 
              type: "spring",
              stiffness: 500,
              damping: 30
            }}
            className={`text-4xl font-bold ${
              phase === 'go' ? 'text-green-400' : 'text-white'
            }`}
          >
            {phase === 'initial' ? timeLeft :
             phase === 'go' ? 'GO!' :
             `${timeLeft}s`}
          </motion.div>
        </AnimatePresence>
        {/* Progress bar */}
        <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
          <motion.div
            className={`h-full ${
              phase === 'go' ? 'bg-green-500' :
              phase === 'initial' ? 'bg-yellow-500' : 
              'bg-purple-500'
            }`}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>
    </div>
  );
};

export default ClashCountdown; 