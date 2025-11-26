
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Project, ExtractionResult, ExtractionStatus, ConfidenceScore, User } from '../types';

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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEYS = {
  USER: 'academica_user_v1'
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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

  const login = (email: string, role: 'Admin' | 'Analyst') => {
    const name = role === 'Admin' ? 'Alex Administrator' : 'Diana Analyst';
    const initials = role === 'Admin' ? 'AA' : 'DA';
    
    const newUser: User = { name, email, role, initials };
    setUser(newUser);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(newUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEYS.USER);
  };

  // --- Data State ---
  // Fetch from API
  const [projects, setProjects] = useState<Project[]>([]);
  const [results, setResults] = useState<ExtractionResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch initial data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [projectsRes, resultsRes] = await Promise.all([
          fetch(`${API_URL}/api/projects`),
          fetch(`${API_URL}/api/results`)
        ]);

        if (projectsRes.ok && resultsRes.ok) {
          const projectsData = await projectsRes.json();
          const resultsData = await resultsRes.json();
          setProjects(projectsData);
          setResults(resultsData);
        }
      } catch (error) {
        console.error('Failed to fetch data from API:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

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

  // Consolidated function to handle both single and bulk additions
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
        remarks: null
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

  return (
    <AppContext.Provider value={{ user, login, logout, projects, results, addProject, editProject, deleteProject, addTargets, updateResult, deleteResult, restoreData }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
