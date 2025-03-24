import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface CountdownTimerProps {
  startTime: bigint;
  duration?: number;
}

const CountdownTimer = ({ startTime, duration = 30 }: CountdownTimerProps) => {
  const [timeLeft, setTimeLeft] = useState<number>(() => {
    const start = Number(startTime) * 1000;
    const now = Date.now();
    return Math.max(0, duration - (now - start) / 1000);
  });
  
  const requestRef = useRef<number>();
  const previousTimeRef = useRef<number>();

  const animate = (time: number) => {
    if (previousTimeRef.current !== undefined) {
      const start = Number(startTime) * 1000;
      const now = Date.now();
      const remaining = Math.max(0, duration - (now - start) / 1000);
      
      // Only update state if the time has changed by at least 1 second
      if (Math.floor(remaining) !== Math.floor(timeLeft)) {
        setTimeLeft(remaining);
      }
    }
    previousTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [startTime]); // Only re-run effect if startTime changes

  const progress = (timeLeft / duration) * 100;

  return (
    <div className="w-full space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-gray-300">Time Remaining</span>
        <span className="text-sm font-medium text-gray-300">
          {Math.ceil(timeLeft)}s
        </span>
      </div>
      <div className="w-full bg-gray-600/50 rounded-full h-2">
        <motion.div
          className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full"
          initial={{ width: '100%' }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
    </div>
  );
};

export default React.memo(CountdownTimer); 