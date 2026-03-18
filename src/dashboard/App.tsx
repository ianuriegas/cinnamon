import { Navigate, Route, Routes } from "react-router";
import { useAuth } from "./hooks/useAuth";
import { BaseLayout } from "./layouts/BaseLayout";
import { ApiKeysPage } from "./pages/ApiKeysPage";
import { JobsPage } from "./pages/JobsPage";
import { NoTeamsPage } from "./pages/NoTeamsPage";
import { RequestAccessPage } from "./pages/RequestAccessPage";
import { RunDetailPage } from "./pages/RunDetailPage";
import { RunsPage } from "./pages/RunsPage";
import { TeamsPage } from "./pages/TeamsPage";
import { UsersPage } from "./pages/UsersPage";

export function App() {
  const { user, isLoading, accessRequestsEnabled, authEnabled } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
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
        <Route path="jobs" element={<JobsPage />} />
        <Route path="definitions" element={<Navigate to="/jobs" replace />} />
        <Route path="schedules" element={<Navigate to="/jobs" replace />} />
        <Route
          path="admin/users"
          element={authEnabled ? <UsersPage /> : <Navigate to="/" replace />}
        />
        <Route path="admin/api-keys" element={<ApiKeysPage />} />
        <Route path="admin/teams" element={<TeamsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
