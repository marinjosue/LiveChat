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
        models_dir = Path("models")
        
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
        
        # Analizar cada snippet con el modelo
        for line_num, code_snippet in snippets:
            try:
                # Saltar si no hay modelo
                if not self.detector_model or not self.vectorizer_detector:
                    print(f"  ⚠️ Saltando análisis de {file_path}:{line_num} (sin modelo)")
                    continue
                
                # Vectorizar código
                features = self.vectorizer_detector.transform([code_snippet])
                
                # Codificar lenguaje
                if self.language_encoder and language in self.language_encoder.classes_:
                    lang_encoded = self.language_encoder.transform([language])[0]
                else:
                    lang_encoded = 0  # Default si lenguaje no reconocido
                
                # Combinar features
                features_array = np.column_stack([
                    features.toarray(),
                    np.array([[lang_encoded]])
                ])
                
                # Predicción Modelo 1
                is_vulnerable = self.detector_model.predict(features_array)[0]
                confidence = self.detector_model.predict_proba(features_array)[0]
                vuln_confidence = confidence[is_vulnerable] if is_vulnerable == 1 else 1 - confidence[1]
                
                if is_vulnerable == 1 and vuln_confidence > 0.5:
                    # Detectar tipo de vulnerabilidad por patrones regex
                    cwe_type = self._detect_vulnerability_type(code_snippet, language)
                    cwe_confidence = vuln_confidence  # Usar confianza del detector
                    
                    vulnerability = {
                        'file': file_path,
                        'line': line_num,
                        'code': code_snippet[:100],
                        'type': cwe_type,
                        'confidence': float(cwe_confidence),
                        'detector_confidence': float(vuln_confidence),
                        'language': language
                    }
                    
                    vulnerabilities.append(vulnerability)
                    print(f"  ⚠️ Vulnerabilidad detectada en línea {line_num}")
                    print(f"     Tipo: {cwe_type} ({cwe_confidence*100:.1f}%)")
                    print(f"     Código: {code_snippet[:60]}...")
            
            except Exception as e:
                print(f"  ❌ Error analizando línea {line_num}: {e}")
                continue
        
        return vulnerabilities
    
    def scan_repository(self, patterns: List[str] = None) -> Dict:
        """Escanear repositorio completo"""
        if patterns is None:
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
        
        print("📂 Iniciando escaneo de repositorio...")
        all_vulnerabilities = []
        
        # Archivos a ignorar
        ignore_dirs = {'.git', '.github', '__pycache__', 'node_modules', '.venv', 'venv', 'models', 'colab', 'Versiones'}
        
        root = Path('.')
        files_scanned = 0
        
        for pattern in patterns:
            for file_path in root.glob(pattern):
                # Ignorar directorios específicos
                if any(ignore_dir in file_path.parts for ignore_dir in ignore_dirs):
                    continue
                
                if file_path.is_file():
                    files_scanned += 1
                    vulns = self.scan_file(str(file_path))
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
