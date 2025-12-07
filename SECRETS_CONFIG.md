# 🔐 Configuración de Secrets - GitHub Actions

## ⚡ Configuración Rápida

### Tus Credenciales de Telegram Bot

```
Bot: @J0s_notify_bot
Token: 8491862798:AAHc2B4aLiZmnEfwZ1b0ClCiP1VWdJi7jpc
Chat ID: 1648068776
```

---

## 📍 Dónde Configurar los Secrets

### 1. Ir a GitHub Repository Settings

```
https://github.com/marinjosue/LiveChat/settings/secrets/actions
```

O navega manualmente:
1. Abre tu repositorio: https://github.com/marinjosue/LiveChat
2. Click en **Settings** (pestaña superior)
3. En el menú lateral izquierdo, busca **Secrets and variables**
4. Click en **Actions**
5. Click en **New repository secret**

---

## 🔑 Secrets a Configurar

### Secret #1: TELEGRAM_BOT_TOKEN

```
Name: TELEGRAM_BOT_TOKEN

Secret: 8491862798:AAHc2B4aLiZmnEfwZ1b0ClCiP1VWdJi7jpc
```

1. Click **New repository secret**
2. En "Name" escribe: `TELEGRAM_BOT_TOKEN`
3. En "Secret" pega: `8491862798:AAHc2B4aLiZmnEfwZ1b0ClCiP1VWdJi7jpc`
4. Click **Add secret**

---

### Secret #2: TELEGRAM_CHAT_ID

```
Name: TELEGRAM_CHAT_ID

Secret: 1648068776
```

1. Click **New repository secret**
2. En "Name" escribe: `TELEGRAM_CHAT_ID`
3. En "Secret" pega: `1648068776`
4. Click **Add secret**

---

## ✅ Verificación

Después de configurar, deberías ver:

```
TELEGRAM_BOT_TOKEN    Updated X minutes ago
TELEGRAM_CHAT_ID      Updated X minutes ago
```

---

## 🧪 Prueba Local

Para probar que funciona localmente:

```powershell
# Configura las variables temporalmente
$env:TELEGRAM_BOT_TOKEN="8491862798:AAHc2B4aLiZmnEfwZ1b0ClCiP1VWdJi7jpc"
$env:TELEGRAM_CHAT_ID="1648068776"

# Instala requests si no lo tienes
pip install requests

# Envía mensaje de prueba
python -c "import requests; requests.post('https://api.telegram.org/bot8491862798:AAHc2B4aLiZmnEfwZ1b0ClCiP1VWdJi7jpc/sendMessage', data={'chat_id': '1648068776', 'text': '✅ Test desde LiveChat Pipeline'})"
```

Si recibes un mensaje en Telegram, ¡funciona! 🎉

---

## 🚀 Siguiente Paso

Una vez configurados los secrets:

1. ✅ Secrets configurados en GitHub
2. 📝 Crear un Pull Request de `dev` → `test`
3. 🤖 El pipeline se ejecutará automáticamente
4. 📱 Recibirás notificación en Telegram

Ver: `PIPELINE_QUICK_START.md` para instrucciones de uso.

---

## ⚠️ Seguridad

- ❌ **NUNCA** subas estos valores al código
- ❌ **NUNCA** los compartas públicamente
- ✅ **SOLO** configúralos como secrets en GitHub
- ✅ GitHub los mantendrá encriptados y seguros

---

## 🔄 Regenerar Token (si es necesario)

Si necesitas regenerar el token:

1. Busca @BotFather en Telegram
2. Envía: `/mybots`
3. Selecciona: @J0s_notify_bot
4. Click: "API Token"
5. Click: "Revoke current token"
6. Copia el nuevo token
7. Actualiza el secret en GitHub

---

**¡Listo! Ahora ve a GitHub y configura los secrets para activar el pipeline 🚀**
