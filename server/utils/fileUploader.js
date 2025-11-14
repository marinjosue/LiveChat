const cloudinary = require('../config/cloudinary');

/**
 * Sube un archivo a Cloudinary desde un buffer base64
 * @param {string} fileBase64 - Archivo en formato base64
 * @param {string} fileName - Nombre original del archivo
 * @param {string} folder - Carpeta en Cloudinary
 * @param {number} maxRetries - Número máximo de reintentos
 * @returns {Promise<Object>} - Información del archivo subido
 */
const uploadToCloudinary = async (fileBase64, fileName, folder = 'livechat', maxRetries = 3) => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`📤 Intento ${attempt}/${maxRetries} de subir archivo: ${fileName}`);
      
      // Detectar tipo de archivo
      const isPDF = fileName.toLowerCase().endsWith('.pdf');
      const isDocument = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|zip|rar)$/i.test(fileName);
      
      // Configuración optimizada según tipo
      const uploadOptions = {
        folder: folder,
        resource_type: isDocument ? 'raw' : 'auto', // 'raw' para documentos es más rápido
        public_id: `${Date.now()}-${fileName.replace(/\.[^/.]+$/, "")}`,
        overwrite: false,
        timeout: 120000, // 120 segundos para archivos grandes
        chunk_size: 6000000 // 6MB chunks para uploads más estables
      };

      // Solo agregar transformations para imágenes/videos
      if (!isDocument) {
        uploadOptions.transformation = [
          { quality: 'auto' },
          { fetch_format: 'auto' }
        ];
      }
      
      const uploadPromise = cloudinary.uploader.upload(fileBase64, uploadOptions);

      // Esperar a que se complete la subida
      const result = await uploadPromise;

      console.log(`✅ Archivo subido exitosamente en intento ${attempt}: ${result.secure_url}`);
      
      return {
        success: true,
        url: result.secure_url,
        publicId: result.public_id,
        resourceType: result.resource_type,
        format: result.format,
        width: result.width,
        height: result.height,
        size: result.bytes,
        thumbnail: result.resource_type === 'video' ? 
          result.secure_url.replace(/\.[^/.]+$/, '.jpg') : result.secure_url
      };
      
    } catch (error) {
      lastError = error;
      console.error(`❌ Error en intento ${attempt}/${maxRetries}:`, error.message);
      
      // Si no es el último intento, esperar antes de reintentar
      if (attempt < maxRetries) {
        const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Backoff exponencial: 1s, 2s, 4s (máx 5s)
        console.log(`⏳ Esperando ${waitTime}ms antes de reintentar...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  // Si llegamos aquí, todos los intentos fallaron
  console.error(`❌ Falló la subida después de ${maxRetries} intentos:`, lastError.message);
  return {
    success: false,
    error: lastError.message || 'Error al subir archivo después de varios intentos'
  };
};

/**
 * Elimina un archivo de Cloudinary
 * @param {string} publicId - ID público del archivo en Cloudinary
 * @param {string} resourceType - Tipo de recurso (image, video, raw)
 */
const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType
    });
    return result;
  } catch (error) {
    console.error('❌ Error al eliminar archivo de Cloudinary:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  uploadToCloudinary,
  deleteFromCloudinary
};
