import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AppLayout from '@/layouts/AppLayout';
import AuthGuard from '@/layouts/AuthGuard';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { setSessionClearedCallback } from '@/stores/useAuthStore';

const DashboardPage = React.lazy(() => import('@/pages/DashboardPage'));
const ContractsPage = React.lazy(() => import('@/pages/ContractsPage'));
const CreateContractPage = React.lazy(() => import('@/pages/CreateContractPage'));
const ContractDetailPage = React.lazy(() => import('@/pages/ContractDetailPage'));
const TemplatesPage = React.lazy(() => import('@/pages/TemplatesPage'));
const SmartContractsPage = React.lazy(() => import('@/pages/SmartContractsPage'));
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
const PublicProfilePage = React.lazy(() => import('@/pages/PublicProfilePage'));
const OpportunitiesPage = React.lazy(() => import('@/pages/OpportunitiesPage'));
const DocumentAuthPage = React.lazy(() => import('@/pages/DocumentAuthPage'));
const PartnersPage = React.lazy(() => import('@/pages/PartnersPage'));
const AffiliatesPage = React.lazy(() => import('@/pages/AffiliatesPage'));
const WalletPage = React.lazy(() => import('@/pages/WalletPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      retry: 1,
      // Keep showing cached data while refetching — prevents empty flicker
      placeholderData: (prev: unknown) => prev,
    },
  },
});

// Clear all cached data when the user logs out or switches accounts,
// so the next user never sees stale data from the previous session.
setSessionClearedCallback(() => queryClient.clear());

const LoadingFallback = () => (
  <div className="flex min-h-screen items-center justify-center gap-3 text-neutral-500">
    <span
      className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-700 border-t-emerald-500"
      role="status"
      aria-label="Carregando"
    />
    Carregando...
  </div>
);

function PublicHandleRoute() {
  const { handle } = useParams<{ handle: string }>();
  return handle?.startsWith('@') ? <PublicProfilePage /> : <NotFoundPage />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/sign/:contractId/:partyId" element={<PublicSignPage />} />
            <Route path="/opportunities/:opportunityId" element={<OpportunitiesPage />} />
            {/* Perfis públicos — acessíveis sem autenticação */}
            <Route path="/:handle" element={<PublicHandleRoute />} />
            <Route path="/profile/:handle" element={<PublicProfilePage />} />
            <Route element={<AppLayout />}>
              {/* Feed público — visível sem login, interações redirecionam p/ login */}
              <Route path="opportunities" element={<OpportunitiesPage />} />
              <Route element={<AuthGuard />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="contracts" element={<ContractsPage />} />
                <Route path="contracts/new" element={<CreateContractPage />} />
                <Route path="contracts/:id" element={<ContractDetailPage />} />
                <Route path="templates" element={<TemplatesPage />} />
                <Route path="smart-contracts" element={<SmartContractsPage />} />
                <Route path="partners" element={<PartnersPage />} />
                <Route path="affiliates" element={<AffiliatesPage />} />
                <Route path="wallet" element={<WalletPage />} />
                <Route path="analytics" element={<AnalyticsPage />} />
                <Route path="finance" element={<FinancePage />} />
                <Route path="admin" element={<AdminDashboardPage />} />
                <Route path="verify" element={<VerifyPage />} />
                <Route path="integrations" element={<IntegrationsPage />} />
                <Route path="pricing" element={<PricingPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="seed" element={<SeedPage />} />
                <Route path="stellar-anchor" element={<StellarAnchorPage />} />
                <Route path="document-auth" element={<DocumentAuthPage />} />
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
          </Suspense>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
