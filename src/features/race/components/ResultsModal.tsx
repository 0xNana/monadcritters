import React from 'react';
import { Race } from '../types';

interface ResultsModalProps {
  race: Race;
  onClose: () => void;
  userAddress?: string;
}

const ResultsModal: React.FC<ResultsModalProps> = ({ race, onClose, userAddress }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">
            Race Results ({race.maxPlayers} Players)
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>
        
        <div className="overflow-auto max-h-96">
          <table className="w-full">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-700">
                <th className="py-2">Position</th>
                <th className="py-2">Wallet</th>
                <th className="py-2 text-right">Score</th>
                <th className="py-2 text-right">Reward (MON)</th>
              </tr>
            </thead>
            <tbody>
              {race.results?.map((result) => (
                <tr 
                  key={result.player} 
                  className={`border-b border-gray-700 ${
                    result.player === userAddress ? 'bg-purple-900/20' : ''
                  }`}
                >
                  <td className="py-3 text-white">#{result.finalPosition}</td>
                  <td className="py-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-white">{result.player}</span>
                      {result.player === userAddress && (
                        <span className="px-2 py-0.5 text-xs bg-purple-500/30 text-purple-300 rounded-full">
                          You
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 text-white text-right">{result.score}</td>
                  <td className="py-3 text-green-400 text-right">
                    {result.reward.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-lg font-medium hover:from-indigo-600 hover:to-violet-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResultsModal;
