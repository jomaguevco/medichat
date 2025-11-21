const kardexApi = require('../../kardexApi');
const kardexDb = require('../../kardexDb');
const logger = require('../../utils/logger');
const productCache = require('../../utils/productCache');
const sessionManager = require('../../sessionManager');
const aiCache = require('./aiCache');

/**
 * Ejecutor de Queries con IA
 * 
 * Ejecuta queries estructuradas basadas en decisiones de IA.
 * Integra con kardexApi.js y kardexDb.js existentes.
 * Maneja errores y fallbacks (API → BD → cache).
 */
class QueryExecutor {
  /**
   * Ejecutar query según intención resuelta
   */
  async execute(intent) {
    try {
      const { queryNecesaria, queryParams, intencion } = intent;

      if (!queryNecesaria) {
        logger.debug('No hay query necesaria para esta intención');
        return { data: null, error: null };
      }

      logger.info('Ejecutando query', {
        query: queryNecesaria,
        params: queryParams,
        intencion
      });

      let result = null;
      let error = null;

      switch (queryNecesaria) {
        case 'getProductos':
          result = await this._getProductos(queryParams);
          break;

        case 'buscarProductos':
          result = await this._buscarProductos(queryParams);
          break;

        case 'getProducto':
          result = await this._getProducto(queryParams);
          break;

        case 'verificarStock':
          result = await this._verificarStock(queryParams);
          break;

        case 'getCliente':
          result = await this._getCliente(queryParams);
          break;

        case 'getPedido':
          result = await this._getPedido(queryParams);
          break;

        default:
          logger.warn(`Query desconocida: ${queryNecesaria}`);
          error = `Query desconocida: ${queryNecesaria}`;
      }

      if (error) {
        return { data: null, error };
      }

      return { data: result, error: null };
    } catch (error) {
      logger.error('Error al ejecutar query', error);
      return { data: null, error: error.message };
    }
  }

  /**
   * Obtener productos (catálogo)
   */
  async _getProductos(params = {}) {
    try {
      const filters = params.filters || {};
      const limit = params.limit || filters.limit || 20;

      // Verificar cache
      const cacheKey = `getProductos:${JSON.stringify(filters)}:${limit}`;
      const cached = aiCache.getQuery(cacheKey);
      if (cached) {
        return cached;
      }

      let productos = null;

      // Intentar BD primero (más rápido)
      if (kardexDb.isConnected()) {
        try {
          productos = await kardexDb.getProductos({
            activo: filters.activo !== false ? true : undefined,
            categoria_id: filters.categoria_id,
            limit: limit
          });
        } catch (dbError) {
          logger.warn('Error al obtener productos de BD', dbError.message);
        }
      }

      // Si no hay resultados, usar API
      if (!productos || productos.length === 0) {
        try {
          productos = await kardexApi.getProductos({
            activo: filters.activo !== false,
            limit: limit
          });
        } catch (apiError) {
          logger.warn('Error al obtener productos de API', apiError.message);
        }
      }

      // Aplicar filtros adicionales si hay
      if (productos && productos.length > 0) {
        if (filters.precioMaximo) {
          productos = productos.filter(p => 
            parseFloat(p.precio_venta || 0) <= filters.precioMaximo
          );
        }
        if (filters.precioMinimo) {
          productos = productos.filter(p => 
            parseFloat(p.precio_venta || 0) >= filters.precioMinimo
          );
        }
        if (filters.soloDisponibles) {
          productos = productos.filter(p => (p.stock_actual || 0) > 0);
        }
      }

      const result = productos || [];
      
      // Guardar en cache
      if (result.length > 0) {
        aiCache.setQuery(cacheKey, result);
      }

      return result;
    } catch (error) {
      logger.error('Error en _getProductos', error);
      return [];
    }
  }

  /**
   * Buscar productos por término
   */
  async _buscarProductos(params = {}) {
    try {
      const term = params.term;
      const limit = params.limit || 5;

      if (!term || term.trim().length === 0) {
        return [];
      }

      let productos = null;

      // Intentar cache primero
      const cacheKey = `search:${term.toLowerCase()}`;
      productos = productCache.get(cacheKey);

      if (!productos) {
        // Intentar BD primero
        if (kardexDb.isConnected()) {
          try {
            productos = await kardexDb.buscarProductos(term, limit);
          } catch (dbError) {
            logger.warn('Error al buscar productos en BD', dbError.message);
          }
        }

        // Si no hay resultados, usar API
        if (!productos || productos.length === 0) {
          try {
            productos = await kardexApi.buscarProductos(term);
            if (productos && productos.length > limit) {
              productos = productos.slice(0, limit);
            }
          } catch (apiError) {
            logger.warn('Error al buscar productos en API', apiError.message);
          }
        }

        // Guardar en cache
        if (productos && productos.length > 0) {
          productCache.set(cacheKey, productos);
        }
      }

      return productos || [];
    } catch (error) {
      logger.error('Error en _buscarProductos', error);
      return [];
    }
  }

  /**
   * Obtener un producto específico
   */
  async _getProducto(params = {}) {
    try {
      const nombre = params.nombre;
      const id = params.id;

      if (id) {
        // Buscar por ID
        if (kardexDb.isConnected()) {
          try {
            const [productos] = await kardexDb.pool.execute(
              'SELECT * FROM productos WHERE id = ?',
              [id]
            );
            if (productos && productos.length > 0) {
              return productos[0];
            }
          } catch (dbError) {
            logger.warn('Error al obtener producto por ID de BD', dbError.message);
          }
        }
      }

      if (nombre) {
        // Buscar por nombre
        const resultados = await this._buscarProductos({ term: nombre, limit: 1 });
        if (resultados && resultados.length > 0) {
          return resultados[0];
        }
      }

      return null;
    } catch (error) {
      logger.error('Error en _getProducto', error);
      return null;
    }
  }

  /**
   * Verificar stock de productos
   */
  async _verificarStock(params = {}) {
    try {
      const productos = params.productos || [];
      
      if (!productos || productos.length === 0) {
        return { disponibles: [], sinStock: [] };
      }

      const disponibles = [];
      const sinStock = [];

      for (const producto of productos) {
        const productoInfo = await this._getProducto({ nombre: producto.nombre });
        
        if (productoInfo) {
          const stockActual = productoInfo.stock_actual || 0;
          const cantidadSolicitada = producto.cantidad || 1;
          
          if (stockActual >= cantidadSolicitada) {
            disponibles.push({
              ...producto,
              stock_actual: stockActual,
              producto_id: productoInfo.id,
              precio_venta: productoInfo.precio_venta
            });
          } else {
            sinStock.push({
              ...producto,
              stock_actual: stockActual,
              cantidad_solicitada: cantidadSolicitada,
              producto_id: productoInfo.id
            });
          }
        } else {
          sinStock.push({
            ...producto,
            motivo: 'producto_no_encontrado'
          });
        }
      }

      return { disponibles, sinStock };
    } catch (error) {
      logger.error('Error en _verificarStock', error);
      return { disponibles: [], sinStock: [] };
    }
  }

  /**
   * Obtener datos de cliente
   */
  async _getCliente(params = {}) {
    try {
      const phone = params.phone || params.phoneNumber;

      if (!phone) {
        return null;
      }

      let cliente = null;

      // Intentar BD primero
      if (kardexDb.isConnected()) {
        try {
          cliente = await kardexDb.buscarClientePorTelefono(phone);
        } catch (dbError) {
          logger.warn('Error al buscar cliente en BD', dbError.message);
        }
      }

      // Si no se encontró, usar API
      if (!cliente) {
        try {
          cliente = await kardexApi.getClientByPhone(phone);
        } catch (apiError) {
          logger.warn('Error al buscar cliente en API', apiError.message);
        }
      }

      return cliente;
    } catch (error) {
      logger.error('Error en _getCliente', error);
      return null;
    }
  }

  /**
   * Obtener estado de pedido
   */
  async _getPedido(params = {}) {
    try {
      const pedidoId = params.pedidoId;
      const phoneNumber = params.phoneNumber;

      if (pedidoId) {
        // Buscar por ID
        try {
          const pedido = await kardexApi.getPedidoEnProceso(pedidoId);
          return pedido;
        } catch (apiError) {
          logger.warn('Error al obtener pedido por ID', apiError.message);
        }
      }

      if (phoneNumber) {
        // Buscar pedido activo de la sesión
        const session = await sessionManager.getSession(phoneNumber);
        if (session && session.current_order) {
          const orderData = JSON.parse(session.current_order);
          if (orderData.pedido_id) {
            try {
              const pedido = await kardexApi.getPedidoEnProceso(orderData.pedido_id);
              return pedido;
            } catch (apiError) {
              logger.warn('Error al obtener pedido de sesión', apiError.message);
            }
          }
          return orderData;
        }
      }

      return null;
    } catch (error) {
      logger.error('Error en _getPedido', error);
      return null;
    }
  }
}

module.exports = new QueryExecutor();

