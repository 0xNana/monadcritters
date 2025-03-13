import React from 'react';
import { Race } from '../types';

interface RaceStatusProps {
  race: Race;
}

export const RaceStatus: React.FC<RaceStatusProps> = ({ race }) => {
  let statusColor = '';
  let statusText = '';

  if (race.hasEnded) {
    statusColor = 'bg-purple-500';
    statusText = 'Completed';
  } else if (race.progressStatus === 'racing') {
    statusColor = 'bg-green-500 animate-pulse';
    statusText = 'In Progress';
  } else if (race.progressStatus === 'complete') {
    statusColor = 'bg-yellow-500';
    statusText = 'Ready to End';
  } else if (race.currentPlayers === race.maxPlayers) {
    statusColor = 'bg-blue-500';
    statusText = 'Ready to Start';
  } else {
    statusColor = 'bg-gray-500';
    statusText = 'Waiting for Players';
  }

  return (
    <div className={`px-3 py-1 rounded-full ${statusColor} text-white text-sm font-medium`}>
      {statusText}
    </div>
  );
};

export default RaceStatus; 