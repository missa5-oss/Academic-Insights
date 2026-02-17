
import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FolderOpen, Settings, LogOut, ShieldCheck, Plus, Lock } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CreateProjectModal } from './ProjectModals';
import { APP_VERSION } from '@/src/config';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { projects, addProject, user, logout } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-jhu-gray text-slate-900 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-jhu-black text-white flex flex-col flex-shrink-0 transition-all duration-300">
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-jhu-heritage rounded-lg flex items-center justify-center">
              <span className="font-bold text-white text-lg">C</span>
            </div>
            <h1 className="text-lg font-bold tracking-tight">JHU Carey</h1>
          </div>
          <p className="text-xs text-slate-400 mt-2 uppercase tracking-wider">Tuition Intelligence</p>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-jhu-heritage text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <LayoutDashboard size={18} />
            Dashboard
          </NavLink>
          
          <div className="pt-4 pb-1 flex items-center justify-between px-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Projects</p>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="text-slate-500 hover:text-white transition-colors"
              title="Create Project"
            >
              <Plus size={14} />
            </button>
          </div>
          
          {projects.map((project) => (
             <NavLink
             key={project.id}
             to={`/project/${project.id}`}
             className={({ isActive }) =>
               `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                 isActive ? 'bg-jhu-heritage text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
               }`
             }
           >
             <FolderOpen size={18} />
             <span className="truncate">{project.name}</span>
           </NavLink>
          ))}
          
          {user?.role === 'Admin' && (
            <>
              <div className="pt-4 pb-1">
                <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">System</p>
              </div>

              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? 'bg-jhu-heritage text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                <Settings size={18} />
                Admin Panel
              </NavLink>
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-jhu-heritage flex items-center justify-center text-xs font-medium text-white">
              {user?.initials || 'U'}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
              <p className="text-xs text-slate-400 truncate">{user?.role} Access</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-slate-400 cursor-pointer hover:text-white"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-700">
            <p className="text-xs text-slate-500 text-center">v{APP_VERSION}</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm z-10">
          <div className="flex items-center gap-2 text-slate-500 text-sm">
             <ShieldCheck size={16} className="text-jhu-green"/>
             <span>System Operational</span>
             <span className="mx-2 text-slate-300">|</span>
             <span>Last crawled: Today, 09:00 AM</span>
          </div>
          <div className="flex items-center gap-4">
             <button
               onClick={() => setIsModalOpen(true)}
               className="px-4 py-2 text-sm font-semibold text-white bg-jhu-heritage rounded-lg hover:opacity-90 transition-all shadow-sm"
             >
               + New Project
             </button>
          </div>
        </header>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-8">
           {children}
        </div>
      </main>

      {/* Global Modals */}
      <CreateProjectModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSubmit={addProject} 
      />
    </div>
  );
};
