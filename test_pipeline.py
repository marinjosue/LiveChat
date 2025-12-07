#!/usr/bin/env python3
"""
Script de prueba local del pipeline de seguridad
Verifica que todos los componentes estén configurados correctamente
"""

import sys
import os
from pathlib import Path
import json

# Colores para terminal
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

def print_success(msg):
    print(f"{GREEN}✅ {msg}{RESET}")

def print_error(msg):
    print(f"{RED}❌ {msg}{RESET}")

def print_warning(msg):
    print(f"{YELLOW}⚠️  {msg}{RESET}")

def print_info(msg):
    print(f"{BLUE}ℹ️  {msg}{RESET}")

def check_models():
    """Verificar que existan los modelos ML"""
    print("\n" + "="*60)
    print("🤖 VERIFICANDO MODELOS ML")
    print("="*60)
    
    models_dir = Path('ml-security/models')
    
    if not models_dir.exists():
        print_error(f"Directorio de modelos no encontrado: {models_dir}")
        return False
    
    required_models = [
        'vulnerability_detector.pkl',
        'cwe_classifier.pkl',
        'vectorizer_detector.pkl',
        'vectorizer_cwe_classifier.pkl',
        'language_encoder.pkl',
        'cwe_encoder.pkl'
    ]
    
    all_exist = True
    for model in required_models:
        model_path = models_dir / model
        if model_path.exists():
            size = model_path.stat().st_size / (1024 * 1024)  # MB
            print_success(f"{model} ({size:.1f} MB)")
        else:
            print_error(f"{model} - NO ENCONTRADO")
            all_exist = False
    
    return all_exist

def check_workflow():
    """Verificar que exista el workflow"""
    print("\n" + "="*60)
    print("📋 VERIFICANDO WORKFLOW")
    print("="*60)
    
    workflow_file = Path('.github/workflows/security-pipeline.yml')
    
    if workflow_file.exists():
        print_success(f"Workflow encontrado: {workflow_file}")
        
        # Contar líneas
        lines = len(workflow_file.read_text().splitlines())
        print_info(f"Líneas de código: {lines}")
        
        return True
    else:
        print_error(f"Workflow no encontrado: {workflow_file}")
        return False

def check_scripts():
    """Verificar que existan los scripts"""
    print("\n" + "="*60)
    print("📜 VERIFICANDO SCRIPTS")
    print("="*60)
    
    scripts_dir = Path('.github/scripts')
    
    if not scripts_dir.exists():
        print_error(f"Directorio de scripts no encontrado: {scripts_dir}")
        return False
    
    required_scripts = [
        'scan_vulnerabilities.py',
        'telegram_notify.py'
    ]
    
    all_exist = True
    for script in required_scripts:
        script_path = scripts_dir / script
        if script_path.exists():
            lines = len(script_path.read_text().splitlines())
            print_success(f"{script} ({lines} líneas)")
        else:
            print_error(f"{script} - NO ENCONTRADO")
            all_exist = False
    
    return all_exist

def check_dependencies():
    """Verificar que estén las dependencias"""
    print("\n" + "="*60)
    print("📦 VERIFICANDO DEPENDENCIAS")
    print("="*60)
    
    requirements_file = Path('ml-security/backend/requirements.txt')
    
    if not requirements_file.exists():
        print_error("requirements.txt no encontrado")
        return False
    
    print_success(f"requirements.txt encontrado")
    
    # Verificar dependencias instaladas
    try:
        import pickle
        print_success("pickle (stdlib)")
        
        import numpy
        print_success(f"numpy {numpy.__version__}")
        
        import sklearn
        print_success(f"scikit-learn {sklearn.__version__}")
        
        import flask
        print_success(f"flask {flask.__version__}")
        
        return True
        
    except ImportError as e:
        print_error(f"Dependencia no instalada: {e}")
        print_info("Ejecuta: cd ml-security/backend && pip install -r requirements.txt")
        return False

def check_git_branches():
    """Verificar que existan las ramas necesarias"""
    print("\n" + "="*60)
    print("🌳 VERIFICANDO RAMAS GIT")
    print("="*60)
    
    try:
        import subprocess
        
        # Obtener ramas
        result = subprocess.run(
            ['git', 'branch', '-a'],
            capture_output=True,
            text=True,
            check=True
        )
        
        branches = result.stdout
        
        required_branches = ['dev', 'test', 'main']
        all_exist = True
        
        for branch in required_branches:
            if branch in branches:
                print_success(f"Rama '{branch}' existe")
            else:
                print_warning(f"Rama '{branch}' no encontrada")
                all_exist = False
        
        # Rama actual
        result = subprocess.run(
            ['git', 'branch', '--show-current'],
            capture_output=True,
            text=True,
            check=True
        )
        current = result.stdout.strip()
        print_info(f"Rama actual: {current}")
        
        return True
        
    except Exception as e:
        print_error(f"Error verificando ramas: {e}")
        return False

def test_model_loading():
    """Probar que se puedan cargar los modelos"""
    print("\n" + "="*60)
    print("🧪 PROBANDO CARGA DE MODELOS")
    print("="*60)
    
    try:
        import pickle
        
        models_dir = Path('ml-security/models')
        
        # Cargar Modelo 1
        print_info("Cargando Modelo 1 (Detector)...")
        with open(models_dir / 'vulnerability_detector.pkl', 'rb') as f:
            detector = pickle.load(f)
        print_success("Modelo 1 cargado correctamente")
        
        # Cargar Modelo 2
        print_info("Cargando Modelo 2 (Clasificador CWE)...")
        with open(models_dir / 'cwe_classifier.pkl', 'rb') as f:
            classifier = pickle.load(f)
        print_success("Modelo 2 cargado correctamente")
        
        # Cargar vectorizers
        print_info("Cargando vectorizers...")
        with open(models_dir / 'vectorizer_detector.pkl', 'rb') as f:
            vec1 = pickle.load(f)
        with open(models_dir / 'vectorizer_cwe_classifier.pkl', 'rb') as f:
            vec2 = pickle.load(f)
        print_success("Vectorizers cargados correctamente")
        
        return True
        
    except Exception as e:
        print_error(f"Error cargando modelos: {e}")
        return False

def test_vulnerability_detection():
    """Probar detección de vulnerabilidades con código de ejemplo"""
    print("\n" + "="*60)
    print("🔍 PROBANDO DETECCIÓN DE VULNERABILIDADES")
    print("="*60)
    
    try:
        import pickle
        
        models_dir = Path('ml-security/models')
        
        # Cargar modelos
        with open(models_dir / 'vulnerability_detector.pkl', 'rb') as f:
            detector = pickle.load(f)
        with open(models_dir / 'vectorizer_detector.pkl', 'rb') as f:
            vectorizer = pickle.load(f)
        with open(models_dir / 'cwe_classifier.pkl', 'rb') as f:
            cwe_classifier = pickle.load(f)
        with open(models_dir / 'vectorizer_cwe_classifier.pkl', 'rb') as f:
            vectorizer_cwe = pickle.load(f)
        with open(models_dir / 'cwe_encoder.pkl', 'rb') as f:
            cwe_encoder = pickle.load(f)
        
        # Código de prueba vulnerable (SQL Injection)
        vulnerable_code = """
        function login(username, password) {
            const query = "SELECT * FROM users WHERE username = '" + username + "' AND password = '" + password + "'";
            return db.execute(query);
        }
        """
        
        print_info("Analizando código vulnerable (SQL Injection)...")
        
        # Detección
        features = vectorizer.transform([vulnerable_code])
        is_vulnerable = detector.predict(features)[0]
        confidence = detector.predict_proba(features)[0]
        
        if is_vulnerable:
            print_success(f"Vulnerabilidad detectada (confianza: {confidence[1]:.1%})")
            
            # Clasificación CWE
            features_cwe = vectorizer_cwe.transform([vulnerable_code])
            cwe_type_idx = cwe_classifier.predict(features_cwe)[0]
            cwe_type = cwe_encoder.inverse_transform([cwe_type_idx])[0]
            
            print_success(f"Tipo CWE identificado: {cwe_type}")
        else:
            print_warning("No se detectó vulnerabilidad (puede ser falso negativo)")
        
        # Código seguro
        safe_code = """
        function login(username, password) {
            const query = "SELECT * FROM users WHERE username = ? AND password = ?";
            return db.execute(query, [username, password]);
        }
        """
        
        print_info("\nAnalizando código seguro (Prepared Statements)...")
        
        features = vectorizer.transform([safe_code])
        is_vulnerable = detector.predict(features)[0]
        confidence = detector.predict_proba(features)[0]
        
        if not is_vulnerable:
            print_success(f"Código seguro detectado (confianza: {confidence[0]:.1%})")
        else:
            print_warning("Detectado como vulnerable (posible falso positivo)")
        
        return True
        
    except Exception as e:
        print_error(f"Error en prueba de detección: {e}")
        return False

def generate_summary():
    """Generar resumen final"""
    print("\n" + "="*60)
    print("📊 RESUMEN")
    print("="*60)
    
    checks = {
        "Modelos ML": check_models(),
        "Workflow GitHub Actions": check_workflow(),
        "Scripts de automatización": check_scripts(),
        "Dependencias Python": check_dependencies(),
        "Ramas Git": check_git_branches(),
        "Carga de modelos": test_model_loading(),
        "Detección de vulnerabilidades": test_vulnerability_detection()
    }
    
    passed = sum(checks.values())
    total = len(checks)
    
    print(f"\n✅ Verificaciones pasadas: {passed}/{total}")
    
    if passed == total:
        print_success("\n🎉 ¡TODOS LOS COMPONENTES ESTÁN LISTOS!")
        print_info("\nPróximos pasos:")
        print("1. Configurar secrets en GitHub (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID)")
        print("2. Proteger ramas (test y main)")
        print("3. Crear un PR de dev → test para probar el pipeline")
        print("\nVer documentación completa en: PIPELINE_SETUP.md")
        return True
    else:
        print_warning("\n⚠️  ALGUNOS COMPONENTES NECESITAN CONFIGURACIÓN")
        print("\nVerificar:")
        for check, passed in checks.items():
            if not passed:
                print(f"  - {check}")
        return False

def main():
    """Función principal"""
    print(f"\n{BLUE}{'='*60}")
    print("🔐 VERIFICACIÓN DEL PIPELINE DE SEGURIDAD ML")
    print(f"{'='*60}{RESET}\n")
    
    # Verificar que estemos en el directorio correcto
    if not Path('ml-security').exists():
        print_error("Este script debe ejecutarse desde el directorio raíz del proyecto")
        print_info("Directorio actual: " + str(Path.cwd()))
        sys.exit(1)
    
    # Ejecutar verificaciones
    success = generate_summary()
    
    sys.exit(0 if success else 1)

if __name__ == '__main__':
    main()
