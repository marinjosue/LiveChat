import React, { useState } from 'react';
import axios from 'axios';
import { Shield, AlertCircle, Sun, Moon } from 'lucide-react';
import Validators from '../utils/validators';
import '../styles/AdminLogin.css';

const BACKEND_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001';

function AdminLogin({ onLoginSuccess, theme, toggleTheme }) {
  const [step, setStep] = useState('login'); // 'login' | '2fa'
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    code2fa: ''
  });
  const [tempToken, setTempToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    // Validar campos antes de enviar
const vUser = Validators.validateAdminUsername(formData.username);
    if (!vUser.ok) return setError(vUser.message);
    const vPass = Validators.validatePassword(formData.password);
    if (!vPass.ok) return setError(vPass.message);

    setLoading(true);

    try {
      const response = await axios.post(`${BACKEND_URL}/api/auth/login`, {
        username: formData.username,
        password: formData.password
      });

      if (response.data.requires2FA) {
        // Requiere 2FA
        setTempToken(response.data.tempToken);
        setStep('2fa');
      } else {
        // Login exitoso sin 2FA
        localStorage.setItem('adminToken', response.data.token);
        onLoginSuccess(response.data.admin);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e) => {
    e.preventDefault();
    setError('');
    // Validar código 2FA antes de enviar
    const v2 = Validators.validate2FACode(formData.code2fa);
    if (!v2.ok) return setError(v2.message);

    setLoading(true);

    try {
      const response = await axios.post(`${BACKEND_URL}/api/auth/verify-2fa`, {
        tempToken: tempToken,
        code: formData.code2fa
      });

      localStorage.setItem('adminToken', response.data.token);
      onLoginSuccess(response.data.admin);
    } catch (err) {
      setError(err.response?.data?.message || 'Código 2FA inválido');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    let newValue = value;
    if (name === 'username') {
  newValue = Validators.sanitizeAdminUsername(value);

  // si el usuario intentó meter algo inválido → mostrar error visual
  if (value !== newValue) {
    setError('Solo se permiten letras y números en el usuario');
  } else {
    setError('');
  }
}


    setFormData(prev => ({
      ...prev,
      [name]: newValue
    }));
  };

  return (
    <div className="admin-login-container">
      <div className="admin-login-card">
        <div className="admin-login-header">
          <div className="header-title">
            <Shield size={32} className="header-icon" />
            <h2>Administración LiveChat</h2>
          </div>
          <p>{step === 'login' ? 'Iniciar Sesión' : 'Autenticación 2FA'}</p>
          <button 
            className="theme-toggle-admin" 
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
            type="button"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>

        {error && (
          <div className="admin-error">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {step === 'login' ? (
          <form onSubmit={handleLogin} className="admin-login-form">
            <div className="form-group">
              <label htmlFor="username">Usuario</label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                disabled={loading}
                autoComplete="username"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Contraseña</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                disabled={loading}
                autoComplete="current-password"
              />
            </div>

            <button 
              type="submit" 
              className="btn-login"
              disabled={loading}
            >
              {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </button>

            <button 
              type="button" 
              className="btn-back"
              onClick={() => window.location.href = '/'}
              disabled={loading}
            >
              Volver al Inicio
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify2FA} className="admin-login-form">
            <div className="form-group">
              <label htmlFor="code2fa">Código 2FA</label>
              <input
                type="text"
                id="code2fa"
                name="code2fa"
                value={formData.code2fa}
                onChange={handleChange}
                required
                disabled={loading}
                placeholder="000000"
                maxLength="6"
                autoComplete="one-time-code"
              />
              <small>Ingresa el código de tu aplicación de autenticación</small>
            </div>

            <button 
              type="submit" 
              className="btn-login"
              disabled={loading}
            >
              {loading ? 'Verificando...' : 'Verificar Código'}
            </button>

            <button 
              type="button" 
              className="btn-back"
              onClick={() => setStep('login')}
              disabled={loading}
            >
              Volver
            </button>
          </form>
        )}

        <div className="admin-login-footer">
          <p>🔒 Conexión segura con TLS</p>
          <p>🛡️ Protegido con rate limiting</p>
        </div>
      </div>
    </div>
  );
}

export default AdminLogin;
