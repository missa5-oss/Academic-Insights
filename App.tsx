import React from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { ProjectDetail } from './pages/ProjectDetail';
import { AdminPanel } from './pages/AdminPanel';
import { Login } from './pages/Login';
import { AppProvider, useApp } from './context/AppContext';
import { ErrorBoundary } from './components/ErrorBoundary';

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
        <HashRouter>
          <AppRoutes />
        </HashRouter>
      </AppProvider>
    </ErrorBoundary>
  );
}

export default App;