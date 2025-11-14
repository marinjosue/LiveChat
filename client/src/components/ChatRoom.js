import React, { useState, useEffect, useRef } from 'react';
import socket from '../services/socketService';
import { Send, LogOut, Users, MessageCircle, Paperclip, X, Image as ImageIcon, Video as VideoIcon, Music as MusicIcon, FileText } from 'lucide-react';
import '../styles/ChatRoom.css';
import { getDeviceId, clearCurrentRoom, updateRoomActivity,isReconnecting,finishReconnection,markPageRefreshing } from '../utils/deviceManager';
import { confirmDialog, ConfirmDialog } from 'primereact/confirmdialog';
import 'primereact/resources/themes/lara-light-indigo/theme.css';
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css'; 

const ChatRoom = ({ pin, nickname, onLeave }) => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState(1);
  const [limit, setLimit] = useState(null);
  const [isLastUser, setIsLastUser] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [mediaModal, setMediaModal] = useState({ isOpen: false, url: null, type: null });
  const [errorModal, setErrorModal] = useState({ isOpen: false, message: '' });
  const [uploadingMessages, setUploadingMessages] = useState([]);
  const [downloadModal, setDownloadModal] = useState({ isOpen: false, url: null, fileName: null });
  const [uploadProgress, setUploadProgress] = useState({ show: false, message: '', percent: 0 });

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  
  useEffect(() => {
    // Configurar intervalos para actualizar la actividad del usuario
    const activityInterval = setInterval(() => {
      updateRoomActivity();
    }, 30000); // Cada 30 segundos
    
    socket.on('chatMessage', ({ sender, text }) => {
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages(prev => [...prev, { sender, text, timestamp, messageType: 'text' }]);
    });

    socket.on('fileMessage', ({ sender, messageType, fileData, timestamp, tempId }) => {
      console.log('📨 Evento fileMessage recibido:', { 
        sender, 
        messageType, 
        fileUrl: fileData?.url, 
        tempId,
        currentNickname: nickname,
        isOwnMessage: sender === nickname
      });
      const formattedTime = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      // Si es nuestro propio archivo, reemplazar el mensaje temporal
      if (tempId && sender === nickname) {
        console.log('✅ Es nuestro archivo, cerrando progreso...', tempId);
        
        // Mostrar 100% primero
        setUploadProgress({ show: true, message: '¡Archivo subido con éxito!', percent: 100 });
        console.log('🎯 Progress actualizado a 100%');
        
        // Cerrar progreso después de 1 segundo
        setTimeout(() => {
          console.log('🔚 Cerrando modal de progreso');
          setUploadProgress({ show: false, message: '', percent: 0 });
          setUploadingFile(false);
        }, 1000);
        
        setMessages(prev => prev.map(msg => 
          msg.id === tempId 
            ? { sender, messageType, fileData, timestamp: formattedTime }
            : msg
        ));
        setUploadingMessages(prev => prev.filter(m => m.id !== tempId));
      } else {
        console.log('👤 Archivo de otro usuario');
        // Si es de otro usuario, agregar normalmente
        setMessages(prev => [...prev, { sender, messageType, fileData, timestamp: formattedTime }]);
      }
    });

    socket.on('fileSuccess', ({ tempId }) => {
      console.log('✅ Evento fileSuccess recibido:', tempId);
      // Asegurar que el progreso se cierre (por si fileMessage no lo hizo)
      setTimeout(() => {
        console.log('🔚 FileSuccess cerrando progreso');
        setUploadingFile(false);
        setUploadProgress({ show: false, message: '', percent: 0 });
      }, 1500);
    });

    socket.on('fileError', ({ message: errorMsg, tempId }) => {
      console.error('❌ Error de archivo:', errorMsg);
      
      // Mensajes de error más amigables
      let userMessage = errorMsg;
      if (errorMsg.includes('15MB')) {
        userMessage = 'El archivo es demasiado grande. Máximo 15MB.';
      } else if (errorMsg.includes('Cloudinary')) {
        userMessage = 'Error al subir el archivo. Por favor intenta de nuevo.';
      } else if (errorMsg.includes('no existe')) {
        userMessage = 'La sala ya no existe. Por favor actualiza la página.';
      } else if (errorMsg.includes('base64') || errorMsg.includes('formato')) {
        userMessage = 'Formato de archivo no válido. Por favor intenta con otro archivo.';
      }
      
      setErrorModal({ isOpen: true, message: userMessage });
      setUploadingFile(false);
      setUploadProgress({ show: false, message: '', percent: 0 });
      
      // Eliminar mensaje temporal si hay error
      if (tempId) {
        setMessages(prev => prev.filter(m => m.id !== tempId));
        setUploadingMessages(prev => prev.filter(m => m.id !== tempId));
      }
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

    // Manejar mensajes previos
    socket.on('previousMessages', (messages) => {
      console.log('📜 Mensajes previos recibidos:', messages.length);
      const formattedMessages = messages.map(msg => ({
        sender: msg.sender,
        text: msg.text,
        messageType: msg.messageType || 'text',
        fileData: msg.fileData,
        timestamp: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }));
      
      // Restaurar mensajes sin borrar los temporales que están subiendo
      setMessages(prev => {
        // Mantener solo mensajes temporales que estén subiendo activamente
        const uploadingTemp = prev.filter(m => m.isTemp && m.fileData?.uploading);
        // Agregar mensajes del servidor
        return [...formattedMessages, ...uploadingTemp];
      });
    });

    return () => {
      socket.off('chatMessage');
      socket.off('fileMessage');
      socket.off('fileSuccess');
      socket.off('fileError');
      socket.off('userJoined');
      socket.off('userLeft');
      socket.off('isLastUser');
      socket.off('previousMessages');
      clearInterval(activityInterval);
    };
  }, [pin]);

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
            console.log('Reconexión exitosa');
            // Solicitar mensajes previos por si no se cargaron
            socket.emit('requestPreviousMessages', { pin });
          } else {
            console.error('Error en reconexión:', response?.message || 'Sin respuesta del servidor');
            // Si falla la reconexión, intentar unirse nuevamente
            socket.emit('joinRoom', { pin, nickname, deviceId: getDeviceId() }, (joinResponse) => {
              if (joinResponse && joinResponse.success) {
                console.log('Reingreso exitoso a la sala');
              }
            });
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
    const trimmedMessage = message.trim();
    if (trimmedMessage === '') return;
    
    console.log('Enviando mensaje:', { pin, text: trimmedMessage });
    socket.emit('sendMessage', { pin, text: trimmedMessage });
    setMessage('');
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    console.log('📎 Archivo seleccionado:', file.name, 'Tamaño:', (file.size / (1024 * 1024)).toFixed(2), 'MB', 'Tipo:', file.type);

    // Validar tamaño (15MB)
    const MAX_SIZE = 15 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setErrorModal({ 
        isOpen: true, 
        message: `El archivo "${file.name}" supera el límite de 15MB. Tamaño actual: ${(file.size / (1024 * 1024)).toFixed(2)}MB` 
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    // Validar tipos permitidos (formatos ampliados)
    const allowedTypes = [
      // Imágenes
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp',
      // Videos
      'video/mp4', 'video/webm', 'video/mpeg', 'video/quicktime', 'video/x-msvideo',
      // Audio
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm',
      // Documentos
      'application/pdf',
      'application/msword', // .doc
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/vnd.ms-excel', // .xls
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-powerpoint', // .ppt
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
      'text/plain', // .txt
      'text/csv', // .csv
      // Comprimidos
      'application/zip', 'application/x-zip-compressed',
      'application/x-rar-compressed', 'application/vnd.rar',
      'application/x-7z-compressed',
      'application/gzip', 'application/x-gzip'
    ];

    // Validación más flexible por extensión si el tipo MIME no es reconocido
    const fileName = file.name.toLowerCase();
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp',
                               '.mp4', '.webm', '.mpeg', '.mov', '.avi',
                               '.mp3', '.wav', '.ogg',
                               '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv',
                               '.zip', '.rar', '.7z', '.gz'];
    
    const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));
    
    if (!allowedTypes.includes(file.type) && !hasValidExtension) {
      setErrorModal({ 
        isOpen: true, 
        message: `Tipo de archivo no permitido. Formatos soportados: imágenes, videos, audio, documentos (PDF, Word, Excel, PowerPoint), y archivos comprimidos (ZIP, RAR, 7Z)` 
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setSelectedFile(file);
  };

  // ⚡ Función optimizada para subir archivos grandes por HTTP
  const uploadViaHTTP = async (file, tempId, uploadTimeout) => {
    try {
      setUploadProgress({ show: true, message: 'Preparando archivo...', percent: 10 });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('pin', pin);
      formData.append('sender', nickname);
      formData.append('tempId', tempId);

      console.log('📤 Enviando archivo por HTTP...');
      setUploadProgress({ show: true, message: 'Subiendo archivo...', percent: 30 });

      const xhr = new XMLHttpRequest();

      // Progreso de subida real
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 70) + 30; // 30-100%
          setUploadProgress({ 
            show: true, 
            message: `Subiendo... ${percentComplete}%`, 
            percent: percentComplete 
          });
        }
      };

      xhr.onload = () => {
        clearTimeout(uploadTimeout);
        
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          console.log('✅ HTTP Upload exitoso:', response);
          setUploadProgress({ show: true, message: '¡Archivo subido!', percent: 100 });
          
          // Cerrar progreso y limpiar estado después de 2 segundos
          // El mensaje real llegará por socket (fileMessage) o por previousMessages al reconectar
          setTimeout(() => {
            console.log('🔚 Cerrando progreso después de upload HTTP exitoso');
            setUploadProgress({ show: false, message: '', percent: 0 });
            setUploadingFile(false);
            // Eliminar mensaje temporal - el real llegará por socket o previousMessages
            setMessages(prev => prev.filter(m => m.id !== tempId));
            setUploadingMessages(prev => prev.filter(m => m.id !== tempId));
          }, 2000);

          setSelectedFile(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        } else {
          console.error('❌ Error HTTP:', xhr.status);
          setErrorModal({ isOpen: true, message: 'Error al subir archivo' });
          setUploadingFile(false);
          setUploadProgress({ show: false, message: '', percent: 0 });
          setMessages(prev => prev.filter(m => m.id !== tempId));
          setUploadingMessages(prev => prev.filter(m => m.id !== tempId));
        }
      };

      xhr.onerror = () => {
        clearTimeout(uploadTimeout);
        console.error('❌ Error de red al subir');
        setErrorModal({ isOpen: true, message: 'Error de conexión al subir archivo' });
        setUploadingFile(false);
        setUploadProgress({ show: false, message: '', percent: 0 });
        setMessages(prev => prev.filter(m => m.id !== tempId));
        setUploadingMessages(prev => prev.filter(m => m.id !== tempId));
      };

      const serverUrl = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001';
      xhr.open('POST', `${serverUrl}/api/upload`, true);
      xhr.send(formData);

    } catch (error) {
      clearTimeout(uploadTimeout);
      console.error('❌ Error en uploadViaHTTP:', error);
      setErrorModal({ isOpen: true, message: 'Error al procesar archivo' });
      setUploadingFile(false);
      setUploadProgress({ show: false, message: '', percent: 0 });
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setUploadingMessages(prev => prev.filter(m => m.id !== tempId));
    }
  };

  const sendFile = async () => {
    if (!selectedFile) return;

    const fileSizeMB = (selectedFile.size / (1024 * 1024)).toFixed(2);
    console.log(`📎 Preparando archivo para enviar: ${selectedFile.name} (${fileSizeMB}MB)`);
    setUploadingFile(true);

    // Crear ID único para este mensaje temporal
    const tempId = `temp-${Date.now()}`;
    
    // Determinar tipo de archivo
    let fileType = 'document';
    if (selectedFile.type.startsWith('image/')) fileType = 'image';
    else if (selectedFile.type.startsWith('video/')) fileType = 'video';
    else if (selectedFile.type.startsWith('audio/')) fileType = 'audio';

    // Agregar mensaje temporal "Subiendo..."
    const tempMessage = {
      id: tempId,
      sender: nickname,
      messageType: fileType,
      fileData: {
        originalName: selectedFile.name,
        uploading: true
      },
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isTemp: true
    };
    
    setUploadingMessages(prev => [...prev, tempMessage]);
    setMessages(prev => [...prev, tempMessage]);

    // Timeout dinámico basado en el tamaño del archivo (mínimo 90s, hasta 180s para archivos grandes)
    const timeoutDuration = Math.max(90000, Math.min(selectedFile.size / 1024 / 8, 180000)); // 90-180 segundos
    console.log(`⏱️ Timeout configurado a ${(timeoutDuration / 1000).toFixed(0)} segundos para archivo de ${fileSizeMB}MB`);
    
    const uploadTimeout = setTimeout(() => {
      console.error('❌ Timeout: Subida tardó demasiado');
      setErrorModal({ isOpen: true, message: 'La subida tardó demasiado. Inténtalo de nuevo con un archivo más pequeño o verifica tu conexión.' });
      setUploadingFile(false);
      setUploadProgress({ show: false, message: '', percent: 0 });
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setUploadingMessages(prev => prev.filter(m => m.id !== tempId));
    }, timeoutDuration);

    // Optimización: Comprimir imágenes antes de subir
    if (selectedFile.type.startsWith('image/') && !selectedFile.type.includes('gif')) {
      console.log('🖼️ Comprimiendo imagen antes de subir...');
      compressImage(selectedFile, tempId, uploadTimeout);
      return;
    }

    // ⚡ OPTIMIZACIÓN: Archivos grandes por HTTP (mucho más rápido)
    const fileSizeBytes = selectedFile.size;
    const use_HTTP = fileSizeBytes > 2 * 1024 * 1024; // Archivos >2MB por HTTP

    if (use_HTTP) {
      console.log('⚡ Usando HTTP para archivo grande (más rápido)');
      uploadViaHTTP(selectedFile, tempId, uploadTimeout);
      return;
    }

    // Mostrar progreso de lectura
    setUploadProgress({ show: true, message: 'Leyendo archivo...', percent: 10 });

    const reader = new FileReader();
    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        const percentLoaded = Math.round((e.loaded / e.total) * 50); // 0-50% para lectura
        setUploadProgress({ show: true, message: 'Leyendo archivo...', percent: percentLoaded });
      }
    };

    reader.onload = () => {
      const fileData = reader.result; // Base64
      const base64SizeMB = (fileData.length / (1024 * 1024)).toFixed(2);
      console.log(`✅ Archivo leído (${base64SizeMB}MB en base64), enviando a servidor...`);
      setUploadProgress({ show: true, message: 'Enviando a servidor...', percent: 60 });

      socket.emit('sendFile', {
        pin,
        fileData,
        fileName: selectedFile.name,
        fileType: selectedFile.type,
        fileSize: selectedFile.size,
        tempId // Enviar el ID temporal para poder reemplazarlo
      }, (response) => {
        // Callback para confirmar recepción del servidor
        console.log('📥 Callback del servidor recibido:', response);
        clearTimeout(uploadTimeout);
        setUploadProgress({ show: true, message: 'Procesando en servidor...', percent: 80 });
        
        if (!response || !response.success) {
          console.error('❌ Error confirmado por servidor:', response);
          setErrorModal({ isOpen: true, message: response?.message || 'Error al procesar el archivo' });
          setUploadingFile(false);
          setUploadProgress({ show: false, message: '', percent: 0 });
          setMessages(prev => prev.filter(m => m.id !== tempId));
          setUploadingMessages(prev => prev.filter(m => m.id !== tempId));
        } else {
          console.log('✅ Servidor confirmó recepción exitosa');
        }
      });

      console.log('📤 Evento sendFile emitido');
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };

    reader.onerror = () => {
      clearTimeout(uploadTimeout);
      console.error('❌ Error al leer el archivo');
      setErrorModal({ isOpen: true, message: 'Error al leer el archivo' });
      setUploadingFile(false);
      setUploadProgress({ show: false, message: '', percent: 0 });
      // Eliminar mensaje temporal
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setUploadingMessages(prev => prev.filter(m => m.id !== tempId));
    };

    reader.readAsDataURL(selectedFile);
  };

  const cancelFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Función para comprimir imágenes automáticamente
  const compressImage = (file, tempId, uploadTimeout) => {
    setUploadProgress({ show: true, message: 'Cargando imagen...', percent: 5 });
    
    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadProgress({ show: true, message: 'Procesando imagen...', percent: 20 });
      
      const img = new Image();
      img.onload = () => {
        setUploadProgress({ show: true, message: 'Comprimiendo imagen...', percent: 30 });
        
        // Calcular dimensiones optimizadas (máximo 1920px de ancho)
        let width = img.width;
        let height = img.height;
        const maxWidth = 1920;
        const maxHeight = 1920;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          } else {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
          console.log(`📐 Redimensionando imagen: ${img.width}x${img.height} → ${Math.round(width)}x${Math.round(height)}`);
        }

        // Crear canvas para comprimir
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        setUploadProgress({ show: true, message: 'Optimizando calidad...', percent: 50 });

        // Convertir a base64 con calidad 0.8 (80%)
        canvas.toBlob((blob) => {
          const originalSizeMB = (file.size / (1024 * 1024)).toFixed(2);
          const compressedSizeMB = (blob.size / (1024 * 1024)).toFixed(2);
          const reduction = (((file.size - blob.size) / file.size) * 100).toFixed(1);
          console.log(`✅ Imagen comprimida: ${originalSizeMB}MB → ${compressedSizeMB}MB (${reduction}% reducción)`);

          setUploadProgress({ show: true, message: 'Preparando para enviar...', percent: 60 });

          // Leer blob comprimido y enviar
          const compressedReader = new FileReader();
          compressedReader.onprogress = (e) => {
            if (e.lengthComputable) {
              const percentLoaded = 60 + Math.round((e.loaded / e.total) * 20); // 60-80%
              setUploadProgress({ show: true, message: 'Convirtiendo imagen...', percent: percentLoaded });
            }
          };
          
          compressedReader.onload = () => {
            const fileData = compressedReader.result;
            const base64SizeMB = (fileData.length / (1024 * 1024)).toFixed(2);
            console.log(`📤 Enviando imagen comprimida (${base64SizeMB}MB en base64)...`);
            setUploadProgress({ show: true, message: 'Enviando a servidor...', percent: 85 });

            socket.emit('sendFile', {
              pin,
              fileData,
              fileName: file.name,
              fileType: file.type,
              fileSize: blob.size,
              tempId
            }, (response) => {
              clearTimeout(uploadTimeout);
              if (!response || !response.success) {
                console.error('❌ Error confirmado por servidor');
                setErrorModal({ isOpen: true, message: response?.message || 'Error al procesar el archivo' });
                setUploadingFile(false);
                setMessages(prev => prev.filter(m => m.id !== tempId));
                setUploadingMessages(prev => prev.filter(m => m.id !== tempId));
              }
            });

            setSelectedFile(null);
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }
          };

          compressedReader.onerror = () => {
            clearTimeout(uploadTimeout);
            console.error('❌ Error al leer imagen comprimida');
            setErrorModal({ isOpen: true, message: 'Error al procesar la imagen' });
            setUploadingFile(false);
            setUploadProgress({ show: false, message: '', percent: 0 });
            setMessages(prev => prev.filter(m => m.id !== tempId));
            setUploadingMessages(prev => prev.filter(m => m.id !== tempId));
          };

          compressedReader.readAsDataURL(blob);
        }, file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.8);
      };

      img.onerror = () => {
        clearTimeout(uploadTimeout);
        console.error('❌ Error al cargar imagen para comprimir');
        setErrorModal({ isOpen: true, message: 'Error al procesar la imagen' });
        setUploadingFile(false);
        setUploadProgress({ show: false, message: '', percent: 0 });
        setMessages(prev => prev.filter(m => m.id !== tempId));
        setUploadingMessages(prev => prev.filter(m => m.id !== tempId));
      };

      img.src = e.target.result;
    };

    reader.onerror = () => {
      clearTimeout(uploadTimeout);
      console.error('❌ Error al leer archivo de imagen');
      setErrorModal({ isOpen: true, message: 'Error al leer la imagen' });
      setUploadingFile(false);
      setUploadProgress({ show: false, message: '', percent: 0 });
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setUploadingMessages(prev => prev.filter(m => m.id !== tempId));
    };

    reader.readAsDataURL(file);
  };

  const openMediaModal = (url, type) => {
    setMediaModal({ isOpen: true, url, type });
  };

  const closeMediaModal = () => {
    setMediaModal({ isOpen: false, url: null, type: null });
  };

  // Función para descargar archivo con nombre y formato correcto
  const downloadFile = async (url, fileName) => {
    try {
      console.log('📥 Descargando archivo:', fileName);
      
      // Fetch del archivo desde Cloudinary
      const response = await fetch(url);
      const blob = await response.blob();
      
      // Crear enlace temporal para descarga
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName; // Mantiene nombre y extensión original
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Limpiar URL temporal
      window.URL.revokeObjectURL(blobUrl);
      console.log('✅ Archivo descargado:', fileName);
    } catch (error) {
      console.error('❌ Error al descargar archivo:', error);
      setErrorModal({ isOpen: true, message: 'Error al descargar el archivo. Inténtalo de nuevo.' });
    }
  };

  // Confirmar descarga de documentos
  const confirmDownload = (url, fileName) => {
    setDownloadModal({ isOpen: true, url, fileName });
  };

  const handleDownload = () => {
    downloadFile(downloadModal.url, downloadModal.fileName);
    setDownloadModal({ isOpen: false, url: null, fileName: null });
  };

  const cancelDownload = () => {
    setDownloadModal({ isOpen: false, url: null, fileName: null });
  };

  const renderMessage = (msg, idx) => {
    const isSelf = msg.sender === nickname;
    
    // Debug: verificar comparación
    if (idx < 3) { // Solo para los primeros 3 mensajes
      console.log(`Mensaje ${idx}:`, {
        sender: msg.sender,
        nickname: nickname,
        isSelf: isSelf,
        senderType: typeof msg.sender,
        nicknameType: typeof nickname
      });
    }

    if (msg.messageType === 'text') {
      return (
        <div key={msg.id || idx} className={`chat-message ${isSelf ? 'self' : 'other'}`}>
          <span className="sender">{msg.sender} <small>{msg.timestamp}</small></span>
          <p>{msg.text}</p>
        </div>
      );
    }

    // Si es un mensaje temporal subiendo
    if (msg.isTemp && msg.fileData?.uploading) {
      return (
        <div key={msg.id} className={`chat-message ${isSelf ? 'self' : 'other'} uploading-message`}>
          <span className="sender">{msg.sender} <small>{msg.timestamp}</small></span>
          <div className="file-message uploading">
            <div className="uploading-indicator">
              <div className="uploading-spinner-small"></div>
              <span className="uploading-text">Subiendo {msg.fileData.originalName}...</span>
            </div>
          </div>
        </div>
      );
    }

    // Renderizar archivos multimedia
    return (
      <div key={msg.id || idx} className={`chat-message ${isSelf ? 'self' : 'other'}`}>
        <span className="sender">{msg.sender} <small>{msg.timestamp}</small></span>
        <div className="file-message">
          {msg.messageType === 'image' && (
            <div className="image-container">
              <img 
                src={msg.fileData.url} 
                alt={msg.fileData.originalName} 
                className="message-image" 
                onClick={() => openMediaModal(msg.fileData.url, 'image')}
              />
              <button 
                className="download-btn-overlay"
                onClick={(e) => {
                  e.stopPropagation();
                  downloadFile(msg.fileData.url, msg.fileData.originalName);
                }}
                title="Descargar imagen"
              >
                📥
              </button>
            </div>
          )}
          {msg.messageType === 'video' && (
            <div className="video-container">
              <video className="message-video" onClick={() => openMediaModal(msg.fileData.url, 'video')}>
                <source src={msg.fileData.url} type={msg.fileData.mimeType} />
              </video>
              <div className="video-overlay" onClick={() => openMediaModal(msg.fileData.url, 'video')}>
                <div className="play-icon">▶</div>
              </div>
              <button 
                className="download-btn-overlay"
                onClick={(e) => {
                  e.stopPropagation();
                  downloadFile(msg.fileData.url, msg.fileData.originalName);
                }}
                title="Descargar video"
              >
                📥
              </button>
            </div>
          )}
          {msg.messageType === 'audio' && (
            <div className="audio-container">
              <audio controls className="message-audio">
                <source src={msg.fileData.url} type={msg.fileData.mimeType} />
              </audio>
              <button 
                className="download-btn-audio"
                onClick={() => downloadFile(msg.fileData.url, msg.fileData.originalName)}
                title="Descargar audio"
              >
                📥 Descargar
              </button>
            </div>
          )}
          {msg.messageType === 'document' && (
            <div className="document-container">
              <button 
                className="document-link"
                onClick={() => confirmDownload(msg.fileData.url, msg.fileData.originalName || 'documento.pdf')}
              >
                <FileText size={20} />
                <span>{msg.fileData.originalName || 'Documento'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Función para mostrar confirmación
const confirmExit = async () => {
  const deviceId = getDeviceId();

  confirmDialog({
    message: '¿Estás seguro de que deseas salir? Al salir se eliminará tu conversación de esta sala.',
    header: 'Confirmar salida',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Sí, salir',
    rejectLabel: 'Cancelar',
    accept: async () => {
      console.log('🚪 Saliendo de la sala...');
      
      // Marcar que estamos saliendo intencionalmente (no recarga)
      socket.emit('intentionalLeave', { pin });
      
      // Esperar a que el servidor confirme la eliminación de la sesión
      socket.emit('leaveRoom', { pin, deviceId }, (response) => {
        console.log('✅ Respuesta del servidor:', response);
        
        // Al salir, elimina el deviceId para que se genere uno nuevo en la próxima unión
        localStorage.removeItem('livechat-device-id');
        sessionStorage.removeItem('livechat-device-id');
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
        {messages.map((msg, idx) => renderMessage(msg, idx))}
        <div ref={messagesEndRef} />
      </div>

      {selectedFile && (
        <div className="file-preview">
          <div className="file-preview-content">
            <span className="file-preview-name">
              {selectedFile.type.startsWith('image/') && <ImageIcon size={16} />}
              {selectedFile.type.startsWith('video/') && <VideoIcon size={16} />}
              {selectedFile.type.startsWith('audio/') && <MusicIcon size={16} />}
              {!selectedFile.type.startsWith('image/') && 
               !selectedFile.type.startsWith('video/') && 
               !selectedFile.type.startsWith('audio/') && <FileText size={16} />}
              {selectedFile.name}
            </span>
            <button onClick={cancelFile} className="cancel-file-btn">
              <X size={16} />
            </button>
          </div>
          <button onClick={sendFile} disabled={uploadingFile} className="send-file-btn">
            {uploadingFile ? 'Subiendo...' : 'Enviar archivo'}
          </button>
        </div>
      )}

      <footer className="chat-input-bar">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z,.gz"
        />
        <button 
          onClick={() => fileInputRef.current?.click()} 
          className="attach-btn"
          title="Adjuntar archivo: imágenes, videos, audio, documentos, comprimidos (máx 15MB) - Imágenes se comprimen automáticamente"
        >
          <Paperclip size={20} />
        </button>
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

      {/* Modal para ampliar imágenes y videos */}
      {mediaModal.isOpen && (
        <div className="media-modal" onClick={closeMediaModal}>
          <div className="media-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeMediaModal}>
              <X size={24} />
            </button>
            {mediaModal.type === 'image' && (
              <img src={mediaModal.url} alt="Vista ampliada" className="modal-media" />
            )}
            {mediaModal.type === 'video' && (
              <video controls autoPlay className="modal-media">
                <source src={mediaModal.url} />
              </video>
            )}
          </div>
        </div>
      )}

      {/* Modal de error */}
      {errorModal.isOpen && (
        <div className="error-modal-overlay" onClick={() => setErrorModal({ isOpen: false, message: '' })}>
          <div className="error-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="error-modal-header">
              <h3>Error al subir archivo</h3>
              <button className="error-modal-close" onClick={() => setErrorModal({ isOpen: false, message: '' })}>
                <X size={20} />
              </button>
            </div>
            <div className="error-modal-body">
              <p>{errorModal.message}</p>
            </div>
            <div className="error-modal-footer">
              <button className="error-modal-button" onClick={() => setErrorModal({ isOpen: false, message: '' })}>
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación de descarga */}
      {downloadModal.isOpen && (
        <div className="error-modal-overlay" onClick={cancelDownload}>
          <div className="error-modal-content download-modal" onClick={(e) => e.stopPropagation()}>
            <div className="error-modal-header">
              <h3>📥 Descargar archivo</h3>
              <button className="error-modal-close" onClick={cancelDownload}>
                <X size={20} />
              </button>
            </div>
            <div className="error-modal-body">
              <p>¿Deseas descargar el archivo?</p>
              <p className="download-filename"><strong>{downloadModal.fileName}</strong></p>
            </div>
            <div className="error-modal-footer">
              <button className="error-modal-button cancel-btn" onClick={cancelDownload}>
                Cancelar
              </button>
              <button className="error-modal-button download-btn" onClick={handleDownload}>
                📥 Descargar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Indicador de carga con progreso */}
      {uploadProgress.show && (
        <div className="upload-overlay">
          <div className="upload-spinner-container">
            <div className="upload-spinner"></div>
            <p>{uploadProgress.message}</p>
            <div className="progress-bar-container">
              <div className="progress-bar" style={{ width: `${uploadProgress.percent}%` }}></div>
            </div>
            <p className="progress-text">{uploadProgress.percent}%</p>
          </div>
        </div>
      )}

      <ConfirmDialog />
    </div>
  );
  
};

export default ChatRoom;