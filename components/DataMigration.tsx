import React, { useState } from 'react';
import { AlertCircle, CheckCircle, Database } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const LEGACY_STORAGE_KEYS = {
  PROJECTS: 'academica_projects_v1',
  RESULTS: 'academica_results_v1'
};

export const DataMigration: React.FC = () => {
  const [status, setStatus] = useState<'idle' | 'checking' | 'migrating' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [dataFound, setDataFound] = useState(false);

  const checkForLegacyData = () => {
    const hasProjects = localStorage.getItem(LEGACY_STORAGE_KEYS.PROJECTS);
    const hasResults = localStorage.getItem(LEGACY_STORAGE_KEYS.RESULTS);
    return { hasData: !!(hasProjects || hasResults), hasProjects, hasResults };
  };

  const handleCheckData = () => {
    setStatus('checking');
    const { hasData, hasProjects, hasResults } = checkForLegacyData();

    if (hasData) {
      const projectCount = hasProjects ? JSON.parse(hasProjects).length : 0;
      const resultCount = hasResults ? JSON.parse(hasResults).length : 0;
      setMessage(`Found ${projectCount} projects and ${resultCount} results in localStorage`);
      setDataFound(true);
      setStatus('idle');
    } else {
      setMessage('No localStorage data found to migrate');
      setDataFound(false);
      setStatus('idle');
    }
  };

  const handleMigrate = async () => {
    setStatus('migrating');
    setMessage('Starting migration...');

    try {
      const { hasProjects, hasResults } = checkForLegacyData();

      if (!hasProjects && !hasResults) {
        setMessage('No data to migrate');
        setStatus('error');
        return;
      }

      let projectsData = [];
      let resultsData = [];

      if (hasProjects) {
        projectsData = JSON.parse(hasProjects);
        setMessage(`Migrating ${projectsData.length} projects...`);

        for (const project of projectsData) {
          await fetch(`${API_URL}/api/projects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(project)
          });
        }
      }

      if (hasResults) {
        resultsData = JSON.parse(hasResults);
        setMessage(`Migrating ${resultsData.length} results...`);

        // Migrate in batches of 50 for better performance
        const batchSize = 50;
        for (let i = 0; i < resultsData.length; i += batchSize) {
          const batch = resultsData.slice(i, i + batchSize);
          await fetch(`${API_URL}/api/results/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ results: batch })
          });
        }
      }

      setMessage(`✓ Successfully migrated ${projectsData.length} projects and ${resultsData.length} results!`);
      setStatus('success');

      // Optional: Clean up localStorage after successful migration
      // Uncomment these lines if you want to remove legacy data after migration
      // localStorage.removeItem(LEGACY_STORAGE_KEYS.PROJECTS);
      // localStorage.removeItem(LEGACY_STORAGE_KEYS.RESULTS);

    } catch (error) {
      console.error('Migration error:', error);
      setMessage(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setStatus('error');
    }
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '32px',
      borderRadius: '12px',
      color: 'white',
      margin: '24px 0'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <Database size={24} />
        <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>Data Migration Tool</h3>
      </div>

      <p style={{ marginBottom: '24px', opacity: 0.9 }}>
        Migrate your existing data from localStorage to Neon database.
      </p>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        <button
          onClick={handleCheckData}
          disabled={status === 'migrating'}
          style={{
            padding: '10px 20px',
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '6px',
            color: 'white',
            cursor: status === 'migrating' ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: 500,
            transition: 'all 0.2s'
          }}
        >
          Check for Data
        </button>

        <button
          onClick={handleMigrate}
          disabled={!dataFound || status === 'migrating'}
          style={{
            padding: '10px 20px',
            backgroundColor: dataFound && status !== 'migrating' ? 'white' : 'rgba(255, 255, 255, 0.3)',
            border: 'none',
            borderRadius: '6px',
            color: dataFound && status !== 'migrating' ? '#667eea' : 'rgba(255, 255, 255, 0.6)',
            cursor: dataFound && status !== 'migrating' ? 'pointer' : 'not-allowed',
            fontSize: '14px',
            fontWeight: 600,
            transition: 'all 0.2s'
          }}
        >
          {status === 'migrating' ? 'Migrating...' : 'Migrate to Database'}
        </button>
      </div>

      {message && (
        <div style={{
          padding: '12px',
          backgroundColor: 'rgba(255, 255, 255, 0.15)',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {status === 'success' && <CheckCircle size={18} />}
          {status === 'error' && <AlertCircle size={18} />}
          <span style={{ fontSize: '14px' }}>{message}</span>
        </div>
      )}
    </div>
  );
};
