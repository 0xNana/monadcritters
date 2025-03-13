import React from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import RaceView from '../features/race/components/RaceView';

export default function RaceViewPage() {
  return (
    <ErrorBoundary>
      <RaceView />
    </ErrorBoundary>
  );
} 