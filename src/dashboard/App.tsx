import { Navigate, Route, Routes } from "react-router";
import { BaseLayout } from "./layouts/BaseLayout";
import { AdminPage } from "./pages/AdminPage";
import { DefinitionsPage } from "./pages/DefinitionsPage";
import { RunDetailPage } from "./pages/RunDetailPage";
import { RunsPage } from "./pages/RunsPage";
import { SchedulesPage } from "./pages/SchedulesPage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<BaseLayout />}>
        <Route index element={<RunsPage />} />
        <Route path="runs/:id" element={<RunDetailPage />} />
        <Route path="definitions" element={<DefinitionsPage />} />
        <Route path="schedules" element={<SchedulesPage />} />
        <Route path="admin" element={<AdminPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
