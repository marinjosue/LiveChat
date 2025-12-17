#!/usr/bin/env python3
"""Send vulnerability notifications to Telegram"""
import json
import os
import sys
import requests
from datetime import datetime
import html

def escape_html(text):
    """Escapar caracteres HTML especiales"""
    if not text:
        return ""
    return html.escape(str(text))

def send_telegram_notification():
    """Read vulnerability report and send Telegram notification"""
    
    bot_token = os.getenv('TELEGRAM_BOT_TOKEN')
    chat_id = os.getenv('TELEGRAM_CHAT_ID')
    
    if not bot_token or not chat_id:
        print('⚠️ Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID')
        return False
    
    try:
        with open('vulnerability_report.json') as f:
            report = json.load(f)
        
        vulnerabilities = report.get('vulnerabilities', [])
        summary = report.get('summary', {})
        timestamp = report.get('timestamp', '')
        usuario = report.get('usuario', 'Unknown')
        commit = report.get('commit', 'Unknown')
        commit_message = report.get('commit_message', 'No message')
        
        # Readable time format
        readable_time = timestamp
        
        if vulnerabilities:
            # Message for vulnerabilities found
            message = "🚨 <b>VULNERABILIDADES DETECTADAS</b> 🚨\n\n"
            message += "📊 <b>Resumen:</b>\n"
            message += f"• Total archivos: {report.get('files_scanned', 0)}\n"
            message += f"• Archivos vulnerables: {summary.get('vulnerable', 0)}\n"
            message += f"• Total vulnerabilidades: {summary.get('total', 0)}\n"
            message += f"• Críticas: {summary.get('critical', 0)}\n"
            message += f"• Altas: {summary.get('high', 0)}\n"
            message += f"• Medias: {summary.get('medium', 0)}\n"
            message += f"• Bajas: {summary.get('low', 0)}\n\n"
            message += "🔍 <b>TOP 10 VULNERABILIDADES:</b>\n\n"
            
            for i, vuln in enumerate(vulnerabilities[:10], 1):  # Solo primeras 10
                file_path = vuln.get('file', 'unknown')
                line = vuln.get('line_number', '?')
                vuln_type = vuln.get('type', 'Unknown')
                risk_score = vuln.get('risk_score', 0)
                severity = vuln.get('severity', 'medium').upper()
                line_content = escape_html(vuln.get('line_content', '')[:50])
                
                message += f"<b>{i}. {escape_html(vuln_type)}</b> [{severity}]\n"
                message += f"📁 {escape_html(file_path)}\n"
                message += f"📍 Línea: {line}\n"
                message += f"⚠️ Riesgo: {risk_score*100:.1f}%\n"
                if line_content:
                    message += f"💻 <code>{line_content}</code>\n"
                message += "\n"
            
            if len(vulnerabilities) > 10:
                message += f"<i>... y {len(vulnerabilities) - 10} vulnerabilidades más</i>\n\n"
            
            message += f"👤 Usuario: {escape_html(usuario)}\n"
            message += f"🔗 Commit: <code>{escape_html(commit)}</code>\n"
            message += f"⏰ Hora: {readable_time}\n"
        else:
            # Message when no vulnerabilities found
            message = "✅ <b>SIN VULNERABILIDADES DETECTADAS</b> ✅\n\n"
            message += "📊 <b>Análisis completado exitosamente</b>\n\n"
            message += f"Archivos escaneados: {report.get('files_scanned', 0)}\n"
            message += "Vulnerabilidades encontradas: 0\n\n"
            message += f"👤 Usuario: {escape_html(usuario)}\n"
            message += f"💬 Commit: {escape_html(commit)}\n"
            message += f"⏰ Hora: {readable_time}\n"
            message += "🔗 Repo: LiveChat"
        
        # Send to Telegram
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        payload = {
            'chat_id': chat_id,
            'text': message,
            'parse_mode': 'HTML'
        }
        
        response = requests.post(url, json=payload, timeout=10)
        
        if response.status_code == 200:
            print('✅ Notificación enviada a Telegram exitosamente')
            return True
        else:
            print(f'❌ Error enviando notificación: {response.text}')
            return False
            
    except FileNotFoundError:
        print('⚠️ vulnerability_report.json no encontrado')
        return False
    except Exception as e:
        print(f'❌ Error: {e}')
        return False

if __name__ == '__main__':
    success = send_telegram_notification()
    sys.exit(0 if success else 1)
