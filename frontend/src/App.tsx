import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import Layout from "./components/Layout";
import Placeholder from "./components/Placeholder";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleRoute from "./components/RoleRoute";
import Dashboard from "./pages/Dashboard";
import IssueDetail from "./pages/IssueDetail";
import Issues from "./pages/Issues";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="issues" element={<Issues />} />
              <Route path="issues/:id" element={<IssueDetail />} />
              <Route path="approvals" element={<Placeholder title="Approvals" />} />
              <Route element={<RoleRoute roles={["admin"]} />}>
                <Route path="users" element={<Placeholder title="Users" />} />
              </Route>
              <Route element={<RoleRoute roles={["admin", "auditor"]} />}>
                <Route path="audit" element={<Placeholder title="Audit Logs" />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
