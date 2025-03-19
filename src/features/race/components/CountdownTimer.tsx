import React, { useEffect, useState } from 'react';

interface CountdownTimerProps {
  startTime: bigint;
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({ startTime }) => {
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = Math.floor(Date.now() / 1000);
      const targetTime = Number(startTime);
      const difference = targetTime - now;

      if (difference <= 0) {
        return 'Starting...';
      }

      // Convert to seconds
      const seconds = Math.max(0, difference);
      return `${seconds}s`;
    };

    // Initial calculation
    setTimeLeft(calculateTimeLeft());

    // Update every second
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [startTime]);

  return (
    <div className="text-sm font-medium">
      {timeLeft === 'Starting...' ? (
        <span className="text-yellow-400 animate-pulse">{timeLeft}</span>
      ) : (
        <span className="text-blue-400">Starts in: {timeLeft}</span>
      )}
    </div>
  );
};

export default CountdownTimer; 