import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import Layout from './Layout';
import { ErrorBoundary } from './ErrorBoundary';
import LoginSignup from './LoginSignup';
import OrderList from './OrderList';
import OrderCreate from './OrderCreate';
import OrderDetail from './OrderDetail';
import Dashboard from './Dashboard';
import Upload from './Upload';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public auth route */}
        <Route path="/login" element={<LoginSignup />} />

        {/* Private layout routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout>
                <ErrorBoundary>
                  <OrderList />
                </ErrorBoundary>
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/orders/create"
          element={
            <ProtectedRoute>
              <Layout>
                <ErrorBoundary>
                  <OrderCreate />
                </ErrorBoundary>
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/orders/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <ErrorBoundary>
                  <OrderDetail />
                </ErrorBoundary>
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Layout>
                <ErrorBoundary>
                  <Dashboard />
                </ErrorBoundary>
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/upload"
          element={
            <ProtectedRoute>
              <Layout>
                <ErrorBoundary>
                  <Upload />
                </ErrorBoundary>
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Fallback routes */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
