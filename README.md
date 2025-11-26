# 🏥 MediChat - Bot de Notificaciones Médicas por WhatsApp

Bot de WhatsApp para el **Sistema de Gestión de Stock Médico RFID** que permite enviar notificaciones, alertas y recetas médicas directamente a pacientes y personal de salud.

---

## ✨ Características

- 📱 **WhatsApp nativo** - Conexión directa sin APIs de pago
- 🎤 **Reconocimiento de voz** - Transcripción local con Whisper (español)
- 📋 **Envío de recetas** - Envía recetas médicas con código QR al paciente
- 🚨 **Alertas de stock** - Notifica sobre productos con stock bajo o vencidos
- 🔔 **Notificaciones automáticas** - Alertas a farmacéuticos y administradores
- 💾 **Base de datos local** (SQLite) para sesiones
- 🔗 **Integración completa** con Sistema RFID de Stock Médico
- 🆓 **100% gratuito** - Sin costos de APIs externas

---

## 📋 Requisitos Previos

### 1. Node.js
```bash
# Instalar Node.js v18 o superior
node --version  # debe mostrar v18.x.x o superior
```

### 2. Python (para Whisper - opcional, solo para voz)
```bash
# Instalar Python 3.8 o superior
python3 --version

# Instalar OpenAI Whisper
pip3 install openai-whisper

# Verificar instalación
whisper --help
```

### 3. FFmpeg (para procesamiento de audio)
```bash
# En macOS
brew install ffmpeg

# En Ubuntu/Debian
sudo apt update && sudo apt install ffmpeg

# En Windows
# Descargar desde: https://ffmpeg.org/download.html
```

---

## 🚀 Instalación

### 1. Instalar dependencias
```bash
cd medichat
npm install
```

### 2. Configurar variables de entorno
```bash
# Copiar el archivo de ejemplo
cp .env.example .env

# Editar .env con tus datos
```

**Configuración en `.env`:**
```env
# Configuración del servidor
PORT=3001
NODE_ENV=development

# API del Sistema RFID
RFID_API_URL=http://localhost:3000/api
RFID_AUTH_TOKEN=tu_token_de_autenticacion

# Whisper (Transcripción de voz - opcional)
WHISPER_MODEL=base
WHISPER_LANGUAGE=es
WHISPER_PYTHON_PATH=python3

# Configuración del bot
WELCOME_MESSAGE=¡Hola! Soy el asistente del Sistema Médico RFID.
TIMEZONE=America/Lima
```

### 3. Iniciar el bot
```bash
npm start
# o
node src/app.js
```

En el primer inicio:
1. Se generará un **código QR** en la consola y en `qr/qr.png`
2. Escanea el QR con WhatsApp (Dispositivos vinculados)
3. El bot se conectará automáticamente
4. ¡Listo! El sistema puede enviar notificaciones por WhatsApp

---

## 🔧 Integración con Sistema RFID

El bot se integra con el backend del Sistema RFID para:

| Funcionalidad | Descripción |
|---------------|-------------|
| **Envío de recetas** | Envía la receta médica con QR al teléfono del paciente |
| **Alertas de stock** | Notifica a farmacéuticos sobre stock bajo o vencido |
| **Notificaciones** | Envía alertas críticas al personal de salud |

### Endpoints utilizados

| Endpoint | Método | Uso |
|----------|--------|-----|
| `/prescriptions/:id` | GET | Obtener datos de una receta |
| `/alerts` | GET | Consultar alertas activas |
| `/products` | GET | Verificar stock de productos |

---

## 💬 Funcionalidades del Bot

### Envío de Recetas Médicas
Cuando se crea una receta en el Sistema RFID, el bot puede enviarla automáticamente al paciente:

```
📋 RECETA MÉDICA
━━━━━━━━━━━━━━━━━━

👤 Paciente: Juan Pérez
🏥 Código: RX-2024-00123
📅 Fecha: 26/11/2024

💊 Medicamentos:
• Paracetamol 500mg - 20 unidades
  Tomar 1 cada 8 horas

• Amoxicilina 500mg - 21 cápsulas
  Tomar 1 cada 8 horas por 7 días

👨‍⚕️ Dr. Carlos García
Colegiatura: CMP-12345

[Imagen del código QR para despacho]
```

### Alertas de Stock
```
🚨 ALERTA DE STOCK

⚠️ Productos con stock bajo:
• Paracetamol 500mg: 15 unidades (mínimo: 50)
• Ibuprofeno 400mg: 8 unidades (mínimo: 30)

⏰ Productos próximos a vencer:
• Amoxicilina Lote L-2024-001: vence en 7 días
```

### Comandos Disponibles

Los usuarios autorizados pueden usar:

- `ESTADO` - Ver estado del sistema
- `ALERTAS` - Ver alertas activas
- `AYUDA` - Mostrar comandos disponibles

---

## 📁 Estructura del Proyecto

```
medichat/
├── src/
│   ├── app.js                 # Servidor principal Express
│   ├── whatsapp.js            # Lógica de conexión WhatsApp
│   ├── whisper.js             # Transcripción de voz (opcional)
│   ├── rfidApi.js             # Cliente HTTP para Sistema RFID
│   ├── sessionManager.js      # Gestión de sesiones
│   └── utils/
│       ├── audioConverter.js  # Conversión de audio
│       └── logger.js          # Registro de eventos
├── config/
│   └── config.js              # Configuración general
├── qr/
│   └── qr.png                 # Código QR de WhatsApp (auto-generado)
├── data/
│   └── medichat.db            # Base de datos SQLite (auto-generada)
├── temp/                      # Archivos temporales de audio
├── tokens/                    # Sesión de WhatsApp
├── package.json
├── .env.example
├── .env
└── README.md
```

---

## 🔄 Flujo de Notificaciones

1. **Evento en Sistema RFID** - Se crea receta, alerta de stock, etc.
2. **Webhook a MediChat** - El backend RFID notifica al bot
3. **Procesamiento** - El bot formatea el mensaje
4. **Envío por WhatsApp** - Se envía al destinatario correspondiente
5. **Confirmación** - Se registra el envío exitoso

---

## 🔐 Seguridad

- ✅ Token de autenticación para API del Sistema RFID
- ✅ Validación de números de WhatsApp autorizados
- ✅ Logs de todas las notificaciones enviadas
- ✅ Datos sensibles no se almacenan permanentemente
- ✅ Sesión de WhatsApp encriptada localmente

---

## 🐛 Troubleshooting

### El QR no aparece
```bash
# Eliminar sesión anterior
rm -rf tokens/

# Reiniciar el bot
npm start
```

### Error con Whisper (si usas voz)
```bash
# Verificar instalación
whisper --help

# Reinstalar si es necesario
pip3 install --upgrade openai-whisper
```

### Error de conexión con Sistema RFID
```bash
# Verificar que el backend esté corriendo
curl http://localhost:3000/api/health

# Verificar token en .env
```

### Audio no se transcribe
```bash
# Verificar FFmpeg
ffmpeg -version

# Verificar permisos de carpeta temp/
chmod 755 temp/
```

---

## 🚀 Despliegue

### Con PM2 (Recomendado)
```bash
# Instalar PM2
npm install -g pm2

# Iniciar con PM2
pm2 start src/app.js --name medichat

# Ver logs
pm2 logs medichat

# Reiniciar
pm2 restart medichat

# Iniciar automáticamente con el sistema
pm2 startup
pm2 save
```

### Con el script de inicio del Sistema RFID
El bot se inicia automáticamente al ejecutar:
- **Windows:** `iniciar.bat`
- **macOS/Linux:** `iniciar_todo.sh`

---

## 📧 Soporte

Si tienes problemas o preguntas:
- Revisa la sección de Troubleshooting
- Verifica los logs del sistema
- Contacta al administrador del sistema

---

## 📄 Licencia

MIT License - Parte del Sistema de Gestión de Stock Médico RFID

---

**Desarrollado con ❤️ para instituciones de salud**
