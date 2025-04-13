import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { AdminExportService } from '../services/AdminExportService';

const AdminExport: React.FC = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);
    
    try {
      const adminExport = AdminExportService.getInstance();
      await adminExport.downloadExportData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-6 bg-gray-800 rounded-xl shadow-lg">
      <h2 className="text-2xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
        Admin Data Export
      </h2>
      
      <div className="space-y-4">
        <p className="text-gray-300">
          Export all user data including stats, clash history, and social verifications.
        </p>
        
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleExport}
          disabled={isExporting}
          className={`w-full py-3 rounded-lg transition-all text-sm font-medium flex items-center justify-center gap-2 ${
            isExporting
              ? 'bg-gray-700 cursor-not-allowed'
              : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'
          }`}
        >
          {isExporting ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Exporting...</span>
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Export User Data</span>
            </>
          )}
        </motion.button>
        
        {error && (
          <div className="text-red-400 text-sm p-3 bg-red-400/10 rounded-lg">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminExport; 