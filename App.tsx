import React, { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { AppProvider, useApp } from './context/AppContext';
import { ToastProvider } from './context/ToastContext';
import { ErrorBoundary } from './components/ErrorBoundary';

// Lazy load route components for code splitting
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail').then(m => ({ default: m.ProjectDetail })));
const AdminPanel = lazy(() => import('./pages/AdminPanel').then(m => ({ default: m.AdminPanel })));

// Loading fallback component
const LoadingFallback: React.FC = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="flex flex-col items-center gap-3">
      <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
      <p className="text-gray-600">Loading...</p>
    </div>
  </div>
);

interface RouteWrapperProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<RouteWrapperProps> = ({ children }) => {
  const { user } = useApp();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

const AdminRoute: React.FC<RouteWrapperProps> = ({ children }) => {
  const { user } = useApp();
  
  if (user?.role !== 'Admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Protected Routes wrapped in Layout */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Suspense fallback={<LoadingFallback />}>
                <Routes>
                  <Route
                    path="/"
                    element={
                      <ErrorBoundary boundaryName="Dashboard">
                        <Dashboard />
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/project/:id"
                    element={
                      <ErrorBoundary boundaryName="ProjectDetail">
                        <ProjectDetail />
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/admin"
                    element={
                      <AdminRoute>
                        <ErrorBoundary boundaryName="AdminPanel">
                          <AdminPanel />
                        </ErrorBoundary>
                      </AdminRoute>
                    }
                  />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <ErrorBoundary boundaryName="App">
      <AppProvider>
        <ToastProvider>
          <HashRouter>
            <AppRoutes />
          </HashRouter>
        </ToastProvider>
      </AppProvider>
    </ErrorBoundary>
  );
}

export default App;