#!/usr/bin/env python3
"""
Script de escaneo de vulnerabilidades para GitHub Actions
Usa el modelo ML VulnerabilityModel para detectar y clasificar vulnerabilidades
"""

import sys
import os
import json
from pathlib import Path
from typing import List, Dict

# Agregar path del proyecto
sys.path.insert(0, str(Path(__file__).parent.parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent.parent / 'ml-security'))

# Importar el modelo
try:
    from model_vulnerabilities import VulnerabilityModel
    print("✅ Modelo importado exitosamente")
except ImportError as e:
    print(f"❌ Error importando modelo: {e}")
    print(f"   Asegúrate que model_vulnerabilities.py está en ml-security/")
    sys.exit(1)

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
    def __init__(self):
        """Inicializar scanner con el modelo ML"""
        print("📦 Inicializando modelo de vulnerabilidades...")
        try:
            self.model = VulnerabilityModel()
            print("✅ Modelo cargado exitosamente")
        except Exception as e:
            print(f"❌ Error inicializando modelo: {e}")
            sys.exit(1)
    
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
            ext = file_path.suffix[1:].lower()
            language = EXT_TO_LANG.get(ext, 'python')
            
            # ✓ USAR MODELO: Analizar código
            print(f"🔍 Analizando: {file_path.name} ({language})")
            analysis = self.model.analyze_code(code, language)
            
            result = {
                'file': str(file_path),
                'language': language,
                'vulnerable': analysis.get('vulnerable', False),
                'max_risk_score': analysis.get('max_risk_score', 0.0),
                'total_vulnerabilities': analysis.get('summary', {}).get('total_vulnerabilities', 0),
                'status': 'VULNERABLE' if analysis.get('vulnerable') else 'SAFE'
            }
            
            # Si es vulnerable, agregar detalles
            if analysis.get('vulnerable'):
                vulnerabilities = analysis.get('vulnerabilities', [])
                
                # Vulnerabilidades ordenadas por riesgo
                sorted_vulns = sorted(vulnerabilities, key=lambda x: x.get('risk_score', 0), reverse=True)
                
                result['vulnerabilities'] = sorted_vulns
                result['vulnerability_types'] = analysis.get('summary', {}).get('vulnerability_types', [])
                
                # Tomar la primera vulnerabilidad como principal
                if sorted_vulns:
                    main_vuln = sorted_vulns[0]
                    result['type'] = main_vuln.get('type', 'Unknown')
                    result['line'] = main_vuln.get('line_number', 1)
                    result['confidence'] = main_vuln.get('risk_score', 0.0)
                    result['code'] = main_vuln.get('line_content', '')
                    
                    # Determinar severidad basada en risk score
                    risk_score = main_vuln.get('risk_score', 0.0)
                    if risk_score > 0.85:
                        result['severity'] = 'critical'
                    elif risk_score > 0.75:
                        result['severity'] = 'high'
                    elif risk_score > 0.65:
                        result['severity'] = 'medium'
                    else:
                        result['severity'] = 'low'
                
                print(f"   🚨 VULNERABLE: {result.get('type')} (Risk: {result.get('confidence', 0):.1%}) [Línea {result.get('line', 1)}]")
            else:
                print(f"   ✅ SAFE")
            
            return result
            
        except Exception as e:
            print(f"   ⚠️  Error: {e}")
            return {
                'file': str(file_path),
                'status': 'error',
                'error': str(e)
            }
    
    def scan_files(self, file_paths: List[Path]) -> List[Dict]:
        """Escanear múltiples archivos"""
        results = []
        
        print(f"\n🔍 Escaneando {len(file_paths)} archivos\n")
        
        for file_path in file_paths:
            if file_path.exists():
                result = self.scan_file(file_path)
                results.append(result)
        
        return results


def main():
    """Función principal"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Escanear vulnerabilidades con modelo ML')
    parser.add_argument('--files', nargs='+', help='Lista de archivos específicos a analizar')
    args = parser.parse_args()
    
    # Configurar paths
    script_dir = Path(__file__).parent
    project_root = script_dir.parent.parent
    
    # Obtener archivos a escanear
    if args.files:
        target_files = [Path(f) for f in args.files if Path(f).exists()]
        if not target_files:
            print("❌ Error: Ninguno de los archivos especificados existe")
            sys.exit(1)
    else:
        print("❌ Uso: python scan_vulnerabilities.py --files archivo1.js archivo2.py")
        sys.exit(1)
    
    # Inicializar scanner
    scanner = VulnerabilityScanner()
    
    # Escanear archivos
    results = scanner.scan_files(target_files)
    
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
        for vuln in vuln_files[:10]:  # Primeras 10
            print(f"\n📁 {vuln['file']}")
            print(f"   Tipo: {vuln.get('type', 'Unknown')}")
            print(f"   Riesgo: {vuln.get('confidence', 0):.1%}")
            print(f"   Severidad: {vuln.get('severity', 'unknown')}")
            print(f"   Línea: {vuln.get('line', 1)}")
            if vuln.get('code'):
                print(f"   Código: {vuln['code'][:60]}")
    
    # Contexto de GitHub
    from datetime import datetime
    import subprocess
    
    timestamp = datetime.now().strftime('%d/%m/%Y %H:%M:%S')
    usuario = os.getenv('GITHUB_ACTOR', 'unknown')
    
    try:
        commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], 
                                       text=True, stderr=subprocess.DEVNULL).strip()[:7]
    except:
        commit = 'unknown'
    
    commit_msg = os.getenv('GITHUB_COMMIT_MESSAGE', 'No message')
    
    # Calcular resumen por severidad
    severity_counts = {
        'critical': sum(1 for r in results if r.get('severity') == 'critical'),
        'high': sum(1 for r in results if r.get('severity') == 'high'),
        'medium': sum(1 for r in results if r.get('severity') == 'medium'),
        'low': sum(1 for r in results if r.get('severity') == 'low')
    }
    
    # Preparar vulnerabilidades para notificación
    vuln_files = [r for r in results if r.get('vulnerable', False)]
    sorted_vulns = sorted(vuln_files, key=lambda x: x.get('confidence', 0), reverse=True)[:10]
    
    vulnerabilities_for_notification = []
    for vuln in sorted_vulns:
        vulnerabilities_for_notification.append({
            'file': vuln.get('file', 'unknown'),
            'line': vuln.get('line', 1),
            'type': vuln.get('type', 'Unknown'),
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
        'summary': {
            'total': total,
            'safe': safe,
            'vulnerable': vulnerable,
            'errors': errors,
            'skipped': skipped,
            'critical': severity_counts['critical'],
            'high': severity_counts['high'],
            'medium': severity_counts['medium'],
            'low': severity_counts['low']
        },
        'is_safe': vulnerable == 0,
        'files_scanned': total,
        'vulnerabilities': vulnerabilities_for_notification,
        'results': results
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
