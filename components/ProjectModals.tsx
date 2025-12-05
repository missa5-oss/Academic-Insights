
import React, { useState, useEffect } from 'react';
import { X, List, Type } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const BaseModal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md animate-fade-in-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-xl font-semibold text-jhu-heritage">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-jhu-gray text-slate-500 transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, description: string) => void;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit(name, description);
      setName('');
      setDescription('');
      onClose();
    }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Create New Project">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Project Name</label>
          <input
            autoFocus
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-jhu-heritage focus:outline-none"
            placeholder="e.g. MBA Analysis 2026"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-jhu-heritage focus:outline-none h-24"
            placeholder="Briefly describe the scope of this project..."
          />
        </div>
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-4 py-2 bg-jhu-heritage text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-all shadow-sm"
          >
            Create Project
          </button>
        </div>
      </form>
    </BaseModal>
  );
};

interface EditProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialName: string;
  initialDescription: string;
  onSubmit: (name: string, description: string) => void;
}

export const EditProjectModal: React.FC<EditProjectModalProps> = ({ isOpen, onClose, initialName, initialDescription, onSubmit }) => {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setDescription(initialDescription);
    }
  }, [isOpen, initialName, initialDescription]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit(name, description);
      onClose();
    }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Edit Project Details">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Project Name</label>
          <input
            autoFocus
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-jhu-heritage focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-jhu-heritage focus:outline-none h-24"
          />
        </div>
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-4 py-2 bg-jhu-heritage text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-all shadow-sm"
          >
            Save Changes
          </button>
        </div>
      </form>
    </BaseModal>
  );
};

interface AddTargetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (targets: { school: string; program: string }[]) => void;
}

export const AddTargetModal: React.FC<AddTargetModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [school, setSchool] = useState('');
  const [program, setProgram] = useState('');
  const [bulkData, setBulkData] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (mode === 'single') {
      if (school.trim() && program.trim()) {
        onSubmit([{ school: school.trim(), program: program.trim() }]);
        setSchool('');
        setProgram('');
        onClose();
      }
    } else {
      // Split by newline, handling both \n (Unix) and \r\n (Windows)
      const lines = bulkData.split(/\r?\n/);
      
      const targets = lines
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => {
          let school = '';
          let program = '';

          // Priority 1: Check for Tab delimiter (Excel paste)
          let idx = line.indexOf('\t');
          
          // Priority 2: Check for Comma delimiter (CSV)
          if (idx === -1) {
             idx = line.indexOf(',');
          }
          
          // Priority 3: No delimiter? Treat whole line as School, default program to 'General'
          if (idx === -1) {
             school = line.trim();
             program = 'General';
          } else {
             school = line.substring(0, idx).trim();
             program = line.substring(idx + 1).trim();
          }

          // Cleanup surrounding quotes if they exist (e.g. "Harvard University", "MBA")
          school = school.replace(/^["']|["']$/g, '');
          program = program.replace(/^["']|["']$/g, '');

          return { school, program };
        })
        .filter((item): item is { school: string; program: string } => 
          item !== null && item.school.length > 0 && item.program.length > 0
        );

      if (targets.length > 0) {
        onSubmit(targets);
        setBulkData('');
        onClose();
      }
    }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Add Extraction Target">
      <div className="flex border-b border-slate-200 mb-4">
        <button
          type="button"
          onClick={() => setMode('single')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            mode === 'single'
              ? 'border-jhu-heritage text-jhu-heritage'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Type size={16} /> Single Entry
        </button>
        <button
          type="button"
          onClick={() => setMode('bulk')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            mode === 'bulk'
              ? 'border-jhu-heritage text-jhu-heritage'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <List size={16} /> Bulk Add
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'single' ? (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">School / Institution</label>
              <input
                autoFocus
                type="text"
                required={mode === 'single'}
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-jhu-heritage focus:outline-none"
                placeholder="e.g. Yale University"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Program Name</label>
              <input
                type="text"
                required={mode === 'single'}
                value={program}
                onChange={(e) => setProgram(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-jhu-heritage focus:outline-none"
                placeholder="e.g. Master of Data Science"
              />
            </div>
          </>
        ) : (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Bulk Data (CSV or Excel Paste)
            </label>
            <p className="text-xs text-slate-500 mb-2">
              Enter one target per line: <code className="bg-slate-100 px-1 rounded">School Name, Program Name</code>
            </p>
            <textarea
              autoFocus
              required={mode === 'bulk'}
              value={bulkData}
              onChange={(e) => setBulkData(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-jhu-heritage focus:outline-none h-32"
              placeholder={'Harvard University, MBA\nStanford University, Computer Science\nYale University'}
            />
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-4 py-2 bg-jhu-heritage text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-all shadow-sm"
          >
            {mode === 'single' ? 'Add Target' : 'Add Targets'}
          </button>
        </div>
      </form>
    </BaseModal>
  );
};
