#!/usr/bin/env python3
"""
Script para enviar notificaciones a Telegram
Uso: python telegram_notify.py <tipo> <mensaje>
"""
import os
import sys
import requests
from datetime import datetime

def send_telegram_message(message, parse_mode='HTML'):
    """
    Envía un mensaje a Telegram
    """
    bot_token = os.getenv('TELEGRAM_BOT_TOKEN')
    chat_id = os.getenv('TELEGRAM_CHAT_ID')
    
    if not bot_token or not chat_id:
        print("⚠️ Variables de entorno TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID requeridas")
        return False
    
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    
    payload = {
        'chat_id': chat_id,
        'text': message,
        'parse_mode': parse_mode
    }
    
    try:
        response = requests.post(url, data=payload)
        response.raise_for_status()
        print("✅ Notificación enviada a Telegram")
        return True
    except Exception as e:
        print(f"❌ Error al enviar notificación: {e}")
        return False

def format_security_alert(repo, pr_number, author, vulnerabilities):
    """
    Formatea alerta de seguridad
    """
    message = "🔴 <b>ALERTA DE SEGURIDAD</b>\n\n"
    message += f"📦 <b>Repositorio:</b> {repo}\n"
    message += f"🔀 <b>PR:</b> #{pr_number}\n"
    message += f"👤 <b>Autor:</b> {author}\n"
    message += f"🕐 <b>Fecha:</b> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
    message += f"❌ <b>Vulnerabilidades detectadas:</b> {vulnerabilities}\n\n"
    message += "⚠️ El código NO puede ser mergeado hasta que se corrijan las vulnerabilidades."
    
    return message

def format_approval_message(repo, pr_number, author, branch):
    """
    Formatea mensaje de aprobación
    """
    message = "✅ <b>CÓDIGO APROBADO</b>\n\n"
    message += f"📦 <b>Repositorio:</b> {repo}\n"
    message += f"🔀 <b>PR:</b> #{pr_number}\n"
    message += f"👤 <b>Autor:</b> {author}\n"
    message += f"🌿 <b>Rama:</b> {branch}\n"
    message += f"🕐 <b>Fecha:</b> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
    message += "✅ El análisis ML no detectó vulnerabilidades\n"
    message += "✅ Todas las pruebas pasaron\n\n"
    message += "🚀 El código está listo para merge"
    
    return message

def format_deployment_message(repo, branch, status, url=None):
    """
    Formatea mensaje de despliegue
    """
    emoji = "✅" if status == "success" else "❌"
    status_text = "EXITOSO" if status == "success" else "FALLIDO"
    
    message = f"{emoji} <b>DESPLIEGUE {status_text}</b>\n\n"
    message += f"📦 <b>Repositorio:</b> {repo}\n"
    message += f"🌿 <b>Rama:</b> {branch}\n"
    message += f"🕐 <b>Fecha:</b> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
    
    if status == "success":
        message += "✅ La aplicación se desplegó correctamente\n"
        if url:
            message += f"🌐 <b>URL:</b> {url}"
    else:
        message += "❌ El despliegue falló\n"
        message += "Por favor, revisa los logs para más detalles."
    
    return message

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python telegram_notify.py <tipo> [args...]")
        print("Tipos: security_alert, approval, deployment")
        sys.exit(1)
    
    notification_type = sys.argv[1]
    
    if notification_type == "security_alert":
        if len(sys.argv) < 6:
            print("Uso: python telegram_notify.py security_alert <repo> <pr_number> <author> <vulnerabilities>")
            sys.exit(1)
        
        message = format_security_alert(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5])
        send_telegram_message(message)
    
    elif notification_type == "approval":
        if len(sys.argv) < 6:
            print("Uso: python telegram_notify.py approval <repo> <pr_number> <author> <branch>")
            sys.exit(1)
        
        message = format_approval_message(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5])
        send_telegram_message(message)
    
    elif notification_type == "deployment":
        if len(sys.argv) < 5:
            print("Uso: python telegram_notify.py deployment <repo> <branch> <status> [url]")
            sys.exit(1)
        
        url = sys.argv[5] if len(sys.argv) > 5 else None
        message = format_deployment_message(sys.argv[2], sys.argv[3], sys.argv[4], url)
        send_telegram_message(message)
    
    else:
        print(f"❌ Tipo de notificación desconocido: {notification_type}")
        sys.exit(1)
