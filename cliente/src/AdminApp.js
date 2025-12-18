import React, { useState, useEffect } from 'react';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';

const BACKEND_URL = process.env.REACT_APP_SOCKET_URL;

// Función segura para validar y parsear datos de admin
const safeParseAdminData = (data) => {
  try {
    if (!data || typeof data !== 'string') {
      return null;
    }
    
    const parsed = JSON.parse(data);
    
    // Validar estructura esperada del objeto admin
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    
    // Validar que tenga los campos requeridos
    if (!parsed.username || typeof parsed.username !== 'string') {
      return null;
    }
    
    // Sanitizar datos para prevenir XSS
    return {
      username: String(parsed.username).replace(/[<>\"']/g, ''),
      email: parsed.email ? String(parsed.email).replace(/[<>\"']/g, '') : undefined,
      role: parsed.role ? String(parsed.role).replace(/[<>\"']/g, '') : undefined,
      id: parsed.id ? String(parsed.id).replace(/[<>\"']/g, '') : undefined
    };
  } catch (error) {
    console.error('Error al parsear datos de admin:', error);
    return null;
  }
};

// Función segura para obtener tema
const safeGetTheme = () => {
  try {
    const storedTheme = localStorage.getItem('livechat-theme');
    return (storedTheme === 'light' || storedTheme === 'dark') ? storedTheme : 'dark';
  } catch (error) {
    return 'dark';
  }
};

function AdminApp() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminData, setAdminData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(safeGetTheme());

  // Verificar token al cargar y al recargar la página
  useEffect(() => {
    const checkAuthStatus = async () => {
      let token, savedAdmin;
      
      try {
        token = localStorage.getItem('adminToken');
        savedAdmin = localStorage.getItem('adminData');
      } catch (error) {
        console.error('Error al acceder a localStorage:', error);
        setLoading(false);
        return;
      }
      
      if (token && savedAdmin) {
        try {
          // Verificar que el token siga siendo válido
          const response = await fetch(`${BACKEND_URL}/api/admin/stats`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            // Parsear de forma segura los datos del admin
            const parsedAdmin = safeParseAdminData(savedAdmin);
            
            if (parsedAdmin && parsedAdmin.username) {
              setAdminData(parsedAdmin);
              setIsAuthenticated(true);
              console.log('✅ Sesión restaurada para:', parsedAdmin.username);
            } else {
              console.warn('⚠️ Datos de admin inválidos');
              localStorage.removeItem('adminToken');
              localStorage.removeItem('adminData');
            }
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
    try {
      // Usar un ID específico en lugar de clase genérica para evitar conflictos
      const appContainer = document.getElementById('admin-app-root') || 
                          document.querySelector('[data-admin-app="true"]');
      
      if (appContainer) {
        if (theme === 'light') {
          appContainer.classList.add('light-theme');
        } else {
          appContainer.classList.remove('light-theme');
        }
      }
      
      // Validar tema antes de guardar
      if (theme === 'light' || theme === 'dark') {
        localStorage.setItem('livechat-theme', theme);
      }
    } catch (error) {
      console.error('Error aplicando tema:', error);
    }
  }, [theme]);

  const handleLoginSuccess = (admin) => {
    try {
      // Sanitizar datos del admin antes de guardar
      const sanitizedAdmin = {
        username: String(admin.username || '').replace(/[<>\"']/g, ''),
        email: admin.email ? String(admin.email).replace(/[<>\"']/g, '') : undefined,
        role: admin.role ? String(admin.role).replace(/[<>\"']/g, '') : undefined,
        id: admin.id ? String(admin.id).replace(/[<>\"']/g, '') : undefined
      };
      
      setAdminData(sanitizedAdmin);
      setIsAuthenticated(true);
      
      // Guardar datos del admin para persistencia
      localStorage.setItem('adminData', JSON.stringify(sanitizedAdmin));
      console.log('✅ Sesión iniciada para:', sanitizedAdmin.username);
    } catch (error) {
      console.error('Error al guardar sesión:', error);
    }
  };

  const handleLogout = () => {
    try {
      setAdminData(null);
      setIsAuthenticated(false);
      // Limpiar datos guardados de forma segura
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminData');
      console.log('✅ Sesión cerrada');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      // Aún así intentar limpiar el estado
      setAdminData(null);
      setIsAuthenticated(false);
    }
  };

  const toggleTheme = () => {
    setTheme(prevTheme => {
      const newTheme = prevTheme === 'dark' ? 'light' : 'dark';
      return newTheme;
    });
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
    <div className="admin-app" id="admin-app-root" data-admin-app="true">
      {isAuthenticated ? (
        <AdminDashboard admin={adminData} onLogout={handleLogout} theme={theme} toggleTheme={toggleTheme} />
      ) : (
        <AdminLogin onLoginSuccess={handleLoginSuccess} theme={theme} toggleTheme={toggleTheme} />
      )}
    </div>
  );
}

export default AdminApp;
