import React, { useState, useEffect, useRef } from 'react';
import socket from '../services/socketService';
import { Send, LogOut, Users, MessageCircle } from 'lucide-react';
import '../styles/ChatRoom.css';
import { getDeviceId, clearCurrentRoom, updateRoomActivity,isReconnecting,finishReconnection,markPageRefreshing } from '../utils/deviceManager';
import { confirmDialog, ConfirmDialog } from 'primereact/confirmdialog';
import 'primereact/resources/themes/lara-light-indigo/theme.css';
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';
import { getClientIp } from '../utils/networkUtils'; 

const ChatRoom = ({ pin, nickname, onLeave }) => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState(1);
  const [limit, setLimit] = useState(null);
  const [isLastUser, setIsLastUser] = useState(false);

  const messagesEndRef = useRef(null);
  
  useEffect(() => {
    // Configurar intervalos para actualizar la actividad del usuario
    const activityInterval = setInterval(() => {
      updateRoomActivity();
    }, 30000); // Cada 30 segundos
    
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
      clearInterval(activityInterval);
    };
  }, [pin]);

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
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (message.trim() !== '') {
      socket.emit('chatMessage', { pin, text: message });
      setMessage('');
    }
  };

  // Función para mostrar confirmación
const confirmExit = async () => {
  const ip = await getClientIp(); 
  const deviceId = getDeviceId();

  confirmDialog({
    message: '¿Estás seguro de que deseas salir? Al salir se eliminará tu conversación de esta sala.',
    header: 'Confirmar salida',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Sí, salir',
    rejectLabel: 'Cancelar',
    accept: async () => {
      // Elimina la sesión anterior en el backend
      socket.emit('leaveRoom', { pin, deviceId, ip }, () => {
        // Al salir, elimina el deviceId para que se genere uno nuevo en la próxima unión
        localStorage.removeItem('livechat-device-id');
        sessionStorage.removeItem('livechat-device-id');
        clearCurrentRoom();
        onLeave();
      });
    }
  });
};
  

  return (
    <div className="chat-wrapper">
      <header className="chat-topbar">
        <div className="room-info">
          <MessageCircle size={20} /> Sala <strong>{pin}</strong> - {nickname}
        </div>
        <div className="topbar-actions">
          <div className="user-count">
            <Users size={18} /> {participants} {limit ? `/ ${limit}` : ''}
            {isLastUser && <span className="last-user-badge"> (Último usuario)</span>}
          </div>
          <button className="exit-btn" onClick={confirmExit}>
            <LogOut size={16} /> Salir
          </button>
        </div>
      </header>

      <div className="chat-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`chat-message ${msg.sender === nickname ? 'self' : 'other'}`}>
            <span className="sender">{msg.sender} <small>{msg.timestamp}</small></span>
            <p>{msg.text}</p>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <footer className="chat-input-bar">
        <input
          type="text"
          placeholder="Escribe un mensaje..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
        />
        <button onClick={sendMessage}>
          <Send size={20} />
        </button>
      </footer>
      <ConfirmDialog />
    </div>
  );
  
};

export default ChatRoom;