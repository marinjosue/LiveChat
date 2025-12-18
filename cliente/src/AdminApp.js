import React, { useState, useEffect } from 'react';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';

const BACKEND_URL = process.env.REACT_APP_SOCKET_URL;

function AdminApp() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminData, setAdminData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(localStorage.getItem('livechat-theme') || 'dark');

  // Verificar token al cargar y al recargar la página
  useEffect(() => {
    const checkAuthStatus = async () => {
      const token = localStorage.getItem('adminToken');
      const savedAdmin = localStorage.getItem('adminData');
      
      if (token && savedAdmin) {
        try {
          // Verificar que el token siga siendo válido
          const response = await fetch(`${BACKEND_URL}/api/admin/stats`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            const parsedAdmin = JSON.parse(savedAdmin);
            setAdminData(parsedAdmin);
            setIsAuthenticated(true);
            console.log('✅ Sesión restaurada para:', parsedAdmin.username);
          } else {
            // Token inválido, limpiar
            console.warn('⚠️ Token inválido, limpiando sesión');
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminData');
          }
        } catch (error) {
          console.error('❌ Error verificando token:', error);
          localStorage.removeItem('adminToken');
          localStorage.removeItem('adminData');
        }
      }
      
      setLoading(false);
    };
    
    checkAuthStatus();
  }, []);

  // Aplicar tema
  useEffect(() => {
    const appContainer = document.querySelector('.admin-app');
    if (appContainer) {
      if (theme === 'light') {
        appContainer.classList.add('light-theme');
      } else {
        appContainer.classList.remove('light-theme');
      }
    }
    localStorage.setItem('livechat-theme', theme);
  }, [theme]);

  const handleLoginSuccess = (admin) => {
    setAdminData(admin);
    setIsAuthenticated(true);
    // Guardar datos del admin para persistencia
    localStorage.setItem('adminData', JSON.stringify(admin));
    console.log('✅ Sesión iniciada para:', admin.username);
  };

  const handleLogout = () => {
    setAdminData(null);
    setIsAuthenticated(false);
    // Limpiar datos guardados
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminData');
    console.log('✅ Sesión cerrada');
  };

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'dark' ? 'light' : 'dark');
  };

  if (loading) {
    return (
      <div className="admin-app">
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <div style={{
            width: '3rem',
            height: '3rem',
            border: '3px solid #e2e8f0',
            borderRadius: '50%',
            borderTopColor: '#3b82f6',
            animation: 'spin 1s ease-in-out infinite'
          }}></div>
          <p style={{ color: '#64748b' }}>Verificando sesión...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-app">
      {isAuthenticated ? (
        <AdminDashboard admin={adminData} onLogout={handleLogout} theme={theme} toggleTheme={toggleTheme} />
      ) : (
        <AdminLogin onLoginSuccess={handleLoginSuccess} theme={theme} toggleTheme={toggleTheme} />
      )}
    </div>
  );
}

export default AdminApp;
