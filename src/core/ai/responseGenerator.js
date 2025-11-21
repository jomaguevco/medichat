const multiModelAI = require('./multiModelAI');
const logger = require('../../utils/logger');
const productSuggestions = require('../../utils/productSuggestions');
const aiCache = require('./aiCache');

/**
 * Generador de Respuestas con IA
 * 
 * Genera respuestas completas usando IA.
 * Recibe datos de QueryExecutor y formatea respuesta natural y contextual.
 * Soporta Markdown para WhatsApp y personaliza según historial del usuario.
 */
class ResponseGenerator {
  constructor() {
    this.baseSystemPrompt = `Eres un asistente de ventas amigable, profesional y muy útil de KARDEX.
Genera respuestas naturales, conversacionales y útiles.

FORMATO:
- Usa Markdown para WhatsApp (negritas con *, listas con •, emojis apropiados)
- Sé claro, conciso y amigable
- Personaliza según el contexto del usuario
- Incluye sugerencias útiles cuando sea apropiado
- Usa emojis de forma moderada y apropiada

ESTILO:
- Conversacional y natural
- Profesional pero cercano
- Útil y orientado a ayudar
- Optimista y positivo

Responde SOLO con el texto de la respuesta, sin JSON, sin explicaciones adicionales.`;
  }

  /**
   * Generar respuesta según intención y datos
   */
  async generate(intent, data, context = {}) {
    try {
      const { sessionState = {}, conversationHistory = [], isFromVoice = false } = context;
      const intencion = intent.intencion || intent.intent || 'OTRO';

      // Si hay acción que no requiere respuesta generada, retornar null
      const actionOnlyIntents = ['CONFIRMAR_PEDIDO', 'CANCELAR_PEDIDO'];
      if (intent.action && actionOnlyIntents.includes(intencion)) {
        logger.info('Intención con acción directa, no genera respuesta');
        return {
          text: null,
          data: data,
          buttons: null
        };
      }

      // Construir prompt específico según intención
      const prompt = this._buildPrompt(intent, data, context);
      
      // Si no hay prompt (ya se retornó), no generar respuesta
      if (!prompt) {
        return {
          text: null,
          data: data,
          buttons: null
        };
      }

      const systemPrompt = this._buildSystemPrompt(intent, context);

      logger.info('Generando respuesta', {
        intencion: intencion,
        hasData: !!data,
        dataLength: Array.isArray(data) ? data.length : (data ? 1 : 0)
      });

      // Verificar cache de respuestas (solo para consultas comunes)
      const cacheableIntents = ['VER_CATALOGO', 'AYUDA', 'SALUDO'];
      let cacheKey = null;
      if (cacheableIntents.includes(intencion)) {
        const crypto = require('crypto');
        const textHash = crypto.createHash('md5').update(prompt.substring(0, 200)).digest('hex');
        cacheKey = `response:${intencion}:${textHash.substring(0, 16)}`;
        const cached = aiCache.getResponse(cacheKey);
        if (cached) {
          return {
            text: cached.text,
            data: data,
            buttons: cached.buttons
          };
        }
      }

      // Usar modelo de conversación para respuestas
      const response = await multiModelAI.generate(
        prompt,
        systemPrompt,
        'conversation',
        { temperature: 0.5 }
      );

      const result = {
        text: response.trim(),
        data: data,
        buttons: this._generateButtons(intent, data, context)
      };

      // Guardar en cache si aplica
      if (cacheKey && result.text) {
        aiCache.setResponse(cacheKey, {
          text: result.text,
          buttons: result.buttons
        });
      }

      return result;
    } catch (error) {
      logger.error('Error al generar respuesta', error);
      // Fallback a respuesta básica
      return this._generateFallbackResponse(intent, data, context);
    }
  }

  /**
   * Construir prompt según intención
   */
  _buildPrompt(intent, data, context) {
    const { sessionState = {} } = context;
    const intencion = intent.intencion;

    let prompt = '';

    switch (intencion) {
      case 'VER_CATALOGO':
        prompt = this._buildCatalogPrompt(data, sessionState);
        break;

      case 'CONSULTAR_PRECIO':
        prompt = this._buildPricePrompt(intent, data, sessionState);
        break;

      case 'CONSULTAR_STOCK':
        prompt = this._buildStockPrompt(intent, data, sessionState);
        break;

      case 'BUSCAR_PRODUCTOS':
        prompt = this._buildSearchPrompt(intent, data, sessionState);
        break;

      case 'VER_PEDIDO':
        prompt = this._buildOrderPrompt(data, sessionState);
        break;

      case 'CONFIRMAR_PEDIDO':
      case 'CANCELAR_PEDIDO':
        // Estas acciones son manejadas directamente por handlers
        // No generamos respuesta aquí
        return null;

      case 'AYUDA':
        prompt = this._buildHelpPrompt(sessionState);
        break;

      case 'SALUDO':
        prompt = this._buildGreetingPrompt(sessionState);
        break;

      case 'HACER_PEDIDO':
        // Los pedidos son manejados por aiProcessor existente
        prompt = this._buildOrderIntentPrompt(intent, sessionState);
        break;

      default:
        prompt = this._buildGenericPrompt(intent, data, sessionState);
    }

    return prompt || null;
  }

  /**
   * Construir system prompt específico
   */
  _buildSystemPrompt(intent, context) {
    const { sessionState = {}, conversationHistory = [] } = context;
    
    let contextInfo = '';

    if (sessionState.state) {
      contextInfo += `- Estado actual: ${sessionState.state}\n`;
    }
    if (sessionState._authenticated) {
      contextInfo += `- Es cliente registrado: Sí\n`;
      if (sessionState._client_name) {
        contextInfo += `- Nombre del cliente: ${sessionState._client_name}\n`;
      }
    }
    if (conversationHistory.length > 0) {
      contextInfo += `- Conversación anterior disponible\n`;
    }

    return `${this.baseSystemPrompt}\n\nCONTEXTO DEL USUARIO:\n${contextInfo || '- Sin contexto adicional'}`;
  }

  /**
   * Prompt para catálogo
   */
  _buildCatalogPrompt(productos, sessionState) {
    let prompt = `Genera una respuesta mostrando el catálogo de productos de KARDEX.\n\n`;
    
    if (productos && productos.length > 0) {
      prompt += `PRODUCTOS DISPONIBLES (${productos.length} productos):\n\n`;
      productos.slice(0, 20).forEach((p, idx) => {
        const precio = parseFloat(p.precio_venta || 0).toFixed(2);
        const stock = (p.stock_actual || 0) > 0 ? '✅' : '❌';
        prompt += `${idx + 1}. ${p.nombre} - S/ ${precio} ${stock}\n`;
      });
      
      if (productos.length > 20) {
        prompt += `\n... y ${productos.length - 20} productos más\n`;
      }
      
      prompt += `\nGenera una respuesta atractiva con formato Markdown para WhatsApp, incluyendo:\n`;
      prompt += `- Título destacado con emoji\n`;
      prompt += `- Lista de productos con precios y disponibilidad\n`;
      prompt += `- Instrucciones de cómo pedir o ver más detalles\n`;
      prompt += `- Sugerencias útiles (filtros, búsqueda, etc.)\n`;
    } else {
      prompt += `No hay productos disponibles en este momento.\n\n`;
      prompt += `Genera una respuesta amigable informando esto y sugiriendo contactar más tarde.`;
    }
    
    return prompt;
  }

  /**
   * Prompt para consulta de precio
   */
  _buildPricePrompt(intent, productos, sessionState) {
    const productoNombre = intent.parametros?.producto || 'producto';
    
    let prompt = `El usuario pregunta por el precio de: "${productoNombre}"\n\n`;
    
    if (productos && productos.length > 0) {
      const producto = productos[0];
      const precio = parseFloat(producto.precio_venta || 0).toFixed(2);
      const stock = (producto.stock_actual || 0) > 0;
      const stockTexto = stock ? `${producto.stock_actual} unidades` : 'agotado';
      
      prompt += `PRODUCTO ENCONTRADO:\n`;
      prompt += `- Nombre: ${producto.nombre}\n`;
      prompt += `- Precio: S/ ${precio}\n`;
      prompt += `- Stock: ${stockTexto}\n`;
      
      if (productos.length > 1) {
        prompt += `\nPRODUCTOS SIMILARES ENCONTRADOS (${productos.length - 1} más):\n`;
        productos.slice(1, 4).forEach((p, idx) => {
          const p_precio = parseFloat(p.precio_venta || 0).toFixed(2);
          prompt += `${idx + 2}. ${p.nombre} - S/ ${p_precio}\n`;
        });
      }
      
      prompt += `\nGenera una respuesta clara y amigable con:\n`;
      prompt += `- Precio destacado\n`;
      prompt += `- Información de stock\n`;
      prompt += `- Cómo hacer pedido\n`;
      if (productos.length > 1) {
        prompt += `- Mencionar productos similares disponibles\n`;
      }
    } else {
      prompt += `No se encontró el producto "${productoNombre}".\n\n`;
      prompt += `Genera una respuesta amigable informando esto y sugiriendo:\n`;
      prompt += `- Verificar el nombre\n`;
      prompt += `- Ver el catálogo completo\n`;
      prompt += `- Buscar con otros términos`;
    }
    
    return prompt;
  }

  /**
   * Prompt para consulta de stock
   */
  _buildStockPrompt(intent, productos, sessionState) {
    const productoNombre = intent.parametros?.producto || 'producto';
    
    let prompt = `El usuario pregunta por la disponibilidad de: "${productoNombre}"\n\n`;
    
    if (productos && productos.length > 0) {
      const producto = productos[0];
      const stock = (producto.stock_actual || 0);
      const precio = parseFloat(producto.precio_venta || 0).toFixed(2);
      
      prompt += `PRODUCTO ENCONTRADO:\n`;
      prompt += `- Nombre: ${producto.nombre}\n`;
      prompt += `- Stock disponible: ${stock} unidades\n`;
      prompt += `- Precio: S/ ${precio}\n`;
      
      prompt += `\nGenera una respuesta clara indicando:\n`;
      if (stock > 0) {
        prompt += `- Disponibilidad confirmada\n`;
        prompt += `- Cantidad disponible\n`;
        prompt += `- Cómo hacer pedido\n`;
      } else {
        prompt += `- Producto agotado\n`;
        prompt += `- Sugerir productos similares disponibles\n`;
      }
    } else {
      prompt += `No se encontró el producto "${productoNombre}".\n\n`;
      prompt += `Genera una respuesta amigable informando esto y sugiriendo ver el catálogo.`;
    }
    
    return prompt;
  }

  /**
   * Prompt para búsqueda de productos
   */
  _buildSearchPrompt(intent, productos, sessionState) {
    const termino = intent.parametros?.termino || '';
    const filtros = intent.parametros?.filtros || {};
    
    let prompt = `El usuario busca productos con término: "${termino}"\n\n`;
    
    if (filtros.precioMaximo) {
      prompt += `Filtro: Precio máximo S/ ${filtros.precioMaximo}\n`;
    }
    if (filtros.soloDisponibles) {
      prompt += `Filtro: Solo productos disponibles\n`;
    }
    prompt += `\n`;
    
    if (productos && productos.length > 0) {
      prompt += `PRODUCTOS ENCONTRADOS (${productos.length}):\n\n`;
      productos.slice(0, 15).forEach((p, idx) => {
        const precio = parseFloat(p.precio_venta || 0).toFixed(2);
        const stock = (p.stock_actual || 0) > 0 ? '✅' : '❌';
        prompt += `${idx + 1}. ${p.nombre} - S/ ${precio} ${stock}\n`;
      });
      
      prompt += `\nGenera una respuesta con:\n`;
      prompt += `- Cantidad de resultados\n`;
      prompt += `- Lista de productos encontrados\n`;
      prompt += `- Cómo hacer pedido o ver más detalles\n`;
    } else {
      prompt += `No se encontraron productos con esos criterios.\n\n`;
      prompt += `Genera una respuesta amigable sugiriendo:\n`;
      prompt += `- Modificar términos de búsqueda\n`;
      prompt += `- Ver el catálogo completo\n`;
      prompt += `- Intentar con otros filtros`;
    }
    
    return prompt;
  }

  /**
   * Prompt para ver pedido
   */
  _buildOrderPrompt(pedido, sessionState) {
    let prompt = `El usuario quiere ver su pedido actual.\n\n`;
    
    if (pedido && pedido.detalles && pedido.detalles.length > 0) {
      prompt += `PEDIDO ACTUAL:\n`;
      prompt += `- Número: ${pedido.numero_pedido || 'En proceso'}\n`;
      prompt += `- Total: S/ ${parseFloat(pedido.total || 0).toFixed(2)}\n\n`;
      prompt += `PRODUCTOS:\n`;
      pedido.detalles.forEach((det, idx) => {
        const producto = det.producto || {};
        const subtotal = parseFloat(det.subtotal || 0).toFixed(2);
        prompt += `${idx + 1}. ${producto.nombre || 'Producto'} x${det.cantidad} = S/ ${subtotal}\n`;
      });
      
      prompt += `\nGenera una respuesta con:\n`;
      prompt += `- Resumen claro del pedido\n`;
      prompt += `- Total destacado\n`;
      prompt += `- Opciones: confirmar, modificar o cancelar`;
    } else if (pedido && pedido.productos && pedido.productos.length > 0) {
      // Formato alternativo de pedido
      prompt += `PEDIDO ACTUAL:\n`;
      prompt += `- Total: S/ ${parseFloat(pedido.total || 0).toFixed(2)}\n\n`;
      prompt += `PRODUCTOS:\n`;
      pedido.productos.forEach((p, idx) => {
        const subtotal = (parseFloat(p.precio_unitario || 0) * (p.cantidad || 1)).toFixed(2);
        prompt += `${idx + 1}. ${p.nombre || p.nombre_producto} x${p.cantidad} = S/ ${subtotal}\n`;
      });
      
      prompt += `\nGenera una respuesta similar al formato anterior.`;
    } else {
      prompt += `El usuario no tiene un pedido actual.\n\n`;
      prompt += `Genera una respuesta amigable informando esto y sugiriendo hacer un pedido.`;
    }
    
    return prompt;
  }

  /**
   * Prompt para ayuda
   */
  _buildHelpPrompt(sessionState) {
    const estado = sessionState.state || 'idle';
    const autenticado = sessionState._authenticated || false;
    
    let prompt = `El usuario pide ayuda.\n\n`;
    prompt += `CONTEXTO:\n`;
    prompt += `- Estado: ${estado}\n`;
    prompt += `- Autenticado: ${autenticado ? 'Sí' : 'No'}\n\n`;
    
    prompt += `Genera una respuesta de ayuda contextual con:\n`;
    prompt += `- Comandos generales disponibles\n`;
    if (estado === 'pedido_en_proceso' || estado === 'awaiting_confirmation') {
      prompt += `- Comandos específicos para pedidos (ver, modificar, confirmar, cancelar)\n`;
    }
    if (estado === 'awaiting_payment') {
      prompt += `- Comandos de pago (Yape, Plin, confirmar pago)\n`;
    }
    prompt += `- Ejemplos de uso\n`;
    prompt += `- Tips útiles`;
    
    return prompt;
  }

  /**
   * Prompt para saludo
   */
  _buildGreetingPrompt(sessionState) {
    const nombre = sessionState._client_name || '';
    const autenticado = sessionState._authenticated || false;
    
    let prompt = `El usuario saluda.\n\n`;
    
    if (autenticado && nombre) {
      prompt += `CONTEXTO:\n`;
      prompt += `- Es cliente registrado\n`;
      prompt += `- Nombre: ${nombre}\n\n`;
      prompt += `Genera un saludo personalizado y cálido para ${nombre}, incluyendo:\n`;
    } else {
      prompt += `CONTEXTO:\n`;
      prompt += `- Es un nuevo usuario o no autenticado\n\n`;
      prompt += `Genera un saludo de bienvenida amigable, incluyendo:\n`;
    }
    
    prompt += `- Bienvenida a KARDEX\n`;
    prompt += `- Opciones principales disponibles (catálogo, pedidos, etc.)\n`;
    prompt += `- Cómo empezar a usar el servicio\n`;
    prompt += `- Invitación a hacer preguntas`;
    
    return prompt;
  }

  /**
   * Prompt para intención de pedido
   */
  _buildOrderIntentPrompt(intent, sessionState) {
    // Los pedidos son manejados por aiProcessor, solo confirmar
    return `El usuario quiere hacer un pedido. Los productos serán procesados por el sistema de pedidos.`;
  }

  /**
   * Prompt genérico
   */
  _buildGenericPrompt(intent, data, sessionState) {
    let prompt = `El usuario tiene la intención: ${intent.intencion}\n\n`;
    
    if (intent.parametros && Object.keys(intent.parametros).length > 0) {
      prompt += `Parámetros detectados:\n`;
      prompt += JSON.stringify(intent.parametros, null, 2);
      prompt += `\n\n`;
    }
    
    if (data) {
      prompt += `Datos disponibles:\n`;
      prompt += JSON.stringify(data, null, 2);
      prompt += `\n\n`;
    }
    
    prompt += `Genera una respuesta apropiada según la intención del usuario.`;
    
    return prompt;
  }

  /**
   * Generar botones si aplica
   */
  _generateButtons(intent, data, context) {
    const intencion = intent.intencion;
    const buttons = [];

    // Botones según intención
    switch (intencion) {
      case 'VER_CATALOGO':
        buttons.push(
          { title: '🔍 Buscar', id: 'search' },
          { title: '🛒 Hacer Pedido', id: 'order' }
        );
        break;

      case 'CONSULTAR_PRECIO':
      case 'CONSULTAR_STOCK':
        if (data && data.length > 0) {
          buttons.push(
            { title: '🛒 Agregar al Pedido', id: 'add_to_order' },
            { title: '📋 Ver Catálogo', id: 'catalog' }
          );
        }
        break;

      case 'VER_PEDIDO':
        buttons.push(
          { title: '✅ Confirmar', id: 'confirm_order' },
          { title: '✏️ Modificar', id: 'modify_order' },
          { title: '❌ Cancelar', id: 'cancel_order' }
        );
        break;

      default:
        // No buttons
        break;
    }

    return buttons.length > 0 ? buttons : null;
  }

  /**
   * Generar respuesta de fallback
   */
  _generateFallbackResponse(intent, data, context) {
    const intencion = intent.intencion;

    // Respuestas básicas predefinidas
    const fallbacks = {
      VER_CATALOGO: '🛍️ *CATÁLOGO DE PRODUCTOS*\n\nAquí están nuestros productos disponibles.\n\n💬 Para ver más detalles, escribe el nombre del producto o di *"AYUDA"* para ver opciones.',
      CONSULTAR_PRECIO: '💰 *CONSULTA DE PRECIO*\n\nPor favor, menciona el nombre específico del producto que te interesa.\n\n💡 Ejemplo: *"¿Cuánto cuesta una laptop?"*',
      CONSULTAR_STOCK: '📦 *CONSULTA DE STOCK*\n\nPor favor, menciona el nombre del producto.\n\n💡 Ejemplo: *"¿Tienes laptops disponibles?"*',
      AYUDA: '🤖 *AYUDA*\n\nPuedo ayudarte con:\n• Ver catálogo de productos\n• Consultar precios y stock\n• Hacer pedidos\n• Ver estado de pedidos\n\n💬 Di *"CATALOGO"* para empezar.',
      SALUDO: '👋 *¡Hola! Bienvenido a KARDEX* 👋\n\n¿En qué puedo ayudarte hoy?\n\n💡 Di *"CATALOGO"* para ver productos o *"AYUDA"* para más opciones.',
      OTRO: '👋 *¡Hola!* 👋\n\nNo estoy seguro de entenderte completamente.\n\n💡 Di *"AYUDA"* para ver qué puedo hacer por ti.'
    };

    return {
      text: fallbacks[intencion] || fallbacks.OTRO,
      data: data,
      buttons: null
    };
  }
}

module.exports = new ResponseGenerator();

