# 🎯 PLAN DE MEJORA DETALLADO - CHATDEX

**Fecha de inicio:** ${new Date().toLocaleDateString('es-PE')}  
**Versión objetivo:** 2.0.0  
**Estimado:** 9 semanas

---

## 📋 RESUMEN EJECUTIVO

Este plan detalla las mejoras necesarias para transformar ChatDex de un chatbot funcional a uno de **clase empresarial** con:
- ✅ Interactividad completa (botones, respuestas rápidas)
- ✅ Validación automática de pagos
- ✅ Experiencia de usuario mejorada
- ✅ Sistema robusto de manejo de errores
- ✅ Analytics y reportes en tiempo real

---

## 🔴 FASE 1: MEJORAS CRÍTICAS (Semanas 1-3)

### 📅 SEMANA 1: Validaciones y Flujos Mejorados

#### Día 1-2: Refactorizar Flujo Inicial

**Problema:** El bot pregunta siempre si es cliente, incluso cuando ya está autenticado.

**Solución:**
1. Crear sistema de "recuerdos" de clientes frecuentes
2. Guardar último estado de autenticación por número
3. Saltar flujo de confirmación para clientes conocidos

**Archivos a modificar:**
- `src/whatsapp-baileys.js` (líneas 1216-1229)
- `src/sessionManager.js` (agregar método `rememberClient`)
- `src/db.js` (crear tabla `client_memories`)

**Código a implementar:**
```javascript
// src/sessionManager.js
async rememberClient(phoneNumber, clientId) {
  await db.run(
    `INSERT INTO client_memories (phone_number, client_id, last_seen, times_seen) 
     VALUES (?, ?, datetime("now"), 1)
     ON CONFLICT(phone_number) DO UPDATE SET 
     last_seen = datetime("now"), 
     times_seen = times_seen + 1`,
    [phoneNumber, clientId]
  );
}

async isFrequentClient(phoneNumber) {
  const memory = await db.get(
    `SELECT * FROM client_memories WHERE phone_number = ?`,
    [phoneNumber]
  );
  return memory && memory.times_seen >= 3;
}
```

**Tareas:**
- [ ] Crear tabla `client_memories` en base de datos
- [ ] Implementar método `rememberClient` en `sessionManager`
- [ ] Modificar flujo inicial para verificar si es cliente frecuente
- [ ] Agregar opción de "olvidar" cliente (para pruebas)
- [ ] Testear con múltiples interacciones

#### Día 3-4: Mejorar Validación de Stock

**Problema:** El stock se verifica al agregar pero no al confirmar (puede haber cambiado).

**Solución:**
1. Verificar stock en tiempo real al confirmar pedido
2. Mostrar alerta si algún producto quedó sin stock
3. Ofrecer alternativas automáticamente

**Archivos a modificar:**
- `src/orderHandler.js` (método `confirmOrder`)
- `src/kardexApi.js` (agregar método `verifyStockInRealTime`)

**Código a implementar:**
```javascript
// src/orderHandler.js - confirmOrder
async confirmOrder(phoneNumber, whatsappHandler, sessionState) {
  // ... código existente ...
  
  // NUEVO: Verificar stock en tiempo real
  const stockCheck = await this.verifyAllProductsStock(pedido.productos);
  
  if (!stockCheck.allAvailable) {
    await whatsappHandler.sendMessage(phoneNumber,
      `⚠️ *Alerta de Stock*\n\n` +
      `Algunos productos ya no tienen stock suficiente:\n\n` +
      stockCheck.unavailable.map(p => 
        `• ${p.nombre}: Solicitado ${p.cantidad}, Disponible ${p.stock}`
      ).join('\n') +
      `\n\n💡 ¿Deseas continuar con los productos disponibles o modificar tu pedido?`
    );
    
    // Mostrar botones: "Continuar" | "Modificar"
    return;
  }
  
  // ... resto del código ...
}
```

**Tareas:**
- [ ] Crear método `verifyAllProductsStock` en `orderHandler`
- [ ] Modificar `confirmOrder` para verificar stock
- [ ] Implementar lógica de actualización de cantidades si falta stock
- [ ] Agregar mensajes informativos para el usuario
- [ ] Testear con productos que cambian de stock

#### Día 5: Validaciones Mejoradas (DNI, Email, Teléfono)

**Problema:** Validaciones básicas, no verifican autenticidad.

**Solución:**
1. Validar DNI con algoritmo de verificación
2. Validar email con verificación de dominio
3. Validar teléfono verificando si existe en BD

**Archivos a crear:**
- `src/utils/dniValidator.js` (nuevo)
- `src/utils/emailValidator.js` (nuevo)

**Código a implementar:**
```javascript
// src/utils/dniValidator.js
function validateDNI(dni) {
  // Validar formato (8 dígitos)
  if (!/^\d{8}$/.test(dni)) {
    return { valid: false, error: 'DNI debe tener 8 dígitos' };
  }
  
  // Algoritmo de verificación de DNI peruano
  const multipliers = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  
  for (let i = 0; i < 8; i++) {
    sum += parseInt(dni[i]) * multipliers[i + 2];
  }
  
  const remainder = sum % 11;
  const checkDigit = remainder < 2 ? remainder : 11 - remainder;
  
  return { valid: true, checkDigit };
}
```

**Tareas:**
- [ ] Implementar validador de DNI
- [ ] Implementar validador de email mejorado
- [ ] Integrar validaciones en flujos de registro
- [ ] Agregar mensajes de error descriptivos
- [ ] Testear con datos válidos e inválidos

---

### 📅 SEMANA 2: Interactividad con Botones

#### Día 1-2: Implementar Botones Interactivos de WhatsApp

**Problema:** Todo es texto, no hay botones para mejorar UX.

**Solución:**
1. Implementar API de botones de Baileys
2. Crear sistema de plantillas de mensajes con botones
3. Agregar botones en flujos clave

**Archivos a crear:**
- `src/utils/whatsappButtons.js` (nuevo)
- `src/utils/messageTemplates.js` (nuevo)

**Código a implementar:**
```javascript
// src/utils/whatsappButtons.js
class WhatsAppButtons {
  static async sendButtons(whatsappHandler, phoneNumber, text, buttons) {
    const buttonRows = buttons.map(button => ({
      title: button.title,
      id: button.id
    }));
    
    await whatsappHandler.sock.sendMessage(
      phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`,
      {
        text: text,
        footer: 'Selecciona una opción:',
        buttons: buttonRows,
        headerType: 1
      }
    );
  }
  
  static createConfirmationButtons() {
    return [
      { title: '✅ Confirmar', id: 'confirm_yes' },
      { title: '❌ Cancelar', id: 'confirm_no' }
    ];
  }
  
  static createPaymentButtons() {
    return [
      { title: '💳 Yape', id: 'payment_yape' },
      { title: '💳 Plin', id: 'payment_plin' },
      { title: '❌ Cancelar', id: 'payment_cancel' }
    ];
  }
}
```

**Tareas:**
- [ ] Investigar API de botones de Baileys
- [ ] Crear utilidad `whatsappButtons.js`
- [ ] Implementar envío de botones
- [ ] Manejar eventos de clicks de botones
- [ ] Integrar en flujos de confirmación

#### Día 3-4: Respuestas Rápidas (Quick Replies)

**Problema:** Usuario tiene que escribir respuestas manualmente.

**Solución:**
1. Implementar respuestas rápidas para confirmaciones
2. Crear sistema de respuestas predefinidas
3. Agregar en flujos comunes

**Código a implementar:**
```javascript
// src/utils/messageTemplates.js
static createQuickReply(text, quickReplies) {
  return {
    text: text,
    contextInfo: {
      quotedMessage: {
        conversation: text
      }
    },
    footer: 'Selecciona una opción rápida:',
    buttons: quickReplies.map(reply => ({
      buttonId: reply.id,
      buttonText: { displayText: reply.text },
      type: 1
    }))
  };
}
```

**Tareas:**
- [ ] Implementar sistema de respuestas rápidas
- [ ] Agregar respuestas rápidas para confirmaciones
- [ ] Agregar respuestas rápidas para pagos
- [ ] Integrar en flujos principales
- [ ] Testear interacción con botones

#### Día 5: Carrusel de Productos

**Problema:** Catálogo es solo texto, difícil de navegar.

**Solución:**
1. Crear carrusel de productos para catálogo
2. Mostrar productos con imágenes (si disponibles)
3. Agregar botones de "Agregar" en cada producto

**Tareas:**
- [ ] Investigar API de carrusel de Baileys
- [ ] Crear función para generar carrusel
- [ ] Integrar con búsqueda de productos
- [ ] Agregar imágenes de productos
- [ ] Testear navegación

---

### 📅 SEMANA 3: Sistema de Pagos Mejorado

#### Día 1-2: Códigos de Pago Únicos

**Problema:** No hay forma de identificar pagos automáticamente.

**Solución:**
1. Generar código único por pedido
2. Asociar código con monto esperado
3. Permitir confirmación de pago con código

**Archivos a crear:**
- `src/services/paymentCodeService.js` (nuevo)

**Código a implementar:**
```javascript
// src/services/paymentCodeService.js
class PaymentCodeService {
  static generateCode(pedidoId, monto) {
    // Generar código único: PED-{pedidoId}-{timestamp}
    const timestamp = Date.now().toString(36).toUpperCase();
    const code = `PED-${pedidoId}-${timestamp.substring(0, 6)}`;
    
    return {
      code,
      pedidoId,
      monto,
      expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 horas
    };
  }
  
  static async saveCode(codeData) {
    await db.run(
      `INSERT INTO payment_codes (code, pedido_id, monto, expires_at) 
       VALUES (?, ?, ?, ?)`,
      [codeData.code, codeData.pedidoId, codeData.monto, codeData.expiresAt]
    );
  }
}
```

**Tareas:**
- [ ] Crear tabla `payment_codes` en BD
- [ ] Implementar generación de códigos
- [ ] Integrar en flujo de confirmación de pedido
- [ ] Mostrar código en mensaje de pago
- [ ] Testear generación y verificación

#### Día 3-4: Integración con API de Yape/Plin (si disponible)

**Problema:** No se verifican pagos automáticamente.

**Solución:**
1. Investigar APIs de Yape/Plin disponibles
2. Implementar verificación automática si existe API
3. Crear sistema de polling o webhooks

**Tareas:**
- [ ] Investigar APIs disponibles de Yape/Plin
- [ ] Implementar verificación si existe API pública
- [ ] Crear sistema de verificación manual como fallback
- [ ] Agregar timeout de espera de pago
- [ ] Implementar recordatorios

#### Día 5: Verificación de Pagos con OCR

**Problema:** Usuario tiene que confirmar manualmente.

**Solución:**
1. Permitir subir captura de comprobante
2. Usar OCR para extraer monto y código
3. Verificar automáticamente

**Archivos a crear:**
- `src/utils/ocrService.js` (nuevo)

**Tareas:**
- [ ] Investigar librerías de OCR (Tesseract.js)
- [ ] Implementar procesamiento de imágenes
- [ ] Extraer monto y referencia del comprobante
- [ ] Verificar contra código de pago
- [ ] Testear con comprobantes reales

---

## 🟡 FASE 2: MEJORAS IMPORTANTES (Semanas 4-6)

### 📅 SEMANA 4: Experiencia de Usuario

#### Día 1-2: Carrito Persistente

**Tareas:**
- [ ] Guardar carrito en BD
- [ ] Recuperar carrito al iniciar sesión
- [ ] Sincronizar carrito entre sesiones
- [ ] Agregar comando "Recuperar mi carrito"

#### Día 3-4: Sistema de Favoritos

**Tareas:**
- [ ] Crear tabla `favorites` en BD
- [ ] Implementar guardar/eliminar favoritos
- [ ] Mostrar favoritos en comando especial
- [ ] Agregar botón "Agregar a favoritos" en productos

#### Día 5: Modo "Continuar Comprando"

**Tareas:**
- [ ] Agregar opción después de confirmar pedido
- [ ] Mantener carrito activo
- [ ] Permitir agregar más productos
- [ ] Mejorar flujo de navegación

---

### 📅 SEMANA 5: Seguimiento de Pedidos

#### Día 1-3: Sistema de Estados de Pedido

**Tareas:**
- [ ] Definir estados: Pendiente, Confirmado, Preparando, En camino, Entregado
- [ ] Crear tabla de estados en BD
- [ ] Implementar actualización de estados
- [ ] Notificar cambios de estado al cliente
- [ ] Agregar comando "Estado de mi pedido"

#### Día 4-5: Reprogramación de Entregas

**Tareas:**
- [ ] Permitir cambiar fecha/hora de entrega
- [ ] Validar disponibilidad de nuevos horarios
- [ ] Notificar cambios a administradores
- [ ] Agregar botones de reprogramación

---

### 📅 SEMANA 6: Multimodalidad

#### Día 1-2: Procesamiento de Imágenes

**Tareas:**
- [ ] Implementar recepción de imágenes
- [ ] Crear sistema de búsqueda por imagen (si posible)
- [ ] Procesar comprobantes de pago
- [ ] Agregar OCR para códigos QR

#### Día 3-5: Envío de Imágenes de Productos

**Tareas:**
- [ ] Integrar imágenes de productos desde KARDEX
- [ ] Enviar imágenes al mostrar catálogo
- [ ] Crear carrusel con imágenes
- [ ] Optimizar imágenes para WhatsApp

---

## 🟢 FASE 3: MEJORAS AVANZADAS (Semanas 7-9)

### 📅 SEMANA 7: Analytics y Reportes

#### Día 1-3: Sistema de Métricas

**Tareas:**
- [ ] Crear tabla de métricas en BD
- [ ] Implementar tracking de eventos
- [ ] Crear dashboard básico
- [ ] Generar reportes diarios

#### Día 4-5: Análisis de Conversaciones

**Tareas:**
- [ ] Guardar todas las conversaciones
- [ ] Implementar análisis de sentimiento
- [ ] Identificar intenciones más comunes
- [ ] Crear reportes de satisfacción

---

### 📅 SEMANA 8: IA Avanzada

#### Día 1-3: Fine-tuning de Modelos

**Tareas:**
- [ ] Recopilar datos de conversaciones
- [ ] Preparar dataset para fine-tuning
- [ ] Fine-tunear modelo DistilBERT para español peruano
- [ ] Integrar modelo mejorado

#### Día 4-5: Recomendaciones Inteligentes

**Tareas:**
- [ ] Implementar sistema de recomendaciones
- [ ] Basado en historial de compras
- [ ] Basado en productos similares
- [ ] Integrar en flujos de navegación

---

### 📅 SEMANA 9: Seguridad y Optimización

#### Día 1-2: Rate Limiting

**Tareas:**
- [ ] Implementar rate limiting por usuario
- [ ] Agregar protección contra spam
- [ ] Crear sistema de bloqueo temporal
- [ ] Integrar con Redis (si disponible)

#### Día 3-5: Optimización y Testing

**Tareas:**
- [ ] Optimizar queries de BD
- [ ] Implementar cache para productos
- [ ] Testear todos los flujos
- [ ] Preparar documentación final

---

## 📊 SEGUIMIENTO Y MÉTRICAS

### Dashboard de Progreso

Crear archivo `PROGRESO.md` para trackear:

```markdown
# 📊 Progreso de Mejoras

## Fase 1: Mejoras Críticas (Semanas 1-3)
- [ ] Semana 1: Validaciones (0%)
- [ ] Semana 2: Interactividad (0%)
- [ ] Semana 3: Pagos (0%)

## Fase 2: Mejoras Importantes (Semanas 4-6)
- [ ] Semana 4: UX (0%)
- [ ] Semana 5: Seguimiento (0%)
- [ ] Semana 6: Multimodalidad (0%)

## Fase 3: Mejoras Avanzadas (Semanas 7-9)
- [ ] Semana 7: Analytics (0%)
- [ ] Semana 8: IA (0%)
- [ ] Semana 9: Seguridad (0%)
```

---

## 🎯 OBJETIVOS FINALES

Al finalizar este plan, el chatbot debería:

✅ Tener interactividad completa con botones  
✅ Validar pagos automáticamente (cuando sea posible)  
✅ Ofrecer experiencia de usuario mejorada  
✅ Tener sistema robusto de seguimiento de pedidos  
✅ Procesar múltiples tipos de contenido  
✅ Tener analytics y reportes en tiempo real  
✅ Ser más inteligente con IA mejorada  
✅ Estar protegido contra abusos  

---

## 📝 NOTAS DE IMPLEMENTACIÓN

### Prioridades
1. **CRÍTICO:** Fase 1 completa antes de pasar a Fase 2
2. **IMPORTANTE:** Fase 2 puede iniciarse paralelamente a Fase 1 si hay recursos
3. **NICE TO HAVE:** Fase 3 puede posponerse si hay problemas en Fases anteriores

### Recursos Necesarios
- ✅ Desarrollador full-time (9 semanas)
- ✅ Acceso a APIs de pago (investigar disponibilidad)
- ✅ Base de datos mejorada (PostgreSQL recomendado para analytics)
- ✅ Servidor de desarrollo y testing

### Riesgos
- ⚠️ APIs de Yape/Plin pueden no estar disponibles públicamente
- ⚠️ Fine-tuning de modelos requiere datos y recursos
- ⚠️ WhatsApp puede cambiar APIs (mantener actualizado)

---

**Última actualización:** ${new Date().toLocaleDateString('es-PE')}

