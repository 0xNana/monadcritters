import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { LockClosedIcon } from '@heroicons/react/24/outline';

/**
 * Minimalist Navigation Component
 * Follows DRY and KISS principles
 */
interface NavigationProps {
  isMobile?: boolean;
}

const Navigation: React.FC<NavigationProps> = ({ isMobile = false }) => {
  const { isConnected } = useAccount();
  const location = useLocation();
  
  // Navigation items - Main app navigation
  const navItems = [
    { path: '/clashes', label: 'Clashes', requiresAuth: false },
    { path: '/critter-clash', label: 'Active Clash', requiresAuth: true },
    { path: '/leaderboard', label: 'Leaderboard', requiresAuth: false },
  ];
  
  if (isMobile) {
    return (
      <nav className="w-full">
        <div className="flex flex-col space-y-3 w-full">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.requiresAuth && !isConnected ? '/' : item.path}
              className={({ isActive }) =>
                `px-4 py-3 rounded-lg text-center font-medium flex items-center justify-center ${
                  isActive
                    ? 'bg-purple-600 text-white'
                    : item.requiresAuth && !isConnected
                      ? 'text-gray-500 cursor-not-allowed'
                      : 'text-gray-300 hover:bg-purple-500/20 hover:text-white'
                }`
              }
            >
              {item.requiresAuth && !isConnected && (
                <LockClosedIcon className="w-4 h-4 mr-1.5" />
              )}
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    );
  }
  
  return (
    <nav>
      <div className="flex items-center space-x-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.requiresAuth && !isConnected ? '/' : item.path}
            className={({ isActive }) =>
              `px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center ${
                isActive
                  ? 'bg-purple-600 text-white'
                  : item.requiresAuth && !isConnected
                    ? 'text-gray-500 cursor-not-allowed'
                    : 'text-gray-300 hover:bg-purple-500/20 hover:text-white'
              }`
            }
            onClick={(e) => {
              if (item.requiresAuth && !isConnected) {
                e.preventDefault();
              }
            }}
          >
            {item.requiresAuth && !isConnected && (
              <LockClosedIcon className="w-3.5 h-3.5 mr-1.5" />
            )}
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default Navigation; 