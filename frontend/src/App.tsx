import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/layout/Layout';
import Login from './modules/identity/Login';
import ForgotPassword from './modules/identity/ForgotPassword';
import ResetPassword from './modules/identity/ResetPassword';
import Dashboard from './modules/dashboard/Dashboard';
import Vendors from './modules/procurement/Vendors';
import VendorDetail from './modules/procurement/VendorDetail';
import PurchaseRequests from './modules/procurement/PurchaseRequests';
import PurchaseOrders from './modules/procurement/PurchaseOrders';
import Contracts from './modules/procurement/Contracts';
import Invoices from './modules/finance/Invoices';
import InvoiceDashboard from './modules/finance/InvoiceDashboard';
import Customers from './modules/finance/Customers';
import Payments from './modules/finance/Payments';
import Documents from './modules/document/Documents';
import Notifications from './modules/document/Notifications';
import AuditLogs from './modules/document/AuditLogs';
import Reports from './modules/dashboard/Reports';
import UserManagement from './modules/identity/UserManagement';
import Settings from './modules/identity/Settings';
import LoadingScreen from './components/common/LoadingScreen';
import Copilot from './modules/ai/Copilot';
import InvoiceIntelligence from './modules/ai/InvoiceIntelligence';
import ContractIntelligence from './modules/ai/ContractIntelligence';
import DocumentSearch from './modules/ai/DocumentSearch';

// Role sets mirror the Sidebar visibility so direct-URL access matches the menu.
const PROCUREMENT_ROLES = ['admin', 'procurement_manager', 'auditor'];
const ORDER_ROLES = ['admin', 'procurement_manager', 'finance', 'auditor', 'vendor'];
const INVOICE_ROLES = ['admin', 'finance', 'procurement_manager', 'auditor', 'vendor'];
const AI_INVOICE_ROLES = ['admin', 'finance', 'procurement_manager', 'auditor', 'vendor'];
const AI_BROAD_ROLES = ['admin', 'procurement_manager', 'finance', 'vendor', 'auditor', 'employee'];
const AI_CONTRACT_ROLES = ['admin', 'procurement_manager', 'finance', 'auditor'];

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
});

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  if (user?.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
};

const RoleRoute: React.FC<{ children: React.ReactNode; roles: string[] }> = ({ children, roles }) => {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
      <Route path="/reset-password" element={<PublicRoute><ResetPassword /></PublicRoute>} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        {/* Main Dashboard */}
        <Route index element={<Dashboard />} />

        {/* Procurement */}
        <Route path="vendors" element={<RoleRoute roles={PROCUREMENT_ROLES}><Vendors /></RoleRoute>} />
        <Route path="vendors/:id" element={<RoleRoute roles={PROCUREMENT_ROLES}><VendorDetail /></RoleRoute>} />
        <Route path="purchase-requests" element={<RoleRoute roles={PROCUREMENT_ROLES}><PurchaseRequests /></RoleRoute>} />
        <Route path="purchase-orders" element={<RoleRoute roles={ORDER_ROLES}><PurchaseOrders /></RoleRoute>} />
        <Route path="contracts" element={<RoleRoute roles={ORDER_ROLES}><Contracts /></RoleRoute>} />

        {/* Finance */}
        <Route path="invoice-dashboard" element={<RoleRoute roles={INVOICE_ROLES}><InvoiceDashboard /></RoleRoute>} />
        <Route path="invoices" element={<RoleRoute roles={INVOICE_ROLES}><Invoices /></RoleRoute>} />
        <Route path="customers" element={
          <RoleRoute roles={['admin', 'finance']}>
            <Customers />
          </RoleRoute>
        } />
        <Route path="payments" element={
          <RoleRoute roles={['admin', 'finance', 'auditor']}>
            <Payments />
          </RoleRoute>
        } />

        {/* AI */}
        <Route path="ai" element={<RoleRoute roles={AI_BROAD_ROLES}><Copilot /></RoleRoute>} />
        <Route path="ai/search" element={<RoleRoute roles={AI_BROAD_ROLES}><DocumentSearch /></RoleRoute>} />
        <Route path="ai/contracts" element={<RoleRoute roles={AI_CONTRACT_ROLES}><ContractIntelligence /></RoleRoute>} />
        <Route path="ai/invoices" element={<RoleRoute roles={AI_INVOICE_ROLES}><InvoiceIntelligence /></RoleRoute>} />

        {/* HR & Payroll — temporarily removed from scope; redirect any stale links */}
        <Route path="hr/*" element={<Navigate to="/" replace />} />

        {/* Documents & System */}
        <Route path="documents" element={<Documents />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="audit-logs" element={<RoleRoute roles={['admin', 'auditor']}><AuditLogs /></RoleRoute>} />
        <Route path="reports" element={<RoleRoute roles={['admin', 'procurement_manager', 'finance', 'auditor']}><Reports /></RoleRoute>} />
        <Route path="users" element={<AdminRoute><UserManagement /></AdminRoute>} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <AppRoutes />
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
