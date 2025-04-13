import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Layout } from './components/Layout';
import HomePage from './pages/HomePage';
import ClashLobbyPage from './pages/ClashLobbyPage';
import ClashViewPage from './pages/ClashViewPage';
import ClashLeaderboardPage from './pages/ClashLeaderboardPage';
import { Toaster } from 'react-hot-toast';
import { WagmiConfig } from 'wagmi';
import { getConfig } from './utils/config';
import { WalletProvider } from './components/WalletProvider';
import { useAccount } from 'wagmi';
import { ToastProvider } from './components/Toast';
import { processIncomingReferral } from './utils/referralUtils';
import { ReferralProvider } from './contexts/ReferralContext';
import { ClashPointsProvider } from './contexts/ClashPointsContext';

// Layout wrapper component
const LayoutWrapper = () => {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
};

// Auth guard for routes that require wallet connection
const RequireAuth = () => {
  const { isConnected } = useAccount();
  
  if (!isConnected) {
    return <Navigate to="/" replace />;
  }
  
  return <Outlet />;
};

// Main Application Component
const AppContent: React.FC = () => {
  // Process referrals when app loads
  useEffect(() => {
    processIncomingReferral();
  }, []);

  return (
    <Router>
      <ToastProvider>
        <Toaster position="top-right" />
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<HomePage />} />
          
          {/* Protected Routes */}
          <Route element={<RequireAuth />}>
            <Route element={<LayoutWrapper />}>
              {/* Clash Routes */}
              <Route path="/clashes" element={<ClashLobbyPage />} />
              <Route path="/clash-view" element={<ClashViewPage />} />
              <Route path="/clash/leaderboard" element={<ClashLeaderboardPage />} />
            </Route>
          </Route>

          {/* Catch all - redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ToastProvider>
    </Router>
  );
};

const App: React.FC = () => {
  // Get the configuration in a safe way that works in both browser and SSR contexts
  const safeConfig = getConfig();
  
  return (
    <WagmiConfig config={safeConfig}>
      <WalletProvider>
        <ReferralProvider>
          <ClashPointsProvider>
            <AppContent />
          </ClashPointsProvider>
        </ReferralProvider>
      </WalletProvider>
    </WagmiConfig>
  );
};

export default App; 