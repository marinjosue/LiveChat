import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Home, 
  Lock, 
  RefreshCw, 
  Trash2, 
  Calendar, 
  Users, 
  MessageCircle, 
  Power, 
  Circle,
  CheckCircle
} from 'lucide-react';
import '../styles/RoomManagement.css';

const BACKEND_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001';

function RoomManagement() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Cargar salas al montar el componente
  useEffect(() => {
    loadRooms();
    // Auto-refresh cada 10 segundos
    const interval = setInterval(loadRooms, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadRooms = async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    
    const token = localStorage.getItem('adminToken');
    if (!token) {
      setError('Token de autenticación no encontrado');
      setLoading(false);
      return;
    }

    try {
      console.log('🔍 Cargando salas desde:', `${BACKEND_URL}/api/admin/rooms`);
      const response = await axios.get(`${BACKEND_URL}/api/admin/rooms`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      console.log('📥 Respuesta del servidor:', response.data);

      if (response.data.success) {
        const roomsList = response.data.rooms || [];
        console.log(`✅ ${roomsList.length} salas encontradas:`, roomsList);
        setRooms(roomsList);
        setError('');
      } else {
        console.error('❌ Error en respuesta:', response.data);
        setError('Error al cargar las salas');
      }
    } catch (err) {
      console.error('❌ Error cargando salas:', err);
      console.error('Detalles del error:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      if (err.response?.status === 401) {
        setError('Sesión expirada. Por favor, inicia sesión nuevamente.');
      } else {
        setError('Error al conectar con el servidor');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleDeleteRoom = async (pin, roomName) => {
    if (!window.confirm(`¿Estás seguro de ELIMINAR (desactivar) la sala "${roomName}" (PIN: ${pin})?\n\n⚠️ La sala será marcada como inactiva y los usuarios no podrán acceder.`)) {
      return;
    }

    const token = localStorage.getItem('adminToken');
    try {
      console.log(`🗑️ Eliminando sala ${pin}...`);
      const response = await axios.delete(
        `${BACKEND_URL}/api/admin/rooms/${pin}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (response.data.success) {
        console.log('✅ Sala eliminada exitosamente');
        // Recargar la lista de salas
        await loadRooms();
        alert(`✅ Sala "${roomName}" desactivada exitosamente`);
      }
    } catch (err) {
      console.error('❌ Error eliminando sala:', err);
      alert('❌ Error al eliminar sala: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleToggleRoomStatus = async (pin, roomName, currentStatus) => {
    const action = currentStatus ? 'desactivar' : 'reactivar';
    const actionText = currentStatus ? 'desactivada' : 'reactivada';
    
    if (!window.confirm(`¿Deseas ${action} la sala "${roomName}" (PIN: ${pin})?`)) {
      return;
    }

    const token = localStorage.getItem('adminToken');
    try {
      console.log(`🔄 ${action} sala ${pin}...`);
      
      if (currentStatus) {
        // Desactivar
        await axios.delete(
          `${BACKEND_URL}/api/admin/rooms/${pin}`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
      } else {
        // Reactivar
        await axios.patch(
          `${BACKEND_URL}/api/admin/rooms/${pin}/activate`,
          {},
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
      }
      
      console.log(`✅ Sala ${actionText} exitosamente`);
      // Recargar la lista de salas
      await loadRooms();
      alert(`✅ Sala "${roomName}" ${actionText} exitosamente`);
      
    } catch (err) {
      console.error(`❌ Error al ${action} sala:`, err);
      alert(`❌ Error al ${action} sala: ` + (err.response?.data?.message || err.message));
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRoomTypeIcon = (type) => {
    return type === 'multimedia' ? <MessageCircle size={18} /> : <MessageCircle size={18} />;
  };

  const getRoomTypeLabel = (type) => {
    return type === 'multimedia' ? 'Multimedia' : 'Solo Texto';
  };

  if (loading) {
    return (
      <div className="room-management">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Cargando salas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="room-management">
      <div className="room-management-header">
        <div className="header-title">
          <Home size={28} />
          <div>
            <h2>Gestión de Salas</h2>
            <p className="subtitle">Administra todas las salas de chat del sistema</p>
          </div>
        </div>
        
        <button 
          className={`btn-refresh ${refreshing ? 'spinning' : ''}`}
          onClick={() => loadRooms(true)}
          disabled={refreshing}
          title="Actualizar lista de salas"
        >
          <RefreshCw size={18} />
          {refreshing ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>

      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠️</span>
          {error}
        </div>
      )}

      <div className="room-stats">
        <div className="stat-item">
          <span className="stat-label">Total de salas:</span>
          <span className="stat-value">{rooms.length}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Activas:</span>
          <span className="stat-value active">{rooms.filter(r => r.isActive).length}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Inactivas:</span>
          <span className="stat-value inactive">{rooms.filter(r => !r.isActive).length}</span>
        </div>
      </div>

      {rooms.length === 0 ? (
        <div className="empty-state">
          <Home size={64} className="empty-icon" />
          <h3>No hay salas creadas</h3>
          <p>Crea tu primera sala desde la pestaña "Crear Sala"</p>
        </div>
      ) : (
        <div className="rooms-list">
          {rooms.map(room => (
            <div 
              key={room.pin} 
              className={`room-card ${!room.isActive ? 'inactive-room' : ''}`}
            >
              <div className="room-card-header">
                <div className="room-title-section">
                  <h3 className="room-name">
                    {getRoomTypeIcon(room.roomType)} {room.name}
                  </h3>
                  <span className={`status-badge ${room.isActive ? 'active' : 'inactive'}`}>
                    {room.isActive ? (
                      <>
                        <CheckCircle size={14} /> Activa
                      </>
                    ) : (
                      <>
                        <Circle size={14} /> Inactiva
                      </>
                    )}
                  </span>
                </div>
                
                <div className="room-pin-display">
                  <span className="pin-label">PIN:</span>
                  <code className="pin-code">{room.pin}</code>
                </div>
              </div>

              <div className="room-card-body">
                <div className="room-info-grid">
                  <div className="info-item">
                    <MessageCircle size={16} className="info-icon" />
                    <div className="info-content">
                      <span className="info-label">Tipo:</span>
                      <span className="info-value">{getRoomTypeLabel(room.roomType)}</span>
                    </div>
                  </div>

                  <div className="info-item">
                    <Users size={16} className="info-icon" />
                    <div className="info-content">
                      <span className="info-label">Participantes:</span>
                      <span className="info-value">
                        {room.participantCount || 0} / {room.maxParticipants}
                        {room.participantCount >= room.maxParticipants && (
                          <span className="full-badge">
                            <Lock size={12} /> Llena
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="info-item">
                    <Calendar size={16} className="info-icon" />
                    <div className="info-content">
                      <span className="info-label">Creada:</span>
                      <span className="info-value">{formatDate(room.createdAt)}</span>
                    </div>
                  </div>

                  {room.lastActivity && (
                    <div className="info-item">
                      <Calendar size={16} className="info-icon" />
                      <div className="info-content">
                        <span className="info-label">Última actividad:</span>
                        <span className="info-value">{formatDate(room.lastActivity)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="room-card-footer">
                <button
                  className={`btn-action ${room.isActive ? 'btn-warning' : 'btn-success'}`}
                  onClick={() => handleToggleRoomStatus(room.pin, room.name, room.isActive)}
                  title={room.isActive ? 'Desactivar sala' : 'Reactivar sala'}
                >
                  <Power size={16} />
                  {room.isActive ? 'Desactivar' : 'Reactivar'}
                </button>
                
                <button
                  className="btn-action btn-danger"
                  onClick={() => handleDeleteRoom(room.pin, room.name)}
                  title="Desactivar sala permanentemente"
                >
                  <Trash2 size={16} />
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default RoomManagement;
