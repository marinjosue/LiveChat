#!/usr/bin/env python3
"""Send vulnerability notifications to Telegram"""
import json
import os
import sys
import requests
from datetime import datetime

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
        
        # Get commit info from GitHub Actions environment
        commit_message = os.getenv('GITHUB_COMMIT_MESSAGE', 'Unknown')
        commit_author = os.getenv('GITHUB_ACTOR', 'Unknown')
        
        # Parse timestamp to readable format
        try:
            dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
            readable_time = dt.strftime('%d/%m/%Y %H:%M:%S')
        except:
            readable_time = timestamp
        
        if vulnerabilities:
            # Message for vulnerabilities found
            message = "🚨 <b>VULNERABILIDADES DETECTADAS</b> 🚨\n\n"
            message += "📊 <b>Resumen:</b>\n"
            message += f"• Total: {len(vulnerabilities)} vulnerabilidades\n"
            message += f"• Críticas (>85%): {summary.get('critical', 0)}\n"
            message += f"• Altas (70-85%): {summary.get('high', 0)}\n"
            message += f"• Medias (50-70%): {summary.get('medium', 0)}\n\n"
            message += "🔍 <b>TODAS LAS VULNERABILIDADES DETECTADAS:</b>\n\n"
            
            for i, vuln in enumerate(vulnerabilities, 1):
                file_path = vuln.get('file', 'unknown')
                line = vuln.get('line', '?')
                vuln_type = vuln.get('type', 'Unknown')
                confidence = vuln.get('confidence', 0)
                code = vuln.get('code', '')[:80]
                
                message += f"<b>{i}. {vuln_type}</b>\n"
                message += f"   📄 <code>{file_path}</code>\n"
                message += f"   📍 <b>Línea:</b> {line}\n"
                message += f"   🎯 <b>Confianza:</b> {confidence*100:.1f}%\n"
                message += f"   💻 <b>Código:</b> <code>{code}...</code>\n\n"
            
            message += f"👤 Usuario: <code>{commit_author}</code>\n"
            message += f"💬 Commit: <code>{commit_message}</code>\n"
            message += f"⏰ Hora: <code>{readable_time}</code>\n"
            message += "🔗 Repo: <code>LiveChat</code>"
        else:
            # Message when no vulnerabilities found
            message = "✅ <b>SIN VULNERABILIDADES DETECTADAS</b> ✅\n\n"
            message += "📊 <b>Análisis completado exitosamente</b>\n\n"
            message += f"Archivos escaneados: {report.get('files_scanned', 0)}\n"
            message += "Vulnerabilidades encontradas: 0\n\n"
            message += f"👤 Usuario: <code>{commit_author}</code>\n"
            message += f"💬 Commit: <code>{commit_message}</code>\n"
            message += f"⏰ Hora: <code>{readable_time}</code>\n"
            message += "🔗 Repo: <code>LiveChat</code>"
        
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
