import React, { useState, useRef, useEffect } from 'react';
import socket from '../services/socketService';
import { LogIn, User, Key } from 'lucide-react';
import { Toast } from 'primereact/toast';
import 'primereact/resources/themes/lara-light-indigo/theme.css';
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';
import '../styles/JoinRoom.css';
import { getClientIp } from '../utils/networkUtils';
import { saveCurrentRoom } from '../utils/deviceManager';

const JoinRoom = ({ onRoomJoined }) => {
  const [, setMessages] = useState([]);
  const [pin, setPin] = useState('');
  const [nickname, setNickname] = useState('');
  const toast = useRef(null);

  const handleJoinRoom = async () => {
    if (!nickname.trim() || pin.length !== 6) {
      toast.current.show({ severity: 'error', summary: 'Error', detail: 'Completa los campos correctamente', life: 3000 });
      return;
    }

    const ip = await getClientIp();
    if (!ip) {
      toast.current.show({ severity: 'error', summary: 'Error', detail: 'No se pudo obtener la IP', life: 3000 });
      return;
    }

    socket.emit('joinRoom', { pin, nickname, deviceId: ip }, (response) => {
      if (response.success) {
        saveCurrentRoom(pin, nickname);
        toast.current.show({ severity: 'success', summary: 'Unido', detail: `Te has unido a la sala ${pin}`, life: 2000 });
        setTimeout(() => onRoomJoined(pin, nickname), 2000);
      } else {
        toast.current.show({ severity: 'error', summary: 'Error', detail: response.message, life: 3000 });
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
          <label><User size={16} /> Nickname</label>
                <input
        type="text"
        placeholder="Tu nombre (máx. 12 caracteres)"
        value={nickname}
        onChange={(e) => setNickname(e.target.value.slice(0, 12))}
        maxLength={12}
        required
      />
          <label><Key size={16} /> PIN</label>
          <input type="text" value={pin} onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} placeholder="PIN de 6 dígitos" maxLength={6} />
          <button onClick={handleJoinRoom}>Unirse a la Sala</button>
        </div>
      </div>
    </>
  );
};

export default JoinRoom;
