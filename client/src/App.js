import React, { useState, useEffect } from 'react';
import CreateRoom from './components/CreateRoom';
import JoinRoom from './components/JoinRoom';
import ChatRoom from './components/ChatRoom';
import { Rocket, ShieldCheck, Palette, Server, GitBranch, Users, Code, Github, Sun, Moon } from 'lucide-react';
import './styles/App.css';
import { getCurrentRoom, clearCurrentRoom, getDeviceId } from './utils/deviceManager';
import socket from './services/socketService';

const App = () => {
  const savedRoom = getCurrentRoom(); 
  const [isReconnecting, setIsReconnecting] = useState(!!savedRoom);
  const [currentPin, setCurrentPin] = useState(savedRoom?.pin || null);
  const [nickname, setNickname] = useState(savedRoom?.nickname || '');
  const [activeTab, setActiveTab] = useState('join'); // 'join' or 'create'
  const [theme, setTheme] = useState('dark'); // 'dark' o 'light'

  useEffect(() => {
    if (savedRoom) {
      socket.emit('reconnectToRoom', { ...savedRoom, deviceId: getDeviceId() }, (response) => {
        if (!response.success) {
          clearCurrentRoom();
          setCurrentPin(null);
          setNickname('');
        }
        setIsReconnecting(false);
      });
    } else {
      setIsReconnecting(false);
    }
    
    // Iniciar animación del fondo
    initBackgroundAnimation();
    
    // Cargar tema guardado si existe
    const savedTheme = localStorage.getItem('livechat-theme');
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);
  
  // Efecto para aplicar el tema actual
  useEffect(() => {
    if (theme === 'light') {
      document.querySelector('.app-container').classList.add('light-theme');
    } else {
      document.querySelector('.app-container').classList.remove('light-theme');
    }
    // Guardar preferencia de tema
    localStorage.setItem('livechat-theme', theme);
  }, [theme]);
  
  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'dark' ? 'light' : 'dark');
  };
  
  const initBackgroundAnimation = () => {
    // Esta función se ejecutará una vez al montar el componente
    // Creará una animación de fondo usando canvas si es posible
    const canvas = document.getElementById('background-canvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const particlesArray = [];
    const numberOfParticles = 100;
    
    class Particle {
      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 5 + 1;
        this.speedX = Math.random() * 2 - 1;
        this.speedY = Math.random() * 2 - 1;
        this.color = `rgba(255, 255, 255, ${Math.random() * 0.2})`;
      }
      
      update() {
        this.x += this.speedX;
        this.y += this.speedY;
        
        if (this.x > canvas.width || this.x < 0) {
          this.speedX = -this.speedX;
        }
        if (this.y > canvas.height || this.y < 0) {
          this.speedY = -this.speedY;
        }
      }
      
      draw() {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    const init = () => {
      for (let i = 0; i < numberOfParticles; i++) {
        particlesArray.push(new Particle());
      }
    };
    
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < particlesArray.length; i++) {
        particlesArray[i].update();
        particlesArray[i].draw();
      }
      requestAnimationFrame(animate);
    };
    
    init();
    animate();
    
    window.addEventListener('resize', () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      init();
    });
  };

  const handleRoomCreated = (pin, nick) => {
    setNickname(nick);
    setCurrentPin(pin);
  };

  const handleRoomJoined = (pin, nick) => {
    setNickname(nick);
    setCurrentPin(pin);
  };

  const handleLeaveRoom = () => {
    clearCurrentRoom();
    setNickname('');
    setCurrentPin(null);
  };

  if (isReconnecting) {
    return (
      <div className="app-container">
        <header className="app-header">
          <h1 className="title">LiveChat</h1>
        </header>
        <main className="app-main">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Reconectando a la sala, por favor espere...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-container">
      <canvas id="background-canvas" className="background-canvas"></canvas>
      
      <header className="app-header">
        <div className="header-content">
          <button className="theme-toggle" onClick={toggleTheme} aria-label="Cambiar tema">
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <h1 className="title">LiveChat</h1>
          <div className="header-divider"></div>
          <p className="subtitle">Comunicación en tiempo real, segura y escalable</p>
        </div>
      </header>

      <main className="app-main">
        {!currentPin ? (
          <>
            <section className="hero-section">
              <div className="hero-content">
                <h2 className="hero-title">Bienvenido a LiveChat</h2>
                <p className="hero-description">
                  Una plataforma de comunicación en tiempo real construida con tecnologías modernas
                  que garantiza una experiencia fluida y segura para todos los usuarios.
                </p>
                <div className="tech-stack">
                  <div className="tech-item">
                    <Code size={20} />
                    <span>React.js</span>
                  </div>
                  <div className="tech-item">
                    <Server size={20} />
                    <span>Node.js</span>
                  </div>
                  <div className="tech-item">
                    <GitBranch size={20} />
                    <span>Socket.io</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="auth-card-container">
              <div className="auth-card">
                <div className="auth-tabs">
                  <button 
                    className={`auth-tab ${activeTab === 'join' ? 'active' : ''}`}
                    onClick={() => setActiveTab('join')}
                  >
                    Unirse a Sala
                  </button>
                  <button 
                    className={`auth-tab ${activeTab === 'create' ? 'active' : ''}`}
                    onClick={() => setActiveTab('create')}
                  >
                    Crear Sala
                  </button>
                </div>
                
                <div className="auth-content">
                  {activeTab === 'join' ? (
                    <div className="join-room-container animated-fade-in">
                      <JoinRoom onRoomJoined={handleRoomJoined} />
                    </div>
                  ) : (
                    <div className="create-room-container animated-fade-in">
                      <CreateRoom onRoomCreated={handleRoomCreated} />
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="features-section">
              <div className="feature-card">
                <Rocket size={32} />
                <h3>Comunicación Instantánea</h3>
                <p>Mensajería en tiempo real con respuestas inmediatas gracias a WebSockets.</p>
              </div>
              <div className="feature-card">
                <ShieldCheck size={32} />
                <h3>Seguridad Avanzada</h3>
                <p>Control de acceso por PIN único y verificación por dispositivo para mayor protección.</p>
              </div>
              <div className="feature-card">
                <Palette size={32} />
                <h3>Diseño Responsive</h3>
                <p>Interfaz adaptable optimizada para cualquier dispositivo y tamaño de pantalla.</p>
              </div>
              <div className="feature-card">
                <Users size={32} />
                <h3>Escalabilidad</h3>
                <p>Arquitectura diseñada para soportar múltiples salas simultáneas con alto rendimiento.</p>
              </div>
            </section>
          </>
        ) : (
          <ChatRoom pin={currentPin} nickname={nickname} onLeave={handleLeaveRoom} />
        )}
      </main>

      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-column">
            © {new Date().getFullYear()} LiveChat - Todos los derechos reservados
          </div>
          <div className="footer-column developer">
            Desarrollado por <strong>Autepim</strong>
          </div>
          <div className="footer-column github-link">
            <a href="https://github.com/marinjosue/LiveChat" target="_blank" rel="noopener noreferrer">
              <Github size={20} />
              <span>Ver código fuente</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;