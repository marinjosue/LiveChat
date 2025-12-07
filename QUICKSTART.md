# 🚀 Guía Rápida de Inicio

## ⚡ Setup en 5 Minutos

### 1. Entrenar el Modelo (Primera vez)

```powershell
cd ml-security
pip install -r requirements.txt
python train_model.py
```

### 2. Configurar Telegram

1. Busca [@BotFather](https://t.me/BotFather) en Telegram
2. Crea un bot: `/newbot`
3. Copia el **token**
4. Busca [@userinfobot](https://t.me/userinfobot)
5. Obtén tu **chat ID**: `/start`

### 3. Configurar Secrets en GitHub

```
Settings → Secrets → Actions → New secret
```

- `TELEGRAM_BOT_TOKEN`: Tu token del bot
- `TELEGRAM_CHAT_ID`: Tu chat ID

### 4. Probar Localmente

```powershell
# Escanear código
cd ml-security
python vulnerability_scanner.py ..\servidor

# Ver reporte
cat security_report.json
```

### 5. Crear Pull Request

```powershell
# En rama dev
git add .
git commit -m "feat: nueva funcionalidad"
git push origin dev

# Crear PR: dev → test
# El pipeline se ejecutará automáticamente
```

---

## 📋 Checklist de Configuración

- [ ] Modelo entrenado (`vulnerability_classifier.pkl` existe)
- [ ] Bot de Telegram creado
- [ ] Secrets configurados en GitHub
- [ ] Prueba local exitosa
- [ ] Ramas `dev`, `test`, `main` creadas
- [ ] Pipeline funcionando

---

## 🎯 Comandos Útiles

### Escanear código

```powershell
cd ml-security
python vulnerability_scanner.py ..\cliente\src
python vulnerability_scanner.py ..\servidor
```

### Re-entrenar modelo

```powershell
cd ml-security
python train_model.py
```

### Probar notificaciones

```powershell
$env:TELEGRAM_BOT_TOKEN="tu_token"
$env:TELEGRAM_CHAT_ID="tu_chat_id"
python ..\scripts\telegram_notify.py security_alert "LiveChat" "123" "test" "2"
```

### Docker local

```powershell
# Construir
docker-compose build

# Ejecutar
docker-compose up -d

# Ver logs
docker-compose logs -f

# Detener
docker-compose down
```

---

## 🔄 Flujo de Trabajo Diario

1. **Desarrollar** en rama `dev`
2. **Commit y push** a `dev`
3. **Crear PR** de `dev` → `test`
4. **Esperar** análisis ML automático
5. Si **✅ pasa**: merge a `test`
6. Si **❌ falla**: corregir vulnerabilidades
7. Desde `test` → `main` para producción

---

## 🚨 Si el Pipeline Falla

### Paso 1: Ver el reporte

Ve a GitHub Actions → Descarga `security-report` artifact

### Paso 2: Revisar vulnerabilidades

```json
{
  "vulnerable_list": [
    {
      "file": "servidor/routes/user.js",
      "issues": ["⚠️ Posible SQL Injection"]
    }
  ]
}
```

### Paso 3: Corregir código

```javascript
// Antes (vulnerable)
const query = 'SELECT * FROM users WHERE id = ' + userId;

// Después (seguro)
const query = 'SELECT * FROM users WHERE id = ?';
db.query(query, [userId]);
```

### Paso 4: Push de nuevo

El pipeline se volverá a ejecutar automáticamente.

---

## 📞 Contacto Rápido

- 🐛 Issues: [GitHub Issues](https://github.com/marinjosue/LiveChat/issues)
- 📖 Documentación completa: Ver `PIPELINE_README.md`

---

**¡Listo para empezar! 🎉**
