#!/usr/bin/env python3
"""
test_api.py
Tests reales para detección de vulnerabilidades
"""

import sys
import os
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / 'backend'))

from client import VulnerabilityDetectorClient


class VulnerabilityTests:
    """Tests reales de detección"""
    
    def __init__(self):
        self.client = VulnerabilityDetectorClient("http://localhost:5000")
        self.passed = 0
        self.failed = 0
        self.results = []
    
    def test(self, nombre, codigo, lenguaje, debe_ser_vulnerable):
        """Ejecuta una prueba individual"""
        try:
            resultado = self.client.analyze(codigo, lenguaje)
            
            es_vulnerable = resultado["vulnerable"] == 1
            tipo = resultado.get("tipo_vulnerabilidad")
            
            test_exitoso = es_vulnerable == debe_ser_vulnerable
            
            status = "[+]" if test_exitoso else "[!]"
            print(f"{status} {nombre}")
            print(f"    Lenguaje: {lenguaje}")
            print(f"    Estado: {'VULNERABLE' if es_vulnerable else 'SEGURO'}")
            
            if tipo:
                print(f"    Tipo: {tipo}")
            
            if test_exitoso:
                self.passed += 1
            else:
                self.failed += 1
            
            self.results.append({
                "nombre": nombre,
                "lenguaje": lenguaje,
                "exitoso": test_exitoso,
                "tipo": tipo,
                "vulnerable": es_vulnerable
            })
            
        except Exception as e:
            print(f"[ERROR] {nombre}: {str(e)}")
            self.failed += 1
    
    def run_all(self):
        """Ejecuta todos los tests"""
        print("\n" + "="*80)
        print("TESTS DE DETECCION DE VULNERABILIDADES")
        print("="*80 + "\n")
        
        tests = [
            ("SQL Injection", [
                ("Concatenacion de SQL", "query = 'SELECT * FROM users WHERE id = ' + user_id", "python", True),
                ("Format string SQL", "f'SELECT * FROM table WHERE name = {input}'", "python", True),
            ]),
            ("XSS", [
                ("Response sin escape", "response.write(user_input)", "python", True),
                ("HTML sin escapar", "<%= unescaped_data %>", "javascript", True),
            ]),
            ("Command Injection", [
                ("OS system", "os.system('ls ' + folder)", "python", True),
                ("Subprocess shell", "subprocess.call(cmd, shell=True)", "python", True),
            ]),
            ("Path Traversal", [
                ("File read con entrada", "open(directory + filename)", "python", True),
                ("Directory access", "fs.readFile('../' + file)", "javascript", True),
            ]),
            ("Buffer Overflow", [
                ("strcpy fixed", "strcpy(buffer, input)", "c++", True),
                ("Array bounds", "for (int i = 0; i <= 10; i++) array[i]", "c++", True),
            ]),
            ("Weak Cryptography", [
                ("MD5 hash", "hashlib.md5(password.encode())", "python", True),
                ("DES encryption", "DES.new(key, DES.MODE_ECB)", "python", True),
            ]),
            ("Code Injection", [
                ("eval input", "eval(user_code)", "python", True),
                ("exec code", "exec(user_script)", "python", True),
            ]),
            ("Deserialization", [
                ("Pickle load", "pickle.loads(data)", "python", True),
                ("YAML load", "yaml.load(input)", "python", True),
            ]),
            ("Hardcoded Secrets", [
                ("Password literal", "password = 'admin123'", "python", True),
                ("API key literal", "api_key = 'sk-12345'", "python", True),
            ]),
        ]
        
        for categoria, test_list in tests:
            print(f"[*] {categoria}:")
            for nombre, codigo, lenguaje, esperado in test_list:
                self.test(nombre, codigo, lenguaje, esperado)
            print()
        
        self.print_summary()
    
    def print_summary(self):
        """Imprime resumen"""
        total = self.passed + self.failed
        
        print("\n" + "="*80)
        print("RESUMEN DE RESULTADOS")
        print("="*80)
        
        print(f"\n[ESTADISTICAS]")
        print(f"  Total de tests: {total}")
        print(f"  Exitosos: {self.passed} ({self.passed/total*100:.1f}%)")
        print(f"  Fallidos: {self.failed} ({self.failed/total*100:.1f}%)")
        
        # Desglose por tipo
        tipos = {}
        vulnerables_correctas = 0
        seguras_correctas = 0
        
        for r in self.results:
            if r["exitoso"]:
                if r["vulnerable"]:
                    vulnerables_correctas += 1
                else:
                    seguras_correctas += 1
            
            tipo = r["tipo"]
            if tipo:
                tipos[tipo] = tipos.get(tipo, 0) + 1
        
        print(f"\n[DETECCIONES]")
        print(f"  Vulnerabilidades detectadas correctamente: {vulnerables_correctas}")
        print(f"  Codigo seguro identificado correctamente: {seguras_correctas}")
        
        if tipos:
            print(f"\n[TIPOS DE VULNERABILIDAD DETECTADOS]")
            for tipo, count in sorted(tipos.items(), key=lambda x: x[1], reverse=True):
                print(f"  • {tipo}: {count} detecciones")
        
        print(f"\n[RESULTADO FINAL]")
        if self.failed == 0:
            print(f"  [SUCCESS] TODOS LOS TESTS EXITOSOS")
        else:
            print(f"  [WARNING] {self.failed} tests fallieron")
        
        print()
        with open("test_results.json", "w") as f:
            json.dump(self.results, f, indent=2)
        
        print(f"[INFO] Resultados guardados en: test_results.json\n")


if __name__ == "__main__":
    tester = VulnerabilityTests()
    tester.run_all()
