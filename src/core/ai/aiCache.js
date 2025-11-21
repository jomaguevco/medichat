const logger = require('../../utils/logger');

/**
 * Cache Inteligente para IA
 * 
 * Cache de respuestas de IA por intención.
 * Cache de resultados de queries frecuentes.
 * Invalidación inteligente según cambios en BD.
 */
class AICache {
  constructor() {
    this.responseCache = new Map();
    this.queryCache = new Map();
    this.responseTTL = 2 * 60 * 1000; // 2 minutos para respuestas
    this.queryTTL = 5 * 60 * 1000; // 5 minutos para queries
  }

  /**
   * Obtener respuesta del cache
   */
  getResponse(key) {
    const cached = this.responseCache.get(key);
    
    if (!cached) {
      return null;
    }

    const age = Date.now() - cached.timestamp;
    
    if (age > this.responseTTL) {
      this.responseCache.delete(key);
      return null;
    }

    logger.debug(`[Cache] Respuesta encontrada en cache: ${key.substring(0, 30)}...`);
    return cached.data;
  }

  /**
   * Guardar respuesta en cache
   */
  setResponse(key, data) {
    this.responseCache.set(key, {
      data,
      timestamp: Date.now()
    });

    // Limpiar cache viejo si hay demasiadas entradas (mantener máximo 500)
    if (this.responseCache.size > 500) {
      const entries = Array.from(this.responseCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      // Eliminar el 20% más viejo
      const toDelete = entries.slice(0, Math.floor(entries.length * 0.2));
      for (const [keyToDelete] of toDelete) {
        this.responseCache.delete(keyToDelete);
      }
    }
  }

  /**
   * Obtener resultado de query del cache
   */
  getQuery(key) {
    const cached = this.queryCache.get(key);
    
    if (!cached) {
      return null;
    }

    const age = Date.now() - cached.timestamp;
    
    if (age > this.queryTTL) {
      this.queryCache.delete(key);
      return null;
    }

    logger.debug(`[Cache] Query encontrada en cache: ${key.substring(0, 30)}...`);
    return cached.data;
  }

  /**
   * Guardar resultado de query en cache
   */
  setQuery(key, data) {
    this.queryCache.set(key, {
      data,
      timestamp: Date.now()
    });

    // Limpiar cache viejo si hay demasiadas entradas (mantener máximo 1000)
    if (this.queryCache.size > 1000) {
      const entries = Array.from(this.queryCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      // Eliminar el 20% más viejo
      const toDelete = entries.slice(0, Math.floor(entries.length * 0.2));
      for (const [keyToDelete] of toDelete) {
        this.queryCache.delete(keyToDelete);
      }
    }
  }

  /**
   * Invalidar cache relacionado con un producto
   */
  invalidateProduct(productId) {
    // Invalidar queries de productos
    const keysToDelete = [];
    for (const [key] of this.queryCache.entries()) {
      if (key.includes(`producto:${productId}`) || key.includes(`producto_${productId}`)) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.queryCache.delete(key);
      logger.debug(`[Cache] Invalidado producto: ${key}`);
    }
  }

  /**
   * Invalidar cache relacionado con un pedido
   */
  invalidateOrder(pedidoId) {
    // Invalidar queries de pedidos
    const keysToDelete = [];
    for (const [key] of this.queryCache.entries()) {
      if (key.includes(`pedido:${pedidoId}`) || key.includes(`pedido_${pedidoId}`)) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.queryCache.delete(key);
      logger.debug(`[Cache] Invalidado pedido: ${key}`);
    }
  }

  /**
   * Invalidar todo el cache
   */
  clear() {
    this.responseCache.clear();
    this.queryCache.clear();
    logger.info('Cache de IA limpiado completamente');
  }

  /**
   * Limpiar cache expirado
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    // Limpiar respuestas expiradas
    for (const [key, value] of this.responseCache.entries()) {
      if (now - value.timestamp > this.responseTTL) {
        this.responseCache.delete(key);
        cleaned++;
      }
    }

    // Limpiar queries expiradas
    for (const [key, value] of this.queryCache.entries()) {
      if (now - value.timestamp > this.queryTTL) {
        this.queryCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`[Cache] Limpiadas ${cleaned} entradas expiradas`);
    }
  }

  /**
   * Obtener estadísticas del cache
   */
  getStats() {
    return {
      responseCacheSize: this.responseCache.size,
      queryCacheSize: this.queryCache.size,
      responseTTL: this.responseTTL,
      queryTTL: this.queryTTL
    };
  }
}

module.exports = new AICache();

