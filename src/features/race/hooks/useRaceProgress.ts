import { useState, useEffect } from 'react';

interface RaceProgress {
  progress: number;
  isComplete: boolean;
  timeLeft: number;
  isCountdownComplete: boolean;
}

export const useRaceProgress = (
  startTime: bigint,
  isActive: boolean,
  hasEnded: boolean,
  countdownDuration: number = 30000 // 30 seconds countdown in milliseconds
): RaceProgress => {
  const [progress, setProgress] = useState<RaceProgress>({
    progress: 0,
    isComplete: hasEnded,
    timeLeft: countdownDuration,
    isCountdownComplete: false
  });

  useEffect(() => {
    // Reset state if race is not active or no start time
    if (!isActive || Number(startTime) === 0) {
      setProgress({
        progress: 0,
        isComplete: false,
        timeLeft: countdownDuration,
        isCountdownComplete: false
      });
      return;
    }

    // If race has ended, show complete state
    if (hasEnded) {
      setProgress({
        progress: 100,
        isComplete: true,
        timeLeft: 0,
        isCountdownComplete: true
      });
      return;
    }

    const updateProgress = () => {
      const now = Date.now();
      const startTimeMs = Number(startTime) * 1000;
      const elapsed = now - startTimeMs;

      // During countdown phase
      if (elapsed < countdownDuration) {
        const timeLeft = countdownDuration - elapsed;
        const countdownProgress = Math.min(100, (elapsed / countdownDuration) * 100);

        return {
          progress: Math.max(0, countdownProgress), // Ensure progress is not negative
          isComplete: false,
          timeLeft: Math.max(0, timeLeft), // Ensure timeLeft is not negative
          isCountdownComplete: false
        };
      }

      // After countdown, during race phase
      const raceElapsed = elapsed - countdownDuration;
      const raceDuration = 30000; // 30 seconds race duration
      const raceProgress = Math.min(100, (raceElapsed / raceDuration) * 100);
      const raceTimeLeft = Math.max(0, raceDuration - raceElapsed);

      // Race is complete if we've exceeded race duration
      const isComplete = raceElapsed >= raceDuration;

      return {
        progress: raceProgress,
        isComplete,
        timeLeft: raceTimeLeft,
        isCountdownComplete: true
      };
    };

    // Initial update
    setProgress(updateProgress());

    // Update progress every 100ms for smoother countdown
    const interval = setInterval(() => {
      const newProgress = updateProgress();
      setProgress(newProgress);

      // Clear interval if race is complete
      if (newProgress.isComplete) {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [startTime, isActive, hasEnded, countdownDuration]);

  return progress;
};

export default useRaceProgress; 