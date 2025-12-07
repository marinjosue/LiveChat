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
 *  NUEVO: Análisis de entropía por bloques
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
    
    if (entropy > 7.95) {
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
    suspicious: anomalyScore > 0.25 
  };
}

/**
 * Analiza los bits menos significativos (LSB)
 * Técnica común de esteganografía (usada por OpenStego)
 */
function analyzeLSB(buffer) {
  const lsbPattern = [];
  let consecutiveSame = 0;
  let maxConsecutive = 0;
  let lastBit = -1;
  
  // Analizar más bytes para OpenStego (20000 en lugar de 10000)
  const sampleSize = Math.min(20000, buffer.length);
  
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
  
  // Ratio ideal en imagen natural: ~0.5 (50/50)
  // OpenStego puede alterar esto a valores más extremos
  const onesRatio = ones / lsbPattern.length;
  const ratioDeviation = Math.abs(onesRatio - 0.5);
  
  // OpenStego tiende a crear patrones con:
  // 1. Alta entropía en LSB (>0.88)
  // 2. Patrones muy cortos (maxConsecutive < 4)
  // 3. Ratio desbalanceado (lejos de 0.5)
  const isHighEntropy = lsbEntropy > 0.88;
  const isShortPatterns = maxConsecutive < 4;
  const isUnbalanced = ratioDeviation > 0.20;
  
  return {
    lsbEntropy,
    onesRatio,
    ratioDeviation,
    maxConsecutiveSame: maxConsecutive,
    suspicious: (isHighEntropy && isShortPatterns) || (isHighEntropy && isUnbalanced) || (isShortPatterns && isUnbalanced && lsbEntropy > 0.85),
    indicators: {
      highEntropy: isHighEntropy,
      shortPatterns: isShortPatterns,
      unbalancedRatio: isUnbalanced
    }
  };
}

/**
 * Verifica firmas digitales conocidas de herramientas de esteganografía
 */
function checkKnownSignatures(buffer) {
  const signatures = [
    // Firmas de texto plano
    { name: 'Steghide', pattern: Buffer.from('STEGHIDE', 'utf8') },
    { name: 'OpenStego-Text', pattern: Buffer.from('OPENSTEGO', 'utf8') },
    { name: 'OutGuess', pattern: Buffer.from('OUTGUESS', 'utf8') },
    { name: 'F5', pattern: Buffer.from('F5STEGO', 'utf8') },
    
    // OpenStego: Buscar patrones de encabezado característicos
    // OpenStego v0.8+ usa header con magic bytes específicos
    { name: 'OpenStego-Header', pattern: Buffer.from([0x4F, 0x53, 0x54]) }, // "OST"
    
    // Steghide: buscar "JPEG" seguido de patrones anómalos
    { name: 'Steghide-JPEG', pattern: Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]) },
  ];
  
  const detected = [];
  
  // Búsqueda de patrones conocidos
  for (const sig of signatures) {
    if (buffer.includes(sig.pattern)) {
      detected.push(sig.name);
    }
  }
  
  // OpenStego: Análisis específico adicional
  // OpenStego modifica los últimos bytes de forma característica
  if (buffer.length > 1000) {
    const lastKB = buffer.slice(-1024);
    const entropy = calculateEntropy(lastKB);
    
    // OpenStego tiende a dejar alta entropía al final
    if (entropy > 7.5) {
      // Verificar patrón de bytes con alta aleatoriedad
      let consecutiveHighBytes = 0;
      for (let i = lastKB.length - 100; i < lastKB.length; i++) {
        if (lastKB[i] > 200) consecutiveHighBytes++;
      }
      
      if (consecutiveHighBytes > 15) { // Más del 15% son bytes altos - MUY SENSIBLE
        detected.push('OpenStego-Pattern');
      }
    }
    
    // Detección adicional: OpenStego en PNG usa LSB en canales de color
    // Verificar primeros y últimos 512 bytes para patrones característicos
    const firstBlock = buffer.slice(0, 512);
    const lastBlock = buffer.slice(-512);
    const firstEntropy = calculateEntropy(firstBlock);
    const lastEntropy = calculateEntropy(lastBlock);
    
    // OpenStego PNG: entropía asimétrica entre inicio y final
    if (Math.abs(firstEntropy - lastEntropy) > 1.0 && lastEntropy > 7.3) {
      detected.push('OpenStego-Asymmetric');
    }
    
    // Detección adicional: verificar alta entropía en medio del archivo
    if (buffer.length > 2048) {
      const midBlock = buffer.slice(Math.floor(buffer.length / 2) - 512, Math.floor(buffer.length / 2) + 512);
      const midEntropy = calculateEntropy(midBlock);
      if (midEntropy > 7.6) {
        detected.push('OpenStego-HighMiddleEntropy');
      }
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
 * NUEVO: Análisis de correlación de píxeles (detecta LSB embedding)
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
    suspicious: avgDifference > 35, // Umbral aumentado - JPEG comprimido puede tener alta diferencia
    interpretation: avgDifference < 15 ? 'Natural' : avgDifference < 30 ? 'Comprimido (JPEG)' : 'Anómalo'
  };
}

/**
 * NUEVO: Análisis de metadatos EXIF
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
 * ✨ Análisis avanzado de patrones LSB en imágenes
 * Detecta manipulación LSB de CUALQUIER herramienta de esteganografía
 * (OpenStego, Steghide, S-Tools, Stegsolve, etc.)
 */
function analyzeAdvancedLSBPattern(rawData, channels, pixelCount, format) {
  const indicators = {
    lsbPlaneNoise: false,
    sequentialPattern: false,
    channelImbalance: false,
    randomPattern: false,
    suspicious: false
  };
  
  // 1. Analizar plano LSB completo (todos los LSBs)
  const lsbPlane = [];
  const sampleSize = Math.min(10000, pixelCount * channels);
  
  for (let i = 0; i < sampleSize; i++) {
    lsbPlane.push(rawData[i] & 1);
  }
  
  // Calcular entropía del plano LSB
  const lsbEntropy = calculateEntropy(Buffer.from(lsbPlane));
  
  // Alta entropía = datos encriptados/comprimidos ocultos (CUALQUIER herramienta)
  // JPEG: umbral más alto debido a compresión natural
  const entropyThreshold = format === 'jpeg' || format === 'jpg' ? 0.97 : 0.92;
  indicators.lsbPlaneNoise = lsbEntropy > entropyThreshold;
  
  // 2. Detectar patrón secuencial (muchas herramientas escriben secuencialmente)
  let transitions = 0;
  for (let i = 1; i < Math.min(5000, lsbPlane.length); i++) {
    if (lsbPlane[i] !== lsbPlane[i - 1]) transitions++;
  }
  const transitionRate = transitions / Math.min(5000, lsbPlane.length);
  
  // Patrón ~50% de transiciones es sospechoso (común en esteganografía)
  // JPEG: rango más estricto
  const isJpeg = format === 'jpeg' || format === 'jpg';
  indicators.sequentialPattern = isJpeg 
    ? (transitionRate > 0.45 && transitionRate < 0.55)
    : (transitionRate > 0.40 && transitionRate < 0.60);
  
  // 3. Detectar patrón completamente aleatorio (alta entropía + transiciones uniformes)
  indicators.randomPattern = lsbEntropy > 0.99 && Math.abs(transitionRate - 0.5) < 0.03;
  
  // 4. Analizar diferencia entre canales RGB
  if (channels >= 3) {
    const channelLSBs = [];
    for (let c = 0; c < 3; c++) {
      const channelBits = [];
      for (let i = 0; i < Math.min(3000, pixelCount); i++) {
        channelBits.push(rawData[i * channels + c] & 1);
      }
      const ones = channelBits.filter(b => b === 1).length;
      channelLSBs.push(ones / channelBits.length);
    }
    
    // Desbalance entre canales indica manipulación selectiva
    const maxDiff = Math.max(...channelLSBs) - Math.min(...channelLSBs);
    indicators.channelImbalance = maxDiff > 0.08; // Más sensible
  }
  
  // 5. Formatos sin compresión son ideales para TODA esteganografía LSB
  const isLosslessFormat = format === 'bmp' || format === 'png' || format === 'tiff';
  
  // Decisión final: múltiples criterios para detectar CUALQUIER técnica LSB
  const suspiciousCount = [
    indicators.lsbPlaneNoise,
    indicators.sequentialPattern,
    indicators.randomPattern,
    indicators.channelImbalance
  ].filter(Boolean).length;
  
  // JPEG: requiere más evidencia (3+ indicadores o firmas conocidas)
  // Formatos sin pérdida: más sensible (2+ indicadores)
  const isJpegFormat = format === 'jpeg' || format === 'jpg';
  indicators.suspicious = isJpegFormat 
    ? (suspiciousCount >= 3) 
    : ((suspiciousCount >= 2) || (suspiciousCount >= 1 && isLosslessFormat && lsbEntropy > 0.90));
  indicators.format = format;
  indicators.lsbEntropy = lsbEntropy;
  indicators.transitionRate = transitionRate;
  
  return indicators;
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
    
    // ✨ Análisis avanzado LSB (detecta TODAS las herramientas)
    const advancedLSBAnalysis = analyzeAdvancedLSBPattern(rawData, channels, pixelCount, metadata.format);
    
    // Detectar anomalías en metadatos (tamaño excesivo)
    const metadataSize = JSON.stringify(metadata).length;
    const suspiciousMetadata = metadataSize > 5000;
    
    // Umbral adaptativo por formato - JPEG naturalmente tiene alta entropía por compresión
    const entropyThresholds = {
      'jpeg': 7.85,  // JPEG comprimido tiene naturalmente alta entropía (7.5-7.8)
      'jpg': 7.85,
      'png': 7.0,    // PNG: umbral bajo para detectar OpenStego
      'bmp': 6.5,  // BMP: sin compresión = ideal para esteganografía
      'gif': 7.6,
      'webp': 7.4
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
      advancedLSBAnalysis,
      suspiciousMetadata,
      format: metadata.format,
      suspicious: avgEntropy > threshold || suspiciousMetadata || pixelCorrelation.suspicious || exifAnalysis.suspicious || advancedLSBAnalysis.suspicious
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
    'image/jpeg': 0.70,  // JPEG: umbral ALTO - compresión natural genera alta entropía
    'image/jpg': 0.70,
    'image/png': 0.45,   // PNG: IGUAL QUE BMP - OpenStego muy común en PNG
    'image/bmp': 0.45,  // BMP: MUY bajo (formato muy común para esteganografía)
    'image/x-ms-bmp': 0.45,
    'image/x-bmp': 0.45,
    'image/gif': 0.65,
    'image/webp': 0.62,
    'application/pdf': 0.70,
    'video/mp4': 0.75,
    'video/webm': 0.75,
    'audio/mpeg': 0.65,
    'audio/wav': 0.60
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
  // Pesos según confiabilidad de cada técnica - BALANCEADO PARA DETECTAR TODO TIPO DE ESTEGANOGRAFÍA
  const weights = {
    'signatures': 0.40,        // 40% - Firmas conocidas (Steghide, OpenStego, OutGuess, F5, etc.) - AUMENTADO
    'lsbAdvanced': 0.25,       // 25% - Análisis LSB avanzado (detecta TODAS las técnicas LSB)
    'entropyBlocks': 0.15,     // 15% - Anomalías de entropía localizada
    'pixelCorrelation': 0.10,  // 10% - Correlación de píxeles (imágenes)
    'distribution': 0.07,      // 7% - Distribución estadística de bytes
    'exif': 0.03               // 3% - Metadatos anómalos
  };
  
  let weightedScore = 0;
  let totalWeight = 0;
  
  // 1. Firmas de herramientas conocidas (cualquier herramienta)
  if (checks.signatures?.suspicious) {
    weightedScore += weights.signatures;
  }
  totalWeight += weights.signatures;
  
  // 2. Análisis LSB (detecta cualquier técnica LSB: OpenStego, Steghide, etc.)
  if (checks.lsb?.suspicious) {
    weightedScore += weights.lsbAdvanced;
  }
  totalWeight += weights.lsbAdvanced;
  
  // 3. Entropía por bloques (detecta datos encriptados/ocultos)
  if (checks.entropyBlocks?.suspicious) {
    weightedScore += weights.entropyBlocks;
  }
  totalWeight += weights.entropyBlocks;
  
  // 4. Distribución estadística (anomalías en distribución de bytes)
  if (checks.distribution?.suspicious) {
    weightedScore += weights.distribution;
  }
  totalWeight += weights.distribution;
  
  // 5. Análisis específico de imágenes (si aplica)
  if (mimeType.startsWith('image/')) {
    // Correlación de píxeles (detecta manipulación LSB de cualquier fuente)
    if (checks.image?.pixelCorrelation?.suspicious) {
      weightedScore += weights.pixelCorrelation;
    }
    totalWeight += weights.pixelCorrelation;
    
    // Metadatos anómalos
    if (checks.image?.exifAnalysis?.suspicious) {
      weightedScore += weights.exif;
    }
    totalWeight += weights.exif;
    
    // Análisis avanzado de patrones LSB (detecta CUALQUIER herramienta)
    if (checks.image?.advancedLSBAnalysis?.suspicious) {
      // Este análisis detecta patrones LSB sospechosos de CUALQUIER fuente
      // Solo suma al score si no se ha detectado ya por LSB básico
      if (!checks.lsb?.suspicious) {
        weightedScore += weights.lsbAdvanced * 0.5; // 50% adicional
      }
    }
  }
  
  return weightedScore / totalWeight;
}

/**
 * Análisis principal (MEJORADO)
 */
async function analyzeSteganography(fileBuffer, mimeType, fileName) {
  try {
    console.log(`[WORKER] Analizando: ${fileName} (${(fileBuffer.length / 1024).toFixed(1)}KB)`);
    
    const results = {
      fileName,
      mimeType,
      fileSize: fileBuffer.length,
      timestamp: new Date().toISOString(),
      checks: {}
    };
    
    // 1. Análisis de entropía global - umbral adaptativo por tipo
    const globalEntropy = calculateEntropy(fileBuffer);
    const isJpeg = mimeType === 'image/jpeg' || mimeType === 'image/jpg';
    const entropyThreshold = isJpeg ? 7.95 : 7.85; // JPEG tiene naturalmente alta entropía
    results.checks.entropy = {
      value: globalEntropy,
      suspicious: globalEntropy > entropyThreshold,
      threshold: entropyThreshold
    };
    
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
    if (knownSignatures.length > 0) {
      console.log(`[WORKER] ⚠️ FIRMAS DETECTADAS en ${fileName}: ${knownSignatures.join(', ')}`);
    }
    
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
    
    const weightedConfidence = calculateWeightedConfidence(results.checks, mimeType);
    const adaptiveThreshold = determineConfidenceThreshold(mimeType, fileBuffer.length);
    const isSuspicious = weightedConfidence >= adaptiveThreshold;
    
    const suspiciousChecks = [
      results.checks.entropyBlocks?.suspicious,
      results.checks.lsb?.suspicious,
      results.checks.signatures?.suspicious,
      results.checks.distribution?.suspicious,
      results.checks.image?.pixelCorrelation?.suspicious,
      results.checks.image?.exifAnalysis?.suspicious,
      results.checks.image?.advancedLSBAnalysis?.suspicious
    ].filter(Boolean);
    
    console.log(`[WORKER] ${isSuspicious ? '🚨 SOSPECHOSO' : '✅ LIMPIO'} - Confianza: ${(weightedConfidence * 100).toFixed(0)}% vs Umbral: ${(adaptiveThreshold * 100).toFixed(0)}% (${suspiciousChecks.length}/7 checks)`);
    
    // Debug detallado para PNG
    if (mimeType === 'image/png') {
      console.log(`[WORKER PNG DEBUG]:`);
      console.log(`  - Firmas: ${results.checks.signatures?.detected.join(', ') || 'ninguna'}`);
      console.log(`  - LSB suspicious: ${results.checks.lsb?.suspicious ? 'SÍ' : 'NO'} (entropy: ${results.checks.lsb?.lsbEntropy?.toFixed(3)})`);
      console.log(`  - Entropy blocks: ${results.checks.entropyBlocks?.suspicious ? 'SÍ' : 'NO'}`);
      console.log(`  - Advanced LSB: ${results.checks.image?.advancedLSBAnalysis?.suspicious ? 'SÍ' : 'NO'}`);
    }
    
    results.verdict = {
      isSuspicious,
      confidence: weightedConfidence,
      adaptiveThreshold,
      suspiciousChecksCount: suspiciousChecks.length,
      reasons: [],
      scoring: {
        method: 'weighted',
        weights: 'signatures:35%, openStego:25%, entropyBlocks:15%, lsb:12%, pixelCorr:8%, dist:3%, exif:2%'
      }
    };
    
    // Agregar razones específicas (ordenadas por gravedad)
    if (results.checks.signatures?.suspicious) {
      results.verdict.reasons.push(`CRÍTICO: Firmas de herramientas detectadas: ${results.checks.signatures.detected.join(', ')}`);
    }
    if (results.checks.entropyBlocks?.suspicious) {
      results.verdict.reasons.push(`Alta entropía localizada (${(results.checks.entropyBlocks.anomalyScore * 100).toFixed(1)}% bloques anómalos)`);
    }
    if (results.checks.lsb?.suspicious) {
      results.verdict.reasons.push(`Patrón sospechoso en bits menos significativos (entropía LSB: ${results.checks.lsb.lsbEntropy.toFixed(3)})`);
    }
    if (results.checks.image?.pixelCorrelation?.suspicious) {
      results.verdict.reasons.push(`Correlación de píxeles anómala (diferencia: ${results.checks.image.pixelCorrelation.avgPixelDifference.toFixed(1)})`);
    }
    if (results.checks.distribution?.suspicious) {
      results.verdict.reasons.push(`Distribución anómala de bytes (chi²: ${results.checks.distribution.chiSquare.toFixed(1)})`);
    }
    if (results.checks.image?.exifAnalysis?.suspicious) {
      results.verdict.reasons.push(`Metadatos sospechosos: ${results.checks.image.exifAnalysis.suspiciousSignals.join(', ')}`);
    }
    if (results.checks.image?.advancedLSBAnalysis?.suspicious) {
      const indicators = [];
      if (results.checks.image.advancedLSBAnalysis.lsbPlaneNoise) indicators.push('LSB con alta aleatoriedad');
      if (results.checks.image.advancedLSBAnalysis.randomPattern) indicators.push('patrón completamente aleatorio');
      if (results.checks.image.advancedLSBAnalysis.sequentialPattern) indicators.push('patrón secuencial');
      if (results.checks.image.advancedLSBAnalysis.channelImbalance) indicators.push('desbalance entre canales');
      results.verdict.reasons.push(`ALTA SOSPECHA: Patrón LSB sospechoso detectado - posible esteganografía (${indicators.join(', ')})`);
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
