import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from "./pages/Dashboard";
import Issues from './pages/Issues';
function App() {
  return (
    <BrowserRouter>
      <Routes>
  <Route path="/" element={<Navigate to="/login" />} />
  <Route path="/login" element={<Login />} />
  <Route path="/register" element={<Register />} />
  <Route path="/dashboard" element={<Dashboard />} />
  <Route path="/issues" element={<Issues />} />
      </Routes>
    </BrowserRouter>
  );
}
export default App;
