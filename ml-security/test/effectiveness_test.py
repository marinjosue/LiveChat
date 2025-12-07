#!/usr/bin/env python3
"""
effectiveness_test.py
Prueba de efectividad del modelo con 5 seguros y 5 vulnerables
"""

import sys
import os
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / 'backend'))

from client import VulnerabilityDetectorClient


class EffectivenessTest:
    """Test de efectividad con ejemplos claros"""
    
    def __init__(self):
        self.client = VulnerabilityDetectorClient("http://localhost:5000")
        self.passed = 0
        self.failed = 0
        self.results = []
    
    def test(self, numero, nombre, codigo, lenguaje, esperado_vulnerable):
        """Ejecuta una prueba individual"""
        try:
            resultado = self.client.analyze(codigo, lenguaje)
            
            es_vulnerable = resultado["vulnerable"] == 1
            tipo = resultado.get("tipo_vulnerabilidad")
            confianza_det = resultado.get("confianza_deteccion", 0)
            
            test_exitoso = es_vulnerable == esperado_vulnerable
            
            estado_esperado = "VULNERABLE" if esperado_vulnerable else "SEGURO"
            estado_actual = "VULNERABLE" if es_vulnerable else "SEGURO"
            
            status = "[✓]" if test_exitoso else "[✗]"
            
            print(f"\n{numero}. {status} {nombre}")
            print(f"   Lenguaje: {lenguaje}")
            print(f"   Esperado: {estado_esperado}")
            print(f"   Detectado: {estado_actual}")
            if tipo:
                print(f"   Tipo: {tipo}")
            print(f"   Confianza: {confianza_det:.2%}")
            
            if test_exitoso:
                self.passed += 1
                print("   ✓ CORRECTO")
            else:
                self.failed += 1
                print("   ✗ INCORRECTO")
            
            self.results.append({
                "numero": numero,
                "nombre": nombre,
                "lenguaje": lenguaje,
                "esperado": "vulnerable" if esperado_vulnerable else "seguro",
                "detectado": "vulnerable" if es_vulnerable else "seguro",
                "tipo": tipo,
                "confianza": float(confianza_det),
                "exitoso": test_exitoso
            })
            
        except Exception as e:
            print(f"\n{numero}. [!] {nombre}")
            print(f"   Error: {str(e)}")
            self.failed += 1
            self.results.append({
                "numero": numero,
                "nombre": nombre,
                "error": str(e),
                "exitoso": False
            })
    
    def run_all(self):
        """Ejecuta todos los tests"""
        print("\n" + "="*80)
        print("PRUEBA DE EFECTIVIDAD DEL MODELO")
        print("5 Códigos Seguros + 5 Códigos Vulnerables")
        print("="*80)
        
        # 5 CÓDIGOS SEGUROS
        print("\n" + "-"*80)
        print("CÓDIGOS SEGUROS (Esperado: Sin vulnerabilidades)")
        print("-"*80)
        
        self.test(
            1,
            "Python - Prepared Statement",
            """import sqlite3
db = sqlite3.connect('app.db')
cursor = db.cursor()
user_id = input("Enter ID: ")
cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
result = cursor.fetchone()
db.close()""",
            "python",
            False
        )
        
        self.test(
            2,
            "JavaScript - Parameterized Query",
            """const mysql = require('mysql');
const connection = mysql.createConnection(config);
const userId = req.query.id;
const query = 'SELECT * FROM users WHERE id = ?';
connection.query(query, [userId], (err, results) => {
    console.log(results);
});""",
            "javascript",
            False
        )
        
        self.test(
            3,
            "Java - PreparedStatement",
            """import java.sql.PreparedStatement;
String userId = request.getParameter("id");
String query = "SELECT * FROM users WHERE id = ?";
PreparedStatement pstmt = conn.prepareStatement(query);
pstmt.setString(1, userId);
ResultSet rs = pstmt.executeQuery();""",
            "java",
            False
        )
        
        self.test(
            4,
            "PHP - Parameterized Query",
            """<?php
$id = $_GET['id'];
$query = "SELECT * FROM users WHERE id = ?";
$stmt = $conn->prepare($query);
$stmt->bind_param("i", $id);
$stmt->execute();
$result = $stmt->get_result();
?>""",
            "php",
            False
        )
        
        self.test(
            5,
            "Ruby - ORM Safe Query",
            """user_id = params[:id]
user = User.where(id: user_id).first
if user
  render json: user
else
  render json: { error: 'Not found' }
end""",
            "ruby",
            False
        )
        
        # 5 CÓDIGOS VULNERABLES
        print("\n" + "-"*80)
        print("CÓDIGOS VULNERABLES (Esperado: Con vulnerabilidades)")
        print("-"*80)
        
        self.test(
            6,
            "Python - SQL Injection",
            """import sqlite3
db = sqlite3.connect('app.db')
cursor = db.cursor()
user_id = input("Enter ID: ")
query = f"SELECT * FROM users WHERE id = {user_id}"
cursor.execute(query)
result = cursor.fetchone()
db.close()""",
            "python",
            True
        )
        
        self.test(
            7,
            "JavaScript - Command Injection",
            """const express = require('express');
const app = express();
app.get('/api/file', (req, res) => {
    const filename = req.query.file;
    const cmd = `cat /var/data/${filename}`;
    require('child_process').exec(cmd, (err, data) => {
        res.send(data);
    });
});""",
            "javascript",
            True
        )
        
        self.test(
            8,
            "Java - Reflection Injection",
            """String className = request.getParameter("class");
Class<?> cls = Class.forName(className);
Object instance = cls.getDeclaredConstructor().newInstance();
Method method = cls.getMethod("execute");
method.invoke(instance);""",
            "java",
            True
        )
        
        self.test(
            9,
            "PHP - XSS Vulnerability",
            """<?php
$name = $_GET['name'];
$bio = $_GET['bio'];
echo "<h1>Profile: $name</h1>";
echo "<p>$bio</p>";
?>""",
            "php",
            True
        )
        
        self.test(
            10,
            "C++ - Buffer Overflow",
            """#include <cstring>
void processInput(const char* input) {
    char buffer[32];
    strcpy(buffer, input);
    printf("Input: %s\\n", buffer);
}
int main() {
    char userInput[256];
    fgets(userInput, sizeof(userInput), stdin);
    processInput(userInput);
}""",
            "c++",
            True
        )
        
        self.print_summary()
        self.save_results()
    
    def print_summary(self):
        """Imprime resumen"""
        total = self.passed + self.failed
        porcentaje = (self.passed / total * 100) if total > 0 else 0
        
        print("\n" + "="*80)
        print("RESUMEN DE RESULTADOS")
        print("="*80)
        
        print(f"\n[ESTADÍSTICAS]")
        print(f"  Total de tests: {total}")
        print(f"  Exitosos: {self.passed} ({porcentaje:.1f}%)")
        print(f"  Fallidos: {self.failed} ({100-porcentaje:.1f}%)")
        
        # Análisis por categoría
        seguros_detectados = sum(1 for r in self.results if not r.get("error") and r["esperado"] == "seguro" and r["detectado"] == "seguro")
        seguros_totales = sum(1 for r in self.results if r["esperado"] == "seguro")
        vulnerables_detectados = sum(1 for r in self.results if not r.get("error") and r["esperado"] == "vulnerable" and r["detectado"] == "vulnerable")
        vulnerables_totales = sum(1 for r in self.results if r["esperado"] == "vulnerable")
        
        print(f"\n[ANÁLISIS DETALLADO]")
        print(f"  Códigos Seguros detectados correctamente: {seguros_detectados}/{seguros_totales}")
        if seguros_totales > 0:
            print(f"    → Precisión: {seguros_detectados/seguros_totales*100:.1f}%")
        print(f"  Códigos Vulnerables detectados correctamente: {vulnerables_detectados}/{vulnerables_totales}")
        if vulnerables_totales > 0:
            print(f"    → Precisión: {vulnerables_detectados/vulnerables_totales*100:.1f}%")
        
        print(f"\n[RESULTADO FINAL]")
        if porcentaje == 100:
            print(f"  ✓ TODOS LOS TESTS EXITOSOS - Efectividad del modelo: EXCELENTE")
        elif porcentaje >= 80:
            print(f"  ⚠ Efectividad del modelo: BUENA ({porcentaje:.1f}%)")
        elif porcentaje >= 60:
            print(f"  ⚠ Efectividad del modelo: ACEPTABLE ({porcentaje:.1f}%)")
        else:
            print(f"  ✗ Efectividad del modelo: BAJA ({porcentaje:.1f}%)")
        
        print(f"\n[INFO] Resultados guardados en: effectiveness_results.json\n")
    
    def save_results(self):
        """Guarda resultados en JSON"""
        output_file = Path(__file__).parent / "effectiveness_results.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(self.results, f, indent=2, ensure_ascii=False)


if __name__ == "__main__":
    test = EffectivenessTest()
    test.run_all()
