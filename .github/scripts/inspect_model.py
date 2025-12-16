#!/usr/bin/env python3
"""
Script para inspeccionar la estructura y API del modelo model_vulnerabilities.pkl
"""

import pickle
import json
import sys
from pathlib import Path

# Configurar paths
script_dir = Path(__file__).parent
project_root = script_dir.parent.parent
models_dir = project_root / 'ml-security' / 'models'

# Agregar rutas para imports
sys.path.insert(0, str(project_root / 'ml-security'))
sys.path.insert(0, str(project_root))

model_path = models_dir / 'model_vulnerabilities.pkl'

print("=" * 80)
print("🔍 INSPECTANDO MODELO: model_vulnerabilities.pkl")
print("=" * 80)

if not model_path.exists():
    print(f"❌ Error: Modelo no encontrado en {model_path}")
    sys.exit(1)

print(f"\n📁 Ruta: {model_path}")
print(f"📊 Tamaño: {model_path.stat().st_size / (1024**2):.2f} MB")

# Cargar modelo
print("\n📦 Cargando modelo...")
try:
    # Intentar con dill primero (mejor para modelos complejos con clases custom)
    try:
        import dill
        with open(model_path, 'rb') as f:
            model = dill.load(f)
        print("✅ Modelo cargado exitosamente (usando dill)")
    except:
        # Fallback a pickle normal
        with open(model_path, 'rb') as f:
            model = pickle.load(f)
        print("✅ Modelo cargado exitosamente (usando pickle)")
except Exception as e:
    print(f"❌ Error cargando modelo: {e}")
    print(f"   Tipo de error: {type(e).__name__}")
    print(f"   Intenta instalar las dependencias del modelo...")
    sys.exit(1)

# Inspeccionar estructura
print("\n" + "=" * 80)
print("📋 ESTRUCTURA DEL MODELO")
print("=" * 80)

print(f"\n🔹 Tipo: {type(model)}")
print(f"🔹 Clase: {model.__class__.__name__}")

# Atributos
print(f"\n📌 Atributos del objeto:")
attributes = dir(model)
public_attrs = [attr for attr in attributes if not attr.startswith('_')]
for attr in public_attrs[:20]:  # Primeros 20
    print(f"   - {attr}")
if len(public_attrs) > 20:
    print(f"   ... y {len(public_attrs) - 20} más")

# Métodos públicos
print(f"\n🔧 Métodos públicos:")
methods = [m for m in public_attrs if callable(getattr(model, m))]
for method in methods[:15]:
    print(f"   - {method}()")
if len(methods) > 15:
    print(f"   ... y {len(methods) - 15} más")

# Intentar llamar a métodos comunes
print("\n" + "=" * 80)
print("🧪 PROBANDO MÉTODOS COMUNES")
print("=" * 80)

test_code_python = 'query = "SELECT * FROM users WHERE id = \'" + uid + "\'"'
test_code_js = 'el.innerHTML = user;'

# Probar método analyze_code
if hasattr(model, 'analyze_code'):
    print("\n✅ Método 'analyze_code' encontrado")
    try:
        print("\n   Probando: analyze_code(python_code, 'python')")
        result = model.analyze_code(test_code_python, 'python')
        print(f"   ✓ Resultado: {type(result)}")
        print(f"   📄 Contenido:\n{json.dumps(result, indent=2, default=str)[:500]}...")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    try:
        print("\n   Probando: analyze_code(js_code, 'javascript')")
        result = model.analyze_code(test_code_js, 'javascript')
        print(f"   ✓ Resultado: {type(result)}")
        print(f"   📄 Contenido:\n{json.dumps(result, indent=2, default=str)[:500]}...")
    except Exception as e:
        print(f"   ❌ Error: {e}")
else:
    print("\n❌ Método 'analyze_code' NO encontrado")

# Probar método predict
if hasattr(model, 'predict'):
    print("\n✅ Método 'predict' encontrado")
    try:
        print("\n   Probando: predict(python_code)")
        result = model.predict(test_code_python)
        print(f"   ✓ Resultado: {result}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
else:
    print("\n❌ Método 'predict' NO encontrado")

# Probar método classify
if hasattr(model, 'classify'):
    print("\n✅ Método 'classify' encontrado")
    try:
        print("\n   Probando: classify(python_code)")
        result = model.classify(test_code_python)
        print(f"   ✓ Resultado: {result}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
else:
    print("\n❌ Método 'classify' NO encontrado")

# Probar método detect
if hasattr(model, 'detect'):
    print("\n✅ Método 'detect' encontrado")
    try:
        print("\n   Probando: detect(python_code)")
        result = model.detect(test_code_python)
        print(f"   ✓ Resultado: {result}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
else:
    print("\n❌ Método 'detect' NO encontrado")

# Probar llamada directa (si es callable)
if callable(model):
    print("\n✅ Modelo es callable (se puede llamar directamente)")
    try:
        print("\n   Probando: model(python_code)")
        result = model(test_code_python)
        print(f"   ✓ Resultado: {result}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
else:
    print("\n❌ Modelo NO es callable")

# Resumen
print("\n" + "=" * 80)
print("📊 RESUMEN")
print("=" * 80)
print("\n✅ Instrucciones para actualizar scan_vulnerabilities.py:")
print("\n1. Usar método: ??")
print("2. Parámetros: ??")
print("3. Resultado retornado: ??")
print("\nVerifica los resultados anteriores para actualizar el script.")
print("\n" + "=" * 80)
