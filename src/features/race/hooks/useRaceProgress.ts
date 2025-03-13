import { useState, useEffect } from 'react';

interface RaceProgress {
  progress: number;
  isComplete: boolean;
  timeLeft: number;
}

export const useRaceProgress = (
  startTime: bigint,
  isActive: boolean,
  hasEnded: boolean,
  raceDuration: number = 60000 // Default 1 minute in milliseconds
): RaceProgress => {
  const [progress, setProgress] = useState<RaceProgress>({
    progress: 0,
    isComplete: hasEnded,
    timeLeft: 0
  });

  useEffect(() => {
    if (!isActive || hasEnded || Number(startTime) === 0) {
      setProgress({
        progress: hasEnded ? 100 : 0,
        isComplete: hasEnded,
        timeLeft: 0
      });
      return;
    }

    const updateProgress = () => {
      const now = Date.now();
      const start = Number(startTime) * 1000;
      const elapsed = now - start;
      
      if (elapsed <= 0) {
        return {
          progress: 0,
          isComplete: false,
          timeLeft: start - now
        };
      }

      if (elapsed >= raceDuration) {
        return {
          progress: 100,
          isComplete: true,
          timeLeft: 0
        };
      }

      return {
        progress: Math.floor((elapsed / raceDuration) * 100),
        isComplete: false,
        timeLeft: raceDuration - elapsed
      };
    };

    // Initial update
    setProgress(updateProgress());

    // Update progress every second
    const interval = setInterval(() => {
      const newProgress = updateProgress();
      setProgress(newProgress);

      // Clear interval if race is complete
      if (newProgress.isComplete) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, isActive, hasEnded, raceDuration]);

  return progress;
};

export default useRaceProgress; 