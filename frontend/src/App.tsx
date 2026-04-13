import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Entry from './pages/taker/Entry';
import Sandbox from './pages/taker/Sandbox';
import AdminLayout from './pages/admin/Layout';
import AdminDashboard from './pages/admin/Dashboard';
import Participants from './pages/admin/Participants';
import Exams from './pages/admin/Exams';
import Rooms from './pages/admin/Rooms';
import QuestionBank from './pages/admin/QuestionBank';
import AdminLogin from './pages/admin/Login';
import AdminManagement from './pages/admin/AdminManagement';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('adminToken');
  const location = useLocation();

  if (!token) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Admin Public Routes */}
        <Route path="/admin/login" element={<AdminLogin />} />

        {/* Admin Protected Routes with Layout Wrapper */}
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="participants" element={<Participants />} />
          <Route path="exams" element={<Exams />} />
          <Route path="rooms" element={<Rooms />} />
          <Route path="questions" element={<QuestionBank />} />
          <Route path="management" element={<AdminManagement />} />
        </Route>

        {/* Taker Engine Routes */}
        <Route path="/" element={<Entry />} />
        <Route path="/exam" element={<Entry />} />
        <Route path="/exam/sandbox" element={<Sandbox />} />
        
        {/* Default route mapping */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
