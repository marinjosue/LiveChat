import React, { useState, useEffect } from 'react';
import { History, Clock, Users, MessageCircle, LogIn, Trash2 } from 'lucide-react';
import { getDeviceId } from '../utils/deviceManager';
import '../styles/MyRooms.css';

const BACKEND_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001';

const MyRooms = ({ onRoomSelect }) => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadMyRooms();
  }, []);

  const loadMyRooms = async () => {
    try {
      setLoading(true);
      const deviceId = getDeviceId();
      
      const response = await fetch(`${BACKEND_URL}/api/my-rooms/${deviceId}`);
      const data = await response.json();
      
      if (data.success) {
        setRooms(data.rooms);
        setError('');
      } else {
        setError(data.message || 'Error al cargar salas');
      }
    } catch (err) {
      console.error('Error loading my rooms:', err);
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleReconnect = async (room) => {
    try {
      const deviceId = getDeviceId();
      
      // Verificar pertenencia antes de reconectar
      const response = await fetch(`${BACKEND_URL}/api/my-rooms/reconnect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pin: room.pin,
          deviceId,
          nickname: room.nickname
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Reconectar directamente (sin pasar por join)
        onRoomSelect({
          pin: room.pin,
          nickname: room.nickname,
          isReconnecting: true
        });
      } else {
        setError(data.message || 'No puedes reconectarte a esta sala');
        // Auto-refresh después de 3 segundos
        setTimeout(() => {
          loadMyRooms();
          setError('');
        }, 3000);
      }
    } catch (err) {
      console.error('Error reconnecting:', err);
      setError('Error al reconectar. Verifica tu conexión.');
    }
  };

  const handleLeavePermanently = async (room) => {
    if (!window.confirm(`¿Estás seguro de que quieres salir permanentemente de "${room.name}"? No podrás volver a entrar sin el PIN.`)) {
      return;
    }

    try {
      const deviceId = getDeviceId();
      
      const response = await fetch(`${BACKEND_URL}/api/my-rooms/leave-permanently/${room.pin}/${deviceId}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Recargar lista
        loadMyRooms();
      } else {
        setError(data.message || 'Error al salir de la sala');
      }
    } catch (err) {
      console.error('Error leaving permanently:', err);
      setError('Error al salir de la sala');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      return 'Hace menos de 1 hora';
    } else if (diffInHours < 24) {
      return `Hace ${Math.floor(diffInHours)} horas`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `Hace ${diffInDays} días`;
    }
  };

  const getRoomStatusColor = (room) => {
    if (room.isConnected) return '#10b981'; // Verde - conectado
    if (room.isFull) return '#ef4444'; // Rojo - lleno
    return '#6b7280'; // Gris - desconectado
  };

  const getRoomStatusText = (room) => {
    if (room.isConnected) return 'Conectado';
    if (room.isFull) return 'Sala llena';
    return 'Desconectado';
  };

  if (loading) {
    return (
      <div className="my-rooms-container">
        <div className="my-rooms-header">
          <History className="icon" />
          <h2>Mis Salas</h2>
        </div>
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Cargando tus salas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="my-rooms-container">
      <div className="my-rooms-header">
        <History className="icon" />
        <h2>Mis Salas</h2>
        <span className="room-count">{rooms.length} salas</span>
      </div>

      {error && (
        <div className="error-message">
          <p>{error}</p>
          <button onClick={loadMyRooms} className="retry-button">
            Reintentar
          </button>
        </div>
      )}

      {rooms.length === 0 ? (
        <div className="empty-state">
          <MessageCircle className="icon" />
          <h3>No tienes salas guardadas</h3>
          <p>Únete a una sala para que aparezca aquí y puedas volver fácilmente.</p>
        </div>
      ) : (
        <div className="rooms-grid">
          {rooms.map((room) => (
            <div key={room.pin} className="room-card">
              <div className="room-header">
                <div className="room-info">
                  <h3 className="room-name">{room.name}</h3>
                  <span className="room-pin">PIN: {room.pin}</span>
                </div>
                <div 
                  className="room-status" 
                  style={{ backgroundColor: getRoomStatusColor(room) }}
                >
                  {getRoomStatusText(room)}
                </div>
              </div>

              <div className="room-details">
                <div className="detail-item">
                  <Users className="icon" />
                  <span>{room.participantCount}/{room.maxParticipants} participantes</span>
                </div>
                
                <div className="detail-item">
                  <MessageCircle className="icon" />
                  <span>{room.messageCount} mensajes</span>
                </div>
                
                <div className="detail-item">
                  <Clock className="icon" />
                  <span>{formatDate(room.lastSeenAt)}</span>
                </div>
              </div>

              <div className="room-meta">
                <span className="nickname">Como: {room.nickname}</span>
                <span className="room-type">{room.roomType === 'multimedia' ? 'Multimedia' : 'Solo texto'}</span>
              </div>

              <div className="room-actions">
                <button 
                  className="reconnect-button"
                  onClick={() => handleReconnect(room)}
                  disabled={room.isFull && !room.isConnected}
                  title={room.isFull && !room.isConnected ? 'Sala llena' : 'Reconectar a esta sala'}
                >
                  <LogIn className="icon" />
                  Reconectar
                </button>
                
                <button 
                  className="leave-button"
                  onClick={() => handleLeavePermanently(room)}
                  title="Salir permanentemente de esta sala"
                >
                  <Trash2 className="icon" />
                  Salir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <div className="my-rooms-footer">
        <p>Las salas se mantienen hasta que el administrador las elimine o salgas permanentemente.</p>
      </div>
    </div>
  );
};

export default MyRooms;