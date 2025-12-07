import React, { useState, useRef } from 'react';
import { PlusCircle, Users, FileText, Film, User } from 'lucide-react';
import { Toast } from 'primereact/toast';
import 'primereact/resources/themes/lara-light-indigo/theme.css';
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';
import '../styles/CreateRoom.css';
import '../styles/CustomToast.css';
import Validators from '../utils/validators';

const ROOM_NAME_MAX_LENGTH = 30;
const MIN_PARTICIPANTS = 2;
const MAX_PARTICIPANTS = 50;
const ROOM_TYPES = {
  TEXT: 'text',
  MULTIMEDIA: 'multimedia'
};
const TOAST_DURATION = {
  ERROR: 3000,
  SUCCESS: 5000
};

const CreateRoom = ({ onRoomCreated, adminToken }) => {
  const [limit, setLimit] = useState(MIN_PARTICIPANTS);
  const [roomType, setRoomType] = useState('text'); 
  const [roomName, setRoomName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const toast = useRef(null);
  
  const validateForm = () => {
    if (!roomName.trim()) {
      return { isValid: false, message: 'El nombre de la sala es obligatorio' };
    }
    if (roomName.trim().length < 3) {
      return { isValid: false, message: 'El nombre debe tener al menos 3 caracteres' };
    }
    if (limit < MIN_PARTICIPANTS || limit > MAX_PARTICIPANTS) {
      return { isValid: false, message: `El límite debe estar entre ${MIN_PARTICIPANTS} y ${MAX_PARTICIPANTS} participantes` };
    }
    if (!Object.values(ROOM_TYPES).includes(roomType)) {
      return { isValid: false, message: 'Tipo de sala inválido' };
    }
    return { isValid: true };
  };

  const handleCreateRoom = async () => {
    if (isCreating) return; // Prevenir múltiples clicks
    
    const validation = validateForm();
    
    if (!validation.isValid) {
      toast.current.show({ 
        severity: 'error', 
        summary: 'Error de Validación', 
        detail: validation.message, 
        life: TOAST_DURATION.ERROR 
      });
      return;
    }

    if (!adminToken) {
      toast.current.show({ 
        severity: 'error', 
        summary: 'Error de Autenticación', 
        detail: 'Token de administrador requerido', 
        life: TOAST_DURATION.ERROR 
      });
      return;
    }

    setIsCreating(true);
    try {
      const BACKEND_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001';
      
      const payload = {
        name: roomName.trim(),
        roomType: roomType,
        maxParticipants: limit
      };
            
      const response = await fetch(`${BACKEND_URL}/api/admin/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.room) {
        const roomTypeLabel = roomType === 'multimedia' ? 'Multimedia' : 'Solo Texto';
        toast.current.show({ 
          severity: 'success', 
          summary: '✅ Sala Creada Exitosamente', 
          detail: `${data.room.name} (PIN: ${data.room.pin}) - Tipo: ${roomTypeLabel}`, 
          life: TOAST_DURATION.SUCCESS 
        });
        
        console.log('✅ Sala creada:', data.room);
        
        // Limpiar formulario
        setRoomName('');
        setLimit(MIN_PARTICIPANTS);
        setRoomType('text');
        
        if (onRoomCreated) {
          onRoomCreated(data.room);
        }
      } else {
        const errorMessage = data.message || 'Error desconocido al crear la sala';
        toast.current.show({ 
          severity: 'error', 
          summary: 'Error', 
          detail: errorMessage, 
          life: TOAST_DURATION.ERROR 
        });
      }
    } catch (error) {
      console.error('❌ Error creando sala:', error);
      const errorMessage = error.message || 'No se pudo crear la sala. Verifica tu conexión.';
      toast.current.show({ 
        severity: 'error', 
        summary: 'Error de Conexión', 
        detail: errorMessage, 
        life: TOAST_DURATION.ERROR 
      });
    } finally {
      setIsCreating(false);
    }
  };


  return (
    <>
      <Toast ref={toast} position="top-right" />
      <div className="action-card create-room-card">
        <div className="card-header">
          <PlusCircle size={48} className="card-icon" />
          <h2>Crear Nueva Sala de Chat</h2>
          <p className="card-subtitle">Configure los parámetros de su sala</p>
        </div>
        
        <div className="card-body">
          {/* Nombre de la Sala */}
          <div className="form-group">
            <label className="form-label">
              <FileText size={16} />
              Nombre de la Sala
            </label>
          <input
  type="text"
  className="form-input"
  value={roomName}
  onChange={(e) => {
    const raw = e.target.value;
    const sanitized = Validators.sanitizeRoomName(raw).slice(0, ROOM_NAME_MAX_LENGTH);

    if (raw !== sanitized && toast.current) {
      toast.current.show({
        severity: 'warn',
        summary: 'Formato inválido',
        detail: 'Solo se permiten letras y un espacio',
        life: 1800
      });
    }

    setRoomName(sanitized);
  }}
  maxLength={ROOM_NAME_MAX_LENGTH}
  placeholder="Ej: Sala de Trabajo"
  disabled={isCreating}
/>


            <small className="input-hint">
              {roomName.length}/{ROOM_NAME_MAX_LENGTH} caracteres
            </small>
          </div>

          {/* Tipo de Sala */}
          <div className="form-group">
            <label className="form-label">
              <User size={16} />
              Tipo de Sala
            </label>
            <div className="room-type-selector">
              <button
                type="button"
                className={`type-option ${roomType === 'text' ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  console.log('🔵 Cambiando a tipo TEXT');
                  setRoomType('text');
                }}
                disabled={isCreating}
              >
                <div className="type-icon"><FileText size={32} /></div>
                <div className="type-info">
                  <h4>Solo Texto</h4>
                  <p>Mensajes de texto únicamente</p>
                </div>
              </button>
              <button
                type="button"
                className={`type-option ${roomType === 'multimedia' ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  console.log('🔵 Cambiando a tipo MULTIMEDIA');
                  setRoomType('multimedia');
                }}
                disabled={isCreating}
              >
                <div className="type-icon"><Film size={32} /></div>
                <div className="type-info">
                  <h4>Multimedia</h4>
                  <p>Texto, imágenes, archivos y más</p>
                </div>
              </button>
            </div>
          </div>

          {/* Límite de Participantes */}
          <div className="form-group">
            <label className="form-label">
              <Users size={16} />
              Límite de Participantes
            </label>
            <div className="participant-slider">
              <input
                type="range"
                className="slider"
                value={limit}
                min={MIN_PARTICIPANTS}
                max={MAX_PARTICIPANTS}
                onChange={(e) => setLimit(Number(e.target.value))}
                disabled={isCreating}
              />
              <div className="slider-value">{limit} personas</div>
            </div>
          </div>

          <button 
            className={`btn-create ${isCreating ? 'loading' : ''}`} 
            onClick={handleCreateRoom}
            disabled={isCreating}
          >
            <PlusCircle size={20} />
            {isCreating ? 'Creando...' : 'Crear Sala'}
          </button>
        </div>
      </div>
    </>
  );
};

export default CreateRoom;
