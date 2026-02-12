
import React, { createContext, useContext, useState, ReactNode, useEffect, useMemo } from 'react';
import { Project, ExtractionResult, ExtractionStatus, ConfidenceScore, User, TrendData, CrossProjectAnalytics, MarketPositionData, TuitionDistributionBin, RecommendationsResponse, DataQualityMetrics, ActivityTrendData } from '../types';
import { API_URL } from '@/src/config';

/**
 * Type definition for the App context value.
 * Provides authentication, project management, and result operations.
 */
interface AppContextType {
  user: User | null;
  login: (email: string, role: 'Admin' | 'Analyst') => void;
  logout: () => void;
  projects: Project[];
  results: ExtractionResult[];
  addProject: (name: string, description: string) => void;
  editProject: (id: string, name: string, description: string) => void;
  deleteProject: (id: string) => void;
  addTargets: (projectId: string, targets: { schoolName: string; programName: string }[]) => void;
  updateResult: (id: string, updates: Partial<ExtractionResult>) => void;
  deleteResult: (id: string, projectId: string) => void;
  restoreData: (data: { projects: Project[]; results: ExtractionResult[] }) => void;
  getResultHistory: (id: string) => Promise<ExtractionResult[]>;
  createNewVersion: (id: string, newData: Partial<ExtractionResult>) => Promise<void>;
  getTrendsData: (projectId: string) => Promise<TrendData[]>;

  // Dashboard Enhancement: Cross-Project Analytics
  getCrossProjectAnalytics: () => Promise<CrossProjectAnalytics | null>;
  getMarketPositionData: () => Promise<MarketPositionData[]>;
  getTuitionDistribution: () => Promise<TuitionDistributionBin[]>;
  getDataQuality: () => Promise<DataQualityMetrics | null>;
  getRecentActivity: () => Promise<ActivityTrendData[]>;
  getMarketRecommendations: (analyticsData: CrossProjectAnalytics) => Promise<RecommendationsResponse>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

/** Storage keys for localStorage persistence */
const STORAGE_KEYS = {
  USER: 'academica_user_v1'
};

/**
 * Global state provider for the application.
 * Manages authentication, projects, and extraction results with API persistence.
 *
 * @example
 * ```tsx
 * <AppProvider>
 *   <App />
 * </AppProvider>
 * ```
 */
export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // --- Authentication State ---
  const [user, setUser] = useState<User | null>(() => {
    try {
      const savedUser = localStorage.getItem(STORAGE_KEYS.USER);
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (e) {
      return null;
    }
  });

  /**
   * Authenticates a user and persists to localStorage.
   * @param email - User's email address
   * @param role - User role ('Admin' or 'Analyst')
   */
  const login = (email: string, role: 'Admin' | 'Analyst') => {
    const name = role === 'Admin' ? 'Alex Administrator' : 'Diana Analyst';
    const initials = role === 'Admin' ? 'AA' : 'DA';

    const newUser: User = { name, email, role, initials };
    setUser(newUser);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(newUser));
  };

  /** Logs out the current user and clears localStorage. */
  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEYS.USER);
  };

  // --- Data State ---
  // Fetch from API
  const [projects, setProjects] = useState<Project[]>([]);
  const [results, setResults] = useState<ExtractionResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch initial data from API (Sprint 7: Using batch endpoint)
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Use batch endpoint to fetch both projects and results in a single request
        const response = await fetch(`${API_URL}/api/batch?projects=true&results=true`);

        if (response.ok) {
          const data = await response.json();
          if (data.projects && !data.projects.error) {
            setProjects(data.projects);
          }
          if (data.results && !data.results.error) {
            setResults(data.results);
          }
        }
      } catch (error) {
        console.error('Failed to fetch data from API:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  /**
   * Creates a new project and persists to the database.
   * @param name - Project name
   * @param description - Project description
   */
  const addProject = async (name: string, description: string) => {
    const newProject: Project = {
      id: `p-${Date.now()}`,
      name,
      description,
      created_at: new Date().toISOString().split('T')[0],
      last_run: 'Never',
      status: 'Active',
      results_count: 0
    };

    try {
      const response = await fetch(`${API_URL}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProject)
      });

      if (response.ok) {
        const created = await response.json();
        setProjects(prev => [created, ...prev]);
      }
    } catch (error) {
      console.error('Failed to add project:', error);
    }
  };

  /**
   * Updates an existing project's name and description.
   * @param id - Project ID to update
   * @param name - New project name
   * @param description - New project description
   */
  const editProject = async (id: string, name: string, description: string) => {
    try {
      const response = await fetch(`${API_URL}/api/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description })
      });

      if (response.ok) {
        const updated = await response.json();
        setProjects(prev => prev.map(p => p.id === id ? updated : p));
      }
    } catch (error) {
      console.error('Failed to edit project:', error);
    }
  };

  /**
   * Deletes a project and all associated results (cascade).
   * @param id - Project ID to delete
   */
  const deleteProject = async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/api/projects/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        // Delete project from state
        setProjects(prev => prev.filter(p => p.id !== id));
        // Delete associated results (cascade handled by DB, but update state)
        setResults(prev => prev.filter(r => r.project_id !== id));
      }
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  };

  /**
   * Adds extraction targets (school/program combinations) to a project.
   * Handles both single and bulk additions with unique ID generation.
   * @param projectId - Project ID to add targets to
   * @param targets - Array of school/program pairs to add
   */
  const addTargets = async (projectId: string, targets: { schoolName: string; programName: string }[]) => {
    const timestamp = Date.now();

    const newResults: ExtractionResult[] = targets.map((t, index) => {
      // Robust ID generation: timestamp + index + random string to ensure uniqueness even in large batches
      const uniqueId = `r-${timestamp}-${index}-${Math.random().toString(36).substr(2, 9)}`;

      return {
        id: uniqueId,
        project_id: projectId,
        school_name: t.schoolName,
        program_name: t.programName,
        tuition_amount: null,
        tuition_period: '-',
        academic_year: '-',
        confidence_score: ConfidenceScore.LOW,
        status: ExtractionStatus.PENDING,
        source_url: '',
        validated_sources: [],
        extraction_date: '-',
        raw_content: '',
        cost_per_credit: null,
        total_credits: null,
        program_length: null,
        remarks: null,
        extraction_version: 1,
        extracted_at: new Date().toISOString(),
        actual_program_name: null,
        user_comments: null,
        is_stem: null
      };
    });

    try {
      const response = await fetch(`${API_URL}/api/results/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results: newResults })
      });

      if (response.ok) {
        const created = await response.json();
        setResults(prev => [...created, ...prev]);

        // Update project count
        await fetch(`${API_URL}/api/projects/${projectId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ results_count: (projects.find(p => p.id === projectId)?.results_count || 0) + targets.length })
        });

        setProjects(prev => prev.map(p =>
          p.id === projectId ? { ...p, results_count: p.results_count + targets.length } : p
        ));
      }
    } catch (error) {
      console.error('Failed to add targets:', error);
    }
  };

  /**
   * Updates an extraction result with new data.
   * Automatically updates project's last_run timestamp on successful extraction.
   * @param id - Result ID to update
   * @param updates - Partial result data to merge
   */
  const updateResult = async (id: string, updates: Partial<ExtractionResult>) => {
    try {
      const response = await fetch(`${API_URL}/api/results/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        const updated = await response.json();
        setResults(prev => prev.map(r => r.id === id ? updated : r));

        // If extraction succeeded, update project last run
        if (updates.status === ExtractionStatus.SUCCESS || updates.status === ExtractionStatus.NOT_FOUND) {
          const result = results.find(r => r.id === id);
          if (result) {
            const today = new Date().toISOString().slice(0, 16).replace('T', ' ');

            await fetch(`${API_URL}/api/projects/${result.project_id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ last_run: today })
            });

            setProjects(prev => prev.map(p =>
              p.id === result.project_id ? { ...p, last_run: today } : p
            ));
          }
        }
      }
    } catch (error) {
      console.error('Failed to update result:', error);
    }
  };

  /**
   * Deletes an extraction result and updates the project's result count.
   * @param id - Result ID to delete
   * @param projectId - Parent project ID (for count update)
   */
  const deleteResult = async (id: string, projectId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/results/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setResults(prev => prev.filter(r => r.id !== id));

        // Update project count
        const currentCount = projects.find(p => p.id === projectId)?.results_count || 0;
        await fetch(`${API_URL}/api/projects/${projectId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ results_count: Math.max(0, currentCount - 1) })
        });

        setProjects(prev => prev.map(p =>
          p.id === projectId ? { ...p, results_count: Math.max(0, p.results_count - 1) } : p
        ));
      }
    } catch (error) {
      console.error('Failed to delete result:', error);
    }
  };

  /**
   * Restores application data from a backup.
   * Clears existing data and imports projects and results.
   * @param data - Backup data containing projects and results arrays
   */
  const restoreData = async (data: { projects: Project[]; results: ExtractionResult[] }) => {
    try {
      // Clear existing data first
      const existingProjects = await fetch(`${API_URL}/api/projects`).then(r => r.json());
      for (const project of existingProjects) {
        await fetch(`${API_URL}/api/projects/${project.id}`, { method: 'DELETE' });
      }

      // Restore projects
      if (data.projects && Array.isArray(data.projects)) {
        for (const project of data.projects) {
          await fetch(`${API_URL}/api/projects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(project)
          });
        }
        setProjects(data.projects);
      }

      // Restore results
      if (data.results && Array.isArray(data.results)) {
        await fetch(`${API_URL}/api/results/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ results: data.results })
        });
        setResults(data.results);
      }
    } catch (error) {
      console.error('Failed to restore data:', error);
    }
  };

  /**
   * Fetches version history for a specific result.
   * Returns all versions of the same school/program combination.
   * @param id - Result ID to get history for
   * @returns Array of historical extraction results, ordered by version
   */
  const getResultHistory = async (id: string): Promise<ExtractionResult[]> => {
    try {
      const response = await fetch(`${API_URL}/api/results/${id}/history`);
      if (response.ok) {
        return await response.json();
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch result history:', error);
      return [];
    }
  };

  /**
   * Creates a new version of a result for historical price tracking.
   * Increments the extraction_version and stores as a new record.
   * @param id - Original result ID to create new version from
   * @param newData - New extraction data for this version
   */
  const createNewVersion = async (id: string, newData: Partial<ExtractionResult>): Promise<void> => {
    try {
      const newId = `r-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      const response = await fetch(`${API_URL}/api/results/${id}/new-version`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newId,
          ...newData
        })
      });

      if (response.ok) {
        const newVersion = await response.json();
        // Add new version to results
        setResults(prev => [...prev, newVersion]);

        // Update project count if needed
        if (newVersion.project_id) {
          const projectResponse = await fetch(`${API_URL}/api/projects/${newVersion.project_id}`);
          if (projectResponse.ok) {
            const updatedProject = await projectResponse.json();
            setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
          }
        }
      }
    } catch (error) {
      console.error('Failed to create new version:', error);
    }
  };

  /**
   * Fetches trends data for visualizing price changes over time.
   * Used for line chart visualization of tuition trends.
   * @param projectId - Project ID to get trends for
   * @returns Array of trend data points for charting
   */
  const getTrendsData = async (projectId: string): Promise<TrendData[]> => {
    try {
      const response = await fetch(`${API_URL}/api/results/trends/${projectId}`);
      if (response.ok) {
        return await response.json();
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch trends data:', error);
      return [];
    }
  };

  // ==========================================
  // Dashboard Enhancement: Cross-Project Analytics Methods
  // ==========================================

  /**
   * Fetches cross-project analytics aggregates.
   * @returns Cross-project analytics data or null on error
   */
  const getCrossProjectAnalytics = async (): Promise<CrossProjectAnalytics | null> => {
    try {
      const response = await fetch(`${API_URL}/api/analytics/cross-project`);
      if (response.ok) {
        return await response.json();
      }
      console.error('Failed to fetch cross-project analytics');
      return null;
    } catch (error) {
      console.error('Failed to fetch cross-project analytics:', error);
      return null;
    }
  };

  /**
   * Fetches market position data for scatter plot visualization.
   * @returns Array of market position data points
   */
  const getMarketPositionData = async (): Promise<MarketPositionData[]> => {
    try {
      const response = await fetch(`${API_URL}/api/analytics/market-position`);
      if (response.ok) {
        const result = await response.json();
        return result.data || [];
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch market position data:', error);
      return [];
    }
  };

  /**
   * Fetches tuition distribution histogram data.
   * @returns Array of distribution bins
   */
  const getTuitionDistribution = async (): Promise<TuitionDistributionBin[]> => {
    try {
      const response = await fetch(`${API_URL}/api/analytics/tuition-distribution`);
      if (response.ok) {
        const result = await response.json();
        return result.bins || [];
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch tuition distribution:', error);
      return [];
    }
  };

  /**
   * Fetches data quality metrics.
   * @returns Data quality metrics or null on error
   */
  const getDataQuality = async (): Promise<DataQualityMetrics | null> => {
    try {
      const response = await fetch(`${API_URL}/api/analytics/data-quality`);
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error('Failed to fetch data quality:', error);
      return null;
    }
  };

  /**
   * Fetches recent activity trend data (last 30 days).
   * @returns Array of activity trend data points
   */
  const getRecentActivity = async (): Promise<ActivityTrendData[]> => {
    try {
      const response = await fetch(`${API_URL}/api/analytics/recent-activity`);
      if (response.ok) {
        const result = await response.json();
        return result.data || [];
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch recent activity:', error);
      return [];
    }
  };

  /**
   * Generates AI-powered market recommendations based on cross-project analytics.
   * @param analyticsData - Cross-project analytics data
   * @returns Recommendations response with markdown-formatted insights
   */
  const getMarketRecommendations = async (analyticsData: CrossProjectAnalytics): Promise<RecommendationsResponse> => {
    try {
      const response = await fetch(`${API_URL}/api/gemini/recommendations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ analyticsData }),
      });

      if (response.ok) {
        return await response.json();
      }

      throw new Error('Failed to generate recommendations');
    } catch (error) {
      console.error('Failed to fetch market recommendations:', error);
      throw error;
    }
  };

  // Memoize context value to prevent unnecessary re-renders of consumers
  const contextValue = useMemo(() => ({
    user,
    login,
    logout,
    projects,
    results,
    addProject,
    editProject,
    deleteProject,
    addTargets,
    updateResult,
    deleteResult,
    restoreData,
    getResultHistory,
    createNewVersion,
    getTrendsData,
    getCrossProjectAnalytics,
    getMarketPositionData,
    getTuitionDistribution,
    getDataQuality,
    getRecentActivity,
    getMarketRecommendations
  }), [user, projects, results]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

/**
 * Hook to access the App context.
 * Must be used within an AppProvider.
 * @returns The App context value with all state and methods
 * @throws Error if used outside of AppProvider
 *
 * @example
 * ```tsx
 * const { user, projects, addProject } = useApp();
 * ```
 */
export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
