const { parentPort, workerData } = require('worker_threads');
const crypto = require('crypto');
const sharp = require('sharp');

/**
 * Worker dedicado para análisis de esteganografía
 * Detecta posibles datos ocultos en archivos multimedia
 */

/**
 * Calcula la entropía de Shannon de los datos
 * Alta entropía puede indicar datos encriptados o esteganografía
 */
function calculateEntropy(buffer) {
  const frequencies = new Map();
  
  // Contar frecuencias de cada byte
  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i];
    frequencies.set(byte, (frequencies.get(byte) || 0) + 1);
  }
  
  // Calcular entropía de Shannon
  let entropy = 0;
  const len = buffer.length;
  
  for (const count of frequencies.values()) {
    const probability = count / len;
    entropy -= probability * Math.log2(probability);
  }
  
  return entropy;
}

/**
 * Analiza los bits menos significativos (LSB)
 * Técnica común de esteganografía
 */
function analyzeLSB(buffer) {
  const lsbPattern = [];
  let consecutiveSame = 0;
  let maxConsecutive = 0;
  let lastBit = -1;
  
  // Analizar primeros 10000 bytes
  const sampleSize = Math.min(10000, buffer.length);
  
  for (let i = 0; i < sampleSize; i++) {
    const lsb = buffer[i] & 1;
    lsbPattern.push(lsb);
    
    if (lsb === lastBit) {
      consecutiveSame++;
      maxConsecutive = Math.max(maxConsecutive, consecutiveSame);
    } else {
      consecutiveSame = 1;
      lastBit = lsb;
    }
  }
  
  // Calcular entropía de los LSBs
  const ones = lsbPattern.filter(b => b === 1).length;
  const zeros = lsbPattern.length - ones;
  const lsbEntropy = calculateEntropy(Buffer.from(lsbPattern));
  
  return {
    lsbEntropy,
    onesRatio: ones / lsbPattern.length,
    maxConsecutiveSame: maxConsecutive,
    suspicious: lsbEntropy > 0.9 || maxConsecutive < 3
  };
}

/**
 * Verifica firmas digitales conocidas de herramientas de esteganografía
 */
function checkKnownSignatures(buffer) {
  const signatures = [
    // Firmas comunes de herramientas de esteganografía
    { name: 'Steghide', pattern: Buffer.from('STEGHIDE', 'utf8') },
    { name: 'OpenStego', pattern: Buffer.from('OPENSTEGO', 'utf8') },
    { name: 'OutGuess', pattern: Buffer.from('OUTGUESS', 'utf8') },
    { name: 'F5', pattern: Buffer.from('F5STEGO', 'utf8') },
  ];
  
  const detected = [];
  
  for (const sig of signatures) {
    if (buffer.includes(sig.pattern)) {
      detected.push(sig.name);
    }
  }
  
  return detected;
}

/**
 * Análisis estadístico de distribución de bytes
 */
function analyzeByteDistribution(buffer) {
  const histogram = new Array(256).fill(0);
  
  for (let i = 0; i < buffer.length; i++) {
    histogram[buffer[i]]++;
  }
  
  // Calcular chi-cuadrado
  const expected = buffer.length / 256;
  let chiSquare = 0;
  
  for (let i = 0; i < 256; i++) {
    const diff = histogram[i] - expected;
    chiSquare += (diff * diff) / expected;
  }
  
  // Valor crítico de chi-cuadrado para 255 grados de libertad y p=0.05
  const criticalValue = 293.25;
  
  return {
    chiSquare,
    suspicious: chiSquare > criticalValue * 1.5, // Margen más alto para reducir falsos positivos
    uniformity: chiSquare / criticalValue
  };
}

/**
 * Análisis específico para imágenes
 */
async function analyzeImage(buffer) {
  try {
    const metadata = await sharp(buffer).metadata();
    const { data: rawData, info } = await sharp(buffer)
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // Analizar canales de color
    const channels = info.channels;
    const pixelCount = info.width * info.height;
    const channelData = [];
    
    for (let c = 0; c < channels; c++) {
      const channelBuffer = Buffer.alloc(pixelCount);
      for (let i = 0; i < pixelCount; i++) {
        channelBuffer[i] = rawData[i * channels + c];
      }
      channelData.push(channelBuffer);
    }
    
    // Calcular entropía por canal
    const channelEntropies = channelData.map(calculateEntropy);
    const avgEntropy = channelEntropies.reduce((a, b) => a + b, 0) / channelEntropies.length;
    
    // Detectar anomalías en metadatos
    const metadataSize = JSON.stringify(metadata).length;
    const suspiciousMetadata = metadataSize > 5000; // Metadatos inusualmente grandes
    
    return {
      type: 'image',
      width: info.width,
      height: info.height,
      channels: info.channels,
      channelEntropies,
      avgEntropy,
      suspiciousMetadata,
      format: metadata.format,
      suspicious: avgEntropy > 7.5 || suspiciousMetadata
    };
  } catch (error) {
    return {
      type: 'image',
      error: error.message,
      suspicious: false
    };
  }
}

/**
 * Análisis principal
 */
async function analyzeSteganography(fileBuffer, mimeType, fileName) {
  try {
    const results = {
      fileName,
      mimeType,
      fileSize: fileBuffer.length,
      timestamp: new Date().toISOString(),
      checks: {}
    };
    
    // 1. Análisis de entropía global
    const globalEntropy = calculateEntropy(fileBuffer);
    results.checks.entropy = {
      value: globalEntropy,
      suspicious: globalEntropy > 7.8, // Entropía muy alta
      threshold: 7.8
    };
    
    // 2. Análisis de LSB
    const lsbAnalysis = analyzeLSB(fileBuffer);
    results.checks.lsb = lsbAnalysis;
    
    // 3. Verificación de firmas conocidas
    const knownSignatures = checkKnownSignatures(fileBuffer);
    results.checks.signatures = {
      detected: knownSignatures,
      suspicious: knownSignatures.length > 0
    };
    
    // 4. Análisis de distribución de bytes
    const distribution = analyzeByteDistribution(fileBuffer);
    results.checks.distribution = distribution;
    
    // 5. Análisis específico para imágenes
    if (mimeType.startsWith('image/')) {
      const imageAnalysis = await analyzeImage(fileBuffer);
      results.checks.image = imageAnalysis;
    }
    
    // 6. Verificación de integridad del archivo
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    results.integrity = {
      sha256: hash,
      verified: true
    };
    
    // Determinar si el archivo es sospechoso
    const suspiciousChecks = [
      results.checks.entropy.suspicious,
      results.checks.lsb.suspicious,
      results.checks.signatures.suspicious,
      results.checks.distribution.suspicious,
      results.checks.image?.suspicious || false
    ];
    
    const suspiciousCount = suspiciousChecks.filter(Boolean).length;
    
    results.verdict = {
      isSuspicious: suspiciousCount >= 2, // 2 o más checks sospechosos
      suspiciousCount,
      totalChecks: suspiciousChecks.length,
      confidence: suspiciousCount / suspiciousChecks.length,
      reasons: []
    };
    
    // Agregar razones específicas
    if (results.checks.entropy.suspicious) {
      results.verdict.reasons.push('Alta entropía detectada (posible datos encriptados)');
    }
    if (results.checks.lsb.suspicious) {
      results.verdict.reasons.push('Patrón sospechoso en bits menos significativos');
    }
    if (results.checks.signatures.suspicious) {
      results.verdict.reasons.push(`Firmas detectadas: ${knownSignatures.join(', ')}`);
    }
    if (results.checks.distribution.suspicious) {
      results.verdict.reasons.push('Distribución anómala de bytes');
    }
    if (results.checks.image?.suspicious) {
      results.verdict.reasons.push('Anomalías en análisis de imagen');
    }
    
    parentPort.postMessage({
      success: true,
      results
    });
    
  } catch (error) {
    parentPort.postMessage({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}

// Ejecutar análisis
const { fileBuffer, mimeType, fileName } = workerData;
const buffer = Buffer.from(fileBuffer);

analyzeSteganography(buffer, mimeType, fileName);
