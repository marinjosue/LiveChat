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
            
            # ============================================================
            # ENCABEZADO DEL REPORTE
            # ============================================================
            if is_safe:
                message = "╔════════════════════════════════════════╗\n"
                message += "║  ✅ ANÁLISIS DE SEGURIDAD EXITOSO      ║\n"
                message += "╚════════════════════════════════════════╝\n\n"
                message += "🟢 *El código ha sido aprobado*\n"
                message += "✨ No se detectaron vulnerabilidades\n"
            else:
                message = "╔════════════════════════════════════════╗\n"
                message += "║  🚨 ALERTA DE SEGURIDAD               ║\n"
                message += "║  VULNERABILIDADES DETECTADAS           ║\n"
                message += "╚════════════════════════════════════════╝\n\n"
                message += "🔴 *El código contiene vulnerabilidades*\n"
                message += "⚠️  Requiere correcciones antes del merge\n"
            
            # ============================================================
            # ESTADÍSTICAS GENERALES
            # ============================================================
            message += "\n┌─ *📊 ESTADÍSTICAS DEL ANÁLISIS* ─┐\n"
            message += f"│ 📁 Total archivos: `{summary['total']}`\n"
            message += f"│ ✅ Seguros: `{summary['safe']}`\n"
            message += f"│ 🚨 Vulnerables: `{summary['vulnerable']}`\n"
            
            if summary['errors'] > 0:
                message += f"│ ⚠️  Errores: `{summary['errors']}`\n"
            
            if summary.get('skipped', 0) > 0:
                message += f"│ ⏭️  Omitidos: `{summary['skipped']}`\n"
            
            message += "└────────────────────────────────────┘\n"
            
            # ============================================================
            # DETALLES DE VULNERABILIDADES
            # ============================================================
            if not is_safe:
                vuln_results = [r for r in report['results'] if r.get('vulnerable', False)]
                message += "\n┌─ *🔴 VULNERABILIDADES DETECTADAS* ─┐\n"
                
                for idx, vuln in enumerate(vuln_results[:5], 1):  # Limitar a 5
                    file_name = Path(vuln['file']).name
                    file_path = vuln.get('file', 'N/A')
                    language = vuln.get('language', 'Unknown')
                    cwe_type = vuln.get('cwe_type', 'Unknown')
                    cwe_confidence = vuln.get('cwe_confidence', 0)
                    detection_conf = vuln.get('detection_confidence', 0)
                    
                    # Formatear el tipo de CWE
                    if cwe_type == 'Unknown' or not cwe_type:
                        cwe_display = "🔍 No clasificado"
                        severity = "⚠️  MEDIA"
                    else:
                        cwe_display = cwe_type
                        # Asignar severidad según confianza
                        if detection_conf > 0.85:
                            severity = "🔴 ALTA"
                        elif detection_conf > 0.70:
                            severity = "🟠 MEDIA"
                        else:
                            severity = "🟡 BAJA"
                    
                    message += f"\n│\n│ *#{idx} - {file_name}*\n"
                    message += f"│ 📍 Ruta: `{file_path}`\n"
                    message += f"│ 💻 Lenguaje: `{language}`\n"
                    message += f"│ 🏷️  Tipo CWE: {cwe_display}\n"
                    message += f"│ 📈 Severidad: {severity}\n"
                    message += f"│ 🎯 Confianza detección: `{detection_conf*100:.1f}%`\n"
                    
                    if cwe_confidence > 0:
                        message += f"│ 🔬 Confianza clasificación: `{cwe_confidence*100:.1f}%`\n"
                
                message += f"│\n"
                
                if len(vuln_results) > 5:
                    message += f"│ ... y `{len(vuln_results) - 5}` más vulnerabilidades\n"
                
                message += "└────────────────────────────────────┘\n"
            
            # ============================================================
            # INFORMACIÓN DEL REPOSITORIO
            # ============================================================
            repo = os.getenv('GITHUB_REPOSITORY', 'marinjosue/LiveChat')
            branch = os.getenv('GITHUB_REF_NAME', 'dev')
            actor = os.getenv('GITHUB_ACTOR', 'usuario')
            sha = os.getenv('GITHUB_SHA', '0000000')[:7]
            
            message += "\n┌─ *📦 INFORMACIÓN DEL REPOSITORIO* ─┐\n"
            message += f"│ 🏢 Repositorio: `{repo}`\n"
            message += f"│ 🌿 Rama: `{branch}`\n"
            message += f"│ 👤 Autor: `@{actor}`\n"
            message += f"│ 💾 Commit: `{sha}`\n"
            message += "└────────────────────────────────────┘\n"
            
            # ============================================================
            # LLAMADA A LA ACCIÓN
            # ============================================================
            if is_safe:
                message += "\n✅ *Estado: APROBADO PARA MERGE*\n"
                message += "🚀 El código está listo para producción\n"
            else:
                message += "\n❌ *Estado: RECHAZADO - REQUIERE CORRECCIONES*\n"
                message += "🔧 Por favor, corrige las vulnerabilidades detectadas\n"
                message += "📚 Revisa la documentación de OWASP para referencias\n"
            
            message += "\n" + "═"*40
            
            return self.send_message(message)
            
        except Exception as e:
            print(f"❌ Error creando notificación: {e}")
            return False
    
    def notify_tests(self, component: str, success: bool, message: Optional[str] = None) -> bool:
        """Notificar resultados de tests"""
        emoji = "✅" if success else "❌"
        status = "EXITOSO" if success else "FALLIDO"
        
        msg = f"╔════════════════════════════════════════╗\n"
        msg += f"║  {emoji} RESULTADO DE TESTS              ║\n"
        msg += f"╚════════════════════════════════════════╝\n\n"
        msg += f"*Estado:* {'🟢 EXITOSO' if success else '🔴 FALLIDO'}\n\n"
        
        msg += f"┌─ *📋 DETALLES DEL TEST* ─┐\n"
        msg += f"│ 📦 Componente: `{component}`\n"
        msg += f"│ 🧪 Estado: `{status}`\n"
        
        if message:
            msg += f"│ 📝 Mensaje: {message}\n"
        
        msg += "└───────────────────────────┘\n"
        
        # Contexto de GitHub
        branch = os.getenv('GITHUB_REF_NAME', 'dev')
        actor = os.getenv('GITHUB_ACTOR', 'usuario')
        repo = os.getenv('GITHUB_REPOSITORY', 'marinjosue/LiveChat')
        
        msg += f"\n┌─ *🔗 INFORMACIÓN* ─┐\n"
        msg += f"│ 📦 Repo: `{repo}`\n"
        msg += f"│ 🌿 Rama: `{branch}`\n"
        msg += f"│ 👤 Actor: `@{actor}`\n"
        msg += "└────────────────────┘\n"
        
        if not success:
            msg += "\n🔧 Por favor, revisa los logs para más detalles\n"
        else:
            msg += "\n✨ ¡Todos los tests pasaron correctamente!\n"
        
        msg += "═"*40
        
        return self.send_message(msg)
    
    def notify_deploy(self, success: bool, environment: str = 'production') -> bool:
        """Notificar resultado del despliegue"""
        emoji = "🚀" if success else "❌"
        status = "EXITOSO" if success else "FALLIDO"
        
        msg = f"╔════════════════════════════════════════╗\n"
        msg += f"║  {emoji} DESPLIEGUE {status:^22} ║\n"
        msg += f"╚════════════════════════════════════════╝\n\n"
        msg += f"*Estado:* {'🟢 DESPLEGADO' if success else '🔴 ERROR'}\n\n"
        
        # Contexto
        repo = os.getenv('GITHUB_REPOSITORY', 'marinjosue/LiveChat')
        branch = os.getenv('GITHUB_REF_NAME', 'main')
        actor = os.getenv('GITHUB_ACTOR', 'usuario')
        sha = os.getenv('GITHUB_SHA', '0000000')[:7]
        
        msg += f"┌─ *🌍 INFORMACIÓN DE DESPLIEGUE* ─┐\n"
        msg += f"│ 🌐 Ambiente: `{environment.upper()}`\n"
        msg += f"│ 📦 Repositorio: `{repo}`\n"
        msg += f"│ 🌿 Rama: `{branch}`\n"
        msg += f"│ 👤 Autor: `@{actor}`\n"
        msg += f"│ 💾 Commit: `{sha}`\n"
        msg += "└────────────────────────────────────┘\n"
        
        if success:
            msg += "\n✨ *Despliegue Completado Exitosamente*\n"
            msg += "🟢 La aplicación está en línea\n"
            msg += "📊 Monitoreando la salud de la aplicación...\n"
        else:
            msg += "\n🚨 *El despliegue ha fallado*\n"
            msg += "❌ La aplicación NO se ha desplegado\n"
            msg += "🔧 Revisa los logs inmediatamente\n"
            msg += "📞 Contacta al equipo de DevOps\n"
        
        msg += "\n" + "═"*40
        
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
