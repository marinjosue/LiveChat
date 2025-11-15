import React, { useState, useEffect, useRef } from 'react';
import socket from '../services/socketService';
import { Send, LogOut, Users, MessageCircle, FileX } from 'lucide-react';
import { getDeviceId, clearCurrentRoom, updateRoomActivity, isReconnecting, finishReconnection, markPageRefreshing } from '../utils/deviceManager';
import { confirmDialog, ConfirmDialog } from 'primereact/confirmdialog';
import 'primereact/resources/themes/lara-light-indigo/theme.css';
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';
import { Toast } from 'primereact/toast'; 

/**
 * Componente ChatText - Sala de chat SOLO TEXTO
 * Para salas tipo 'text' sin capacidades multimedia
 */
const ChatText = ({ pin, nickname, onLeave }) => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState(1);
  const [limit, setLimit] = useState(null);
  const [isLastUser, setIsLastUser] = useState(false);

  const messagesEndRef = useRef(null);
  const toast = useRef(null);
  
  useEffect(() => {
    // Configurar intervalos para actualizar la actividad del usuario
    const activityInterval = setInterval(() => {
      updateRoomActivity();
    }, 30000); // Cada 30 segundos
    
    // Escuchar cuando el admin cierra la sala
    socket.on('roomClosedByAdmin', ({ message: msg }) => {
      toast.current?.show({
        severity: 'warn',
        summary: 'Sala Cerrada',
        detail: msg,
        life: 5000
      });
      
      // Esperar 5 segundos y luego salir
      setTimeout(() => {
        clearCurrentRoom();
        onLeave();
      }, 5000);
    });
    
    socket.on('chatMessage', ({ sender, text }) => {
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages(prev => [...prev, { sender, text, timestamp }]);
    });

    socket.on('userJoined', ({ count, limit: roomLimit }) => {
      setParticipants(count);
      setLimit(roomLimit);
      setIsLastUser(count === 1);
    });

    socket.on('userLeft', ({ count, limit: roomLimit }) => {
      setParticipants(count);
      setLimit(roomLimit);
      setIsLastUser(count === 1);
    });

    socket.on('isLastUser', (isLast) => {
      setIsLastUser(isLast);
    });

    // Solicitar mensajes previos cuando se conecta a la sala
    socket.emit('requestPreviousMessages', { pin });

    return () => {
      socket.off('chatMessage');
      socket.off('userJoined');
      socket.off('userLeft');
      socket.off('isLastUser');
      socket.off('roomClosedByAdmin');
      clearInterval(activityInterval);
    };
  }, [pin, onLeave]);

  useEffect(() => {
    socket.on('previousMessages', (messages) => {
      const formattedMessages = messages.map(msg => ({
        sender: msg.sender,
        text: msg.text,
        timestamp: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }));
      setMessages(formattedMessages);
    });

    return () => {
      socket.off('previousMessages');
    };
  }, []);

  useEffect(() => {
    // Verificar si estamos reconectando desde un refresh
    const handleReconnection = () => {
      if (isReconnecting()) {
        console.log("Reconectando después de recargar la página...");
        socket.emit('reconnectToRoom', { 
          pin, 
          nickname, 
          deviceId: getDeviceId() 
        }, (response) => {
          if (response.success) {
            console.log('Reconexión exitosa');
          } else {
            console.error('Error en reconexión:', response.message);
          }
          // Marcar reconexión como finalizada
          finishReconnection();
        });
      }
    };

    // Ejecutar al montar el componente
    handleReconnection();
    
    // Manejar evento de cierre de ventana o recarga
    const handleBeforeUnload = () => {
      markPageRefreshing(pin);
      socket.emit('pageRefreshing', { pin, deviceId: getDeviceId() });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [pin, nickname]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (message.trim() !== '') {
      socket.emit('sendMessage', { pin, text: message });
      setMessage('');
    }
  };

  const confirmExit = async () => {
    const deviceId = getDeviceId();

    confirmDialog({
      message: '¿Estás seguro de que deseas SALIR PERMANENTEMENTE? Perderás tu pertenencia a esta sala.',
      header: 'Salir definitivamente',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, salir definitivamente',
      rejectLabel: 'Cancelar',
      accept: async () => {
        console.log('🚪 Saliendo definitivamente de la sala...');
        
        // Salir permanentemente (eliminar pertenencia)
        try {
          await fetch(`http://localhost:3001/api/my-rooms/leave-permanently/${pin}/${deviceId}`, {
            method: 'DELETE'
          });
        } catch (error) {
          console.error('Error saliendo permanentemente:', error);
        }
        
        // Marcar que estamos saliendo intencionalmente
        socket.emit('intentionalLeave', { pin });
        
        // Salir de la sala
        socket.emit('leaveRoom', { pin, deviceId }, (response) => {
          console.log('✅ Respuesta del servidor:', response);
          
          // Generar nuevo deviceId para próxima sesión
          localStorage.removeItem('livechat-device-id');
          sessionStorage.removeItem('livechat-device-id');
          clearCurrentRoom();
          
          // Pequeño delay para asegurar que el servidor procesó todo
          setTimeout(() => {
            // Desconectar el socket completamente
            socket.disconnect();
            
            // Volver a la pantalla principal
            onLeave();
          }, 100);
        });
      }
    });
  };

  const minimizeRoom = async () => {
    const deviceId = getDeviceId();
    console.log('📱 Minimizando sala (manteniendo pertenencia)...');
    
    // Marcar que estamos saliendo intencionalmente (no recarga)
    socket.emit('intentionalLeave', { pin });
    
    // Esperar a que el servidor confirme la eliminación de la sesión
    socket.emit('leaveRoom', { pin, deviceId }, (response) => {
      console.log('✅ Respuesta del servidor:', response);
      clearCurrentRoom();
      
      // Pequeño delay para asegurar que el servidor procesó todo
      setTimeout(() => {
        onLeave();
      }, 100);
    });
  };

  const handleExit = async () => {
    confirmExit();
  };
  

  return (
    <div className="chat-wrapper text-only">
      <Toast ref={toast} position="top-right" />
      <ConfirmDialog />
      
      {/* Header con información de sala */}
      <header className="chat-header">
        <div className="chat-info">
          <div className="room-details">
            <h3 className="room-name">
              <MessageCircle size={20} /> Sala <strong>{pin}</strong> - {nickname}
            </h3>
            <span className="text-only-badge">
              <FileX size={14} />
              Solo Texto
            </span>
          </div>
          <div className="user-stats">
            <div className="user-count">
              <Users size={18} /> {participants} {limit ? `/ ${limit}` : ''}
              {isLastUser && <span className="last-user-badge"> (Último usuario)</span>}
            </div>
          </div>
        </div>
        <div className="chat-actions">
          <button className="minimize-btn modern-btn" onClick={minimizeRoom} title="Minimizar sala (mantener pertenencia)">
            <LogOut size={16} /> Minimizar
          </button>
          <button className="exit-btn danger-btn" onClick={handleExit} title="Salir permanentemente">
            ❌ Salir
          </button>
        </div>
      </header>
      
      {/* Indicador de sala solo texto */}
      <div className="chat-type-badge">
        <FileX size={16} />
        <span>Sala Solo Texto - Sin capacidades multimedia (imágenes, videos, archivos)</span>
      </div>
      
      <div className="messages-container">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.sender === nickname ? 'message-self' : 'message-other'}`}>
            <div className="message-header">
              <span className="sender-name">{msg.sender}</span>
              <small className="message-time">{msg.timestamp}</small>
            </div>
            <div className="message-content">
              <p>{msg.text}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <footer className="chat-input">
        <div className="input-container">
          <input
            type="text"
            className="message-input"
            placeholder="Escribe un mensaje de texto..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            maxLength={500}
          />
          <button className="send-btn" onClick={sendMessage} disabled={!message.trim()}>
            <Send size={20} />
          </button>
        </div>
      </footer>
    </div>
  );
  
};

export default ChatText;
