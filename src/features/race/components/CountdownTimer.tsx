import React, { useEffect, useState } from 'react';

interface CountdownTimerProps {
  startTime: bigint;
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({ startTime }) => {
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    const calculateTimeLeft = () => {
      const startTimeMs = Number(startTime) * 1000;
      const now = Date.now();
      const difference = startTimeMs - now;

      if (difference <= 0) {
        return 'Starting...';
      }

      // Convert to seconds, minutes, hours
      const seconds = Math.floor((difference / 1000) % 60);
      const minutes = Math.floor((difference / 1000 / 60) % 60);
      const hours = Math.floor(difference / 1000 / 60 / 60);

      if (hours > 0) {
        return `${hours}h ${minutes}m ${seconds}s`;
      } else if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
      } else {
        return `${seconds}s`;
      }
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