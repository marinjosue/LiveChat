import React, { useState, useEffect } from 'react';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';

const BACKEND_URL = process.env.REACT_APP_SOCKET_URL;

// Función segura para validar y parsear datos de admin
// SECURITY: Implementa múltiples capas de validación para prevenir deserialización insegura
const safeParseAdminData = (data) => {
  try {
    // Capa 1: Validación de tipo de entrada
    if (!data || typeof data !== 'string') {
      return null;
    }
    
    // Capa 2: Validación de longitud para prevenir payloads maliciosos
    if (data.length > 10000) {
      console.warn('Datos exceden límite de seguridad');
      return null;
    }
    
    // Capa 3: Validación de caracteres peligrosos antes de parsear
    const dangerousPatterns = /<script|javascript:|onerror|onclick|onload|eval\(|constructor\(/gi;
    if (dangerousPatterns.test(data)) {
      console.warn('Patrón peligroso detectado en datos');
      return null;
    }
    
    // Capa 4: Parseo seguro con manejo de errores
    let parsed;
    try {
      parsed = JSON.parse(data);
    } catch (parseError) {
      console.error('Error en parseo JSON:', parseError);
      return null;
    }
    
    // Capa 5: Validación de estructura esperada del objeto
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    
    // Capa 6: Validación de campos requeridos
    if (!parsed.username || typeof parsed.username !== 'string') {
      return null;
    }
    
    // Capa 7: Validación de longitud de campos
    if (parsed.username.length > 100 || parsed.username.length < 1) {
      return null;
    }
    
    // Capa 8: Sanitización exhaustiva para prevenir XSS
    const sanitize = (str) => {
      if (!str) return undefined;
      return String(str)
        .replace(/[<>\"'`]/g, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+=/gi, '')
        .trim();
    };
    
    // Capa 9: Construcción de objeto seguro solo con propiedades permitidas
    return {
      username: sanitize(parsed.username),
      email: parsed.email ? sanitize(parsed.email) : undefined,
      role: parsed.role ? sanitize(parsed.role) : undefined,
      id: parsed.id ? sanitize(parsed.id) : undefined
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
      // SECURITY: Uso exclusivo de getElementById para evitar inyecciones
      // Se elimina querySelector por políticas de seguridad
      const appContainer = document.getElementById('admin-app-root');
      
      if (appContainer) {
        // Validar tema antes de aplicar
        if (theme === 'light') {
          appContainer.classList.add('light-theme');
          appContainer.classList.remove('dark-theme');
        } else if (theme === 'dark') {
          appContainer.classList.add('dark-theme');
          appContainer.classList.remove('light-theme');
        }
      }
      
      // Validación estricta del tema antes de guardar
      if (theme === 'light' || theme === 'dark') {
        localStorage.setItem('livechat-theme', theme);
      }
    } catch (error) {
      console.error('Error aplicando tema:', error);
    }
  }, [theme]);

  const handleLoginSuccess = (admin) => {
    try {
      // SECURITY: Validación exhaustiva antes de procesar datos del admin
      if (!admin || typeof admin !== 'object') {
        console.error('Datos de admin inválidos');
        return;
      }
      
      // Validación de campos requeridos
      if (!admin.username || typeof admin.username !== 'string') {
        console.error('Username inválido');
        return;
      }
      
      // Sanitización avanzada de datos del admin
      const sanitize = (str) => {
        if (!str) return undefined;
        return String(str)
          .replace(/[<>\"'`]/g, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+=/gi, '')
          .replace(/data:/gi, '')
          .trim()
          .substring(0, 100); // Límite de longitud
      };
      
      const sanitizedAdmin = {
        username: sanitize(admin.username),
        email: admin.email ? sanitize(admin.email) : undefined,
        role: admin.role ? sanitize(admin.role) : undefined,
        id: admin.id ? sanitize(admin.id) : undefined
      };
      
      // Validación final
      if (!sanitizedAdmin.username) {
        console.error('Sanitización falló');
        return;
      }
      
      setAdminData(sanitizedAdmin);
      setIsAuthenticated(true);
      
      // Guardar datos del admin para persistencia con serialización segura
      try {
        const serialized = JSON.stringify(sanitizedAdmin);
        localStorage.setItem('adminData', serialized);
        console.log('✅ Sesión iniciada para:', sanitizedAdmin.username);
      } catch (serializationError) {
        console.error('Error al serializar datos:', serializationError);
      }
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
