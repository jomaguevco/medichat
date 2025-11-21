const ollamaClient = require('../../utils/ollamaClient');
const logger = require('../../utils/logger');
const config = require('../../../config/config');

/**
 * Gestor de Múltiples Modelos de IA
 * 
 * Gestiona diferentes modelos de Ollama según la tarea:
 * - Modelo 1: Consultas generales (catálogo, precios, stock) - phi3:mini
 * - Modelo 2: Pedidos complejos - phi3:mini (más contexto)
 * - Modelo 3: Conversación natural - phi3:mini (temperatura más alta)
 */
class MultiModelAI {
  constructor() {
    this.models = {
      queries: {
        model: config.ollama.model || 'phi3:mini',
        temperature: 0.2,
        top_p: 0.9,
        top_k: 40,
        timeout: 8000
      },
      orders: {
        model: config.ollama.model || 'phi3:mini',
        temperature: 0.3,
        top_p: 0.9,
        top_k: 40,
        timeout: 10000
      },
      conversation: {
        model: config.ollama.model || 'phi3:mini',
        temperature: 0.5,
        top_p: 0.95,
        top_k: 50,
        timeout: 8000
      }
    };
    
    this.baseUrl = config.ollama.baseUrl || 'http://localhost:11434';
  }

  /**
   * Verificar si Ollama está disponible
   */
  async isAvailable() {
    return await ollamaClient.isAvailable();
  }

  /**
   * Obtener configuración del modelo según tipo de tarea
   */
  getModelConfig(taskType = 'queries') {
    const config = this.models[taskType] || this.models.queries;
    return {
      model: config.model,
      temperature: config.temperature,
      top_p: config.top_p,
      top_k: config.top_k,
      timeout: config.timeout
    };
  }

  /**
   * Generar respuesta con modelo específico según tarea
   */
  async generate(prompt, systemPrompt, taskType = 'queries', options = {}) {
    try {
      const modelConfig = this.getModelConfig(taskType);
      
      const finalOptions = {
        temperature: options.temperature || modelConfig.temperature,
        top_p: options.top_p || modelConfig.top_p,
        top_k: options.top_k || modelConfig.top_k,
        timeout: options.timeout || modelConfig.timeout
      };

      logger.debug(`Generando con modelo ${taskType}`, {
        model: modelConfig.model,
        temperature: finalOptions.temperature,
        promptLength: prompt.length
      });

      const response = await ollamaClient.generate(
        prompt,
        systemPrompt,
        finalOptions
      );

      return response;
    } catch (error) {
      logger.error(`Error al generar con modelo ${taskType}`, error);
      
      // Intentar fallback con modelo de consultas si falla
      if (taskType !== 'queries') {
        logger.warn(`Intentando fallback con modelo queries`);
        try {
          const fallbackConfig = this.getModelConfig('queries');
          return await ollamaClient.generate(
            prompt,
            systemPrompt,
            {
              temperature: fallbackConfig.temperature,
              top_p: fallbackConfig.top_p,
              top_k: fallbackConfig.top_k,
              timeout: fallbackConfig.timeout
            }
          );
        } catch (fallbackError) {
          logger.error('Error en fallback', fallbackError);
          throw error;
        }
      }
      
      throw error;
    }
  }

  /**
   * Generar respuesta en formato JSON con modelo específico
   */
  async generateJSON(prompt, systemPrompt, taskType = 'queries', options = {}) {
    try {
      const jsonPrompt = `${prompt}\n\nResponde SOLO con un JSON válido, sin texto adicional.`;
      const response = await this.generate(jsonPrompt, systemPrompt, taskType, options);
      
      // Intentar extraer JSON de la respuesta
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // Si no hay match, intentar parsear directamente
      return JSON.parse(response);
    } catch (error) {
      logger.error(`Error al parsear JSON de modelo ${taskType}`, error);
      throw new Error('No se pudo obtener una respuesta válida del modelo');
    }
  }

  /**
   * Verificar que el modelo esté disponible
   */
  async checkModel(taskType = 'queries') {
    return await ollamaClient.checkModel();
  }
}

module.exports = new MultiModelAI();

