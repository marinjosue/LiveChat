import React, { useState, useEffect } from 'react';
import axios from 'axios';
import CreateRoom from './CreateRoom';
import RoomManagement from './RoomManagement';
import { BarChart3, Home, ScrollText, Shield, Settings, LogOut, Sun, Moon, Server, Database, Activity, Lock, Folder, Check, Info } from 'lucide-react';
import '../styles/AdminDashboard.css';

const BACKEND_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001';

function AdminDashboard({ admin, onLogout, theme, toggleTheme }) {
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'logs' | 'security' | 'createRoom' | 'rooms' | 'management' | 'settings'
  const [qrCode, setQrCode] = useState(null);
  const [secret2FA, setSecret2FA] = useState(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [enable2FALoading, setEnable2FALoading] = useState(false);

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 10000); // Actualizar cada 10s
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDashboardData = async () => {
    const token = localStorage.getItem('adminToken');
    if (!token) return;

    try {
      const config = {
        headers: { 'Authorization': `Bearer ${token}` }
      };

      const [statsRes, logsRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/admin/stats`, config),
        axios.get(`${BACKEND_URL}/api/admin/logs?limit=10`, config)
      ]);

      setStats(statsRes.data);
      setLogs(logsRes.data.logs || []);
      setError('');
    } catch (err) {
      if (err.response?.status === 401) {
        handleLogout();
      } else {
        setError('Error al cargar datos del dashboard');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    onLogout();
  };

  const handleRoomCreated = (newRoom) => {
    // Cambiar a la pestaña de gestión de salas para ver la nueva sala
    setActiveTab('rooms');
  };

  const handleEnable2FA = async () => {
    setEnable2FALoading(true);
    const token = localStorage.getItem('adminToken');
    
    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/auth/enable-2fa`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        setQrCode(response.data.qrCode);
        setSecret2FA(response.data.secret);
        setError('');
      }
    } catch (err) {
      setError('Error al habilitar 2FA: ' + (err.response?.data?.message || err.message));
    } finally {
      setEnable2FALoading(false);
    }
  };

  const handleVerify2FA = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError('Por favor ingresa un código de 6 dígitos');
      return;
    }

    const token = localStorage.getItem('adminToken');
    
    try {
      console.log('Verificando código 2FA...', {
        url: `${BACKEND_URL}/api/auth/confirm-2fa`,
        code: verificationCode
      });

      const response = await axios.post(
        `${BACKEND_URL}/api/auth/confirm-2fa`,
        { code: verificationCode },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      console.log('Respuesta 2FA:', response.data);

      if (response.data.success) {
        alert('✅ 2FA habilitado exitosamente!');
        setQrCode(null);
        setSecret2FA(null);
        setVerificationCode('');
        setError('');
        loadDashboardData();
      }
    } catch (err) {
      console.error('Error al verificar 2FA:', err);
      console.error('Error response:', err.response);
      
      if (err.response) {
        // El servidor respondió con un código de error
        setError(err.response.data?.message || 'Código inválido');
      } else if (err.request) {
        // La petición fue hecha pero no hubo respuesta
        setError('No se pudo conectar con el servidor. Verifica que esté corriendo en ' + BACKEND_URL);
      } else {
        // Error al configurar la petición
        setError('Error: ' + err.message);
      }
    }
  };

  const handleDisable2FA = async () => {
    if (!window.confirm('¿Estás seguro de deshabilitar 2FA? Esto reducirá la seguridad de tu cuenta.')) {
      return;
    }
    
    const token = localStorage.getItem('adminToken');
    
    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/auth/disable-2fa`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        alert('✅ 2FA deshabilitado');
        loadDashboardData();
      }
    } catch (err) {
      setError('Error al deshabilitar 2FA: ' + (err.response?.data?.message || err.message));
    }
  };

  const getLogStatusBadge = (status) => {
    const badges = {
      success: { color: '#4caf50', text: '✓ Éxito' },
      failure: { color: '#f44336', text: '✗ Fallo' },
      warning: { color: '#ff9800', text: '⚠ Advertencia' },
      info: { color: '#2196f3', text: 'ℹ Info' }
    };
    const badge = badges[status] || badges.info;
    return <span className="log-badge" style={{ backgroundColor: badge.color }}>{badge.text}</span>;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('es-ES');
  };

  if (loading) {
    return (
      <div className="admin-dashboard">
        <div className="loading">Cargando dashboard...</div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <header className="dashboard-header">
        <div className="header-left">
          <div className="header-title">
            <Shield size={32} className="header-icon" />
            <h1>Panel de Administración</h1>
          </div>
          <p>Bienvenido, <strong>{admin.username}</strong>
            <span className={`role-badge role-${admin.role}`}>
              {admin.role === 'superadmin' ? 'Super Admin' : 'Admin'}
            </span>
          </p>
        </div>
        <div className="header-actions">
          <button 
            className="theme-toggle-dashboard" 
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button className="btn-logout" onClick={handleLogout}>
            <LogOut size={18} />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </header>

      {error && (
        <div className="dashboard-error">
          {error}
        </div>
      )}

      <nav className="dashboard-tabs">
        <button 
          className={activeTab === 'overview' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('overview')}
        >
          <BarChart3 size={18} />
          <span>Overview</span>
        </button>
        <button 
          className={activeTab === 'createRoom' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('createRoom')}
        >
          <Home size={18} />
          <span>Crear Sala</span>
        </button>
        <button 
          className={activeTab === 'rooms' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('rooms')}
        >
          <Home size={18} />
          <span>Gestionar Salas</span>
        </button>
        <button 
          className={activeTab === 'logs' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('logs')}
        >
          <ScrollText size={18} />
          <span>Logs de Auditoría</span>
        </button>
        <button 
          className={activeTab === 'security' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('security')}
        >
          <Shield size={18} />
          <span>Seguridad</span>
        </button>
        {admin.role === 'superadmin' && (
          <button 
            className={activeTab === 'management' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('management')}
          >
            <Settings size={18} />
            <span>Gestión de Admins</span>
          </button>
        )}
        <button 
          className={activeTab === 'settings' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('settings')}
        >
          <Settings size={18} />
          <span>Configuración</span>
        </button>
      </nav>

      {activeTab === 'overview' && stats && (
        <div className="tab-content">
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon"><Server size={32} /></div>
              <div className="stat-content">
                <h3>Servidor</h3>
                <p className="stat-value">{stats.server?.uptime || 'N/A'}</p>
                <small>Uptime</small>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon"><Database size={32} /></div>
              <div className="stat-content">
                <h3>Memoria</h3>
                <p className="stat-value">
                  {stats.server?.memory?.usedMB?.toFixed(1) || '0'} MB
                </p>
                <small>
                  de {stats.server?.memory?.totalMB?.toFixed(1) || '0'} MB
                </small>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon"><Activity size={32} /></div>
              <div className="stat-content">
                <h3>Workers Globales</h3>
                <p className="stat-value">
                  {stats.threadPools?.global?.activeWorkers || 0}/{stats.threadPools?.global?.totalWorkers || 0}
                </p>
                <small>Activos/Total</small>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon"><Lock size={32} /></div>
              <div className="stat-content">
                <h3>Pool de Auth</h3>
                <p className="stat-value">
                  {stats.threadPools?.auth?.queueSize || 0}
                </p>
                <small>Tareas en cola</small>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon"><Folder size={32} /></div>
              <div className="stat-content">
                <h3>Pool de Archivos</h3>
                <p className="stat-value">
                  {stats.threadPools?.fileSecurity?.queueSize || 0}
                </p>
                <small>Tareas en cola</small>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon"><BarChart3 size={32} /></div>
              <div className="stat-content">
                <h3>Utilización</h3>
                <p className="stat-value">
                  {(stats.threadPools?.global?.utilization * 100)?.toFixed(1) || '0'}%
                </p>
                <small>Workers globales</small>
              </div>
            </div>
          </div>

          <div className="performance-section">
            <h2>⚡ Métricas de Rendimiento</h2>
            <div className="performance-grid">
              <div className="performance-item">
                <span className="perf-label">Tiempo promedio de espera:</span>
                <span className="perf-value">
                  {stats.threadPools?.global?.avgWaitTime?.toFixed(2) || '0'} ms
                </span>
              </div>
              <div className="performance-item">
                <span className="perf-label">Tiempo promedio de ejecución:</span>
                <span className="perf-value">
                  {stats.threadPools?.global?.avgExecutionTime?.toFixed(2) || '0'} ms
                </span>
              </div>
              <div className="performance-item">
                <span className="perf-label">Pico de cola:</span>
                <span className="perf-value">
                  {stats.threadPools?.global?.peakQueueSize || 0} tareas
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'createRoom' && (
        <div className="tab-content">
          <div className="create-room-section">
            <h2>➕ Crear Nueva Sala de Chat</h2>
            <p className="section-subtitle">
              Como {admin.role === 'superadmin' ? 'Super Administrador' : 'Administrador'}, puedes crear salas de chat para los usuarios.
            </p>
            <div className="create-room-container">
              <CreateRoom 
                adminToken={localStorage.getItem('adminToken')}
                onRoomCreated={handleRoomCreated} 
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'rooms' && (
        <div className="tab-content">
          <RoomManagement />
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="tab-content">
          <div className="logs-section">
            <div className="logs-header">
              <h2><ScrollText size={24} /> Últimos 10 Logs de Auditoría</h2>
              <button className="btn-refresh" onClick={loadDashboardData}>
                🔄 Actualizar
              </button>
            </div>

            {logs.length === 0 ? (
              <p className="no-logs">No hay logs disponibles</p>
            ) : (
              <div className="logs-table">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Acción</th>
                      <th>Admin</th>
                      <th>Estado</th>
                      <th>IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log._id}>
                        <td>{formatDate(log.createdAt)}</td>
                        <td><code>{log.action}</code></td>
                        <td>{log.adminId?.username || 'N/A'}</td>
                        <td>{getLogStatusBadge(log.status)}</td>
                        <td><code>{log.ipAddress}</code></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="tab-content">
          <div className="security-section">
            <h2><Shield size={24} /> Estado de Seguridad</h2>
            
            <div className="security-checks">
              <div className="security-check success">
                <span className="check-icon"><Check size={16} /></span>
                <span className="check-text">Helmet configurado (CSP, HSTS, XSS Protection)</span>
              </div>
              <div className="security-check success">
                <span className="check-icon"><Check size={16} /></span>
                <span className="check-text">Rate Limiting activo en todas las rutas</span>
              </div>
              <div className="security-check success">
                <span className="check-icon"><Check size={16} /></span>
                <span className="check-text">Sanitización de inputs habilitada</span>
              </div>
              <div className="security-check success">
                <span className="check-icon"><Check size={16} /></span>
                <span className="check-text">Detección de actividad sospechosa activa</span>
              </div>
              <div className="security-check success">
                <span className="check-icon"><Check size={16} /></span>
                <span className="check-text">Worker Threads para análisis de esteganografía</span>
              </div>
              <div className="security-check success">
                <span className="check-icon"><Check size={16} /></span>
                <span className="check-text">Encriptación AES-256-GCM configurada</span>
              </div>
              <div className="security-check success">
                <span className="check-icon"><Check size={16} /></span>
                <span className="check-text">Logs de auditoría con hash de integridad</span>
              </div>
            </div>

            <div className="security-info">
              <h3><Info size={20} /> Información de Seguridad</h3>
              <ul>
                <li>Autenticación con JWT (expiración: 24 horas)</li>
                <li>2FA opcional con TOTP (compatible con Google Authenticator)</li>
                <li>Bloqueo de cuenta tras 5 intentos fallidos (30 minutos)</li>
                <li>Validación de archivos con 5 técnicas de detección de esteganografía</li>
                <li>Thread Pool Manager con auto-scaling (2-8 workers)</li>
                <li>Todos los logs tienen hash SHA-256 para no repudio</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'management' && admin.role === 'superadmin' && (
        <div className="tab-content">
          <div className="management-section">
            <h2>👥 Gestión de Administradores</h2>
            <p className="section-subtitle">
              Como Super Administrador, puedes gestionar otros administradores y sus permisos.
            </p>
            <div className="management-info">
              <div className="info-card">
                <h3>🔑 Roles Disponibles</h3>
                <ul>
                  <li><strong>Super Admin:</strong> Acceso total al sistema, puede crear/editar/eliminar admins y salas</li>
                  <li><strong>Admin:</strong> Puede crear salas de chat, ver estadísticas y logs</li>
                  <li><strong>Moderator:</strong> Solo puede ver logs y estadísticas (sin crear salas)</li>
                </ul>
              </div>
              <div className="info-card">
                <h3>📝 Para crear nuevos administradores</h3>
                <p>Ejecuta el siguiente comando en el servidor:</p>
                <code className="command-box">node scripts/createAdmin.js</code>
                <p className="mt-2">Durante el proceso, podrás elegir el rol del nuevo administrador.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="tab-content">
          <div className="settings-section">
            <h2>⚙️ Configuración de Cuenta</h2>
            
            <div className="settings-card">
              <div className="setting-header">
                <div>
                  <h3>🔐 Autenticación de Dos Factores (2FA)</h3>
                  <p className="setting-description">
                    Agrega una capa adicional de seguridad a tu cuenta. Necesitarás tu contraseña 
                    y un código de verificación generado por una app como Google Authenticator.
                  </p>
                </div>
                <div className="setting-status">
                  {admin.isEnabled2FA ? (
                    <span className="status-badge active">✓ Habilitado</span>
                  ) : (
                    <span className="status-badge inactive">✗ Deshabilitado</span>
                  )}
                </div>
              </div>

              {!admin.isEnabled2FA && !qrCode && (
                <div className="setting-actions">
                  <button 
                    className="btn-enable-2fa" 
                    onClick={handleEnable2FA}
                    disabled={enable2FALoading}
                  >
                    {enable2FALoading ? 'Generando...' : '🔑 Habilitar 2FA'}
                  </button>
                  <p className="help-text">
                    📱 Necesitarás una app de autenticación como Google Authenticator, 
                    Microsoft Authenticator o Authy.
                  </p>
                </div>
              )}

              {qrCode && (
                <div className="qr-section">
                  <div className="qr-steps">
                    <h4>Pasos para configurar 2FA:</h4>
                    <ol>
                      <li>Descarga una app de autenticación en tu móvil (Google Authenticator, Authy, etc.)</li>
                      <li>Escanea el código QR con la app</li>
                      <li>Ingresa el código de 6 dígitos que aparece en la app</li>
                    </ol>
                  </div>
                  
                  <div className="qr-container">
                    <img src={qrCode} alt="QR Code for 2FA" className="qr-image" />
                    <div className="secret-manual">
                      <p><strong>O ingresa manualmente:</strong></p>
                      <code className="secret-code">{secret2FA}</code>
                    </div>
                  </div>

                  <div className="verification-form">
                    <label>Código de verificación (6 dígitos):</label>
                    <div className="verification-input-group">
                      <input
                        type="text"
                        maxLength={6}
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="000000"
                        className="code-input"
                      />
                      <button 
                        className="btn-verify"
                        onClick={handleVerify2FA}
                        disabled={verificationCode.length !== 6}
                      >
                        Verificar y Activar
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {admin.isEnabled2FA && (
                <div className="setting-actions">
                  <button 
                    className="btn-disable-2fa" 
                    onClick={handleDisable2FA}
                  >
                    ⚠️ Deshabilitar 2FA
                  </button>
                  <p className="help-text warning">
                    ⚠️ Deshabilitar 2FA reducirá la seguridad de tu cuenta. Solo hazlo si has 
                    perdido acceso a tu dispositivo de autenticación.
                  </p>
                </div>
              )}
            </div>

            <div className="settings-info">
              <h3>ℹ️ Información de Seguridad</h3>
              <div className="info-grid">
                <div className="info-item">
                  <strong>Último login:</strong>
                  <span>{admin.lastLogin ? formatDate(admin.lastLogin) : 'Nunca'}</span>
                </div>
                <div className="info-item">
                  <strong>IP del último login:</strong>
                  <span><code>{admin.lastLoginIp || 'N/A'}</code></span>
                </div>
                <div className="info-item">
                  <strong>Cuenta creada:</strong>
                  <span>{formatDate(admin.createdAt)}</span>
                </div>
                <div className="info-item">
                  <strong>Rol:</strong>
                  <span className={`role-badge role-${admin.role}`}>
                    {admin.role === 'superadmin' ? '👑 Super Admin' : '🔑 Admin'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
