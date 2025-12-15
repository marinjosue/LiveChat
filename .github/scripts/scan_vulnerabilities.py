#!/usr/bin/env python3
"""
Script de escaneo de vulnerabilidades para GitHub Actions
Usa los modelos ML entrenados para detectar y clasificar vulnerabilidades
"""

import sys
import os
import pickle
import json
from pathlib import Path
from typing import List, Dict, Tuple

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
    
    def detect_vulnerability(self, code: str) -> Tuple[bool, float, Dict]:
        """
        Detectar si el código es vulnerable (Modelo 1)
        Returns: (is_vulnerable, confidence, probabilities)
        """
        features = self.vectorizer.transform([code])
        is_vulnerable = self.detector.predict(features)[0]
        probabilities = self.detector.predict_proba(features)[0]
        
        return (
            bool(is_vulnerable),
            float(probabilities[is_vulnerable]),
            {
                'seguro': float(probabilities[0]),
                'vulnerable': float(probabilities[1])
            }
        )
    
    def classify_cwe(self, code: str) -> Tuple[str, float]:
        """
        Clasificar tipo de vulnerabilidad CWE (Modelo 2)
        Returns: (cwe_type, confidence)
        """
        features_cwe = self.vectorizer_cwe.transform([code])
        cwe_type_idx = self.cwe_classifier.predict(features_cwe)[0]
        cwe_type = self.cwe_encoder.inverse_transform([cwe_type_idx])[0]
        cwe_confidence = self.cwe_classifier.predict_proba(features_cwe)[0][cwe_type_idx]
        
        return str(cwe_type), float(cwe_confidence)
    
    def scan_file(self, file_path: Path) -> Dict:
        """Escanear un archivo individual"""
        try:
            # Leer contenido
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                code = f.read()
                lines = code.split('\n')
            
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
            
            # Si es vulnerable, clasificar tipo CWE (Modelo 2)
            if is_vulnerable:
                cwe_type, cwe_conf = self.classify_cwe(code)
                result['cwe_type'] = cwe_type
                result['cwe_confidence'] = cwe_conf
                result['type'] = cwe_type  # Para notificación
                result['confidence'] = confidence  # Normalizar para notificación
                
                # Extraer línea de código relevante
                code_snippet = code[:100].replace('\n', ' ').strip()
                if len(code_snippet) > 50:
                    code_snippet = code_snippet[:50] + '...'
                result['code'] = code_snippet
                
                # Estimar línea (usar primera línea con contenido relevante)
                result['line'] = 1
                for i, line in enumerate(lines[:20], 1):
                    if line.strip() and not line.strip().startswith('import') and not line.strip().startswith('const'):
                        result['line'] = i
                        break
                
                # Severity based on confidence
                if confidence > 0.85:
                    result['severity'] = 'critical'
                elif confidence > 0.70:
                    result['severity'] = 'high'
                else:
                    result['severity'] = 'medium'
                
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
        print("❌ Uso: python scan_vulnerabilities.py <directorio>")
        print("   Ejemplo: python scan_vulnerabilities.py ../cliente/src")
        sys.exit(1)
    
    # Configurar paths
    script_dir = Path(__file__).parent
    project_root = script_dir.parent.parent
    models_dir = project_root / 'ml-security' / 'models'
    target_dir = Path(sys.argv[1])
    
    # Verificar que exista el directorio
    if not target_dir.exists():
        print(f"❌ Error: Directorio no encontrado: {target_dir}")
        sys.exit(1)
    
    # Verificar que existan los modelos
    if not models_dir.exists():
        print(f"❌ Error: Directorio de modelos no encontrado: {models_dir}")
        sys.exit(1)
    
    # Inicializar scanner
    scanner = VulnerabilityScanner(models_dir)
    
    # Escanear
    results = scanner.scan_directory(target_dir)
    
    # Generar resumen
    print("\n" + "="*60)
    print("📊 RESUMEN DEL ANÁLISIS")
    print("="*60)
    
    total = len(results)
    vulnerable = sum(1 for r in results if r.get('vulnerable', False))
    safe = sum(1 for r in results if r.get('status') == 'SAFE')
    errors = sum(1 for r in results if r.get('status') == 'error')
    skipped = sum(1 for r in results if r.get('status') == 'skipped')
    
    print(f"📁 Total de archivos analizados: {total}")
    print(f"✅ Archivos seguros: {safe}")
    print(f"🚨 Archivos vulnerables: {vulnerable}")
    print(f"⚠️  Errores: {errors}")
    print(f"⏭️  Omitidos: {skipped}")
    
    # Detalles de vulnerabilidades
    if vulnerable > 0:
        print("\n🔴 VULNERABILIDADES DETECTADAS:")
        print("-" * 60)
        
        vuln_files = [r for r in results if r.get('vulnerable', False)]
        for vuln in vuln_files:
            print(f"\n📁 {vuln['file']}")
            print(f"   Lenguaje: {vuln['language']}")
            print(f"   Tipo CWE: {vuln.get('cwe_type', 'N/A')}")
            print(f"   Confianza detección: {vuln['detection_confidence']:.1%}")
            print(f"   Confianza CWE: {vuln.get('cwe_confidence', 0):.1%}")
    
    # Obtener datos del contexto de GitHub
    from datetime import datetime
    import subprocess
    
    timestamp = datetime.now().strftime('%d/%m/%Y %H:%M:%S')
    usuario = os.getenv('GITHUB_ACTOR', 'unknown')
    commit = os.getenv('GITHUB_SHA', 'unknown')[:7]
    commit_msg = os.getenv('GITHUB_COMMIT_MESSAGE', 'No message')
    
    # Obtener información del commit completo
    try:
        commit_full = subprocess.check_output(['git', 'rev-parse', 'HEAD'], 
                                             cwd=project_root, 
                                             text=True).strip()[:7]
        commit = commit_full
    except:
        pass
    
    # Procesar vulnerabilidades detectadas para el formato de notificación
    vuln_files = [r for r in results if r.get('vulnerable', False)]
    
    # Calcular resumen por severidad
    severity_counts = {
        'critical': sum(1 for r in vuln_files if r.get('severity') == 'critical'),
        'high': sum(1 for r in vuln_files if r.get('severity') == 'high'),
        'medium': sum(1 for r in vuln_files if r.get('severity') == 'medium')
    }
    
    # Ordenar vulnerabilidades por confianza (mayor primero) y tomar primeras 10
    sorted_vulns = sorted(vuln_files, key=lambda x: x.get('confidence', 0), reverse=True)[:10]
    
    # Formatear para notificación (hacer compatible con notify_telegram.py)
    vulnerabilities_for_notification = []
    for vuln in sorted_vulns:
        vulnerabilities_for_notification.append({
            'file': vuln.get('file', 'unknown'),
            'line': vuln.get('line', 1),
            'type': vuln.get('type', vuln.get('cwe_type', 'Unknown')),
            'confidence': vuln.get('confidence', 0),
            'code': vuln.get('code', ''),
            'severity': vuln.get('severity', 'medium')
        })
    
    # Guardar reporte JSON
    report = {
        'timestamp': timestamp,
        'usuario': usuario,
        'commit': commit,
        'commit_message': commit_msg,
        'directory': str(target_dir),
        'summary': {
            'total': total,
            'safe': safe,
            'vulnerable': vulnerable,
            'errors': errors,
            'skipped': skipped,
            'critical': severity_counts['critical'],
            'high': severity_counts['high'],
            'medium': severity_counts['medium']
        },
        'is_safe': vulnerable == 0,
        'files_scanned': total,
        'vulnerabilities': vulnerabilities_for_notification,
        'results': results  # Mantener para referencia detallada
    }
    
    report_file = project_root / 'vulnerability_report.json'
    with open(report_file, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    
    print(f"\n💾 Reporte guardado en: {report_file}")
    
    # Exit code
    if vulnerable > 0:
        print("\n❌ ANÁLISIS FALLIDO: Se detectaron vulnerabilidades")
        sys.exit(1)
    else:
        print("\n✅ ANÁLISIS EXITOSO: No se detectaron vulnerabilidades")
        sys.exit(0)


if __name__ == '__main__':
    main()
