#!/usr/bin/env python3
"""Check if vulnerabilities were detected and fail if any found"""
import json
import sys

try:
    with open('vulnerability_report.json') as f:
        report = json.load(f)
    
    vulnerabilities = report.get('vulnerabilities', [])
    
    if vulnerabilities:
        print(f'❌ {len(vulnerabilities)} vulnerabilidad(es) detectada(s)')
        for v in vulnerabilities[:3]:
            print(f'  - {v["file"]}:{v["line"]} - {v["type"]} ({v["confidence"]*100:.1f}%)')
        sys.exit(1)
    else:
        print('✅ Sin vulnerabilidades detectadas')
        sys.exit(0)
except FileNotFoundError:
    print('⚠️ No se encontró vulnerability_report.json')
    sys.exit(1)
except Exception as e:
    print(f'❌ Error: {e}')
    sys.exit(1)
