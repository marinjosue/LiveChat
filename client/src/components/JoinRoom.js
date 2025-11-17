import React, { useState, useRef, useEffect } from 'react';
import socket from '../services/socketService';
import { LogIn, User, Key } from 'lucide-react';
import { Toast } from 'primereact/toast';
import 'primereact/resources/themes/lara-light-indigo/theme.css';
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';
import '../styles/JoinRoom.css';
import '../styles/CustomToast.css';
import { getClientIp } from '../utils/networkUtils';
import { saveCurrentRoom, getDeviceId } from '../utils/deviceManager';

const JoinRoom = ({ onRoomJoined, initialPin }) => {
  const [, setMessages] = useState([]);
  const [pin, setPin] = useState(initialPin || '');
  const [nickname, setNickname] = useState('');
  const toast = useRef(null);

  // Actualizar PIN cuando initialPin cambia
  useEffect(() => {
    if (initialPin) {
      setPin(initialPin);
    }
  }, [initialPin]);

  const handleJoinRoom = async () => {
    if (!nickname.trim() || pin.length !== 6) {
      toast.current.show({ severity: 'error', summary: 'Error', detail: 'Completa los campos correctamente', life: 3000 });
      return;
    }

    // Usar el deviceId real del dispositivo (no la IP)
    const deviceId = getDeviceId();
    console.log('🔍 DeviceId generado:', deviceId);

    socket.emit('joinRoom', { pin, nickname, deviceId }, (response) => {
      console.log('🔍 Respuesta completa de joinRoom:', response);
      if (response.success) {
        const roomType = response.roomType || 'multimedia';
        console.log('🎯 JoinRoom - PIN:', pin);
        console.log('🎯 JoinRoom - roomType recibido:', response.roomType);
        console.log('🎯 JoinRoom - roomType final:', roomType);
        saveCurrentRoom({ pin, nickname, roomType });
        toast.current.show({ severity: 'success', summary: 'Unido', detail: `Te has unido a la sala ${pin}`, life: 2000 });
        setTimeout(() => onRoomJoined(pin, nickname, roomType), 2000);
      } else {
        // Si es un error de bloqueo por múltiples navegadores, mostrar modal especial
        if (response.message && response.message.includes('ACCESO BLOQUEADO')) {
          // Mostrar modal con información detallada
          toast.current.show({ 
            severity: 'warn', 
            summary: 'Dispositivo ya en uso', 
            detail: response.message, 
            life: 8000,
            sticky: true
          });
        } else {
          // Error normal
          toast.current.show({ severity: 'error', summary: 'Error', detail: response.message, life: 5000 });
        }
      }
    });
  };
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



  return (
    <>
      <Toast ref={toast} position="top-right" />
      <div className="action-card">
        <LogIn size={48} className="card-icon" />
        <h2>Unirse a una Sala</h2>
        
        <div className="card-body">
          <div className="input-group">
            <label><User size={16} /> Nickname</label>
            <input
              type="text"
              placeholder="Tu nombre (máx. 12 caracteres)"
              value={nickname}
              onChange={(e) => setNickname(e.target.value.slice(0, 12))}
              maxLength={12}
              required
            />
          </div>
          <div className="input-group">
            <label><Key size={16} /> PIN de la Sala</label>
            <input 
              type="text" 
              value={pin} 
              onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} 
              placeholder="Ingresa el PIN de 6 dígitos" 
              maxLength={6}
            />
          </div>
          <button onClick={handleJoinRoom}>
            Unirse a la Sala
          </button>
        </div>
      </div>
    </>
  );
};

export default JoinRoom;
