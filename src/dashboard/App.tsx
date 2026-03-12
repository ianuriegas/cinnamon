import { Navigate, Route, Routes } from "react-router";
import { useAuth } from "./hooks/useAuth";
import { BaseLayout } from "./layouts/BaseLayout";
import { ApiKeysPage } from "./pages/ApiKeysPage";
import { DefinitionsPage } from "./pages/DefinitionsPage";
import { NoTeamsPage } from "./pages/NoTeamsPage";
import { RequestAccessPage } from "./pages/RequestAccessPage";
import { RunDetailPage } from "./pages/RunDetailPage";
import { RunsPage } from "./pages/RunsPage";
import { SchedulesPage } from "./pages/SchedulesPage";
import { TeamsPage } from "./pages/TeamsPage";
import { UsersPage } from "./pages/UsersPage";

export function App() {
  const { user, isLoading, accessRequestsEnabled } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (user?.disabled && !user.isSuperAdmin) {
    return <RequestAccessPage user={user} accessRequestsEnabled={accessRequestsEnabled} />;
  }

  const hasTeams = user?.isSuperAdmin || (user?.teamIds && user.teamIds.length > 0) || false;
  if (user && !hasTeams) {
    return <NoTeamsPage user={user} />;
  }

  return (
    <Routes>
      <Route path="/" element={<BaseLayout />}>
        <Route index element={<RunsPage />} />
        <Route path="runs/:id" element={<RunDetailPage />} />
        <Route path="definitions" element={<DefinitionsPage />} />
        <Route path="schedules" element={<SchedulesPage />} />
        <Route path="admin/users" element={<UsersPage />} />
        <Route path="admin/api-keys" element={<ApiKeysPage />} />
        <Route path="admin/teams" element={<TeamsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
