# 🤖 MediChat - Chatbot de WhatsApp con IA

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18+-green?style=for-the-badge&logo=node.js" alt="Node.js">
  <img src="https://img.shields.io/badge/WhatsApp-Baileys-25D366?style=for-the-badge&logo=whatsapp" alt="WhatsApp">
  <img src="https://img.shields.io/badge/Ollama-Local_AI-blue?style=for-the-badge" alt="Ollama">
  <img src="https://img.shields.io/badge/Whisper-Voice-orange?style=for-the-badge" alt="Whisper">
  <img src="https://img.shields.io/badge/SQLite-Database-lightblue?style=for-the-badge&logo=sqlite" alt="SQLite">
</p>

Chatbot inteligente de WhatsApp con **reconocimiento de voz** e **Inteligencia Artificial** para gestión automatizada de pedidos, integrado con el sistema de ventas KARDEX.

---

## 📋 Tabla de Contenidos

- [Características](#-características)
- [Arquitectura del Sistema](#-arquitectura-del-sistema)
- [Requisitos Previos](#-requisitos-previos)
- [Instalación](#-instalación)
- [Configuración](#-configuración)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Módulos del Sistema](#-módulos-del-sistema)
- [Procesamiento de IA](#-procesamiento-de-ia)
- [Flujo de Conversación](#-flujo-de-conversación)
- [API REST](#-api-rest)
- [Integración con KARDEX](#-integración-con-kardex)
- [Comandos del Bot](#-comandos-del-bot)
- [Despliegue](#-despliegue)
- [Troubleshooting](#-troubleshooting)

---

## ✨ Características

### 📱 WhatsApp Nativo
- **Conexión directa** con WhatsApp via Baileys
- **100% gratuito** - Sin APIs de pago
- **Sesión persistente** - No requiere escanear QR repetidamente
- **Soporte multi-dispositivo** compatible

### 🎤 Reconocimiento de Voz
- **Transcripción local** con OpenAI Whisper
- **Optimizado para español peruano**
- **Procesamiento de notas de voz** en tiempo real
- **Corrección automática** de texto transcrito

### 🧠 Inteligencia Artificial
- **Procesador unificado de IA** para todos los mensajes
- **Múltiples modelos** soportados (Ollama local)
- **Detección inteligente de intenciones**
- **Búsqueda semántica** de productos
- **Fuzzy matching** para nombres de productos
- **Respuestas contextuales** basadas en historial

### 🛒 Gestión de Pedidos
- **Flujo completo** de ventas automatizado
- **Carrito de compras** persistente
- **Confirmación de pedidos** interactiva
- **Cálculo automático** de totales
- **Validación de stock** en tiempo real

### 💳 Pagos Integrados
- **QR de Yape/Plin** automático
- **Confirmación de pago** por mensaje
- **Links de pago** personalizados

### 🔔 Notificaciones
- **Alertas a vendedores** cuando hay pedidos
- **Notificaciones automáticas** a administradores
- **Integración con sistema KARDEX**

### 📊 Gestión de Sesiones
- **Sesiones por usuario** con timeout
- **Historial de conversación** persistente
- **Limpieza automática** de sesiones expiradas
- **Métricas de uso**

---

## 🏗️ Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           WHATSAPP                                       │
│                    (Usuario envía mensaje)                               │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     BAILEYS (WhatsApp Client)                            │
│              whatsapp-baileys.js - Conexión y eventos                    │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
          ┌──────────────────┴──────────────────┐
          │                                     │
          ▼                                     ▼
┌─────────────────────┐              ┌─────────────────────┐
│   TEXTO/COMANDOS    │              │   NOTAS DE VOZ      │
│                     │              │                     │
│   Mensaje directo   │              │   whisper.js        │
│   al procesador     │              │   (Transcripción)   │
└──────────┬──────────┘              └──────────┬──────────┘
           │                                    │
           └────────────────┬───────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         NLU (nlu.js)                                     │
│                  Procesamiento de Lenguaje Natural                       │
│                                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │    Text     │  │   Unified   │  │   Intent    │  │  Response   │    │
│  │  Corrector  │→ │     AI      │→ │  Resolver   │→ │  Generator  │    │
│  │             │  │  Processor  │  │             │  │             │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
┌─────────────────┐ ┌───────────────┐ ┌─────────────────┐
│  QUERY EXECUTOR │ │ ORDER HANDLER │ │ SESSION MANAGER │
│                 │ │               │ │                 │
│  Consultas BD   │ │ Gestión de    │ │ Estado usuario  │
│  KARDEX API     │ │ pedidos       │ │ Historial       │
└────────┬────────┘ └───────┬───────┘ └────────┬────────┘
         │                  │                  │
         ▼                  ▼                  ▼
┌─────────────────┐ ┌───────────────┐ ┌─────────────────┐
│   KARDEX API    │ │ NOTIFICATIONS │ │    SQLite DB    │
│   (MySQL)       │ │  (WhatsApp)   │ │   (Sesiones)    │
└─────────────────┘ └───────────────┘ └─────────────────┘
```

---

## 📋 Requisitos Previos

### Software Requerido

| Componente | Versión | Descripción |
|------------|---------|-------------|
| Node.js | 18.x o superior | Runtime de JavaScript |
| Python | 3.8 o superior | Para Whisper |
| FFmpeg | Última versión | Procesamiento de audio |
| Ollama | Última versión | IA local (opcional) |

### Instalación de Whisper
```bash
# Instalar OpenAI Whisper
pip3 install openai-whisper

# Verificar instalación
whisper --help
```

### Instalación de FFmpeg

**Windows:**
```bash
# Descargar de https://ffmpeg.org/download.html
# Agregar al PATH del sistema
```

**macOS:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt update && sudo apt install ffmpeg
```

### Instalación de Ollama (Opcional para IA local)
```bash
# Windows/macOS/Linux
curl -fsSL https://ollama.com/install.sh | sh

# Descargar modelo
ollama pull llama3.2
```

---

## 🚀 Instalación

### 1. Clonar el Repositorio
```bash
git clone https://github.com/jomaguevco/medichat.git
cd medichat
```

### 2. Instalar Dependencias
```bash
npm install
```

### 3. Configurar Variables de Entorno
Crear archivo `.env`:
```env
# Servidor
PORT=3001
NODE_ENV=development

# KARDEX API (Sistema de ventas)
KARDEX_API_URL=http://localhost:3000/api
KARDEX_AUTH_TOKEN=tu_token_de_autenticacion

# Base de datos MySQL de KARDEX (opcional)
KARDEX_DB_HOST=localhost
KARDEX_DB_USER=root
KARDEX_DB_PASSWORD=tu_contraseña
KARDEX_DB_NAME=kardex_db

# Whisper (Transcripción de voz)
WHISPER_MODEL=base
WHISPER_LANGUAGE=es
WHISPER_PYTHON_PATH=python3

# Ollama (IA local)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2

# Configuración de pagos
YAPE_NUMBER=987654321
YAPE_NAME=Tu Negocio
PLIN_NUMBER=987654321

# Configuración del bot
WELCOME_MESSAGE=¡Hola! 👋 Soy el asistente virtual de la farmacia.
CONFIRMATION_TIMEOUT=10
TIMEZONE=America/Lima
```

### 4. Iniciar el Bot

**Windows:**
```bash
./iniciar-medichat.bat
```

**Linux/macOS:**
```bash
./iniciar-bot.sh
# o
npm start
```

### 5. Escanear Código QR
1. Espera a que aparezca el QR en la consola
2. Abre WhatsApp > Configuración > Dispositivos vinculados
3. Escanea el código QR
4. ¡El bot está conectado!

---

## ⚙️ Configuración

### Archivo de Configuración Principal
`config/config.js`:

```javascript
module.exports = {
  port: process.env.PORT || 3001,
  
  // Rutas de archivos
  paths: {
    temp: 'temp',
    qr: 'qr',
    data: 'data',
    tokens: 'tokens',
    logs: 'logs'
  },
  
  // Configuración de Whisper
  whisper: {
    model: process.env.WHISPER_MODEL || 'base',
    language: process.env.WHISPER_LANGUAGE || 'es',
    pythonPath: process.env.WHISPER_PYTHON_PATH || 'python3'
  },
  
  // Configuración de Ollama
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'llama3.2'
  },
  
  // Configuración de KARDEX
  kardex: {
    apiUrl: process.env.KARDEX_API_URL,
    authToken: process.env.KARDEX_AUTH_TOKEN
  },
  
  // Configuración de pagos
  payment: {
    yapeNumber: process.env.YAPE_NUMBER,
    yapeName: process.env.YAPE_NAME,
    plinNumber: process.env.PLIN_NUMBER
  },
  
  // Configuración de sesiones
  session: {
    timeout: 10 * 60 * 1000, // 10 minutos
    cleanupInterval: 10 * 60 * 1000
  }
};
```

---

## 📁 Estructura del Proyecto

```
medichat/
├── config/
│   └── config.js                 # Configuración global
├── data/
│   └── chatbot.db                # Base de datos SQLite
├── logs/
│   ├── bot.log                   # Logs generales
│   └── errors.log                # Logs de errores
├── qr/
│   └── qr.png                    # Código QR de conexión
├── src/
│   ├── app.js                    # Servidor Express principal
│   ├── whatsapp-baileys.js       # Cliente de WhatsApp
│   ├── whisper.js                # Transcripción de voz
│   ├── nlu.js                    # Procesamiento de lenguaje natural
│   ├── orderHandler.js           # Gestión de pedidos
│   ├── sessionManager.js         # Gestión de sesiones
│   ├── db.js                     # Base de datos SQLite
│   ├── kardexApi.js              # Cliente API KARDEX
│   ├── kardexDb.js               # Conexión directa MySQL KARDEX
│   ├── aiProcessor.js            # Procesador de pedidos con IA
│   ├── core/                     # Núcleo del sistema
│   │   ├── ai/                   # Módulos de IA
│   │   │   ├── unifiedAIProcessor.js   # Procesador unificado
│   │   │   ├── intentResolver.js       # Resolver de intenciones
│   │   │   ├── intentClassifier.js     # Clasificador de intenciones
│   │   │   ├── queryExecutor.js        # Ejecutor de consultas
│   │   │   ├── responseGenerator.js    # Generador de respuestas
│   │   │   ├── multiModelAI.js         # Soporte multi-modelo
│   │   │   ├── conversationalAI.js     # IA conversacional
│   │   │   ├── textCorrectorAI.js      # Corrector de texto
│   │   │   └── aiCache.js              # Caché de respuestas
│   │   ├── database/             # Base de datos
│   │   │   ├── databaseManager.js      # Gestor de BD
│   │   │   ├── promotionsManager.js    # Promociones
│   │   │   └── schemaVerifier.js       # Verificador de esquema
│   │   ├── errorHandling/        # Manejo de errores
│   │   │   ├── errorRecovery.js        # Recuperación
│   │   │   ├── flowGuard.js            # Guardia de flujo
│   │   │   └── inputValidator.js       # Validador de entrada
│   │   ├── messaging/            # Mensajería
│   │   │   └── messageGenerator.js     # Generador de mensajes
│   │   └── salesFlow/            # Flujo de ventas
│   │       ├── salesFlowEngine.js      # Motor de flujo
│   │       ├── orderValidator.js       # Validador de pedidos
│   │       └── productRecommender.js   # Recomendador
│   ├── services/                 # Servicios externos
│   │   └── smsService.js               # Servicio SMS
│   └── utils/                    # Utilidades
│       ├── audioConverter.js           # Conversión de audio
│       ├── intentDetector.js           # Detector de intenciones
│       ├── logger.js                   # Sistema de logs
│       ├── ollamaClient.js             # Cliente Ollama
│       ├── paymentLinks.js             # Links de pago
│       ├── phoneNormalizer.js          # Normalizador de teléfono
│       ├── phonetics.js                # Algoritmos fonéticos
│       ├── productCache.js             # Caché de productos
│       ├── productMatcher.js           # Matcher de productos
│       ├── productSuggestions.js       # Sugerencias
│       ├── textCorrector.js            # Corrector de texto
│       ├── textParser.js               # Parser de texto
│       └── yapeQR.js                   # Generador QR Yape
├── temp/                         # Archivos temporales
├── tokens/                       # Tokens de sesión WhatsApp
│   └── baileys-session/          # Sesión de Baileys
├── package.json
├── iniciar-medichat.bat          # Script de inicio Windows
├── iniciar-bot.sh                # Script de inicio Linux/Mac
├── README.md                     # Documentación resumida
├── DOCUMENTACION.md              # Esta documentación
└── COMO_PROBAR.md                # Guía de pruebas
```

---

## 🔌 Módulos del Sistema

### 1. WhatsApp Handler (`whatsapp-baileys.js`)
- **Conexión con WhatsApp** usando @whiskeysockets/baileys
- **Manejo de eventos** de mensajes
- **Persistencia de sesión**
- **Envío de mensajes** e imágenes

### 2. Whisper (`whisper.js`)
- **Transcripción de notas de voz**
- **Modelo optimizado** para español
- **Caché de transcripciones**
- **Preprocesamiento** de audio

### 3. NLU (`nlu.js`)
- **Orquestador principal** del procesamiento
- **Corrección de texto** automática
- **Integración con IA** unificada
- **Formato de respuestas** compatible

### 4. Unified AI Processor (`core/ai/unifiedAIProcessor.js`)
- **Procesamiento unificado** de todos los mensajes
- **Pipeline completo**: Intención → Query → Respuesta
- **Delegación a módulos** especializados
- **Manejo de errores** robusto

### 5. Intent Resolver (`core/ai/intentResolver.js`)
- **Clasificación de intenciones** con IA
- **Detección de parámetros** del mensaje
- **Identificación de queries** necesarias
- **Soporte para múltiples idiomas**

### 6. Order Handler (`orderHandler.js`)
- **Gestión del carrito** de compras
- **Validación de productos** y stock
- **Cálculo de totales**
- **Proceso de checkout**

### 7. Session Manager (`sessionManager.js`)
- **Estado por usuario** persistente
- **Historial de conversación**
- **Timeout automático**
- **Limpieza de sesiones** expiradas

---

## 🧠 Procesamiento de IA

### Intenciones Soportadas

| Intención | Descripción | Ejemplo |
|-----------|-------------|---------|
| `SALUDO` | Saludo inicial | "Hola", "Buenos días" |
| `HACER_PEDIDO` | Solicitar productos | "Quiero 2 paracetamol" |
| `VER_CARRITO` | Ver pedido actual | "¿Qué tengo en mi carrito?" |
| `CONFIRMAR_PEDIDO` | Confirmar compra | "Confirmo", "Sí, proceder" |
| `CANCELAR_PEDIDO` | Cancelar pedido | "Cancelar", "No quiero" |
| `VER_CATALOGO` | Ver productos | "¿Qué productos tienen?" |
| `CONSULTAR_PRECIO` | Preguntar precio | "¿Cuánto cuesta el ibuprofeno?" |
| `CONSULTAR_STOCK` | Verificar disponibilidad | "¿Tienen aspirina?" |
| `AYUDA` | Solicitar ayuda | "Ayuda", "¿Qué puedo hacer?" |
| `PAGAR_YAPE` | Pago con Yape | "Quiero pagar con Yape" |
| `PAGAR_PLIN` | Pago con Plin | "Pago Plin" |

### Pipeline de Procesamiento

```
┌─────────────────────────────────────────────────────────────────┐
│                    MENSAJE ENTRANTE                              │
│                "Quiero 2 paracetamol de 500mg"                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│               1. CORRECCIÓN DE TEXTO                             │
│                                                                  │
│   - Normalización de caracteres                                  │
│   - Corrección ortográfica                                       │
│   - Expansión de abreviaturas                                    │
│                                                                  │
│   Resultado: "quiero 2 paracetamol de 500 miligramos"           │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│               2. RESOLUCIÓN DE INTENCIÓN                         │
│                                                                  │
│   - Clasificación con IA/reglas                                  │
│   - Extracción de parámetros                                     │
│   - Determinación de queries necesarias                          │
│                                                                  │
│   Resultado:                                                     │
│   {                                                              │
│     "intencion": "HACER_PEDIDO",                                │
│     "confianza": 0.95,                                          │
│     "parametros": {                                              │
│       "productos": [{"nombre": "paracetamol", "cantidad": 2}],   │
│       "concentracion": "500mg"                                   │
│     },                                                           │
│     "queryNecesaria": "buscar_producto"                         │
│   }                                                              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│               3. EJECUCIÓN DE QUERIES                            │
│                                                                  │
│   - Búsqueda en base de datos KARDEX                            │
│   - Validación de stock                                          │
│   - Obtención de precios                                         │
│                                                                  │
│   Resultado:                                                     │
│   {                                                              │
│     "productos": [{                                              │
│       "id": 123,                                                 │
│       "nombre": "Paracetamol 500mg",                            │
│       "precio": 5.50,                                            │
│       "stock": 50                                                │
│     }]                                                           │
│   }                                                              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│               4. GENERACIÓN DE RESPUESTA                         │
│                                                                  │
│   - Formateo del mensaje                                         │
│   - Inclusión de datos del query                                 │
│   - Añadir botones/opciones                                      │
│                                                                  │
│   Resultado:                                                     │
│   "✅ Agregado al carrito:                                       │
│    • 2x Paracetamol 500mg - S/ 5.50 c/u                         │
│                                                                  │
│    📦 Tu carrito:                                                │
│    Total: S/ 11.00                                               │
│                                                                  │
│    Escribe CONFIRMO para finalizar"                             │
└─────────────────────────────────────────────────────────────────┘
```

### Búsqueda de Productos

El sistema utiliza múltiples técnicas para encontrar productos:

1. **Búsqueda exacta** - Coincidencia directa de nombre
2. **Búsqueda parcial** - Contiene el término
3. **Fuzzy matching** - Tolerancia a errores tipográficos
4. **Búsqueda fonética** - Suena similar (algoritmo Soundex)
5. **Búsqueda semántica** - Significado similar con IA

```javascript
// Ejemplo de fuzzy matching
"paracetamol" → "Paracetamol 500mg"     // 95% similitud
"paracetamlo" → "Paracetamol 500mg"     // 85% similitud (typo)
"dolorcito"   → "Paracetamol 500mg"     // Sugerencia semántica
```

---

## 🔄 Flujo de Conversación

### Flujo de Pedido Completo

```
┌──────────────────────────────────────────────────────────────────────┐
│                           INICIO                                      │
│                                                                       │
│  Usuario: "Hola"                                                      │
│                                                                       │
│  Bot: "👋 ¡Hola! Soy el asistente virtual de la farmacia.            │
│        ¿En qué puedo ayudarte?                                        │
│                                                                       │
│        🛍️ Ver productos: Escribe CATALOGO                            │
│        🛒 Hacer pedido: Dime qué necesitas                            │
│        ❓ Ayuda: Escribe AYUDA"                                        │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      AGREGAR PRODUCTOS                                │
│                                                                       │
│  Usuario: "Quiero 2 paracetamol y 1 ibuprofeno"                       │
│                                                                       │
│  Bot: "✅ Agregado al carrito:                                        │
│        • 2x Paracetamol 500mg - S/ 5.50 c/u                          │
│        • 1x Ibuprofeno 400mg - S/ 8.00 c/u                           │
│                                                                       │
│        📦 Total: S/ 19.00                                             │
│                                                                       │
│        ¿Deseas agregar algo más?                                      │
│        Escribe CONFIRMO para finalizar"                               │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      CONFIRMACIÓN                                     │
│                                                                       │
│  Usuario: "CONFIRMO"                                                  │
│                                                                       │
│  Bot: "🎉 ¡Pedido confirmado!                                         │
│                                                                       │
│        📋 Resumen:                                                    │
│        • 2x Paracetamol 500mg - S/ 11.00                             │
│        • 1x Ibuprofeno 400mg - S/ 8.00                               │
│        ─────────────────────                                          │
│        💰 Total: S/ 19.00                                             │
│                                                                       │
│        💳 ¿Cómo deseas pagar?                                         │
│        • Escribe YAPE para pagar con Yape                             │
│        • Escribe PLIN para pagar con Plin"                            │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                           PAGO                                        │
│                                                                       │
│  Usuario: "YAPE"                                                      │
│                                                                       │
│  Bot: "📱 Pago con Yape                                               │
│                                                                       │
│        Monto: S/ 19.00                                                │
│        Número: 987654321                                              │
│        Nombre: Tu Negocio                                             │
│                                                                       │
│        [Imagen QR de Yape]                                            │
│                                                                       │
│        Cuando realices el pago, envía una captura                     │
│        o escribe PAGADO"                                              │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       FINALIZACIÓN                                    │
│                                                                       │
│  Usuario: "PAGADO"                                                    │
│                                                                       │
│  Bot: "✅ ¡Gracias por tu compra!                                     │
│                                                                       │
│        Tu pedido #1234 ha sido registrado.                            │
│        Un vendedor se comunicará contigo pronto.                      │
│                                                                       │
│        📞 Si tienes dudas, escribe AYUDA                              │
│        ¡Hasta pronto! 👋"                                              │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 🔗 API REST

El bot expone endpoints para integración externa:

### Health Check
```http
GET /health
```
**Respuesta:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-25T10:00:00Z",
  "uptime": 3600,
  "whatsapp": "connected",
  "database": "connected",
  "handlersConfigured": true
}
```

### Enviar Mensaje
```http
POST /test-send-message
Content-Type: application/json

{
  "phoneNumber": "51987654321",
  "message": "Hola, tu pedido está listo"
}
```

### Enviar Imagen
```http
POST /send-image
Content-Type: application/json

{
  "phoneNumber": "51987654321",
  "imageBase64": "iVBORw0KGgoAAAANSU...",
  "filename": "qr.png",
  "caption": "Escanea este QR"
}
```

### Webchat (Portal Web)
```http
POST /webchat/message
Content-Type: application/json

{
  "sessionId": "web_user_123",
  "text": "Quiero ver el catálogo"
}
```

### Debug Ollama
```http
GET /debug/ollama
```
**Respuesta:**
```json
{
  "ollamaAvailable": true,
  "modelAvailable": true,
  "model": "llama3.2",
  "timestamp": "2025-11-25T10:00:00Z"
}
```

---

## 🔗 Integración con KARDEX

### Conexión API REST

El bot se conecta a KARDEX mediante la API REST:

```javascript
// Buscar productos
GET /api/productos?q=paracetamol

// Obtener producto
GET /api/productos/123

// Verificar stock
GET /api/productos/123/stock

// Notificar pedido
POST /api/notificaciones/whatsapp
{
  "tipo": "nuevo_pedido",
  "pedido": {...},
  "cliente": {...}
}
```

### Conexión Directa MySQL (Opcional)

Para mejor rendimiento, puede conectarse directamente:

```javascript
// kardexDb.js
const pool = mysql.createPool({
  host: process.env.KARDEX_DB_HOST,
  user: process.env.KARDEX_DB_USER,
  password: process.env.KARDEX_DB_PASSWORD,
  database: process.env.KARDEX_DB_NAME
});

// Búsqueda de productos
const [productos] = await pool.execute(`
  SELECT id, nombre, precio, stock 
  FROM productos 
  WHERE nombre LIKE ? AND stock > 0
`, [`%${termino}%`]);
```

---

## 🎮 Comandos del Bot

| Comando | Acción |
|---------|--------|
| `HOLA` / `INICIO` | Mensaje de bienvenida |
| `CATALOGO` / `PRODUCTOS` | Ver productos disponibles |
| `CARRITO` / `ESTADO` | Ver carrito actual |
| `CONFIRMO` / `SÍ` | Confirmar pedido |
| `CANCELAR` / `NO` | Cancelar pedido |
| `YAPE` | Pagar con Yape |
| `PLIN` | Pagar con Plin |
| `PAGADO` | Confirmar pago realizado |
| `AYUDA` | Mostrar opciones de ayuda |

---

## 🚀 Despliegue

### PM2 (Producción Local)
```bash
# Instalar PM2
npm install -g pm2

# Iniciar bot
pm2 start src/app.js --name medichat

# Ver logs
pm2 logs medichat

# Reiniciar
pm2 restart medichat

# Detener
pm2 stop medichat

# Configurar auto-inicio
pm2 startup
pm2 save
```

### Docker
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install --production

COPY . .

# Instalar dependencias de Python y FFmpeg
RUN apk add --no-cache python3 py3-pip ffmpeg
RUN pip3 install openai-whisper

EXPOSE 3001

CMD ["npm", "start"]
```

```bash
# Construir imagen
docker build -t medichat .

# Ejecutar
docker run -d -p 3001:3001 --name medichat medichat
```

---

## 🐛 Troubleshooting

### El QR no aparece
```bash
# Eliminar sesión anterior
rm -rf tokens/baileys-session/

# En Windows
rmdir /s /q tokens\baileys-session

# Reiniciar bot
npm start
```

### Error "Not Logged"
- El bot necesita reconectar con WhatsApp
- Eliminar sesión y escanear nuevo QR
- Verificar que WhatsApp Web no esté activo en otro lugar

### Whisper no funciona
```bash
# Verificar instalación
whisper --help

# Verificar FFmpeg
ffmpeg -version

# Reinstalar Whisper
pip3 install --upgrade openai-whisper
```

### Ollama no disponible
```bash
# Verificar servicio
curl http://localhost:11434/api/tags

# Iniciar Ollama
ollama serve

# Verificar modelo
ollama list
```

### Error de conexión a KARDEX
```bash
# Verificar API
curl http://localhost:3000/api/health

# Verificar token en .env
echo $KARDEX_AUTH_TOKEN

# Verificar MySQL
mysql -u root -p kardex_db -e "SELECT 1"
```

### Alta latencia en respuestas
- Reducir tamaño del modelo Whisper (base → tiny)
- Usar modelo Ollama más pequeño
- Implementar caché de respuestas
- Verificar conexión a internet

---

## 📊 Métricas y Logs

### Ubicación de Logs
```
logs/
├── bot.log        # Logs generales
└── errors.log     # Solo errores
```

### Formato de Logs
```
[2025-11-25 10:00:00] INFO: Mensaje recibido de 51987654321
[2025-11-25 10:00:01] INFO: Intención detectada: HACER_PEDIDO (0.95)
[2025-11-25 10:00:02] SUCCESS: Respuesta enviada a 51987654321
```

### Endpoint de Debug
```http
GET /debug-status
```

---

## 📧 Soporte

- **Repositorio:** https://github.com/jomaguevco/medichat
- **Issues:** Reportar problemas en GitHub
- **Desarrollador:** Jose Mariano Guevara Cotrina

---

## 📄 Licencia

MIT License - Uso libre para proyectos personales y comerciales.

---

**Desarrollado con ❤️ para farmacias y negocios**

