import React, { useState, useEffect, useRef } from 'react';
import socket from '../services/socketService';
import { Send, Users, MessageCircle, FileX } from 'lucide-react';
import ParticipantsList from './ParticipantsList';
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
  const [participantsList, setParticipantsList] = useState([]);
  const [totalParticipants, setTotalParticipants] = useState(0);
  const [maxParticipants, setMaxParticipants] = useState(0);
  const [isPanelVisible, setIsPanelVisible] = useState(true);

  const messagesEndRef = useRef(null);
  const toast = useRef(null);
  const activityIntervalRef = useRef(null);
  
  useEffect(() => {
    // Configurar intervalos para actualizar la actividad del usuario
    activityIntervalRef.current = setInterval(() => {
      updateRoomActivity();
      // Enviar heartbeat al servidor
      socket.emit('userActivity', { pin, deviceId: getDeviceId() });
    }, 30000); // Cada 30 segundos
    
    // 🔧 LISTENER DE MENSAJES PREVIOS - Debe estar ANTES de solicitar los mensajes
    const handlePreviousMessages = (messages) => {
      console.log(`📨 Mensajes previos recibidos: ${messages.length}`);
      const formattedMessages = messages.map(msg => ({
        sender: msg.sender,
        text: msg.text,
        timestamp: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }));
      setMessages(formattedMessages);
    };
    
    socket.on('previousMessages', handlePreviousMessages);
    
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

    // Escuchar actualizaciones de la lista de usuarios
    socket.on('userListUpdate', ({ users, totalCount, maxParticipants: max }) => {
      console.log('📋 Lista de usuarios actualizada:', users);
      setParticipantsList(users);
      setTotalParticipants(totalCount);
      setMaxParticipants(max);
    });

    // Solicitar lista de usuarios al montar el componente
    socket.emit('requestUserList', { pin });

    // Escuchar advertencia de inactividad
    socket.on('inactivityWarning', ({ message: msg, secondsRemaining, reason }) => {
      if (reason === 'INACTIVITY_WARNING') {
        // Mostrar diálogo de confirmación con cuenta regresiva
        let countdown = secondsRemaining;
        
        const updateDialogMessage = () => {
          const messageElement = document.querySelector('.p-dialog-content p');
          if (messageElement) {
            messageElement.textContent = `${msg}\n\nSerás desconectado en ${countdown} segundos por inactividad.\n\n¿Deseas permanecer en la sala?`;
          }
        };
        
        const countdownInterval = setInterval(() => {
          countdown--;
          updateDialogMessage();
          
          if (countdown <= 0) {
            clearInterval(countdownInterval);
          }
        }, 1000);
        
        confirmDialog({
          message: `${msg}\n\nSerás desconectado en ${countdown} segundos por inactividad.\n\n¿Deseas permanecer en la sala?`,
          header: '⚠️ Advertencia de Inactividad',
          icon: 'pi pi-exclamation-triangle',
          acceptLabel: 'Sí, permanecer',
          rejectLabel: 'Salir ahora',
          accept: () => {
            // Usuario responde - enviar actividad
            clearInterval(countdownInterval);
            socket.emit('userActivity', { pin, deviceId: getDeviceId() });
            updateRoomActivity();
            console.log('✅ Usuario respondió - actividad actualizada');
          },
          reject: () => {
            // Usuario decide salir
            clearInterval(countdownInterval);
            clearCurrentRoom();
            onLeave();
          },
          onHide: () => {
            clearInterval(countdownInterval);
          }
        });
      } else if (reason === 'INACTIVITY_TIMEOUT') {
        // Desconexión definitiva
        toast.current?.show({
          severity: 'error',
          summary: 'Desconectado',
          detail: msg,
          life: 3000
        });
        
        setTimeout(() => {
          clearCurrentRoom();
          onLeave();
        }, 3000);
      }
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

    // ✅ NUEVO: Escuchar actualización de participantes en tiempo real
    socket.on('participantCountUpdate', ({ count, limit: roomLimit, isLastUser: isLast }) => {
      console.log(`👥 Actualización de participantes: ${count}/${roomLimit}`);
      setParticipants(count);
      setLimit(roomLimit);
      setIsLastUser(isLast);
    });

    socket.on('isLastUser', (isLast) => {
      setIsLastUser(isLast);
    });

    // 🔧 Solicitar mensajes previos DESPUÉS de configurar el listener
    console.log(`📤 Solicitando mensajes previos para sala ${pin}`);
    socket.emit('requestPreviousMessages', { pin });
    
    // ✅ Enviar actividad inicial al montar el componente
    socket.emit('userActivity', { pin, deviceId: getDeviceId() });

    return () => {
      socket.off('chatMessage');
      socket.off('userJoined');
      socket.off('userLeft');
      socket.off('participantCountUpdate');
      socket.off('isLastUser');
      socket.off('roomClosedByAdmin');
      socket.off('userListUpdate');
      socket.off('inactivityWarning');
      socket.off('previousMessages', handlePreviousMessages);
      if (activityIntervalRef.current) {
        clearInterval(activityIntervalRef.current);
        activityIntervalRef.current = null;
      }
    };
  }, [pin, onLeave]);

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
          if (response && response.success) {
            console.log('✅ Reconexión exitosa');
            // Enviar actividad inmediatamente
            socket.emit('userActivity', { pin, deviceId: getDeviceId() });
          } else {
            console.error('❌ Error en reconexión:', response?.message || 'Sin respuesta');
            // Si falla la reconexión, el usuario ya está en la sala (joinRoom se encargó)
            // Solo marcamos la reconexión como finalizada
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
      message: '¿Estás seguro de que deseas SALIR PERMANENTEMENTE? Esto liberará tu dispositivo para poder unirse a otra sala.',
      header: 'Salir de la sala',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, salir',
      rejectLabel: 'Cancelar',
      accept: async () => {
        console.log('🚪 Saliendo de la sala...');
        
        // Marcar que estamos saliendo intencionalmente
        socket.emit('intentionalLeave', { pin });
        
        // Salir de la sala
        socket.emit('leaveRoom', { pin, deviceId }, (response) => {
          console.log('✅ Respuesta del servidor:', response);
          
          // Limpiar datos guardados del dispositivo
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

  const handleExit = async () => {
    confirmExit();
  };
  return (
    <div className="chat-wrapper text-only">
      <Toast ref={toast} position="top-right" />
      <ConfirmDialog />
      
      <div className="chat-container-with-participants">
        {/* Panel de participantes */}
        <ParticipantsList 
          participants={participantsList}
          totalCount={totalParticipants}
          maxParticipants={maxParticipants}
          onVisibilityChange={setIsPanelVisible}
        />
        
        {/* Contenedor principal del chat */}
        <div className={`chat-main-area ${!isPanelVisible ? 'panel-hidden' : ''}`}>
          {/* Header con información de sala */}
          <header className="chat-topbar">
            <div className="room-info">
              <MessageCircle size={20} />
              <span>Sala <strong>{pin}</strong> - {nickname}</span>
              <span className="text-only-badge-small">
                <FileX size={12} />
                Solo Texto
              </span>
            </div>
            <div className="topbar-actions">
              <div className="user-count">
                <Users size={18} /> {participants} {limit ? `/ ${limit}` : ''}
                {isLastUser && <span className="last-user-badge"> (Último usuario)</span>}
              </div>
              <div className="room-buttons">
                <button className="exit-btn" onClick={handleExit} title="Salir de la sala">
                  ❌ <span>Salir</span>
                </button>
              </div>
            </div>
          </header>
      
          {/* Indicador de sala solo texto */}
          <div className="text-only-info">
            <FileX size={16} />
            <span>Sala Solo Texto - Sin capacidades multimedia (imágenes, videos, archivos)</span>
          </div>
      
          <div className="chat-messages">
            {messages.map((msg, idx) => (
              <div key={idx} className={`chat-message ${msg.sender === nickname ? 'self' : 'other'}`}>
                <div className="sender">
                  <strong>{msg.sender}</strong>
                  <small>{msg.timestamp}</small>
                </div>
                <p>{msg.text}</p>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <footer className="chat-input-bar">
            <input
              type="text"
              placeholder="Escribe un mensaje de texto..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              maxLength={500}
            />
            <button onClick={sendMessage} className="send-btn" disabled={!message.trim()}>
              <Send size={20} />
              <span>Enviar</span>
            </button>
          </footer>
        </div>
      </div>
    </div>
  );
  
};

export default ChatText;
