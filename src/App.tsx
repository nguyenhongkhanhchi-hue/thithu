import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { StudentProvider } from "@/contexts/StudentContext";
import { LayoutProvider } from "@/contexts/LayoutContext";
import { ScreenInspector } from "@/components/ui/ScreenInspector";
import { CelebrationEffect } from "@/components/features/CelebrationEffect";
import HomePage from "@/pages/HomePage";
import ExamsPage from "@/pages/ExamsPage";
import AICreatePage from "@/pages/AICreatePage";
import SettingsPage from "@/pages/SettingsPage";
import GamePage from "@/pages/GamePage";
import ExamPage from "@/pages/ExamPage";
import LoginPage from "@/pages/LoginPage";
import LibraryPage from "@/pages/LibraryPage";
import ParentsPortal from "@/pages/ParentsPortal";
import MistakesPage from "@/pages/MistakesPage";

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const NotFound: React.FC = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-8 text-center">
    <div className="text-6xl mb-4">🔍</div>
    <h1 className="text-2xl font-bold text-gray-800 mb-2">
      Trang không tồn tại
    </h1>
    <a href="/" className="text-blue-600 underline mt-2">
      Quay về trang chủ
    </a>
  </div>
);

const AppRoutes: React.FC = () => (
  <Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/exams" element={<ExamsPage />} />
    <Route path="/ai-create" element={<AICreatePage />} />
    <Route path="/game" element={<GamePage />} />
    <Route path="/settings" element={<SettingsPage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/library" element={<LibraryPage />} />
    <Route path="/exam/:examId" element={<ExamPage />} />
    <Route path="/parents" element={<ParentsPortal />} />
    <Route path="/mistakes" element={<MistakesPage />} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App: React.FC = () => (
  <BrowserRouter>
    <AuthProvider>
      <LayoutProvider>
        <StudentProvider>
          <AppRoutes />
          <ScreenInspector />
          <Toaster position="top-center" richColors />
          <CelebrationEffect />
        </StudentProvider>
      </LayoutProvider>
    </AuthProvider>
  </BrowserRouter>
);


export default App;
