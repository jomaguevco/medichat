const multiModelAI = require('./multiModelAI');
const logger = require('../../utils/logger');

/**
 * Resolver de Intenciones con IA
 * 
 * Resuelve la intención del mensaje usando IA y extrae parámetros estructurados.
 * Determina qué queries necesitan ejecutarse en la base de datos.
 */
class IntentResolver {
  constructor() {
    this.systemPrompt = `Eres un asistente inteligente que entiende todas las intenciones del usuario en un chatbot de ventas de KARDEX.

IMPORTANTE:
- Entiende el lenguaje natural y conversacional. El usuario puede hablar de forma coloquial, con errores de pronunciación (especialmente en voz), o de manera informal.
- Si el usuario dice cosas como "mm", "ehh", "ahh", "um", ignóralas (son pausas de voz).
- Si el usuario usa variaciones de palabras (ej: "lapto" en vez de "laptop", "maus" en vez de "mouse"), entiéndelas correctamente.
- Sé tolerante con errores de transcripción de voz y malas pronunciaciones.

INTENCIONES POSIBLES:
- VER_CATALOGO: Quiere ver productos disponibles. Incluye: "catálogo", "catalogo", "productos", "lista", "ver productos", "muestrame", "mostrar"
- CONSULTAR_PRECIO: Pregunta precio de un producto. Incluye: "cuánto cuesta", "precio", "vale", "a cuánto"
- CONSULTAR_STOCK: Pregunta disponibilidad de producto. Incluye: "tienes", "hay", "disponible", "stock"
- BUSCAR_PRODUCTOS: Busca productos con filtros o términos. Incluye: "buscar", "filtrar", "productos baratos", "menos de X", "con stock", "productos económicos", "solo disponibles"
- HACER_PEDIDO: Quiere comprar/agregar productos. Incluye: "quiero", "necesito", "dame", "comprar", "pedir", "agregar", "ponme", "traeme"
- VER_PEDIDO: Quiere ver su pedido actual. Incluye: "mi pedido", "pedido actual", "estado", "ver pedido"
- CANCELAR_PEDIDO: Quiere cancelar pedido. Incluye: "cancelar", "salir", "no quiero", "olvídalo", "cancelar pedido"
- CONFIRMAR_PEDIDO: Quiere confirmar su pedido. Incluye: "confirmar", "confirmo", "si", "sí", "ok", "okey", "okay", "acepto", "confirmar pedido"
- REGISTRAR: Quiere registrarse. Incluye: "registrar", "registrarme", "crear cuenta"
- LOGIN: Quiere iniciar sesión. Incluye: "login", "ingresar", "iniciar sesión", "mi cuenta"
- MODIFICAR_PERFIL: Quiere actualizar datos. Incluye: "modificar perfil", "cambiar datos", "actualizar"
- AYUDA: Pide ayuda. Incluye: "ayuda", "help", "qué puedo hacer", "comandos"
- SALUDO: Saluda. Incluye: "hola", "hi", "buenos días", "qué tal"
- OTRO: No encaja en lo anterior

QUERIES DISPONIBLES:
- getProductos: Obtener catálogo de productos (requiere: filters)
- buscarProductos: Buscar productos por término (requiere: term, limit)
- getProducto: Obtener un producto específico (requiere: nombre o id)
- getCliente: Obtener datos de cliente (requiere: phone)
- getPedido: Obtener estado de pedido (requiere: pedidoId o phoneNumber)
- verificarStock: Verificar stock de productos (requiere: productos)

Responde SOLO con JSON válido (sin texto adicional, sin markdown):
{
  "intencion": "VER_CATALOGO | CONSULTAR_PRECIO | CONSULTAR_STOCK | BUSCAR_PRODUCTOS | HACER_PEDIDO | VER_PEDIDO | CANCELAR_PEDIDO | CONFIRMAR_PEDIDO | REGISTRAR | LOGIN | MODIFICAR_PERFIL | AYUDA | SALUDO | OTRO",
  "confianza": 0.0-1.0,
  "parametros": {
    "producto": "nombre del producto si aplica",
    "productos": [{"nombre": "texto exacto", "cantidad": número}],
    "cantidad": número si aplica,
    "termino": "término de búsqueda si aplica",
    "filtros": {
      "precioMaximo": número o null,
      "precioMinimo": número o null,
      "soloDisponibles": boolean,
      "categoria": "string o null"
    },
    "pedidoId": número o null,
    "phoneNumber": "string o null"
  },
  "queryNecesaria": "getProductos | buscarProductos | getProducto | verificarStock | getCliente | getPedido | null",
  "queryParams": {
    "filters": object si aplica,
    "term": string si aplica,
    "limit": número si aplica,
    "nombre": string si aplica,
    "phone": string si aplica,
    "pedidoId": número si aplica
  },
  "action": "add_products_to_order | view_order | cancel_order | init_order | confirm_order | show_yape_payment | show_plin_payment | remove_product | update_product_quantity | view_order_history | modify_profile | null",
  "notas": "string opcional con notas adicionales"
}`;
    
    this.cache = new Map();
    this.cacheTTL = 2 * 60 * 1000; // 2 minutos
  }

  /**
   * Resolver intención del mensaje
   */
  async resolve(text, sessionState = {}, conversationHistory = []) {
    try {
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return {
          intencion: 'OTRO',
          confianza: 0.1,
          parametros: {},
          queryNecesaria: null,
          queryParams: {},
          action: null
        };
      }

      // Verificar cache
      const cacheKey = `intent_${text.toLowerCase().trim().substring(0, 50)}`;
      const cached = this.cache.get(cacheKey);
      
      if (cached && (Date.now() - cached.timestamp) < this.cacheTTL) {
        logger.debug('[Cache] Intención encontrada en cache');
        return cached.data;
      }

      // Construir prompt con contexto
      let prompt = `Usuario dice: "${text}"\n\n`;
      
      if (conversationHistory.length > 0) {
        prompt += `Contexto de conversación anterior:\n`;
        conversationHistory.slice(-3).forEach((msg, idx) => {
          prompt += `${idx + 1}. ${msg.role === 'user' ? 'Usuario' : 'Bot'}: ${msg.content.substring(0, 100)}\n`;
        });
        prompt += `\n`;
      }

      if (sessionState && Object.keys(sessionState).length > 0) {
        prompt += `Estado actual del usuario:\n`;
        prompt += `- Estado: ${sessionState.state || 'idle'}\n`;
        prompt += `- Autenticado: ${sessionState._authenticated || false}\n`;
        if (sessionState._client_name) {
          prompt += `- Nombre: ${sessionState._client_name}\n`;
        }
        prompt += `\n`;
      }

      prompt += `Analiza el mensaje del usuario y determina su intención principal con todos los parámetros necesarios.`;

      // Procesar con IA (usar modelo de queries)
      let result = null;
      
      try {
        result = await multiModelAI.generateJSON(
          prompt,
          this.systemPrompt,
          'queries',
          { temperature: 0.2 }
        );

        // Validar estructura
        if (!result.intencion) {
          throw new Error('Intención no detectada');
        }

        // Normalizar intención
        result.intencion = result.intencion.toUpperCase();

        logger.info('Intención resuelta', {
          intencion: result.intencion,
          confianza: result.confianza,
          queryNecesaria: result.queryNecesaria
        });

      } catch (aiError) {
        logger.warn('Error al procesar con IA, usando fallback', aiError.message);
        result = this._fallbackResolution(text, sessionState);
      }

      // Si no se pudo procesar, usar fallback
      if (!result || !result.intencion) {
        result = this._fallbackResolution(text, sessionState);
      }

      // Guardar en cache
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      return result;
    } catch (error) {
      logger.error('Error en resolve:', error);
      return this._fallbackResolution(text, sessionState);
    }
  }

  /**
   * Resolución de fallback cuando IA no está disponible
   */
  _fallbackResolution(text, sessionState = {}) {
    const textLower = text.toLowerCase().trim();
    
    // Detección básica de intenciones
    if (textLower.match(/(catálogo|catalogo|productos|lista|muestrame|mostrar)/)) {
      return {
        intencion: 'VER_CATALOGO',
        confianza: 0.7,
        parametros: {},
        queryNecesaria: 'getProductos',
        queryParams: { filters: { activo: true, limit: 20 } },
        action: null
      };
    }
    
    if (textLower.match(/(cuánto cuesta|precio|vale|a cuánto)/)) {
      const producto = this._extractProductName(text);
      return {
        intencion: 'CONSULTAR_PRECIO',
        confianza: 0.7,
        parametros: { producto },
        queryNecesaria: producto ? 'buscarProductos' : null,
        queryParams: producto ? { term: producto, limit: 3 } : {},
        action: null
      };
    }
    
    if (textLower.match(/(tienes|hay|disponible|stock)/)) {
      const producto = this._extractProductName(text);
      return {
        intencion: 'CONSULTAR_STOCK',
        confianza: 0.7,
        parametros: { producto },
        queryNecesaria: producto ? 'buscarProductos' : null,
        queryParams: producto ? { term: producto, limit: 3 } : {},
        action: null
      };
    }
    
    if (textLower.match(/(quiero|necesito|dame|comprar|pedir|agregar)/)) {
      return {
        intencion: 'HACER_PEDIDO',
        confianza: 0.7,
        parametros: { productos: [] },
        queryNecesaria: null,
        queryParams: {},
        action: 'init_order'
      };
    }
    
    if (textLower.match(/(mi pedido|pedido actual|estado|ver pedido)/)) {
      return {
        intencion: 'VER_PEDIDO',
        confianza: 0.7,
        parametros: {},
        queryNecesaria: 'getPedido',
        queryParams: { phoneNumber: sessionState.phoneNumber },
        action: 'view_order'
      };
    }
    
    if (textLower.match(/(confirmar|confirmo|si|sí|ok|okey|okay|acepto|confirmar pedido)/)) {
      const currentState = sessionState.state || 'idle';
      if (currentState === 'awaiting_confirmation' || currentState === 'pedido_en_proceso') {
        return {
          intencion: 'CONFIRMAR_PEDIDO',
          confianza: 0.8,
          parametros: {},
          queryNecesaria: null,
          queryParams: {},
          action: 'confirm_order'
        };
      }
    }
    
    if (textLower.match(/(cancelar|salir|no quiero|olvídate|cancelar pedido)/)) {
      return {
        intencion: 'CANCELAR_PEDIDO',
        confianza: 0.7,
        parametros: {},
        queryNecesaria: null,
        queryParams: {},
        action: 'cancel_order'
      };
    }
    
    if (textLower.match(/(hola|hi|buenos días|qué tal)/)) {
      return {
        intencion: 'SALUDO',
        confianza: 0.8,
        parametros: {},
        queryNecesaria: null,
        queryParams: {},
        action: null
      };
    }
    
    if (textLower.match(/(ayuda|help|qué puedo hacer|comandos)/)) {
      return {
        intencion: 'AYUDA',
        confianza: 0.8,
        parametros: {},
        queryNecesaria: null,
        queryParams: {},
        action: null
      };
    }

    return {
      intencion: 'OTRO',
      confianza: 0.3,
      parametros: {},
      queryNecesaria: null,
      queryParams: {},
      action: null
    };
  }

  /**
   * Extraer nombre de producto del texto (método básico)
   */
  _extractProductName(text) {
    const normalize = (s) =>
      (s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[¿?¡!.,;:"]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    
    const s = normalize(text);
    
    // Limpiar palabras comunes
    const cleaned = s
      .replace(/\b(precio|cuanto cuesta|valor|stock|disponible|hay|tienes|tiene|de|del|la|el|un|una|unos|unas|cuánto|cuanto|a|el|la)\b/gi, '')
      .trim();
    
    if (cleaned.length >= 3) return cleaned;
    
    // Último recurso: tomar últimas palabras significativas
    const tokens = s.split(' ').filter(t => t.length >= 3);
    return tokens.length ? tokens.slice(-3).join(' ') : null;
  }

  /**
   * Limpiar cache
   */
  clearCache() {
    this.cache.clear();
    logger.info('Cache de IntentResolver limpiado');
  }
}

module.exports = new IntentResolver();

