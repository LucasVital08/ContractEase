import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AppLayout from '@/layouts/AppLayout';
import AuthGuard from '@/layouts/AuthGuard';

const DashboardPage = React.lazy(() => import('@/pages/DashboardPage'));
const ContractsPage = React.lazy(() => import('@/pages/ContractsPage'));
const CreateContractPage = React.lazy(() => import('@/pages/CreateContractPage'));
const ContractDetailPage = React.lazy(() => import('@/pages/ContractDetailPage'));
const TemplatesPage = React.lazy(() => import('@/pages/TemplatesPage'));
const AnalyticsPage = React.lazy(() => import('@/pages/AnalyticsPage'));
const FinancePage = React.lazy(() => import('@/pages/FinancePage'));
const SettingsPage = React.lazy(() => import('@/pages/SettingsPage'));
const NotFoundPage = React.lazy(() => import('@/pages/NotFoundPage'));
const LoginPage = React.lazy(() => import('@/pages/LoginPage'));
const RegisterPage = React.lazy(() => import('@/pages/RegisterPage'));
const ForgotPasswordPage = React.lazy(() => import('@/pages/ForgotPasswordPage'));
const ResetPasswordPage = React.lazy(() => import('@/pages/ResetPasswordPage'));
const PublicSignPage = React.lazy(() => import('@/pages/PublicSignPage'));
const VerifyPage = React.lazy(() => import('@/pages/VerifyPage'));
const AdminDashboardPage = React.lazy(() => import('@/pages/AdminDashboardPage'));
const PricingPage = React.lazy(() => import('@/pages/PricingPage'));
const IntegrationsPage = React.lazy(() => import('@/pages/IntegrationsPage'));
const SeedPage = React.lazy(() => import('@/pages/SeedPage'));
const StellarAnchorPage = React.lazy(() => import('@/pages/StellarAnchorPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1,
    },
  },
});

const LoadingFallback = () => <div className="p-8 text-neutral-500">Carregando...</div>;

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/sign/:contractId/:partyId" element={<PublicSignPage />} />
            <Route element={<AppLayout />}>
              <Route element={<AuthGuard />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="contracts" element={<ContractsPage />} />
                <Route path="contracts/new" element={<CreateContractPage />} />
                <Route path="contracts/:id" element={<ContractDetailPage />} />
                <Route path="templates" element={<TemplatesPage />} />
                <Route path="analytics" element={<AnalyticsPage />} />
                <Route path="finance" element={<FinancePage />} />
                <Route path="admin" element={<AdminDashboardPage />} />
                <Route path="verify" element={<VerifyPage />} />
                <Route path="integrations" element={<IntegrationsPage />} />
                <Route path="pricing" element={<PricingPage />} />
                <Route path="pricing" element={<PricingPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="seed" element={<SeedPage />} />
                <Route path="stellar-anchor" element={<StellarAnchorPage />} />
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
