import {
  BrowserRouter,
  Routes,
  Route,
  Navigate
} from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Knowledge from "./pages/Knowledge";
import AIChat from "./pages/AIChat";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {

  return (

    <BrowserRouter>

      <Routes>

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/register"
          element={<Register />}
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="*"
          element={
            <Navigate
              to="/dashboard"
              replace
            />
          }
        />

        <Route
  path="/knowledge"
  element={
    <ProtectedRoute>
      <Knowledge />
    </ProtectedRoute>
  }
/>

<Route
  path="/ai-chat"
  element={<ProtectedRoute>
    <AIChat />
  </ProtectedRoute>}
/>

      </Routes>

    </BrowserRouter>
  );
}

export default App;