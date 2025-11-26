
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
  bulkDeleteResults: (ids: string[], projectId: string) => void;
  restoreData: (data: { projects: Project[]; results: ExtractionResult[] }) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEYS = {
  PROJECTS: 'academica_projects_v1',
  RESULTS: 'academica_results_v1',
  USER: 'academica_user_v1'
};

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
  // Initialize from LocalStorage or fallback to empty array
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PROJECTS);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to load projects from storage", e);
      return [];
    }
  });

  const [results, setResults] = useState<ExtractionResult[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.RESULTS);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to load results from storage", e);
      return [];
    }
  });

  // Persist to LocalStorage whenever state changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify(results));
  }, [results]);

  const addProject = (name: string, description: string) => {
    const newProject: Project = {
      id: `p-${Date.now()}`,
      name,
      description,
      created_at: new Date().toISOString().split('T')[0],
      last_run: 'Never',
      status: 'Active',
      results_count: 0
    };
    setProjects(prev => [newProject, ...prev]);
  };

  const editProject = (id: string, name: string, description: string) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, name, description } : p));
  };

  const deleteProject = (id: string) => {
    // Delete project
    setProjects(prev => prev.filter(p => p.id !== id));
    // Delete associated results
    setResults(prev => prev.filter(r => r.project_id !== id));
  };

  // Consolidated function to handle both single and bulk additions
  const addTargets = (projectId: string, targets: { schoolName: string; programName: string }[]) => {
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

    setResults(prev => [...newResults, ...prev]);
    
    // Update project count
    setProjects(prev => prev.map(p => 
      p.id === projectId ? { ...p, results_count: p.results_count + targets.length } : p
    ));
  };

  const updateResult = (id: string, updates: Partial<ExtractionResult>) => {
    setResults(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    
    // If extraction succeeded, update project last run
    if (updates.status === ExtractionStatus.SUCCESS || updates.status === ExtractionStatus.NOT_FOUND) {
        const result = results.find(r => r.id === id);
        if (result) {
            const today = new Date().toISOString().slice(0, 16).replace('T', ' ');
            setProjects(prev => prev.map(p => 
                p.id === result.project_id ? { ...p, last_run: today } : p
            ));
        }
    }
  };

  const deleteResult = (id: string, projectId: string) => {
    setResults(prev => prev.filter(r => r.id !== id));

    // Update project count directly using the passed projectId
    setProjects(prev => prev.map(p =>
      p.id === projectId ? { ...p, results_count: Math.max(0, p.results_count - 1) } : p
    ));
  };

  const bulkDeleteResults = (ids: string[], projectId: string) => {
    // Create a Set for efficient lookup
    const idsToDelete = new Set(ids);

    // Delete all results in a single state update
    setResults(prev => prev.filter(r => !idsToDelete.has(r.id)));

    // Update project count by the number of deleted items in a single update
    setProjects(prev => prev.map(p =>
      p.id === projectId ? { ...p, results_count: Math.max(0, p.results_count - ids.length) } : p
    ));
  };

  const restoreData = (data: { projects: Project[]; results: ExtractionResult[] }) => {
    if (data.projects && Array.isArray(data.projects)) {
      setProjects(data.projects);
    }
    if (data.results && Array.isArray(data.results)) {
      setResults(data.results);
    }
  };

  return (
    <AppContext.Provider value={{ user, login, logout, projects, results, addProject, editProject, deleteProject, addTargets, updateResult, deleteResult, bulkDeleteResults, restoreData }}>
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
