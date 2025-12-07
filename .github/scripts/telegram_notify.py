#!/usr/bin/env python3
"""
Script para enviar notificaciones a Telegram
"""

import os
import sys
import json
import requests
from pathlib import Path
from typing import Dict, Optional

class TelegramNotifier:
    def __init__(self):
        self.bot_token = os.getenv('TELEGRAM_BOT_TOKEN')
        self.chat_id = os.getenv('TELEGRAM_CHAT_ID')
        
        if not self.bot_token or not self.chat_id:
            print("⚠️  Advertencia: Variables de Telegram no configuradas")
            self.enabled = False
        else:
            self.enabled = True
    
    def send_message(self, message: str, parse_mode: str = 'Markdown') -> bool:
        """Enviar mensaje a Telegram"""
        if not self.enabled:
            print("⚠️  Notificaciones de Telegram deshabilitadas")
            return False
        
        url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
        
        data = {
            'chat_id': self.chat_id,
            'text': message,
            'parse_mode': parse_mode
        }
        
        try:
            response = requests.post(url, json=data, timeout=10)
            
            if response.status_code == 200:
                print("✅ Notificación enviada a Telegram")
                return True
            else:
                print(f"❌ Error enviando notificación: {response.status_code}")
                print(response.text)
                return False
                
        except Exception as e:
            print(f"❌ Error al enviar notificación: {e}")
            return False
    
    def notify_vulnerability_scan(self, report_file: Path) -> bool:
        """Notificar resultados del escaneo de vulnerabilidades"""
        try:
            with open(report_file, 'r', encoding='utf-8') as f:
                report = json.load(f)
            
            summary = report['summary']
            is_safe = report['is_safe']
            
            # Construir mensaje
            if is_safe:
                emoji = "✅"
                status = "CÓDIGO SEGURO"
            else:
                emoji = "🚨"
                status = "VULNERABILIDADES DETECTADAS"
            
            message = f"{emoji} *{status}*\n\n"
            message += f"📊 *Resumen del Análisis ML:*\n"
            message += f"• Total archivos: {summary['total']}\n"
            message += f"• Seguros: {summary['safe']}\n"
            message += f"• Vulnerables: {summary['vulnerable']}\n"
            
            if summary['errors'] > 0:
                message += f"• Errores: {summary['errors']}\n"
            
            # Detalles de vulnerabilidades
            if not is_safe:
                message += f"\n🔴 *Vulnerabilidades encontradas:*\n"
                
                vuln_results = [r for r in report['results'] if r.get('vulnerable', False)]
                
                for vuln in vuln_results[:5]:  # Limitar a 5 primeras
                    file_name = Path(vuln['file']).name
                    cwe_type = vuln.get('cwe_type', 'Desconocido')
                    confidence = vuln.get('detection_confidence', 0) * 100
                    
                    message += f"\n📁 `{file_name}`\n"
                    message += f"   Tipo: {cwe_type}\n"
                    message += f"   Confianza: {confidence:.0f}%\n"
                
                if len(vuln_results) > 5:
                    message += f"\n... y {len(vuln_results) - 5} más\n"
            
            # Agregar contexto de GitHub
            repo = os.getenv('GITHUB_REPOSITORY', 'N/A')
            branch = os.getenv('GITHUB_REF_NAME', 'N/A')
            actor = os.getenv('GITHUB_ACTOR', 'N/A')
            sha = os.getenv('GITHUB_SHA', 'N/A')[:7]
            
            message += f"\n📦 Repo: `{repo}`\n"
            message += f"🌿 Branch: `{branch}`\n"
            message += f"👤 Actor: @{actor}\n"
            message += f"💾 Commit: `{sha}`\n"
            
            return self.send_message(message)
            
        except Exception as e:
            print(f"❌ Error creando notificación: {e}")
            return False
    
    def notify_tests(self, component: str, success: bool, message: Optional[str] = None) -> bool:
        """Notificar resultados de tests"""
        emoji = "✅" if success else "❌"
        status = "EXITOSO" if success else "FALLIDO"
        
        msg = f"{emoji} *Tests {status}*\n\n"
        msg += f"📦 Componente: `{component}`\n"
        
        if message:
            msg += f"📝 {message}\n"
        
        # Contexto
        branch = os.getenv('GITHUB_REF_NAME', 'N/A')
        actor = os.getenv('GITHUB_ACTOR', 'N/A')
        
        msg += f"\n🌿 Branch: `{branch}`\n"
        msg += f"👤 Actor: @{actor}\n"
        
        return self.send_message(msg)
    
    def notify_deploy(self, success: bool, environment: str = 'production') -> bool:
        """Notificar resultado del despliegue"""
        emoji = "🚀" if success else "❌"
        status = "EXITOSO" if success else "FALLIDO"
        
        msg = f"{emoji} *Deploy {status}*\n\n"
        msg += f"🌍 Ambiente: `{environment}`\n"
        
        # Contexto
        repo = os.getenv('GITHUB_REPOSITORY', 'N/A')
        branch = os.getenv('GITHUB_REF_NAME', 'N/A')
        actor = os.getenv('GITHUB_ACTOR', 'N/A')
        sha = os.getenv('GITHUB_SHA', 'N/A')[:7]
        
        msg += f"📦 Repo: `{repo}`\n"
        msg += f"🌿 Branch: `{branch}`\n"
        msg += f"👤 Actor: @{actor}\n"
        msg += f"💾 Commit: `{sha}`\n"
        
        if success:
            msg += f"\n✨ Aplicación desplegada correctamente"
        
        return self.send_message(msg)


def main():
    """Función principal"""
    if len(sys.argv) < 2:
        print("❌ Uso: python telegram_notify.py <tipo> [argumentos]")
        print("Tipos: vulnerability_scan, tests, deploy")
        sys.exit(1)
    
    notifier = TelegramNotifier()
    action = sys.argv[1]
    
    if action == 'vulnerability_scan':
        if len(sys.argv) < 3:
            print("❌ Uso: python telegram_notify.py vulnerability_scan <report_file>")
            sys.exit(1)
        
        report_file = Path(sys.argv[2])
        if not report_file.exists():
            print(f"❌ Error: Archivo de reporte no encontrado: {report_file}")
            sys.exit(1)
        
        success = notifier.notify_vulnerability_scan(report_file)
        sys.exit(0 if success else 1)
    
    elif action == 'tests':
        if len(sys.argv) < 4:
            print("❌ Uso: python telegram_notify.py tests <component> <success>")
            sys.exit(1)
        
        component = sys.argv[2]
        success = sys.argv[3].lower() == 'true'
        message = sys.argv[4] if len(sys.argv) > 4 else None
        
        success_result = notifier.notify_tests(component, success, message)
        sys.exit(0 if success_result else 1)
    
    elif action == 'deploy':
        if len(sys.argv) < 3:
            print("❌ Uso: python telegram_notify.py deploy <success> [environment]")
            sys.exit(1)
        
        success = sys.argv[2].lower() == 'true'
        environment = sys.argv[3] if len(sys.argv) > 3 else 'production'
        
        success_result = notifier.notify_deploy(success, environment)
        sys.exit(0 if success_result else 1)
    
    else:
        print(f"❌ Tipo de acción desconocido: {action}")
        sys.exit(1)


if __name__ == '__main__':
    main()
