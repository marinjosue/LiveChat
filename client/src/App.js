import React, { useState, useEffect } from 'react';
import JoinRoom from './components/JoinRoom';
import RoomList from './components/RoomList';
import ChatMultimedia from './components/ChatMultimedia';
import ChatText from './components/chatText';
import { MessageSquare, Lock, Zap, Users, LogIn, Shield, Github, Sun, Moon } from 'lucide-react';
import './styles/App.css';
import { clearCurrentRoom, getCurrentRoom, saveCurrentRoom, getDeviceId, finishReconnection, markPageRefreshing } from './utils/deviceManager';
import socket from './services/socketService';

const App = () => {
  const [currentPin, setCurrentPin] = useState(null);
  const [nickname, setNickname] = useState('');
  const [roomType, setRoomType] = useState('multimedia');
  const [activeTab, setActiveTab] = useState('rooms');
  const [selectedRoomPin, setSelectedRoomPin] = useState(null);
  const [theme, setTheme] = useState(localStorage.getItem('livechat-theme') || 'dark');
  const [reconnecting, setReconnecting] = useState(false);

  // Efecto para verificar si hay una sala guardada al cargar la aplicación
  useEffect(() => {
    const checkAndReconnect = async () => {
      const savedRoom = getCurrentRoom();
      
      if (savedRoom && savedRoom.pin && savedRoom.nickname) {
        console.log('🔄 Sala guardada detectada, intentando reconectar...', savedRoom);
        setReconnecting(true);
        
        // Intentar reconectar a la sala
        socket.emit('reconnectToRoom', {
          pin: savedRoom.pin,
          nickname: savedRoom.nickname,
          deviceId: getDeviceId()
        }, (response) => {
          setReconnecting(false);
          
          if (response.success) {
            console.log('✅ Reconexión exitosa a la sala', savedRoom.pin);
            setCurrentPin(savedRoom.pin);
            setNickname(savedRoom.nickname);
            setRoomType(response.roomType || savedRoom.roomType || 'multimedia');
            
            // Actualizar datos guardados con el tipo correcto
            saveCurrentRoom({
              pin: savedRoom.pin,
              nickname: savedRoom.nickname,
              roomType: response.roomType || savedRoom.roomType || 'multimedia'
            });
            
            finishReconnection();
          } else {
            console.error('❌ Error en reconexión:', response.message);
            // Si falla la reconexión, limpiar la sala guardada
            clearCurrentRoom();
          }
        });
      }
    };
    
    checkAndReconnect();
  }, []);

  // Efecto para aplicar el tema actual
  useEffect(() => {
    const appContainer = document.querySelector('.app-container');
    if (appContainer) {
      if (theme === 'light') {
        appContainer.classList.add('light-theme');
      } else {
        appContainer.classList.remove('light-theme');
      }
    }
    localStorage.setItem('livechat-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'dark' ? 'light' : 'dark');
  };

  const handleRoomJoined = (pin, nick, type = 'multimedia') => {
    console.log('🎯 handleRoomJoined - Tipo de sala recibido:', type);
    setNickname(nick);
    setCurrentPin(pin);
    setRoomType(type);
    
    // Guardar la sala actual
    saveCurrentRoom({ pin, nickname: nick, roomType: type });
  };

  const handleRoomSelected = (pin) => {
    setSelectedRoomPin(pin);
    setActiveTab('join');
  };

  const handleLeaveRoom = () => {
    // LIMPIAR TODO al salir
    clearCurrentRoom();
    setNickname('');
    setCurrentPin(null);
    setRoomType('multimedia');
    setActiveTab('rooms');
    
    // Reconectar el socket si fue desconectado
    if (!socket.connected) {
      console.log('🔄 Reconectando socket después de salir...');
      socket.connect();
    }
  };

  return (
    <div className="app-container">
      {reconnecting ? (
        <div className="reconnecting-overlay">
          <div className="reconnecting-spinner">
            <div className="spinner"></div>
            <p>Reconectando a la sala...</p>
          </div>
        </div>
      ) : !currentPin ? (
        <div className="main-layout">
          {/* Header compacto */}
          <header className="compact-header">
            <div className="header-left">
              <div className="brand">
                <MessageSquare size={32} className="brand-icon" />
                <h1 className="brand-text">LiveChat</h1>
              </div>
              <p className="tagline">Comunicación segura en tiempo real</p>
            </div>
            <div className="header-right">
              <button onClick={toggleTheme} className="theme-toggle" title={theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}>
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <a href="/admin" className="admin-link">
                <Shield size={18} />
                <span>Panel Admin</span>
              </a>
            </div>
          </header>

          {/* Contenido principal - Ocupa todo el espacio */}
          <main className="main-content">
            {/* Tabs */}
            <div className="main-tabs">
              <button 
                className={`main-tab ${activeTab === 'rooms' ? 'active' : ''}`}
                onClick={() => setActiveTab('rooms')}
              >
                <Users size={20} />
                <span>Salas Disponibles</span>
              </button>
              <button 
                className={`main-tab ${activeTab === 'join' ? 'active' : ''}`}
                onClick={() => setActiveTab('join')}
              >
                <LogIn size={20} />
                <span>Unirse con PIN</span>
              </button>
            </div>

            {/* Contenido de tabs - Ocupa todo el espacio disponible */}
            <div className="tab-content-fullscreen">
              {activeTab === 'rooms' ? (
                <RoomList onRoomSelected={handleRoomSelected} />
              ) : (
                <div className="join-section">
                  <JoinRoom onRoomJoined={handleRoomJoined} initialPin={selectedRoomPin} />
                </div>
              )}
            </div>
          </main>

          {/* Footer profesional */}
          <footer className="compact-footer">
            <div className="footer-content">
              <div className="footer-features">
                <div className="footer-item">
                  <Lock size={16} />
                  <span>Conexión segura</span>
                </div>
                <div className="footer-item">
                  <Zap size={16} />
                  <span>Tiempo real</span>
                </div>
                <div className="footer-item">
                  <Users size={16} />
                  <span>Sesión única</span>
                </div>
              </div>
              <div className="footer-credits">
                <span className="footer-text">Desarrollado por José Marín, Elkin Pabon y Micaela Salcedo</span>
                <a 
                  href="https://github.com/marinjosue/LiveChat" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="github-link"
                >
                  <Github size={18} />
                  <span>Ver en GitHub</span>
                </a>
              </div>
            </div>
          </footer>
        </div>
      ) : (
        <div className={theme === 'light' ? 'app-container light-theme' : 'app-container'}>
          {roomType === 'text' ? (
            <ChatText pin={currentPin} nickname={nickname} onLeave={handleLeaveRoom} />
          ) : (
            <ChatMultimedia pin={currentPin} nickname={nickname} onLeave={handleLeaveRoom} />
          )}
        </div>
      )}
    </div>
  );
};

export default App;