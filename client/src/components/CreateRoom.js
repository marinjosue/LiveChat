import React, { useState, useRef } from 'react';
import socket from '../services/socketService';
import { PlusCircle, User, Users } from 'lucide-react';
import { Toast } from 'primereact/toast';
import { getClientIp } from '../utils/networkUtils';
import { saveCurrentRoom } from '../utils/deviceManager';
import 'primereact/resources/themes/lara-light-indigo/theme.css';
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';
import '../styles/CreateRoom.css';

const CreateRoom = ({ onRoomCreated }) => {
  const [limit, setLimit] = useState(2);
  const [nickname, setNickname] = useState('');
  const toast = useRef(null);
  
  const handleCreateRoom = async () => {
    if (!nickname.trim() || limit < 1) {
      toast.current.show({ severity: 'error', summary: 'Error', detail: 'Completa los campos correctamente', life: 3000 });
      return;
    }

    const ip = await getClientIp();
    if (!ip) {
      toast.current.show({ severity: 'error', summary: 'Error', detail: 'No se pudo obtener la IP', life: 3000 });
      return;
    }

    socket.emit('createRoom', { limit, nickname, deviceId: ip }, (response) => {
      if (response.success) {
        saveCurrentRoom(response.pin, nickname);
        toast.current.show({ severity: 'success', summary: 'Sala Creada', detail: `PIN ${response.pin}`, life: 2000 });
        setTimeout(() => onRoomCreated(response.pin, nickname), 2000);
      } else {
        toast.current.show({ severity: 'error', summary: 'Error', detail: response.message, life: 3000 });
      }
    });
  };


  return (
    <>
      <Toast ref={toast} position="top-right" />
      <div className="action-card">
        <PlusCircle size={48} className="card-icon" />
        <h2>Crear Nueva Sala</h2>
        <div className="card-body">
          <label><User size={16} /> Nickname</label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
          <label><Users size={16} /> Límite de Participantes</label>
          <input
            type="number"
            value={limit}
            min={2}
            max={20}
            onChange={(e) => setLimit(Number(e.target.value))}
          />
          <button onClick={handleCreateRoom}>Crear Sala</button>
        </div>
      </div>
    </>
  );
};

export default CreateRoom;
