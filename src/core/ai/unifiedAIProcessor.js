const intentResolver = require('./intentResolver');
const queryExecutor = require('./queryExecutor');
const responseGenerator = require('./responseGenerator');
const aiProcessor = require('../../aiProcessor');
const logger = require('../../utils/logger');

/**
 * Procesador Unificado de IA
 * 
 * Procesa TODOS los mensajes (texto y voz) usando IA.
 * Reemplaza completamente basicBot.js.
 * Determina intención principal y parámetros, decide qué queries ejecutar en BD,
 * y genera respuesta completa con IA.
 */
class UnifiedAIProcessor {
  constructor() {
    logger.info('UnifiedAIProcessor inicializado - Sistema de IA unificado');
  }

  /**
   * Procesar mensaje completo
   */
  async process(text, context = {}) {
    try {
      const { sessionState = {}, conversationHistory = [], isFromVoice = false } = context;

      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return {
          intent: 'OTRO',
          confidence: 0.1,
          action: null,
          message: 'No pude entender tu mensaje. Por favor, intenta de nuevo.',
          data: null,
          buttons: null
        };
      }

      logger.info('Procesando mensaje con UnifiedAIProcessor', {
        textLength: text.length,
        isFromVoice,
        hasHistory: conversationHistory.length > 0,
        state: sessionState.state
      });

      // 1. Resolver intención con IA
      const intent = await intentResolver.resolve(text, sessionState, conversationHistory);

      logger.info('Intención resuelta', {
        intencion: intent.intencion,
        confianza: intent.confianza,
        queryNecesaria: intent.queryNecesaria,
        action: intent.action
      });

      // 2. Si es HACER_PEDIDO, delegar a aiProcessor existente
      if (intent.intencion === 'HACER_PEDIDO') {
        logger.info('Delegando pedido a aiProcessor existente');
        try {
          const orderResult = await aiProcessor.processOrder(text, conversationHistory);
          
          // Si el pedido fue procesado exitosamente, usar ese resultado
          if (orderResult.success) {
            return {
              intent: 'order',
              confidence: 0.9,
              action: orderResult.action || 'add_products_to_order',
              message: null, // El mensaje se generará en el handler
              data: orderResult,
              buttons: null
            };
          } else if (orderResult.intent) {
            // La IA detectó otra intención, procesarla normalmente
            logger.info(`IA detectó intención alternativa: ${orderResult.intent}`);
            intent.intencion = orderResult.intent;
          } else {
            // Error en pedido, retornar mensaje de error
            return {
              intent: 'order',
              confidence: 0.5,
              action: null,
              message: orderResult.message || 'No pude procesar tu pedido. Por favor, intenta de nuevo.',
              data: null,
              buttons: null
            };
          }
        } catch (orderError) {
          logger.error('Error al procesar pedido con aiProcessor', orderError);
          // Continuar con flujo normal
        }
      }

      // 3. Si hay acción que no requiere query ni respuesta (como confirm_order, cancel_order)
      // Retornar directamente con la acción
      const actionOnlyIntents = ['CONFIRMAR_PEDIDO', 'CANCELAR_PEDIDO'];
      if (intent.action && actionOnlyIntents.includes(intent.intencion)) {
        logger.info('Intención con acción directa, retornando sin query ni respuesta');
        return {
          intent: intent.intencion.toLowerCase(),
          confidence: intent.confianza || 0.8,
          action: intent.action,
          message: null, // El handler generará el mensaje
          data: null,
          buttons: null
        };
      }

      // 4. Ejecutar queries necesarias
      let queryData = null;
      if (intent.queryNecesaria) {
        logger.info('Ejecutando query', { query: intent.queryNecesaria });
        const queryResult = await queryExecutor.execute(intent);
        
        if (queryResult.error) {
          logger.warn('Error al ejecutar query', queryResult.error);
          // Continuar con respuesta aunque haya error en query
        } else {
          queryData = queryResult.data;
        }
      }

      // 5. Generar respuesta con IA
      let response;
      try {
        response = await responseGenerator.generate(intent, queryData, {
          sessionState,
          conversationHistory,
          isFromVoice
        });
      } catch (responseError) {
        logger.error('Error al generar respuesta', responseError);
        // Usar respuesta de fallback
        response = responseGenerator._generateFallbackResponse(intent, queryData, {
          sessionState,
          conversationHistory,
          isFromVoice
        });
      }

      // 6. Si hay acción y datos de query pero no respuesta generada (view_order, etc.)
      // Retornar con datos para que el handler genere el mensaje
      if (intent.action && queryData && !response.text) {
        return {
          intent: intent.intencion.toLowerCase(),
          confidence: intent.confianza || 0.8,
          action: intent.action,
          message: null, // El handler generará el mensaje con los datos
          data: queryData,
          buttons: null
        };
      }

      // 7. Retornar resultado estructurado
      const result = {
        intent: intent.intencion.toLowerCase(),
        confidence: intent.confianza || 0.7,
        action: intent.action || null,
        message: response.text,
        data: response.data || queryData,
        buttons: response.buttons || null
      };

      logger.success('Procesamiento completo', {
        intent: result.intent,
        confidence: result.confidence,
        hasAction: !!result.action,
        hasMessage: !!result.message
      });

      return result;
    } catch (error) {
      logger.error('Error en UnifiedAIProcessor.process', error);
      
      // Respuesta de error amigable
      return {
        intent: 'error',
        confidence: 0.1,
        action: null,
        message: '😅 Lo siento, hubo un error al procesar tu mensaje.\n\n💡 Por favor intenta:\n• Reformular tu mensaje\n• Escribir *AYUDA* para ver opciones\n• Intentar de nuevo en unos momentos',
        data: null,
        buttons: null
      };
    }
  }

  /**
   * Verificar si el sistema está disponible
   */
  async isAvailable() {
    try {
      const multiModelAI = require('./multiModelAI');
      return await multiModelAI.isAvailable();
    } catch (error) {
      logger.error('Error al verificar disponibilidad', error);
      return false;
    }
  }
}

module.exports = new UnifiedAIProcessor();

