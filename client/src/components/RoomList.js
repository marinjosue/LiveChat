import React, { useState, useEffect } from 'react';
import axios from 'axios';
import socket from '../services/socketService';
import { Users, Lock, Image, MessageSquare, RefreshCw, AlertCircle, Home } from 'lucide-react';
import '../styles/RoomList.css';

const BACKEND_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001';

function RoomList({ onRoomSelected }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadRooms();
    // Auto-refresh cada 10 segundos
    const interval = setInterval(loadRooms, 10000);
    
    // Escuchar eventos de socket para salas
    socket.on('roomCreated', (newRoom) => {
      console.log('Nueva sala creada:', newRoom);
      setRooms(prevRooms => [newRoom, ...prevRooms]);
    });
    
    socket.on('roomDeleted', ({ pin }) => {
      console.log('Sala eliminada:', pin);
      setRooms(prevRooms => prevRooms.filter(room => room.pin !== pin));
    });
    
    return () => {
      clearInterval(interval);
      socket.off('roomCreated');
      socket.off('roomDeleted');
    };
  }, []);

  const loadRooms = async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    
    try {
      const response = await axios.get(`${BACKEND_URL}/api/rooms/public`);
      
      if (response.data.success) {
        setRooms(response.data.rooms);
        setError('');
      }
    } catch (err) {
      console.error('Error cargando salas:', err);
      setError('No se pudieron cargar las salas. Intenta nuevamente.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    loadRooms(true);
  };

  const handleJoinRoom = (pin) => {
    onRoomSelected(pin);
  };

  const getRoomTypeIcon = (roomType) => {
    return roomType === 'multimedia' ? 
      <Image size={18} className="room-type-icon" /> : 
      <MessageSquare size={18} className="room-type-icon" />;
  };

  const getRoomTypeBadge = (roomType) => {
    return (
      <span className={`room-badge ${roomType}`}>
        {roomType === 'multimedia' ? 'Multimedia' : 'Solo Texto'}
      </span>
    );
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Hace un momento';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Hace ${diffHours}h`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `Hace ${diffDays}d`;
  };

  if (loading) {
    return (
      <div className="room-list-container">
        <div className="room-list-header">
          <div className="header-left">
            <h2>
              <Home size={24} />
              Salas Disponibles
            </h2>
          </div>
        </div>
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Cargando salas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="room-list-container">
      <div className="room-list-header">
        <div className="header-left">
          <h2>
            <Home size={24} />
            Salas Disponibles
          </h2>
          <p className="room-count">{rooms.length} salas activas</p>
        </div>
        <button 
          className={`refresh-btn ${refreshing ? 'refreshing' : ''}`}
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw size={18} />
          {refreshing ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>

      {error && (
        <div className="error-banner">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {rooms.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <Home size={64} style={{ opacity: 0.3 }} />
          </div>
          <h3>No hay salas disponibles</h3>
          <p>Las salas creadas por los administradores aparecerán aquí</p>
          <button className="refresh-empty-btn" onClick={handleRefresh}>
            <RefreshCw size={16} />
            Actualizar lista
          </button>
        </div>
      ) : (
        <div className="rooms-grid">
          {rooms.map((room) => (
            <div key={room.pin} className="room-card">
              <div className="room-card-header">
                <div className="room-pin">
                  <Lock size={16} />
                  <span>PIN: {room.pin}</span>
                </div>
                {getRoomTypeBadge(room.roomType)}
              </div>

              <div className="room-card-body">
                <div className="room-info-row">
                  {getRoomTypeIcon(room.roomType)}
                  <span className="room-type-label">
                    {room.roomType === 'multimedia' 
                      ? 'Texto y archivos multimedia' 
                      : 'Solo mensajes de texto'}
                  </span>
                </div>

                <div className="room-stats">
                  <div className="stat-item">
                    <Users size={16} />
                    <span>{room.participantCount}/{room.maxParticipants}</span>
                  </div>
                  <div className="stat-item time">
                    <span>{formatDate(room.createdAt)}</span>
                  </div>
                </div>

                {room.isFull && (
                  <div className="room-full-badge">
                    <AlertCircle size={14} />
                    Sala llena
                  </div>
                )}
              </div>

              <div className="room-card-footer">
                <button 
                  className="join-room-btn"
                  onClick={() => handleJoinRoom(room.pin)}
                  disabled={room.isFull}
                >
                  {room.isFull ? 'Sala Llena' : 'Unirse a la Sala'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="room-list-footer">
        <div className="security-info">
          <Lock size={14} />
          <span>Conexión segura · Una sala por dispositivo</span>
        </div>
      </div>
    </div>
  );
}

export default RoomList;
