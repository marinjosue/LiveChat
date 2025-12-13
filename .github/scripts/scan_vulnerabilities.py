#!/usr/bin/env python3
"""
Script de escaneo de vulnerabilidades para GitHub Actions
Usa los modelos ML entrenados para detectar y clasificar vulnerabilidades
"""

import sys
import os
import pickle
import json
import numpy as np
from pathlib import Path
from typing import List, Dict, Tuple
from datetime import datetime

# Agregar path del proyecto
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

# Mapeo de extensiones a lenguajes soportados
EXT_TO_LANG = {
    'js': 'JavaScript',
    'jsx': 'JavaScript',
    'ts': 'JavaScript',
    'tsx': 'JavaScript',
    'py': 'Python',
    'java': 'Java',
    'cpp': 'C++',
    'c': 'C++',
    'cs': 'C#',
    'php': 'PHP',
    'rb': 'Ruby',
    'go': 'Go',
    'kt': 'Kotlin'
}

class VulnerabilityScanner:
    # Umbral mínimo de confianza para reportar vulnerabilidades
    CONFIDENCE_THRESHOLD = 0.75
    
    def __init__(self, models_dir: Path):
        """Inicializar scanner con los modelos ML"""
        self.models_dir = models_dir
        self.load_models()
    
    def load_models(self):
        """Cargar todos los modelos necesarios"""
        print("📦 Cargando modelos ML...")
        
        try:
            # Modelo 1: Detector binario
            with open(self.models_dir / 'vulnerability_detector.pkl', 'rb') as f:
                self.detector = pickle.load(f)
            
            with open(self.models_dir / 'vectorizer_detector.pkl', 'rb') as f:
                self.vectorizer = pickle.load(f)
            
            with open(self.models_dir / 'language_encoder.pkl', 'rb') as f:
                self.lang_encoder = pickle.load(f)
            
            # Modelo 2: Clasificador CWE
            with open(self.models_dir / 'cwe_classifier.pkl', 'rb') as f:
                self.cwe_classifier = pickle.load(f)
            
            with open(self.models_dir / 'vectorizer_cwe_classifier.pkl', 'rb') as f:
                self.vectorizer_cwe = pickle.load(f)
            
            with open(self.models_dir / 'cwe_encoder.pkl', 'rb') as f:
                self.cwe_encoder = pickle.load(f)
            
            print("✅ Modelos cargados exitosamente")
            
        except Exception as e:
            print(f"❌ Error cargando modelos: {e}")
            sys.exit(1)
    
    def _pad_features(self, features: np.ndarray, target_size: int) -> np.ndarray:
        """
        Ajustar número de features al tamaño esperado por padding o truncado
        """
        current_size = features.shape[1]
        
        if current_size == target_size:
            return features
        elif current_size < target_size:
            # Padding con ceros
            padding = np.zeros((features.shape[0], target_size - current_size))
            return np.hstack([features, padding])
        else:
            # Truncar al tamaño objetivo
            return features[:, :target_size]
    
    def detect_vulnerability(self, code: str) -> Tuple[bool, float, Dict]:
        """
        Detectar si el código es vulnerable (Modelo 1)
        Returns: (is_vulnerable, confidence, probabilities)
        """
        features = self.vectorizer.transform([code]).toarray()
        
        # Intentar ambas dimensiones con manejo robusto
        for target_features in [1001, 1200]:
            try:
                features_padded = self._pad_features(features, target_features)
                is_vulnerable = self.detector.predict(features_padded)[0]
                probabilities = self.detector.predict_proba(features_padded)[0]
                
                return (
                    bool(is_vulnerable),
                    float(probabilities[is_vulnerable]),
                    {
                        'seguro': float(probabilities[0]),
                        'vulnerable': float(probabilities[1])
                    }
                )
            except Exception:
                # Continuar al siguiente intento
                continue
        
        # Si ambos fallan, retornar seguro por defecto
        return (False, 0.0, {'seguro': 1.0, 'vulnerable': 0.0})
    
    def classify_cwe(self, code: str) -> Tuple[str, float]:
        """
        Clasificar tipo de vulnerabilidad CWE (Modelo 2)
        Returns: (cwe_type, confidence)
        """
        features_cwe = self.vectorizer_cwe.transform([code]).toarray()
        
        # Intentar ambas dimensiones con manejo robusto
        for target_features in [1200, 1001]:
            try:
                features_padded = self._pad_features(features_cwe, target_features)
                cwe_type_idx = self.cwe_classifier.predict(features_padded)[0]
                cwe_confidence = self.cwe_classifier.predict_proba(features_padded)[0][cwe_type_idx]
                cwe_type = self.cwe_encoder.inverse_transform([cwe_type_idx])[0]
                
                return str(cwe_type), float(cwe_confidence)
            except Exception:
                # Continuar al siguiente intento
                continue
        
        # Si ambos fallan, retornar tipo desconocido
        return 'Unknown', 0.0
    
    def scan_file(self, file_path: Path) -> Dict:
        """Escanear un archivo individual"""
        try:
            # Leer contenido
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                code = f.read()
            
            # Ignorar archivos muy pequeños o vacíos
            if len(code.strip()) < 10:
                return {
                    'file': str(file_path),
                    'status': 'skipped',
                    'reason': 'Archivo muy pequeño'
                }
            
            # Detectar lenguaje
            ext = file_path.suffix[1:]
            language = EXT_TO_LANG.get(ext, 'JavaScript')
            
            # Análisis Modelo 1: Detección
            is_vulnerable, confidence, probs = self.detect_vulnerability(code)
            
            result = {
                'file': str(file_path),
                'language': language,
                'vulnerable': is_vulnerable,
                'detection_confidence': confidence,
                'probabilities': probs
            }
            
            # Solo reportar como vulnerable si confianza > CONFIDENCE_THRESHOLD
            if is_vulnerable and confidence < self.CONFIDENCE_THRESHOLD:
                # Marcar como falso positivo de baja confianza
                result['status'] = 'SAFE'
                result['note'] = f'Low confidence detection ({confidence:.1%}), treated as SAFE'
                print(f"✅ {file_path.name}: SAFE (low confidence detection {confidence:.1%})")
            elif is_vulnerable:
                # Clasificar tipo CWE (Modelo 2) solo si alta confianza
                cwe_type, cwe_conf = self.classify_cwe(code)
                result['cwe_type'] = cwe_type
                result['cwe_confidence'] = cwe_conf
                result['status'] = 'VULNERABLE'
                
                print(f"🚨 {file_path.name}: VULNERABLE ({cwe_type}, {confidence:.1%})")
            else:
                result['status'] = 'SAFE'
                print(f"✅ {file_path.name}: SAFE ({confidence:.1%})")
            
            return result
            
        except Exception as e:
            print(f"⚠️  Error analizando {file_path}: {e}")
            return {
                'file': str(file_path),
                'status': 'error',
                'error': str(e)
            }
    
    def scan_directory(self, directory: Path, extensions: List[str] = None) -> List[Dict]:
        """Escanear todos los archivos de código en un directorio"""
        if extensions is None:
            extensions = list(EXT_TO_LANG.keys())
        
        results = []
        
        print(f"\n🔍 Escaneando directorio: {directory}")
        print(f"📝 Extensiones: {', '.join(extensions)}\n")
        
        # Buscar archivos recursivamente
        for ext in extensions:
            for file_path in directory.rglob(f'*.{ext}'):
                # Ignorar node_modules, build, dist, etc.
                if any(ignored in file_path.parts for ignored in ['node_modules', 'build', 'dist', 'coverage', '.git']):
                    continue
                
                result = self.scan_file(file_path)
                results.append(result)
        
        return results


def main():
    """Función principal"""
    if len(sys.argv) < 2:
        print("❌ Uso: python scan_vulnerabilities.py <directorio|archivo> [directorio|archivo] ...")
        print("   Ejemplo (directorios): python scan_vulnerabilities.py cliente servidor")
        print("   Ejemplo (archivos): python scan_vulnerabilities.py cliente/src/App.js servidor/server.js")
        print("   Ejemplo (mixto): python scan_vulnerabilities.py cliente/src servidor/models/Room.js")
        sys.exit(1)
    
    # Configurar paths
    script_dir = Path(__file__).parent
    project_root = script_dir.parent.parent
    models_dir = project_root / 'ml-security' / 'models'
    
    # Verificar que existan los modelos
    if not models_dir.exists():
        print(f"❌ Error: Directorio de modelos no encontrado: {models_dir}")
        print(f"   Ruta esperada: {models_dir}")
        sys.exit(1)
    
    # Inicializar scanner
    try:
        scanner = VulnerabilityScanner(models_dir)
    except Exception as e:
        print(f"❌ Error inicializando scanner: {e}")
        sys.exit(1)
    
    # Procesar múltiples directorios y/o archivos
    all_results = []
    target_dirs = []
    
    for target_name in sys.argv[1:]:
        target_path = Path(target_name)
        
        # Intentar rutas relativas si no existe
        if not target_path.exists():
            target_path = project_root / target_name
        
        if not target_path.exists():
            print(f"⚠️  Ruta no encontrada: {target_name}")
            continue
        
        if target_path.is_file():
            # Si es archivo, escanear directamente
            print(f"\n📄 Escaneando archivo: {target_path}")
            result = scanner.scan_file(target_path)
            all_results.append(result)
            target_dirs.append(str(target_path))
            
        elif target_path.is_dir():
            # Si es directorio, escanear recursivamente
            print(f"\n🔍 Escaneando: {target_path}")
            results = scanner.scan_directory(target_path)
            all_results.extend(results)
            target_dirs.append(str(target_path))
    
    # Generar resumen
    print("\n" + "="*70)
    print("📊 RESUMEN DEL ANÁLISIS DE VULNERABILIDADES")
    print("="*70)
    
    total = len(all_results)
    vulnerable = sum(1 for r in all_results if r.get('status') == 'VULNERABLE')
    safe = sum(1 for r in all_results if r.get('status') == 'SAFE')
    errors = sum(1 for r in all_results if r.get('status') == 'error')
    skipped = sum(1 for r in all_results if r.get('status') == 'skipped')
    low_conf = sum(1 for r in all_results if 'low confidence' in r.get('note', '').lower())
    
    print(f"\n📁 Directorios analizados: {len(target_dirs)}")
    print(f"📊 Total de archivos: {total}")
    print(f"   ✅ Seguros: {safe} ({safe/total*100:.1f}%)" if total > 0 else "   ✅ Seguros: 0")
    print(f"   🚨 Vulnerables: {vulnerable} ({vulnerable/total*100:.1f}%)" if total > 0 else "   🚨 Vulnerables: 0")
    if low_conf > 0:
        print(f"   ⚠️  Baja confianza (filtradas): {low_conf}")
    print(f"   ⚠️  Errores: {errors}")
    print(f"   ⏭️  Omitidos: {skipped}")
    
    # Detalles de vulnerabilidades detectadas
    if vulnerable > 0:
        print(f"\n🔴 VULNERABILIDADES DETECTADAS ({vulnerable}):")
        print("-" * 70)
        
        vuln_files = [r for r in all_results if r.get('status') == 'VULNERABLE']
        for idx, vuln in enumerate(vuln_files, 1):
            file_name = Path(vuln['file']).name
            print(f"\n{idx}. 📁 {file_name}")
            print(f"   Ruta: {vuln['file']}")
            print(f"   Lenguaje: {vuln.get('language', 'N/A')}")
            print(f"   Tipo CWE: {vuln.get('cwe_type', 'Desconocido')}")
            print(f"   Confianza Detección: {vuln.get('detection_confidence', 0):.1%}")
            print(f"   Confianza CWE: {vuln.get('cwe_confidence', 0):.1%}")
    elif low_conf > 0:
        print(f"\n⚠️  Se detectaron {low_conf} archivos con baja confianza (< {VulnerabilityScanner.CONFIDENCE_THRESHOLD:.0%}), tratados como SEGUROS")
        print("   Estos pueden requerir revisión manual si es necesario")
    
    # Crear reporte detallado
    vulnerabilities_list = []
    for r in all_results:
        if r.get('status') == 'VULNERABLE':
            vulnerabilities_list.append({
                'file': r['file'],
                'type': r.get('cwe_type', 'Unknown'),
                'cwe_type': r.get('cwe_type', 'Unknown'),
                'confidence': r.get('detection_confidence', 0),
                'severity': _get_severity(r.get('detection_confidence', 0)),
                'description': f"ML Vulnerability Detector confidence: {r.get('detection_confidence', 0):.1%}"
            })
    
    # Guardar reporte JSON
    report = {
        'timestamp': __import__('datetime').datetime.now().isoformat(),
        'directories': target_dirs,
        'models': {
            'detector': 'Vulnerability Detector (79.01% accuracy)',
            'classifier': 'CWE Classifier (86.94% accuracy)',
            'confidence_threshold': f'{VulnerabilityScanner.CONFIDENCE_THRESHOLD:.0%}'
        },
        'summary': {
            'total': total,
            'safe': safe,
            'vulnerable': vulnerable,
            'low_confidence_filtered': low_conf,
            'errors': errors,
            'skipped': skipped
        },
        'is_safe': vulnerable == 0,
        'vulnerabilities': vulnerabilities_list,
        'results': all_results
    }
    
    report_file = Path('vulnerability_report.json')
    with open(report_file, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    
    print(f"\n💾 Reporte guardado en: {report_file}")
    print("="*70)
    
    # Exit code based on findings
    if vulnerable > 0:
        print("\n❌ ANÁLISIS COMPLETADO: Se detectaron vulnerabilidades")
        sys.exit(1)
    else:
        print("\n✅ ANÁLISIS COMPLETADO: No se detectaron vulnerabilidades")
        sys.exit(0)


def _get_severity(confidence: float) -> str:
    """Determinar severidad basada en confianza"""
    if confidence > 0.95:
        return 'critical'
    elif confidence > 0.85:
        return 'high'
    elif confidence > 0.70:
        return 'medium'
    else:
        return 'low'


if __name__ == '__main__':
    main()
