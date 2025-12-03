import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useAuthStore } from './store/useAuthStore';
import Login from './pages/Login';
import MainLayout from './layouts/MainLayout';
import AdminDashboard from './pages/admin/Dashboard';
import EmployeeDashboard from './pages/employee/Dashboard';
import Expenses from './pages/Expenses';
import Incomes from './pages/Incomes';
import Users from './pages/admin/Users';
import Settings from './pages/admin/Settings';
import ProtectedRoute from './routers/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import ConnectionStatus from './components/ConnectionStatus';
import { Loader2 } from 'lucide-react';

function App() {
  const { initializeAuth, loading, role } = useAuthStore();

  useEffect(() => {
    initializeAuth();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ConnectionStatus />
        <Toaster position="top-right" richColors />
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
            <Route path="/" element={
              role === 'admin' ? <AdminDashboard /> : <EmployeeDashboard />
            } />

            <Route path="/gastos" element={<Expenses />} />
            <Route path="/ingresos" element={<Incomes />} />

            {/* Admin Only Routes */}
            <Route path="/usuarios" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Users />
              </ProtectedRoute>
            } />

            <Route path="/configuracion" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Settings />
              </ProtectedRoute>
            } />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
