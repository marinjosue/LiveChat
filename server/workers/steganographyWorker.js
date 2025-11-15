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
 * ✨ NUEVO: Análisis de entropía por bloques
 * Detecta datos ocultos localizados (más preciso que entropía global)
 */
function analyzeEntropyByBlocks(buffer) {
  const blockSize = 1024; // 1KB por bloque
  const entropies = [];
  let highEntropyBlocks = 0;
  
  for (let i = 0; i < buffer.length; i += blockSize) {
    const end = Math.min(i + blockSize, buffer.length);
    const block = buffer.slice(i, end);
    const entropy = calculateEntropy(block);
    entropies.push(entropy);
    
    if (entropy > 7.8) {
      highEntropyBlocks++;
    }
  }
  
  const avgEntropy = entropies.reduce((a, b) => a + b, 0) / entropies.length;
  const maxEntropy = Math.max(...entropies);
  const anomalyScore = highEntropyBlocks / entropies.length;
  
  return {
    blockEntropies: entropies,
    avgEntropy,
    maxEntropy,
    highEntropyBlocks,
    totalBlocks: entropies.length,
    anomalyScore,
    suspicious: anomalyScore > 0.3 // > 30% bloques con alta entropía
  };
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
 * ✨ NUEVO: Análisis de correlación de píxeles (detecta LSB embedding)
 */
async function analyzePixelCorrelation(rawData, channels, pixelCount) {
  let correlationSum = 0;
  let samples = 0;
  const sampleSize = Math.min(1000, pixelCount - 1);
  
  // Analizar correlación horizontal entre píxeles adyacentes
  for (let i = 0; i < sampleSize; i++) {
    const pixel1 = rawData[i * channels];
    const pixel2 = rawData[(i + 1) * channels];
    
    // Píxeles naturales: alta correlación (similares)
    // Píxeles con datos ocultos: baja correlación (aleatorios)
    correlationSum += Math.abs(pixel1 - pixel2);
    samples++;
  }
  
  const avgDifference = correlationSum / samples;
  
  return {
    avgPixelDifference: avgDifference,
    suspicious: avgDifference > 35, // Umbral ajustado
    interpretation: avgDifference < 15 ? 'Natural' : avgDifference < 35 ? 'Comprimido' : 'Anómalo'
  };
}

/**
 * ✨ NUEVO: Análisis de metadatos EXIF
 */
async function analyzeExifData(metadata) {
  const suspiciousSignals = [];
  
  // Señal 1: Software sospechoso
  const software = metadata.exif?.Software || '';
  const suspiciousSoftware = ['steghide', 'openstego', 'f5', 'stego', 'hide'];
  if (suspiciousSoftware.some(s => software.toLowerCase().includes(s))) {
    suspiciousSignals.push(`Software sospechoso: ${software}`);
  }
  
  // Señal 2: Metadatos mínimos (posible limpieza)
  const exifSize = JSON.stringify(metadata.exif || {}).length;
  if (exifSize < 30 && metadata.format !== 'gif') {
    suspiciousSignals.push('Metadatos eliminados o mínimos');
  }
  
  // Señal 3: Metadatos excesivamente grandes
  if (exifSize > 10000) {
    suspiciousSignals.push('Metadatos inusualmente grandes');
  }
  
  return {
    exifSize,
    software,
    suspiciousSignals,
    suspicious: suspiciousSignals.length > 0
  };
}

/**
 * Análisis específico para imágenes (MEJORADO)
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
    
    // ✨ NUEVO: Análisis de correlación de píxeles
    const pixelCorrelation = await analyzePixelCorrelation(rawData, channels, pixelCount);
    
    // ✨ NUEVO: Análisis de metadatos EXIF
    const exifAnalysis = await analyzeExifData(metadata);
    
    // Detectar anomalías en metadatos (tamaño excesivo)
    const metadataSize = JSON.stringify(metadata).length;
    const suspiciousMetadata = metadataSize > 5000;
    
    // Umbral adaptativo por formato
    const entropyThresholds = {
      'jpeg': 7.5,
      'png': 7.0,
      'gif': 7.8,
      'webp': 7.3
    };
    const threshold = entropyThresholds[metadata.format] || 7.5;
    
    return {
      type: 'image',
      width: info.width,
      height: info.height,
      channels: info.channels,
      channelEntropies,
      avgEntropy,
      pixelCorrelation,
      exifAnalysis,
      suspiciousMetadata,
      format: metadata.format,
      suspicious: avgEntropy > threshold || suspiciousMetadata || pixelCorrelation.suspicious || exifAnalysis.suspicious
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
 * ✨ NUEVO: Determina threshold adaptativo por tipo y tamaño
 */
function determineConfidenceThreshold(mimeType, fileSize) {
  const baseThresholds = {
    'image/jpeg': 0.70,
    'image/jpg': 0.70,
    'image/png': 0.65,
    'image/gif': 0.75,
    'image/webp': 0.68,
    'application/pdf': 0.80,
    'video/mp4': 0.85,
    'video/webm': 0.85,
    'audio/mpeg': 0.75,
    'audio/wav': 0.70
  };
  
  let threshold = baseThresholds[mimeType] || 0.70;
  
  // Archivos grandes: menos sensible (compresión normal)
  if (fileSize > 10 * 1024 * 1024) {
    threshold += 0.10;
  }
  // Archivos pequeños: más sensible
  else if (fileSize < 100 * 1024) {
    threshold -= 0.05;
  }
  
  return Math.min(0.90, Math.max(0.50, threshold));
}

/**
 * ✨ NUEVO: Scoring ponderado (no binario)
 */
function calculateWeightedConfidence(checks, mimeType) {
  // Pesos según confiabilidad de cada técnica
  const weights = {
    'signatures': 0.40,        // 40% - MUY confiable (firma directa)
    'entropyBlocks': 0.20,     // 20% - Confiable (anomalías locales)
    'lsb': 0.15,               // 15% - Moderado (técnico)
    'pixelCorrelation': 0.15,  // 15% - Moderado (solo imágenes)
    'distribution': 0.05,      // 5% - Bajo (muchos falsos positivos)
    'exif': 0.05               // 5% - Bajo (puede ser limpieza legítima)
  };
  
  let weightedScore = 0;
  let totalWeight = 0;
  
  // Firmas (peso máximo)
  if (checks.signatures?.suspicious) {
    weightedScore += weights.signatures;
  }
  totalWeight += weights.signatures;
  
  // Entropía por bloques
  if (checks.entropyBlocks?.suspicious) {
    weightedScore += weights.entropyBlocks;
  }
  totalWeight += weights.entropyBlocks;
  
  // LSB
  if (checks.lsb?.suspicious) {
    weightedScore += weights.lsb;
  }
  totalWeight += weights.lsb;
  
  // Distribución (menos peso)
  if (checks.distribution?.suspicious) {
    weightedScore += weights.distribution;
  }
  totalWeight += weights.distribution;
  
  // Análisis de imagen (solo si es imagen)
  if (mimeType.startsWith('image/')) {
    if (checks.image?.pixelCorrelation?.suspicious) {
      weightedScore += weights.pixelCorrelation;
    }
    totalWeight += weights.pixelCorrelation;
    
    if (checks.image?.exifAnalysis?.suspicious) {
      weightedScore += weights.exif;
    }
    totalWeight += weights.exif;
  }
  
  return weightedScore / totalWeight;
}

/**
 * Análisis principal (MEJORADO)
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
      suspicious: globalEntropy > 7.8,
      threshold: 7.8
    };
    
    // ✨ 1b. Análisis de entropía por bloques (NUEVO)
    const entropyBlocks = analyzeEntropyByBlocks(fileBuffer);
    results.checks.entropyBlocks = entropyBlocks;
    
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
    
    // ✨ NUEVO: Calcular confidence con scoring ponderado
    const weightedConfidence = calculateWeightedConfidence(results.checks, mimeType);
    
    // ✨ NUEVO: Threshold adaptativo
    const adaptiveThreshold = determineConfidenceThreshold(mimeType, fileBuffer.length);
    
    // Determinar si el archivo es sospechoso (con threshold adaptativo)
    const isSuspicious = weightedConfidence >= adaptiveThreshold;
    
    // Contar checks individuales para referencia
    const suspiciousChecks = [
      results.checks.entropyBlocks?.suspicious,
      results.checks.lsb?.suspicious,
      results.checks.signatures?.suspicious,
      results.checks.distribution?.suspicious,
      results.checks.image?.pixelCorrelation?.suspicious,
      results.checks.image?.exifAnalysis?.suspicious
    ].filter(Boolean);
    
    results.verdict = {
      isSuspicious,
      confidence: weightedConfidence,
      adaptiveThreshold,
      suspiciousChecksCount: suspiciousChecks.length,
      reasons: [],
      scoring: {
        method: 'weighted',
        weights: 'signatures:40%, entropyBlocks:20%, lsb:15%, pixelCorr:15%, dist:5%, exif:5%'
      }
    };
    
    // Agregar razones específicas (ordenadas por gravedad)
    if (results.checks.signatures?.suspicious) {
      results.verdict.reasons.push(`🚨 CRÍTICO: Firmas de herramientas detectadas: ${results.checks.signatures.detected.join(', ')}`);
    }
    if (results.checks.entropyBlocks?.suspicious) {
      results.verdict.reasons.push(`⚠️ Alta entropía localizada (${(results.checks.entropyBlocks.anomalyScore * 100).toFixed(1)}% bloques anómalos)`);
    }
    if (results.checks.lsb?.suspicious) {
      results.verdict.reasons.push(`⚠️ Patrón sospechoso en bits menos significativos (entropía LSB: ${results.checks.lsb.lsbEntropy.toFixed(3)})`);
    }
    if (results.checks.image?.pixelCorrelation?.suspicious) {
      results.verdict.reasons.push(`⚠️ Correlación de píxeles anómala (diferencia: ${results.checks.image.pixelCorrelation.avgPixelDifference.toFixed(1)})`);
    }
    if (results.checks.distribution?.suspicious) {
      results.verdict.reasons.push(`ℹ️ Distribución anómala de bytes (chi²: ${results.checks.distribution.chiSquare.toFixed(1)})`);
    }
    if (results.checks.image?.exifAnalysis?.suspicious) {
      results.verdict.reasons.push(`ℹ️ Metadatos sospechosos: ${results.checks.image.exifAnalysis.suspiciousSignals.join(', ')}`);
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
