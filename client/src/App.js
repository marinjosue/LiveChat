import React, { useState, useEffect } from 'react';
import JoinRoom from './components/JoinRoom';
import RoomList from './components/RoomList';
import MyRooms from './components/MyRooms';
import ChatMultimedia from './components/ChatMultimedia';
import ChatText from './components/chatText';
import { MessageSquare, Lock, Zap, Users, LogIn, Shield, Github, Sun, Moon, History } from 'lucide-react';
import './styles/App.css';
import { getCurrentRoom, clearCurrentRoom, getDeviceId, saveCurrentRoom } from './utils/deviceManager';
import socket from './services/socketService';

const App = () => {
  const savedRoom = getCurrentRoom(); 
  const [isReconnecting, setIsReconnecting] = useState(!!savedRoom);
  const [currentPin, setCurrentPin] = useState(savedRoom?.pin || null);
  const [nickname, setNickname] = useState(savedRoom?.nickname || '');
  const [roomType, setRoomType] = useState(savedRoom?.roomType || 'multimedia');
  const [activeTab, setActiveTab] = useState('rooms'); 
  const [selectedRoomPin, setSelectedRoomPin] = useState(null);
  const [reconnectionAttempted, setReconnectionAttempted] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('livechat-theme') || 'dark');

  useEffect(() => {
    if (savedRoom && !reconnectionAttempted) {
      setReconnectionAttempted(true);
      
      const handleReconnection = () => {
        socket.emit('reconnectToRoom', { 
          pin: savedRoom.pin, 
          nickname: savedRoom.nickname, 
          deviceId: getDeviceId() 
        }, (response) => {
          if (response && response.success) {
            console.log('🎯 Reconexión exitosa - Tipo de sala:', response.roomType);
            // Actualizar el tipo de sala si viene en la respuesta
            if (response.roomType) {
              setRoomType(response.roomType);
              saveCurrentRoom({ 
                pin: savedRoom.pin, 
                nickname: savedRoom.nickname, 
                roomType: response.roomType 
              });
            }
          } else {
            console.warn('Reconexión fallida:', response?.message || 'Sin respuesta');
          }
          setIsReconnecting(false);
        });
      };

      // Intentar reconexión cuando el socket esté listo
      if (socket.connected) {
        handleReconnection();
      } else {
        socket.once('connect', handleReconnection);
      }

      // Limpiar listener
      return () => {
        socket.off('connect', handleReconnection);
      };
    } else {
      setIsReconnecting(false);
    }
  }, [savedRoom, reconnectionAttempted]);

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
    // Guardar información de la sala actual
    saveCurrentRoom({ pin, nickname: nick, roomType: type });
  };

  const handleRoomSelected = (pin) => {
    setSelectedRoomPin(pin);
    setActiveTab('join');
  };

  const handleMyRoomSelected = ({ pin, nickname, isReconnecting }) => {
    if (isReconnecting) {
      // Reconexión directa
      handleRoomJoined(pin, nickname);
    } else {
      // Unirse normalmente
      setSelectedRoomPin(pin);
      setActiveTab('join');
    }
  };

  const handleLeaveRoom = () => {
    clearCurrentRoom();
    setNickname('');
    setCurrentPin(null);
    setRoomType('multimedia');
    
    // Cambiar automáticamente a "Mis Salas" después de minimizar
    setActiveTab('myRooms');
    
    // Reconectar el socket si fue desconectado
    if (!socket.connected) {
      console.log('🔄 Reconectando socket después de salir...');
      socket.connect();
    }
  };

  if (isReconnecting) {
    return (
      <div className="app-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Reconectando a la sala...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {!currentPin ? (
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
                className={`main-tab ${activeTab === 'myRooms' ? 'active' : ''}`}
                onClick={() => setActiveTab('myRooms')}
              >
                <History size={20} />
                <span>Mis Salas</span>
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
              ) : activeTab === 'myRooms' ? (
                <MyRooms onRoomSelect={handleMyRoomSelected} />
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
        roomType === 'text' ? (
          <ChatText pin={currentPin} nickname={nickname} onLeave={handleLeaveRoom} />
        ) : (
          <ChatMultimedia pin={currentPin} nickname={nickname} onLeave={handleLeaveRoom} />
        )
      )}
    </div>
  );
};

export default App;