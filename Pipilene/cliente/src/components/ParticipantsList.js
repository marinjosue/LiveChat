import React, { useState } from 'react';
import { Users, ChevronLeft, ChevronRight, User } from 'lucide-react';
import '../styles/ParticipantsList.css';

/**
 * Componente ParticipantsList
 * Muestra la lista de participantes conectados con nicknames hasheados para privacidad
 * @param {Array} participants - Lista de participantes con información hasheada
 * @param {number} totalCount - Número total de participantes
 * @param {number} maxParticipants - Límite máximo de participantes
 */
const ParticipantsList = ({ participants = [], totalCount = 0, maxParticipants = 0, onVisibilityChange }) => {
  const [isVisible, setIsVisible] = useState(true);

  const toggleVisibility = () => {
    const newVisibility = !isVisible;
    setIsVisible(newVisibility);
    if (onVisibilityChange) {
      onVisibilityChange(newVisibility);
    }
  };

  return (
    <>
      {/* Botón para mostrar/ocultar - SIEMPRE VISIBLE */}
      <button 
        className={`toggle-participants-btn ${!isVisible ? 'collapsed' : ''}`}
        onClick={toggleVisibility}
        title={isVisible ? 'Ocultar participantes' : 'Mostrar participantes'}
      >
        {isVisible ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
      </button>

      {/* Panel de participantes */}
      <div className={`participants-panel ${isVisible ? 'visible' : 'hidden'}`}>
      {isVisible && (
        <div className="participants-content">
          <div className="participants-header">
            <Users size={18} />
            <h3>Participantes</h3>
            <span className="participant-count">
              {totalCount} {maxParticipants > 0 ? `/ ${maxParticipants}` : ''}
            </span>
          </div>

          <div className="participants-info">
            <p className="privacy-notice">
              🔒 Los nombres están hasheados para proteger tu privacidad
            </p>
          </div>

          <div className="participants-list">
            {participants.length === 0 ? (
              <div className="no-participants">
                <User size={32} />
                <p>Esperando participantes...</p>
              </div>
            ) : (
              participants.map((participant, index) => (
                <div 
                  key={participant.socketId || index} 
                  className={`participant-item ${participant.isYou ? 'is-you' : ''}`}
                >
                  <div 
                    className="participant-avatar" 
                    style={{ backgroundColor: participant.color }}
                  >
                    {participant.initials}
                  </div>
                  <div className="participant-info">
                    <span className="participant-name">
                      {participant.displayName}
                    </span>
                    {participant.isYou && (
                      <span className="you-badge">Tú</span>
                    )}
                    <span className="participant-hash" title="Hash de privacidad">
                      #{participant.hash}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      </div>
    </>
  );
};

export default ParticipantsList;
