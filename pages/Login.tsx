
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { ShieldCheck, ArrowRight } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (role: 'Admin' | 'Analyst') => {
    const loginEmail = email || (role === 'Admin' ? 'admin@academica.edu' : 'diana@university.edu');
    login(loginEmail, role);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-jhu-gray flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-12 h-12 bg-jhu-heritage rounded-xl flex items-center justify-center shadow-lg">
            <span className="font-bold text-white text-2xl">A</span>
          </div>
        </div>
        <h2 className="mt-6 text-center text-4xl font-bold text-jhu-heritage">
          Academica
        </h2>
        <p className="mt-2 text-center text-base text-slate-600">
          Tuition Intelligence Platform
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-md hover:shadow-lg transition-shadow sm:rounded-xl sm:px-10 border border-slate-100">
          <div className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Email address
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-jhu-heritage focus:border-jhu-heritage sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-jhu-heritage focus:border-jhu-heritage sm:text-sm"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-jhu-heritage focus:ring-jhu-heritage border-slate-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-900">
                  Remember me
                </label>
              </div>

              <div className="text-sm">
                <a href="#" className="font-medium text-jhu-heritage hover:opacity-80">
                  Forgot your password?
                </a>
              </div>
            </div>

            <div>
              <button
                onClick={() => handleLogin('Analyst')}
                type="button"
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-jhu-heritage hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-jhu-heritage transition-all"
              >
                Sign in
              </button>
            </div>
          </div>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-slate-500">
                  Or use simulation mode
                </span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                onClick={() => handleLogin('Analyst')}
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-slate-300 shadow-sm text-xs font-medium rounded-lg text-slate-700 bg-white hover:bg-jhu-gray transition-colors"
              >
                Simulate Analyst
              </button>
              <button
                onClick={() => handleLogin('Admin')}
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-slate-300 shadow-sm text-xs font-medium rounded-lg text-slate-700 bg-white hover:bg-jhu-gray transition-colors"
              >
                Simulate Admin
              </button>
            </div>
          </div>
          
          <div className="mt-6 flex items-start gap-3 p-3 bg-blue-50 rounded-lg text-xs text-blue-800">
             <ShieldCheck size={16} className="mt-0.5 flex-shrink-0" />
             <p>Academica is in Phase 3. Authentication is enabled. Use the simulation buttons above to test different role permissions.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
