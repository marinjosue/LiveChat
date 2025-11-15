const { Worker } = require('worker_threads');
const path = require('path');
const { WorkerPool } = require('./workerPoolService');
const { AuditService } = require('./auditService');

// Pool de workers para análisis de esteganografía
const steganographyWorkerPool = new WorkerPool(
  path.join(__dirname, '../workers/steganographyWorker.js'),
  4 // 4 workers para análisis paralelo
);

/**
 * Servicio para análisis de archivos multimedia
 * Detecta esteganografía y verifica integridad
 */
class FileSecurityService {
  /**
   * Analiza un archivo en busca de esteganografía
   * Usa Worker Thread para no bloquear el proceso principal
   */
  static async analyzeSteganography(fileBuffer, mimeType, fileName) {
    try {
      console.log(`[STEGO] Analyzing ${fileName} (${mimeType})...`);
      
      const startTime = Date.now();
      
      // Ejecutar análisis en worker thread
      const result = await steganographyWorkerPool.runTask({
        fileBuffer: Array.from(fileBuffer), // Convertir Buffer a Array para worker
        mimeType,
        fileName
      }, 60000); // 60 segundos de timeout
      
      const duration = Date.now() - startTime;
      
      console.log(`[STEGO] Analysis completed in ${duration}ms`);
      console.log(`[STEGO] Verdict: ${result.success && result.results.verdict.isSuspicious ? 'SUSPICIOUS' : 'CLEAN'}`);
      
      if (result.success && result.results.verdict.isSuspicious) {
        console.warn(`[STEGO] ⚠️ Suspicious file detected: ${fileName}`);
        console.warn(`[STEGO] Reasons: ${result.results.verdict.reasons.join(', ')}`);
      }
      
      return {
        success: result.success,
        isSuspicious: result.success ? result.results.verdict.isSuspicious : false,
        confidence: result.success ? result.results.verdict.confidence : 0,
        reasons: result.success ? result.results.verdict.reasons : [],
        details: result.success ? result.results : null,
        duration,
        error: result.error || null
      };
      
    } catch (error) {
      console.error('[STEGO] Error analyzing file:', error);
      return {
        success: false,
        isSuspicious: false,
        error: error.message,
        duration: 0
      };
    }
  }

  /**
   * Analiza múltiples archivos en paralelo
   */
  static async analyzeMultipleFiles(files) {
    console.log(`[STEGO] Analyzing ${files.length} files in parallel...`);
    
    const promises = files.map(file => 
      this.analyzeSteganography(file.buffer, file.mimeType, file.fileName)
    );
    
    const results = await Promise.all(promises);
    
    const suspicious = results.filter(r => r.isSuspicious);
    
    console.log(`[STEGO] Analysis complete: ${suspicious.length}/${results.length} suspicious files`);
    
    return results;
  }

  /**
   * Verifica la integridad de un archivo
   */
  static async verifyFileIntegrity(fileBuffer, expectedHash = null) {
    const crypto = require('crypto');
    
    const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    const sha512 = crypto.createHash('sha512').update(fileBuffer).digest('hex');
    
    const isValid = expectedHash ? sha256 === expectedHash : true;
    
    return {
      isValid,
      sha256,
      sha512,
      size: fileBuffer.length
    };
  }

  /**
   * Valida tipo de archivo basándose en magic numbers
   */
  static validateFileType(fileBuffer, expectedMimeType) {
    const magicNumbers = {
      'image/jpeg': ['ffd8ffe0', 'ffd8ffe1', 'ffd8ffe2'],
      'image/png': ['89504e47'],
      'image/gif': ['47494638'],
      'application/pdf': ['25504446'],
      'video/mp4': ['66747970'],
      'audio/mpeg': ['494433', 'fffb']
    };
    
    const header = fileBuffer.slice(0, 8).toString('hex');
    const expectedMagic = magicNumbers[expectedMimeType];
    
    if (!expectedMagic) {
      return { isValid: true, reason: 'No magic number check available' };
    }
    
    const isValid = expectedMagic.some(magic => header.startsWith(magic));
    
    return {
      isValid,
      detectedHeader: header,
      expectedMimeType,
      reason: isValid ? 'Valid file signature' : 'File signature mismatch'
    };
  }

  /**
   * Validación completa de archivo
   */
  static async validateFile(fileBuffer, mimeType, fileName, options = {}) {
    const {
      checkSteganography = true,
      checkIntegrity = true,
      checkFileType = true,
      maxSize = 15 * 1024 * 1024,
      allowedTypes = null
    } = options;
    
    const validation = {
      isValid: true,
      errors: [],
      warnings: [],
      checks: {}
    };
    
    // 1. Verificar tamaño
    if (fileBuffer.length > maxSize) {
      validation.isValid = false;
      validation.errors.push(`File exceeds maximum size (${maxSize} bytes)`);
    }
    
    // 2. Verificar tipo permitido
    if (allowedTypes && !allowedTypes.includes(mimeType)) {
      validation.isValid = false;
      validation.errors.push(`File type ${mimeType} not allowed`);
    }
    
    // 3. Validar tipo de archivo por magic numbers
    if (checkFileType) {
      const typeCheck = this.validateFileType(fileBuffer, mimeType);
      validation.checks.fileType = typeCheck;
      
      if (!typeCheck.isValid) {
        validation.isValid = false;
        validation.errors.push(typeCheck.reason);
      }
    }
    
    // 4. Verificar integridad
    if (checkIntegrity) {
      const integrityCheck = await this.verifyFileIntegrity(fileBuffer);
      validation.checks.integrity = integrityCheck;
    }
    
    // 5. Análisis de esteganografía
    if (checkSteganography) {
      const stegoCheck = await this.analyzeSteganography(fileBuffer, mimeType, fileName);
      validation.checks.steganography = stegoCheck;
      
      if (stegoCheck.isSuspicious) {
        validation.warnings.push(`Steganography detected: ${stegoCheck.reasons.join(', ')}`);
        
        // Opcional: rechazar archivos sospechosos
        if (stegoCheck.confidence > 0.7) {
          validation.isValid = false;
          validation.errors.push('File rejected due to high steganography confidence');
        }
      }
    }
    
    return validation;
  }

  /**
   * Obtiene estadísticas del pool de workers
   */
  static getWorkerPoolStats() {
    return steganographyWorkerPool.getStats();
  }

  /**
   * Cierra el pool de workers
   */
  static async shutdown() {
    await steganographyWorkerPool.close();
    console.log('[STEGO] Worker pool closed');
  }
}

module.exports = {
  FileSecurityService,
  steganographyWorkerPool
};
