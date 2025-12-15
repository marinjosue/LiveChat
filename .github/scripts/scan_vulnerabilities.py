#!/usr/bin/env python3
"""
Vulnerability Detection Scanner - GitHub Actions Integration
Escanea archivos de código en busca de vulnerabilidades usando modelos ML
Versión: 2.0 - Detección y clasificación mejorada
"""

import os
import json
import pickle
import numpy as np
import pandas as pd
from pathlib import Path
from typing import List, Dict, Tuple
import re
import subprocess

# Importar modelos ML
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import LabelEncoder
from sklearn.ensemble import RandomForestClassifier

class VulnerabilityScanner:
    """Scanner de vulnerabilidades usando modelos ML entrenados"""
    
    def __init__(self):
        self.detector_model = None
        self.cwe_model = None
        self.vectorizer_detector = None
        self.vectorizer_cwe = None
        self.language_encoder = None
        self.cwe_encoder = None
        self.vulnerabilities = []
        
        print("🚀 Inicializando VulnerabilityScanner...")
        self._load_models()
    
    def _load_models(self):
        """Cargar modelos entrenados desde models/"""
        # Buscar en múltiples ubicaciones
        possible_paths = [
            Path("models"),
            Path("ml-security/models"),
            Path(".github/models")
        ]
        
        models_dir = None
        for path in possible_paths:
            if path.exists():
                models_dir = path
                print(f"📂 Encontrada carpeta de modelos: {path}")
                break
        
        if not models_dir:
            print("❌ No se encontró carpeta de modelos")
            return
        
        try:
            # Cargar Modelo 1: Detector
            if (models_dir / "vulnerability_detector.pkl").exists():
                with open(models_dir / "vulnerability_detector.pkl", "rb") as f:
                    self.detector_model = pickle.load(f)
                print("✅ Modelo Detector cargado")
            else:
                print("⚠️ Modelo Detector no encontrado")
            
            # Cargar vectorizador Detector
            if (models_dir / "vectorizer_detector.pkl").exists():
                with open(models_dir / "vectorizer_detector.pkl", "rb") as f:
                    self.vectorizer_detector = pickle.load(f)
                print("✅ Vectorizador Detector cargado")
            
            # Cargar Modelo 2: CWE Classifier
            if (models_dir / "cwe_classifier.pkl").exists():
                with open(models_dir / "cwe_classifier.pkl", "rb") as f:
                    self.cwe_model = pickle.load(f)
                print("✅ Modelo CWE Classifier cargado")
            else:
                print("⚠️ Modelo CWE Classifier no encontrado")
            
            # Cargar vectorizador CWE
            if (models_dir / "vectorizer_cwe_classifier.pkl").exists():
                with open(models_dir / "vectorizer_cwe_classifier.pkl", "rb") as f:
                    self.vectorizer_cwe = pickle.load(f)
                print("✅ Vectorizador CWE cargado")
            
            # Cargar encoders
            if (models_dir / "language_encoder.pkl").exists():
                with open(models_dir / "language_encoder.pkl", "rb") as f:
                    self.language_encoder = pickle.load(f)
                print("✅ Language Encoder cargado")
            
            if (models_dir / "cwe_encoder.pkl").exists():
                with open(models_dir / "cwe_encoder.pkl", "rb") as f:
                    self.cwe_encoder = pickle.load(f)
                print("✅ CWE Encoder cargado")
        
        except Exception as e:
            print(f"❌ Error cargando modelos: {e}")
            print("⚠️ Continuando sin modelos (modo offline)")
    
    def _get_changed_files(self) -> List[str]:
        """Obtener lista de archivos modificados usando git diff"""
        try:
            # Obtener la rama base (main o master)
            base_branch = "origin/test"
            current_branch = "HEAD"
            
            # Ejecutar git diff para obtener archivos modificados
            result = subprocess.run(
                ["git", "diff", "--name-only", f"{base_branch}...{current_branch}"],
                capture_output=True,
                text=True
            )
            
            if result.returncode == 0:
                files = result.stdout.strip().split('\n')
                files = [f for f in files if f]  # Remover vacíos
                print(f"📝 Archivos modificados: {files}")
                return files
            else:
                print(f"⚠️ Error en git diff: {result.stderr}")
                # Fallback: escanear todo si git diff falla
                return self._get_all_source_files()
        
        except Exception as e:
            print(f"⚠️ Error obteniendo archivos modificados: {e}")
            return self._get_all_source_files()
    
    def _get_all_source_files(self) -> List[str]:
        """Fallback: obtener todos los archivos de código"""
        patterns = [
            '**/*.py',
            '**/*.js',
            '**/*.java',
            '**/*.cpp',
            '**/*.cs',
            '**/*.php',
            '**/*.rb',
            '**/*.swift',
            '**/*.go',
            '**/*.kt',
            '**/*.f90',
        ]
        
        all_files = []
        root = Path('.')
        
        for pattern in patterns:
            for file_path in root.glob(pattern):
                all_files.append(str(file_path))
        
        return all_files

    
    def _detect_vulnerability_type(self, code_snippet: str, language: str) -> str:
        """Detectar tipo de vulnerabilidad por patrones"""
        code_lower = code_snippet.lower()
        
        # SQL Injection patterns
        if any(pat in code_lower for pat in ['select', 'insert', 'update', 'delete', 'where', 'from']):
            if any(pat in code_lower for pat in ['+', '{}', '\"', '\'', 'f\"', 'f\'']):
                return "SQL Injection"
        
        # Command Injection
        if any(pat in code_lower for pat in ['exec', 'system', 'subprocess', 'child_process', 'popen', 'shell=true']):
            return "Command Injection"
        
        # Code Injection / Code Execution
        if any(pat in code_lower for pat in ['eval(', 'exec(', 'compile(', 'new function']):
            return "Code Injection"
        
        # Buffer Overflow
        if any(pat in code_lower for pat in ['strcpy', 'strcat', 'sprintf', 'gets(', 'scanf']):
            return "Buffer Overflow"
        
        # XSS / DOM-based vulnerabilities
        if any(pat in code_lower for pat in ['innerhtml', 'textcontent', 'outerhtml', '<script', 'document.write']):
            return "Cross-Site Scripting (XSS)"
        
        # Path Traversal
        if any(pat in code_lower for pat in ['../', '..\\', '../.']):
            if 'user' in code_lower or 'input' in code_lower or 'file' in code_lower:
                return "Path Traversal"
        
        # Default
        return "Security Vulnerability"
    
    def _detect_language(self, file_path: str) -> str:
        """Detectar lenguaje programación por extensión"""
        ext_to_lang = {
            '.py': 'python',
            '.js': 'javascript',
            '.java': 'java',
            '.cpp': 'c++',
            '.cc': 'c++',
            '.cxx': 'c++',
            '.cs': 'c#',
            '.php': 'php',
            '.rb': 'ruby',
            '.swift': 'swift',
            '.go': 'go',
            '.kt': 'kotlin',
            '.f90': 'fortran',
        }
        
        ext = Path(file_path).suffix.lower()
        return ext_to_lang.get(ext, 'unknown')
    
    def _extract_code_snippets(self, file_path: str, content: str) -> List[Tuple[int, str]]:
        """Extraer snippets de código (líneas no-comentario/no-string)"""
        snippets = []
        lines = content.split('\n')
        
        # Patrón para detectar líneas sospechosas
        dangerous_patterns = [
            r'eval\s*\(',
            r'exec\s*\(',
            r'os\.system\s*\(',
            r'subprocess\s*\(',
            r'strcpy\s*\(',
            r'sprintf\s*\(',
            r'gets\s*\(',
            r'SELECT.*FROM.*WHERE',
            r'INSERT.*INTO.*VALUES',
            r'UPDATE.*SET.*WHERE',
            r'DELETE.*FROM.*WHERE',
            r'<script',
            r'document\.write',
            r'innerHTML\s*=',
            r'new Function',
            r'setTimeout.*eval',
            r'setInterval.*eval',
        ]
        
        for line_num, line in enumerate(lines, 1):
            # Saltar comentarios y vacías
            stripped = line.strip()
            if not stripped or stripped.startswith('#') or stripped.startswith('//'):
                continue
            
            # Buscar patrones peligrosos
            for pattern in dangerous_patterns:
                if re.search(pattern, line, re.IGNORECASE):
                    snippets.append((line_num, line.strip()))
                    break
        
        return snippets
    
    def scan_file(self, file_path: str) -> List[Dict]:
        """Escanear archivo individual en busca de vulnerabilidades"""
        vulnerabilities = []
        
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
        except Exception as e:
            print(f"⚠️ No se puede leer {file_path}: {e}")
            return vulnerabilities
        
        language = self._detect_language(file_path)
        
        # Extraer snippets sospechosos
        snippets = self._extract_code_snippets(file_path, content)
        
        if not snippets:
            return vulnerabilities
        
        print(f"🔍 Analizando {file_path} ({language}) - {len(snippets)} líneas sospechosas")
        
        # Analizar cada snippet
        for line_num, code_snippet in snippets:
            try:
                # Detectar tipo de vulnerabilidad por patrones
                vuln_type = self._detect_vulnerability_type(code_snippet, language)
                
                # Asignar confianza basada en patrones detectados
                confidence = self._calculate_confidence(code_snippet, vuln_type)
                
                if confidence > 0.5:  # Solo reportar si confianza > 50%
                    vulnerability = {
                        'file': file_path,
                        'line': line_num,
                        'code': code_snippet[:100],
                        'type': vuln_type,
                        'confidence': float(confidence),
                        'detector_confidence': float(confidence),
                        'language': language
                    }
                    
                    vulnerabilities.append(vulnerability)
                    print(f"  ⚠️ Vulnerabilidad detectada en línea {line_num}")
                    print(f"     Tipo: {vuln_type} ({confidence*100:.1f}%)")
                    print(f"     Código: {code_snippet[:60]}...")
            
            except Exception as e:
                print(f"  ❌ Error analizando línea {line_num}: {e}")
                continue
        
        return vulnerabilities
    
    def _calculate_confidence(self, code_snippet: str, vuln_type: str) -> float:
        """Calcular confianza basada en patrones detectados"""
        code_lower = code_snippet.lower()
        confidence = 0.6  # Base 60%
        
        # Aumentar confianza según patrones específicos
        if vuln_type == "SQL Injection":
            if any(pat in code_lower for pat in ['+', 'concat', 'interpolate']):
                confidence = 0.85
            if any(pat in code_lower for pat in ['where', 'from', 'select']):
                confidence = 0.90
        
        elif vuln_type == "Code Injection":
            if 'eval(' in code_lower:
                confidence = 0.95
            if 'exec(' in code_lower:
                confidence = 0.95
        
        elif vuln_type == "Cross-Site Scripting (XSS)":
            if 'innerhtml' in code_lower:
                confidence = 0.90
            if '<script' in code_lower:
                confidence = 0.95
        
        elif vuln_type == "Path Traversal":
            if '../' in code_snippet or '..\\' in code_snippet:
                confidence = 0.85
        
        elif vuln_type == "Command Injection":
            if 'system' in code_lower or 'exec' in code_lower:
                confidence = 0.85
        
        return min(confidence, 0.99)  # Máximo 99%
    
    def scan_repository(self, patterns: List[str] = None) -> Dict:
        """Escanear solo archivos modificados en el PR (git diff)"""
        print("📂 Obteniendo archivos modificados...")
        
        # Obtener archivos modificados
        changed_files = self._get_changed_files()
        
        if not changed_files:
            print("⚠️ No hay archivos modificados")
            return {
                'timestamp': pd.Timestamp.now().isoformat(),
                'files_scanned': 0,
                'vulnerabilities': [],
                'summary': {
                    'total': 0,
                    'critical': 0,
                    'high': 0,
                    'medium': 0,
                }
            }
        
        print(f"📂 Escaneo de {len(changed_files)} archivo(s) modificado(s)...")
        all_vulnerabilities = []
        files_scanned = 0
        
        # Ignorar directorios
        ignore_dirs = {'.git', '.github', '__pycache__', 'node_modules', '.venv', 'venv', 'models', 'colab', 'Versiones'}
        
        for file_path in changed_files:
            # Ignorar directorios específicos
            if any(ignore_dir in file_path for ignore_dir in ignore_dirs):
                continue
            
            if os.path.isfile(file_path):
                files_scanned += 1
                vulns = self.scan_file(file_path)
                all_vulnerabilities.extend(vulns)
        
        print(f"\n✅ Escaneo completado")
        print(f"📊 Archivos analizados: {files_scanned}")
        print(f"⚠️ Vulnerabilidades encontradas: {len(all_vulnerabilities)}")
        
        return {
            'timestamp': pd.Timestamp.now().isoformat(),
            'files_scanned': files_scanned,
            'vulnerabilities': all_vulnerabilities,
            'summary': {
                'total': len(all_vulnerabilities),
                'critical': len([v for v in all_vulnerabilities if v['confidence'] > 0.85]),
                'high': len([v for v in all_vulnerabilities if 0.70 < v['confidence'] <= 0.85]),
                'medium': len([v for v in all_vulnerabilities if 0.50 < v['confidence'] <= 0.70]),
            }
        }
    
    def save_report(self, report: Dict, output_file: str = 'vulnerability_report.json'):
        """Guardar reporte en JSON"""
        with open(output_file, 'w') as f:
            json.dump(report, f, indent=2)
        print(f"💾 Reporte guardado en {output_file}")
    
    def print_summary(self, report: Dict):
        """Imprimir resumen del reporte"""
        print("\n" + "="*80)
        print("VULNERABILITY SCAN REPORT")
        print("="*80)
        print(f"Timestamp: {report['timestamp']}")
        print(f"Archivos analizados: {report['files_scanned']}")
        print(f"\nResumen:")
        print(f"  - Críticas (>85%): {report['summary']['critical']}")
        print(f"  - Altas (70-85%): {report['summary']['high']}")
        print(f"  - Medias (50-70%): {report['summary']['medium']}")
        print(f"  - Total: {report['summary']['total']}")
        
        if report['vulnerabilities']:
            print(f"\nVulnerabilidades detectadas:")
            for idx, vuln in enumerate(report['vulnerabilities'], 1):
                print(f"\n{idx}. {vuln['file']}:{vuln['line']}")
                print(f"   Tipo: {vuln['type']} ({vuln['confidence']*100:.1f}%)")
                print(f"   Código: {vuln['code']}")
        else:
            print("\n✅ No se detectaron vulnerabilidades")
        print("="*80 + "\n")


def main():
    """Función principal"""
    print("\n" + "="*80)
    print("VULNERABILITY DETECTION - GitHub Actions Pipeline")
    print("="*80 + "\n")
    
    # Crear scanner
    scanner = VulnerabilityScanner()
    
    # Escanear repositorio
    report = scanner.scan_repository()
    
    # Guardar reporte
    scanner.save_report(report)
    
    # Imprimir resumen
    scanner.print_summary(report)
    
    # Exit con código apropiado
    if report['summary']['total'] > 0:
        print("❌ Vulnerabilidades detectadas")
        exit(1)
    else:
        print("✅ Escaneo completado exitosamente")
        exit(0)


if __name__ == "__main__":
    main()
