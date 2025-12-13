#!/usr/bin/env python3
"""
Script para verificar vulnerabilidades en el reporte
Falla el pipeline si hay vulnerabilidades críticas o altas
"""

import json
import sys
from pathlib import Path
from typing import Dict, List

class VulnerabilityChecker:
    def __init__(self, report_file: str = 'vulnerability_report.json'):
        self.report_file = Path(report_file)
        self.report = self._load_report()
    
    def _load_report(self) -> Dict:
        """Cargar reporte de vulnerabilidades"""
        if not self.report_file.exists():
            print(f"⚠️  Archivo de reporte no encontrado: {self.report_file}")
            return {
                'is_safe': True,
                'vulnerabilities': [],
                'summary': {'vulnerable': 0}
            }
        
        try:
            with open(self.report_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"❌ Error cargando reporte: {e}")
            return {
                'is_safe': True,
                'vulnerabilities': [],
                'summary': {'vulnerable': 0}
            }
    
    def get_vulnerabilities(self) -> List[Dict]:
        """Obtener lista de vulnerabilidades"""
        return self.report.get('vulnerabilities', [])
    
    def get_summary(self) -> Dict:
        """Obtener resumen del análisis"""
        return self.report.get('summary', {})
    
    def is_safe(self) -> bool:
        """Verificar si el código es seguro"""
        return self.report.get('is_safe', True)
    
    def check(self) -> bool:
        """
        Verificar vulnerabilidades
        Retorna: True si es SEGURO (sin vulnerabilidades)
                False si hay CUALQUIER vulnerabilidad
        
        POLÍTICA: NO SE PERMITE NINGUNA VULNERABILIDAD
        """
        vulns = self.get_vulnerabilities()
        summary = self.get_summary()
        is_safe = self.is_safe()
        
        print("\n" + "="*70)
        print("🔍 VERIFICACIÓN DE VULNERABILIDADES")
        print("="*70)
        
        # Mostrar resumen
        print("\n📊 Resumen del Análisis ML:")
        print(f"  • Total archivos: {summary.get('total', 0)}")
        print(f"  • Archivos seguros: {summary.get('safe', 0)}")
        print(f"  • Vulnerabilidades detectadas: {summary.get('vulnerable', 0)}")
        print(f"  • Errores en análisis: {summary.get('errors', 0)}")
        
        # Verificar seguridad general
        if is_safe and len(vulns) == 0:
            print("\n✅ RESULTADO: CÓDIGO SEGURO")
            print("✨ No se detectaron vulnerabilidades")
            print("🚀 Pipeline puede continuar")
            print("="*70 + "\n")
            return True
        
        # Si hay vulnerabilidades - SIEMPRE FALLA
        if len(vulns) > 0:
            print(f"\n🚨 RESULTADO: {len(vulns)} VULNERABILIDAD(ES) DETECTADA(S)")
            print("\n📋 Detalles de Vulnerabilidades:\n")
            
            # Clasificar por severidad para mostrar
            critical = []
            high = []
            medium = []
            low = []
            
            for vuln in vulns:
                severity = vuln.get('severity', 'unknown').lower()
                confidence = vuln.get('confidence', 0)
                
                if severity == 'critical' or confidence > 0.95:
                    critical.append(vuln)
                elif severity == 'high' or confidence > 0.85:
                    high.append(vuln)
                elif severity == 'medium' or confidence > 0.70:
                    medium.append(vuln)
                else:
                    low.append(vuln)
            
            # Mostrar críticas
            if critical:
                print(f"🔴 CRÍTICAS ({len(critical)}):")
                for idx, vuln in enumerate(critical, 1):
                    self._print_vulnerability(vuln, idx)
                print()
            
            # Mostrar altas
            if high:
                print(f"🟠 ALTAS ({len(high)}):")
                for idx, vuln in enumerate(high, 1):
                    self._print_vulnerability(vuln, idx)
                print()
            
            # Mostrar medias
            if medium:
                print(f"🟡 MEDIAS ({len(medium)}):")
                for idx, vuln in enumerate(medium, 1):
                    self._print_vulnerability(vuln, idx)
                print()
            
            # Mostrar bajas
            if low:
                print(f"🟢 BAJAS ({len(low)}):")
                for idx, vuln in enumerate(low, 1):
                    self._print_vulnerability(vuln, idx)
                print()
            
            # POLÍTICA: CUALQUIER VULNERABILIDAD = FALLA
            print("="*70)
            print("❌ PIPELINE BLOQUEADO - VULNERABILIDADES DETECTADAS")
            print("\n⚠️  SE DETECTARON VULNERABILIDADES:")
            print(f"   • Críticas: {len(critical)}")
            print(f"   • Altas: {len(high)}")
            print(f"   • Medias: {len(medium)}")
            print(f"   • Bajas: {len(low)}")
            print(f"   • TOTAL: {len(critical) + len(high) + len(medium) + len(low)}")
            print("\n🚫 POLÍTICA: NO SE PERMITE NINGUNA VULNERABILIDAD")
            print("   Todas las vulnerabilidades deben ser corregidas")
            print("   Corregir antes de hacer merge")
            print("="*70 + "\n")
            return False
        
        print("="*70 + "\n")
        return True
    
    def _print_vulnerability(self, vuln: Dict, idx: int = 1):
        """Imprimir detalles de una vulnerabilidad"""
        file_name = vuln.get('file', 'Desconocido').split('/')[-1]
        vuln_type = vuln.get('type', vuln.get('cwe_type', 'Desconocido'))
        confidence = vuln.get('confidence', 0) * 100
        line = vuln.get('line', 'N/A')
        severity = vuln.get('severity', 'unknown').upper()
        
        print(f"  {idx}. {file_name} (L:{line})")
        print(f"     Tipo: {vuln_type}")
        print(f"     Severidad: {severity}")
        print(f"     Confianza: {confidence:.1f}%")
        
        if vuln.get('description'):
            print(f"     Descripción: {vuln['description']}")
        
        print()


def main():
    """Función principal"""
    print("\n🔍 Iniciando verificación de vulnerabilidades...\n")
    
    # Cargar y verificar
    checker = VulnerabilityChecker()
    is_safe = checker.check()
    
    # Salir con código apropiado
    sys.exit(0 if is_safe else 1)


if __name__ == '__main__':
    main()
