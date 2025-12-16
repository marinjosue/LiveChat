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
    
    def load_model_safe(self, model_name: str, fallback_name: str = None):
        """
        Cargar modelo con fallback.
        Intenta cargar modelo_name, si falla intenta fallback_name
        """
        primary = self.models_dir / model_name
        fallback = self.models_dir / fallback_name if fallback_name else None
        
        try:
            if primary.exists():
                with open(primary, 'rb') as f:
                    return pickle.load(f)
            elif fallback and fallback.exists():
                print(f"   ⚠️  {model_name} no encontrado, usando {fallback_name}")
                with open(fallback, 'rb') as f:
                    return pickle.load(f)
            else:
                raise FileNotFoundError(f"Modelo no encontrado: {model_name} o {fallback_name}")
        except Exception as e:
            print(f"   ❌ Error cargando {model_name}: {e}")
            raise
    
    def load_models(self):
        """Cargar todos los modelos necesarios (compatible con modelo_vulnerabilities.pkl)"""
        print("📦 Cargando modelos ML...")
        
        try:
            # ✓ OPCIÓN PRINCIPAL: Usar el modelo unificado model_vulnerabilities.pkl
            # Este es el nuevo modelo que contiene todo integrado
            model_path = self.models_dir / 'model_vulnerabilities.pkl'
            
            if model_path.exists():
                print(f"   📁 Cargando modelo unificado: {model_path.name}")
                with open(model_path, 'rb') as f:
                    unified_model = pickle.load(f)
                
                # Si el modelo unificado tiene todo integrado
                if hasattr(unified_model, 'analyze_code'):
                    print("   ✅ Modelo unificado cargado (API completa)")
                    self.model = unified_model
                    self.use_unified_model = True
                    print("✅ Modelos cargados exitosamente (Modo Unificado)")
                    return
                else:
                    print("   ⚠️  Modelo unificado sin método analyze_code, usando componentes individuales")
            
            # ✓ OPCIÓN FALLBACK: Cargar componentes individuales
            # Si el modelo unificado no funciona o no existe
            print("   📁 Cargando modelos individuales...")
            
            # Modelo 1: Detector binario
            self.detector = self.load_model_safe('vulnerability_detector.pkl')
            self.vectorizer = self.load_model_safe('vectorizer_detector.pkl')
            self.lang_encoder = self.load_model_safe('language_encoder.pkl')
            
            # Modelo 2: Clasificador CWE
            self.cwe_classifier = self.load_model_safe('cwe_classifier.pkl')
            self.vectorizer_cwe = self.load_model_safe('vectorizer_cwe_classifier.pkl')
            self.cwe_encoder = self.load_model_safe('cwe_encoder.pkl')
            
            self.use_unified_model = False
            print("✅ Modelos cargados exitosamente (Modo Componentes)")
            
        except Exception as e:
            print(f"❌ Error crítico cargando modelos: {e}")
            print(f"   Verifica que los modelos existan en: {self.models_dir}")
            sys.exit(1)
    
    def detect_vulnerability(self, code: str) -> Tuple[bool, float, Dict]:
        """
        Detectar si el código es vulnerable (Modelo 1)
        Returns: (is_vulnerable, confidence, probabilities)
        """
        # ✓ Si usamos el modelo unificado
        if self.use_unified_model:
            try:
                result = self.model.analyze_code(code, 'auto')
                return (
                    result.get('vulnerable', False),
                    result.get('score', 0.0),
                    {
                        'seguro': 1.0 - result.get('score', 0.0),
                        'vulnerable': result.get('score', 0.0)
                    }
                )
            except Exception as e:
                print(f"   ⚠️  Error con modelo unificado: {e}, usando fallback")
        
        # ✓ Fallback: Usar componentes individuales
        features = self.vectorizer.transform([code])
        
        # Ajustar features a 1001 (padding si es necesario)
        if features.shape[1] == 1000:
            import scipy.sparse as sp
            padding = sp.csr_matrix((features.shape[0], 1))
            features = sp.hstack([features, padding])
        
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
        Primero intenta con patrones regex, luego ML
        Returns: (cwe_type, confidence)
        """
        # ✓ Si usamos el modelo unificado
        if self.use_unified_model:
            try:
                result = self.model.analyze_code(code, 'auto')
                cwe_types = result.get('vulnerabilities', [])
                if cwe_types:
                    return f"{cwe_types[0]} ({result.get('details', '')})", result.get('score', 0.5), 1
            except Exception as e:
                print(f"   ⚠️  Error clasificando con modelo unificado: {e}")
        
        import re
        
        # Patrones regex para detectar vulnerabilidades específicas
        cwe_patterns = {
            'CWE-89': (r'(SELECT|INSERT|UPDATE|DELETE).*["\'].*\+.*["\']|query\s*=\s*["\'].*\+|db\.execute\(["\'].*\+', 'SQL Injection'),
            'CWE-79': (r'\.innerHTML\s*=|\.html\s*=|document\.write|eval\(', 'Cross-site Scripting (XSS)'),
            'CWE-78': (r'exec\(|shell\.run|child_process\.exec\(|subprocess\.call\(|system\(', 'OS Command Injection'),
            'CWE-434': (r'fs\.readFileSync\(.*\+|readFile\(.*\+|open\(.*filename', 'Path Traversal'),
            'CWE-798': (r'password\s*[=:]\s*["\']|api.?key\s*[=:]\s*["\']|secret\s*[=:]\s*["\']|AWS_SECRET|DB_PASSWORD', 'Hardcoded Credentials'),
            'CWE-327': (r'md5|MD5|createHash\(["\']md5["\']|hashlib\.md5', 'Weak Cryptography'),
            'CWE-95': (r'\beval\(|Function\(|setTimeout\(.*code|setInterval\(.*code', 'Code Injection'),
            'CWE-276': (r'app\.get\(["\'].*admin|app\.delete\(["\'].*delete|auth check missing', 'Insecure Permissions'),
        }
        
        lines = code.split('\n')
        detected_cwe = None
        highest_confidence = 0.0
        line_number = 1
        
        # Buscar patrones en el código línea por línea
        for cwe_id, (pattern, description) in cwe_patterns.items():
            try:
                # Buscar en cada línea
                for i, line in enumerate(lines, 1):
                    if re.search(pattern, line, re.IGNORECASE):
                        matches = len(re.findall(pattern, line, re.IGNORECASE))
                        confidence = min(0.95, 0.5 + (matches * 0.1))
                        
                        if confidence > highest_confidence:
                            highest_confidence = confidence
                            detected_cwe = cwe_id
                            line_number = i
            except:
                pass
        
        # Si se detectó un patrón, retornarlo con línea exacta
        if detected_cwe:
            cwe_name = cwe_patterns[detected_cwe][1]
            return f"{detected_cwe} ({cwe_name})", highest_confidence, line_number
        
        # Fallback: intentar con ML (solo si no usamos modelo unificado)
        if not self.use_unified_model:
            try:
                features_cwe = self.vectorizer_cwe.transform([code])
                
                # Ajustar features a 1001 (padding si es necesario)
                if features_cwe.shape[1] == 1000:
                    import scipy.sparse as sp
                    padding = sp.csr_matrix((features_cwe.shape[0], 1))
                    features_cwe = sp.hstack([features_cwe, padding])
                
                cwe_type_idx = self.cwe_classifier.predict(features_cwe)[0]
                cwe_type = self.cwe_encoder.inverse_transform([cwe_type_idx])[0]
                cwe_confidence = self.cwe_classifier.predict_proba(features_cwe)[0][cwe_type_idx]
                
                return str(cwe_type), float(cwe_confidence), 1
            except (IndexError, ValueError) as e:
                # Si hay error en clasificación, retornar tipo desconocido
                return "Unknown - No patterns matched", 0.0, 1
        
        return "Unknown - No patterns matched", 0.0, 1
    
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
            
            # Ajustar umbral: marcar como vulnerable si la probabilidad es > 40%
            # en lugar de depender del predictor directo (que tiende a ser conservador)
            adjusted_vulnerable = probs.get('vulnerable', 0) > 0.40
            
            result = {
                'file': str(file_path),
                'language': language,
                'vulnerable': adjusted_vulnerable,
                'detection_confidence': probs.get('vulnerable', 0),
                'probabilities': probs
            }
            
            # Si es vulnerable, clasificar tipo CWE (Modelo 2)
            if adjusted_vulnerable:
                cwe_result = self.classify_cwe(code)
                
                # Manejar ambos formatos (con y sin línea)
                if len(cwe_result) == 3:
                    cwe_type, cwe_conf, cwe_line = cwe_result
                else:
                    cwe_type, cwe_conf = cwe_result
                    cwe_line = 1
                
                result['cwe_type'] = cwe_type
                result['cwe_confidence'] = cwe_conf
                result['type'] = cwe_type  # Para notificación
                result['confidence'] = probs.get('vulnerable', 0)  # Usar probabilidad ajustada
                
                # Extraer línea de código relevante
                code_snippet = code[:100].replace('\n', ' ').strip()
                if len(code_snippet) > 50:
                    code_snippet = code_snippet[:50] + '...'
                result['code'] = code_snippet
                
                # Usar línea detectada por regex, si no usar heurística
                result['line'] = cwe_line
                
                # Severity based on confidence
                if probs.get('vulnerable', 0) > 0.85:
                    result['severity'] = 'critical'
                elif probs.get('vulnerable', 0) > 0.70:
                    result['severity'] = 'high'
                elif probs.get('vulnerable', 0) > 0.55:
                    result['severity'] = 'medium'
                else:
                    result['severity'] = 'low'
                
                result['status'] = 'VULNERABLE'
                
                print(f"🚨 {file_path.name}: VULNERABLE ({cwe_type}, {probs.get('vulnerable', 0):.1%}) [Línea {cwe_line}]")
            else:
                result['status'] = 'SAFE'
                print(f"✅ {file_path.name}: SAFE ({probs.get('vulnerable', 0):.1%})")
            
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
    import argparse
    
    parser = argparse.ArgumentParser(description='Escanear vulnerabilidades con ML')
    parser.add_argument('--files', nargs='+', help='Lista de archivos específicos a analizar')
    parser.add_argument('directory', nargs='?', help='Directorio a escanear (si no se especifican archivos)')
    args = parser.parse_args()
    
    # Configurar paths
    script_dir = Path(__file__).parent
    project_root = script_dir.parent.parent
    models_dir = project_root / 'ml-security' / 'models'
    
    # Modo 1: Archivos específicos
    if args.files:
        target_files = [Path(f) for f in args.files if Path(f).exists()]
        if not target_files:
            print("❌ Error: Ninguno de los archivos especificados existe")
            sys.exit(1)
        print(f"📋 Analizando {len(target_files)} archivos específicos")
    # Modo 2: Directorio
    elif args.directory:
        target_dir = Path(args.directory)
        if not target_dir.exists():
            print(f"❌ Error: Directorio no encontrado: {target_dir}")
            sys.exit(1)
        target_files = None
    else:
        print("❌ Uso:")
        print("   Modo 1 (archivos): python scan_vulnerabilities.py --files archivo1.js archivo2.py")
        print("   Modo 2 (directorio): python scan_vulnerabilities.py ../cliente/src")
        sys.exit(1)
    
    # Verificar que existan los modelos
    if not models_dir.exists():
        print(f"❌ Error: Directorio de modelos no encontrado: {models_dir}")
        sys.exit(1)
    
    # Inicializar scanner
    scanner = VulnerabilityScanner(models_dir)
    
    # Escanear archivos
    if target_files:
        # Modo archivos específicos
        results = []
        print(f"\n🔍 Analizando {len(target_files)} archivos específicos\n")
        for file_path in target_files:
            file_path = Path(file_path)
            if file_path.exists():
                result = scanner.scan_file(file_path)
                results.append(result)
    else:
        # Modo directorio
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
        'directory': str(target_dir) if target_files is None else 'multiple_files',
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
