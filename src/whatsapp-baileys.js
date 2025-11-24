const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const config = require('../config/config');
const logger = require('./utils/logger');
const nlu = require('./nlu');
const sessionManager = require('./sessionManager');
const orderHandler = require('./orderHandler');
const whisperTranscriber = require('./whisper');

class WhatsAppHandler {
  constructor() {
    this.sock = null;
    this.contacts = {}; // Cache manual de contactos
    this.isConnecting = false;
    this.connected = false;
    this.messageHandlersConfigured = false;
    this.qrCode = null;
    this.processedMessageIds = new Set();
    this.authState = null;
  }

  /**
   * Inicializar cliente de WhatsApp con Baileys
   */
  async initialize() {
    if (this.connected || this.isConnecting) {
      logger.warn('WhatsApp ya está conectado o conectándose');
      return;
    }

    this.isConnecting = true;

    try {
      logger.info('🔌 Iniciando conexión con WhatsApp usando Baileys...');
      logger.info('✅ Baileys es más estable y no requiere Puppeteer');

      // Asegurar que el directorio de sesión exista
      const sessionDir = path.join(__dirname, '..', config.paths.tokens, 'baileys-session');
      await fs.mkdir(sessionDir, { recursive: true });

      // Cargar estado de autenticación
      const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
      this.authState = { state, saveCreds };

      // Obtener la última versión de Baileys
      const { version } = await fetchLatestBaileysVersion();
      logger.info(`✅ Versión de Baileys: ${version.join('.')}`);

      // Crear socket de WhatsApp
      // Crear logger compatible con Baileys (necesita método trace)
      const baileysLogger = pino({ level: 'silent' });
      // Agregar método trace si no existe (Baileys lo requiere)
      // pino ya tiene trace, pero asegurémonos de que funcione
      if (typeof baileysLogger.trace !== 'function') {
        baileysLogger.trace = function() {
          // No hacer nada, solo evitar errores
        };
      }
      
      // Asegurar que nuestro logger también tenga trace para makeCacheableSignalKeyStore
      if (typeof logger.trace !== 'function') {
        logger.trace = function() {
          // No hacer nada, solo evitar errores
        };
      }
      
      this.sock = makeWASocket({
        version,
        logger: baileysLogger, // Logger compatible con Baileys
        printQRInTerminal: false, // Generaremos nuestro propio QR
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger)
        },
        browser: ['ChatDex Bot', 'Chrome', '1.0.0'],
        generateHighQualityLinkPreview: true,
        syncFullHistory: false,
        markOnlineOnConnect: true
      });

      logger.info('✅ Socket de WhatsApp creado');

      // Manejar actualizaciones de contactos para cachearlos
      this.sock.ev.on('contacts.update', (updates) => {
        for (const update of updates) {
          if (update.id && update.notify) {
            this.contacts[update.id] = update;
          }
        }
      });

      // Manejar actualizaciones de credenciales
      this.sock.ev.on('creds.update', async () => {
        await saveCreds();
        logger.debug('✅ Credenciales guardadas');
      });

      // Manejar conexión
      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          // Generar QR code
          logger.info('📱 Generando código QR...');
          try {
            const qrImage = await qrcode.toDataURL(qr);
            const qrPath = path.join(__dirname, '..', 'qr', 'qr.png');
            await fs.mkdir(path.dirname(qrPath), { recursive: true });
            
            // Guardar QR como imagen
            const base64Data = qrImage.replace(/^data:image\/png;base64,/, '');
            await fs.writeFile(qrPath, base64Data, 'base64');
            
            this.qrCode = qr;
            
            console.log('\n');
            console.log('═'.repeat(70));
            console.log('📱 ESCANEA ESTE QR CON WHATSAPP');
            console.log('═'.repeat(70));
            console.log('   Ubicación: qr/qr.png');
            console.log('   O escanea el QR de la consola');
            console.log('═'.repeat(70));
            console.log('\n');
            
            // Mostrar QR en consola
            qrcode.toString(qr, { type: 'terminal', small: true }, (err, qrString) => {
              if (!err) {
                console.log(qrString);
                console.log('\n');
              }
            });
            
            logger.success('✅ Código QR generado en qr/qr.png');
          } catch (qrError) {
            logger.error('❌ Error al generar QR:', qrError);
          }
        }

        if (connection === 'close') {
          const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
          
          if (shouldReconnect) {
            logger.warn('⚠️ Conexión cerrada, reconectando...');
            this.connected = false;
            this.isConnecting = false;
            // Reconectar después de un momento
            setTimeout(() => {
              this.initialize().catch(err => {
                logger.error('❌ Error al reconectar:', err);
              });
            }, 3000);
          } else {
            logger.error('❌ Sesión cerrada. Elimina la carpeta baileys-session y reinicia.');
            this.connected = false;
            this.isConnecting = false;
          }
        } else if (connection === 'open') {
          logger.success('\n╔══════════════════════════════════════════════════════════════════════╗');
          logger.success('║              ✅ WHATSAPP CONECTADO EXITOSAMENTE                       ║');
          logger.success('╚══════════════════════════════════════════════════════════════════════╝');
          logger.success('');
          
          console.log('\n');
          console.log('═'.repeat(70));
          console.log('✅ WHATSAPP CONECTADO EXITOSAMENTE');
          console.log('═'.repeat(70));
          console.log('\n');

          this.connected = true;
          this.isConnecting = false;

          // Obtener información del socket
          const me = this.sock.user;
          if (me) {
            logger.info(`📱 Conectado como: ${me.name || me.id || 'N/A'}`);
            logger.info(`📱 ID: ${me.id || 'N/A'}`);
            console.log(`   Número: ${me.id || 'N/A'}`);
            console.log(`   Nombre: ${me.name || 'N/A'}`);
            console.log('═'.repeat(70));
            console.log('\n');
          }

          // Configurar handlers de mensajes
          if (!this.messageHandlersConfigured) {
            logger.info('📡 Configurando handlers de mensajes...');
            await this.setupMessageHandlers();
          }
        }
      });

      logger.info('✅ Socket inicializado, esperando conexión...');

    } catch (error) {
      logger.error('❌ Error al inicializar WhatsApp:', error);
      this.isConnecting = false;
      this.connected = false;
      throw error;
    }
  }

  /**
   * Configurar handlers de mensajes
   */
  async setupMessageHandlers() {
    if (this.messageHandlersConfigured) {
      logger.warn('⚠️ Handlers ya están configurados');
      return true;
    }

    if (!this.sock) {
      logger.error('❌ No hay socket disponible para configurar handlers');
      return false;
    }

    try {
      logger.info('📡 Configurando handlers de mensajes con Baileys...');

      // Handler para mensajes
      this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
        logger.info(`📥 Evento messages.upsert recibido - tipo: ${type}, mensajes: ${messages.length}`);
        
        // Procesar mensajes de tipo 'notify' (nuevos) y 'append' (mensajes recientes)
        // Ignorar solo otros tipos como 'update' que son actualizaciones de estado
        if (type !== 'notify' && type !== 'append') {
          logger.debug(`⚠️ Tipo de mensaje ignorado: ${type}`);
          return;
        }

        logger.info(`✅ Procesando ${messages.length} mensaje(s)...`);

        for (const message of messages) {
          try {
            // Ignorar mensajes del propio bot
            if (message.key.fromMe) {
              logger.debug('⚠️ Ignorando mensaje del propio bot');
              continue;
            }

            // Ignorar mensajes de grupos
            if (message.key.remoteJid?.includes('@g.us')) {
              logger.debug('⚠️ Ignorando mensaje de grupo');
              continue;
            }

            // Log visible
            console.log('\n');
            console.log('═'.repeat(70));
            console.log('📩 ========== MENSAJE RECIBIDO ==========');
            console.log('═'.repeat(70));
            console.log('📩 HORA: ' + new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' }));
            console.log('📩 FROM: ' + (message.key.remoteJid || 'N/A'));
            console.log('📩 FROM ME: ' + (message.key.fromMe ? 'SÍ' : 'NO'));
            console.log('📩 IS GROUP: ' + (message.key.remoteJid?.includes('@g.us') ? 'SÍ' : 'NO'));
            console.log('📩 TYPE: ' + (message.message ? Object.keys(message.message)[0] : 'text'));
            console.log('═'.repeat(70));
            console.log('\n');

            logger.info('📩 ========== MENSAJE RECIBIDO ==========');
            logger.info('📩 HORA: ' + new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' }));

            // Extraer número de teléfono usando Baileys
            let phoneNumber = null;
            let realPhoneNumber = null; // Para buscar en BD
            const remoteJid = message.key.remoteJid;
            
            if (remoteJid) {
              // Usar jidDecode de Baileys para obtener el número real
              try {
                const { jidDecode, jidNormalizedUser } = require('@whiskeysockets/baileys');
                
                // Intentar decodificar el JID
                const decoded = jidDecode(remoteJid);
                if (decoded && decoded.user) {
                  phoneNumber = decoded.user;
                  logger.info(`📞 Número decodificado desde JID: ${remoteJid} -> ${phoneNumber}`);
                } else {
                  // Si no se puede decodificar, intentar normalizar
                  const normalized = jidNormalizedUser(remoteJid);
                  if (normalized) {
                    phoneNumber = normalized.replace('@s.whatsapp.net', '').replace('@c.us', '');
                    logger.info(`📞 Número normalizado desde JID: ${remoteJid} -> ${phoneNumber}`);
                  } else {
                    // Fallback: extraer manualmente
                    if (remoteJid.includes('@s.whatsapp.net')) {
                      phoneNumber = remoteJid.replace('@s.whatsapp.net', '');
                    } else if (remoteJid.includes('@c.us')) {
                      phoneNumber = remoteJid.replace('@c.us', '');
                    } else if (remoteJid.includes('@')) {
                      phoneNumber = remoteJid.split('@')[0];
                      logger.warn(`⚠️ JID especial detectado, usando parte antes de @: ${phoneNumber}`);
                    } else {
                      phoneNumber = remoteJid;
                    }
                  }
                }
                
                // Intentar obtener el número real del contacto desde el store de Baileys
                // Esto es necesario porque cuando el JID termina en @lid, es un ID interno
                try {
                  if (this.sock && remoteJid.includes('@lid')) {
                    logger.info(`🔍 JID termina en @lid, buscando número real desde store...`);
                    
                    // Intentar obtener el número real del contacto
                    let contact = null;
                    
                    // Método 1: Buscar en nuestro cache de contactos
                    if (this.contacts && this.contacts[remoteJid]) {
                      contact = this.contacts[remoteJid];
                      logger.info(`📞 Contacto encontrado en cache local`);
                      
                      // Extraer el número real del contacto
                      if (contact.jid) {
                        realPhoneNumber = contact.jid.replace('@s.whatsapp.net', '').replace('@c.us', '');
                        logger.info(`✅ Número real obtenido desde cache contact.jid: ${realPhoneNumber}`);
                      } else if (contact.id) {
                        realPhoneNumber = contact.id.replace('@s.whatsapp.net', '').replace('@c.us', '');
                        logger.info(`✅ Número real obtenido desde cache contact.id: ${realPhoneNumber}`);
                      }
                    }
                    
                    // Método 2: Intentar con onWhatsApp usando el número extraído
                    if (!realPhoneNumber && this.sock.onWhatsApp && phoneNumber) {
                      logger.info(`🔍 Intentando obtener número con onWhatsApp usando: ${phoneNumber}...`);
                      try {
                        // onWhatsApp necesita el número en formato @s.whatsapp.net
                        const checkJid = `${phoneNumber}@s.whatsapp.net`;
                        const result = await this.sock.onWhatsApp(checkJid);
                        if (result && result.length > 0 && result[0].exists && result[0].jid) {
                          realPhoneNumber = result[0].jid.replace('@s.whatsapp.net', '').replace('@c.us', '');
                          logger.info(`✅ Número real obtenido desde onWhatsApp: ${realPhoneNumber}`);
                        } else {
                          logger.warn(`⚠️ onWhatsApp no encontró número para ${checkJid}`);
                        }
                      } catch (onWhatsAppError) {
                        logger.warn(`⚠️ Error en onWhatsApp: ${onWhatsAppError.message}`);
                      }
                    }
                    
                    // Método 3: Buscar en nuestro cache de contactos
                    if (!realPhoneNumber && this.contacts) {
                      logger.info(`🔍 Buscando en cache de contactos...`);
                      try {
                        for (const [jid, contactData] of Object.entries(this.contacts)) {
                          if (jid === remoteJid || (contactData && (contactData.id === remoteJid || contactData.jid === remoteJid))) {
                            const foundJid = contactData?.jid || jid;
                            if (foundJid && foundJid.includes('@s.whatsapp.net')) {
                              realPhoneNumber = foundJid.replace('@s.whatsapp.net', '').replace('@c.us', '');
                              logger.info(`✅ Número real encontrado en cache: ${realPhoneNumber}`);
                              break;
                            }
                          }
                        }
                      } catch (cacheError) {
                        logger.warn(`⚠️ Error al buscar en cache: ${cacheError.message}`);
                      }
                    }
                  }
                } catch (contactError) {
                  logger.error(`❌ Error al obtener número real desde contacto: ${contactError.message}`);
                  logger.error(`   Stack: ${contactError.stack?.substring(0, 300)}`);
                }
                
              } catch (e) {
                // Fallback manual si falla la decodificación
                logger.warn(`⚠️ Error al decodificar JID, usando método manual: ${e.message}`);
                if (remoteJid.includes('@s.whatsapp.net')) {
                  phoneNumber = remoteJid.replace('@s.whatsapp.net', '');
                } else if (remoteJid.includes('@c.us')) {
                  phoneNumber = remoteJid.replace('@c.us', '');
                } else if (remoteJid.includes('@')) {
                  phoneNumber = remoteJid.split('@')[0];
                } else {
                  phoneNumber = remoteJid;
                }
              }
            }
            
            if (!phoneNumber) {
              logger.error('❌ ERROR: No se pudo extraer el número de teléfono del JID:', remoteJid);
              return;
            }
            
            // Usar el número real si está disponible, de lo contrario usar el extraído
            const phoneForSearch = realPhoneNumber || phoneNumber;
            
            // Log del formato original para debug
            logger.info(`📞 JID original: ${remoteJid}`);
            logger.info(`📞 Número extraído: ${phoneNumber}`);
            if (realPhoneNumber) {
              logger.info(`📞 Número real obtenido: ${realPhoneNumber}`);
            }
            logger.info(`📞 Número a usar para búsqueda: ${phoneForSearch}`);

            // Verificar si ya procesamos este mensaje
            const messageId = message.key.id;
            if (this.processedMessageIds.has(messageId)) {
              logger.debug('⚠️ Mensaje ya procesado, ignorando');
              return;
            }
            this.processedMessageIds.add(messageId);

            // Limpiar IDs antiguos (mantener solo los últimos 1000)
            if (this.processedMessageIds.size > 1000) {
              const idsArray = Array.from(this.processedMessageIds);
              this.processedMessageIds = new Set(idsArray.slice(-500));
            }

            logger.info(`📨 Mensaje recibido de ${phoneNumber} (JID: ${remoteJid})`);

            // Actualizar estado de conexión
            if (!this.connected) {
              this.connected = true;
              logger.info('✅ Conexión confirmada por recepción de mensaje');
            }

            // Procesar mensaje de texto
            if (message.message?.conversation || message.message?.extendedTextMessage?.text) {
              const text = message.message.conversation || message.message.extendedTextMessage?.text || '';
              logger.info(`📝 Mensaje de texto: ${text.substring(0, 100)}`);
              
              // Guardar el remoteJid original para usar en respuestas
              // Pasar phoneForSearch para buscar en BD y phoneNumber para sesión
              await this.processTextMessage(phoneForSearch, text, remoteJid);
            }
            // Procesar mensaje de voz
            else if (message.message?.audioMessage || message.message?.pttMessage) {
              logger.info('🎤 Mensaje de voz recibido');
              
              const audioMessage = message.message.audioMessage || message.message.pttMessage;
              if (audioMessage) {
                logger.debug('Audio message details:', {
                  hasAudioMessage: !!message.message.audioMessage,
                  hasPttMessage: !!message.message.pttMessage,
                  audioMessageKeys: audioMessage ? Object.keys(audioMessage) : []
                });
                // Guardar el remoteJid original para usar en respuestas
                // Pasar phoneForSearch para buscar en BD y phoneNumber para sesión
                await this.processVoiceMessageBaileys(phoneForSearch, audioMessage, remoteJid);
              } else {
                logger.warn('⚠️ Audio message object es null o undefined');
              }
            }
            // Otros tipos de mensaje
            else {
              logger.info('⚠️ Tipo de mensaje no soportado:', Object.keys(message.message || {})[0]);
              await this.sendMessage(remoteJid, 'Lo siento, solo puedo procesar mensajes de texto y voz.');
            }

          } catch (msgError) {
            logger.error('❌ Error al procesar mensaje:', msgError);
            logger.error('Stack:', msgError.stack?.substring(0, 500));
          }
        }
      });

      this.messageHandlersConfigured = true;
      logger.success('✅ Handlers de mensajes configurados exitosamente');
      logger.info('📱 El bot está listo para recibir mensajes');

      return true;

    } catch (error) {
      logger.error('❌ Error al configurar handlers de mensajes', error);
      return false;
    }
  }

  /**
   * Procesar mensaje de texto
   * Versión simplificada: Solo responde con mensaje básico
   */
  async processTextMessage(phoneNumber, text, remoteJid = null) {
    try {
      // Usar remoteJid original si está disponible
      const jidToUse = remoteJid || (phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`);
      
      logger.info(`📱 Procesando mensaje de texto de ${phoneNumber}`);
      
      // Respuesta simplificada
      const textLower = text.toLowerCase().trim();
      
      if (textLower.includes('hola') || textLower.includes('hi') || textLower.includes('buenos días') || textLower.includes('buenas')) {
        await this.sendMessage(jidToUse,
          `👋 *¡Hola!* 👋\n\n` +
          `Soy el bot de recetas médicas.\n\n` +
          `📋 Este sistema está diseñado para enviar recetas médicas por WhatsApp.\n\n` +
          `💡 Si necesitas recibir una receta médica, contacta con tu médico o farmacia.`
        );
      } else {
        await this.sendMessage(jidToUse,
          `👋 *Hola* 👋\n\n` +
          `Soy el bot de recetas médicas.\n\n` +
          `📋 Este sistema está diseñado para enviar recetas médicas por WhatsApp.\n\n` +
          `💡 Si necesitas recibir una receta médica, contacta con tu médico o farmacia.\n\n` +
          `Escribe *HOLA* para comenzar.`
        );
      }
      
    } catch (error) {
      logger.error('❌ Error al procesar mensaje de texto:', error);
      try {
        const jidToUse = remoteJid || (phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`);
        await this.sendMessage(jidToUse,
          `😅 Lo siento, hubo un error al procesar tu mensaje.\n\n` +
          `Por favor intenta de nuevo o escribe *HOLA* para comenzar.`
        );
      } catch (sendError) {
        logger.error('❌ Error crítico: No se pudo enviar mensaje de error', sendError);
      }
    }
  }

  /**
   * Manejar acciones del NLU (SIMPLIFICADO - No usado)
   */
  async handleAction(phoneNumberOrJid, action, actionData, sessionState) {
    // Método simplificado - no hace nada
    logger.warn(`Acción recibida pero no procesada (bot simplificado): ${action}`);
  }

  /**
   * Procesar mensaje de voz (SIMPLIFICADO)
   */
  async processVoiceMessageBaileys(phoneNumber, audioMessage, remoteJid = null) {
    try {
      // Usar remoteJid original si está disponible
      const jidToUse = remoteJid || (phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`);
      
      logger.info('🎤 Mensaje de voz recibido');
      await this.sendMessage(jidToUse,
        `🎤 *Mensaje de voz recibido* 🎤\n\n` +
        `Lo siento, actualmente solo puedo procesar mensajes de texto.\n\n` +
        `💡 Por favor, envía tu consulta por mensaje de texto.\n\n` +
        `Escribe *HOLA* para comenzar.`
      );
    } catch (error) {
      logger.error('❌ Error al procesar mensaje de voz:', error);
    }
  }

  /**
   * Generar sugerencias (SIMPLIFICADO - No usado)
   */
  _generateSuggestions(text) {
    // Método simplificado - no hace nada
    return null;
  }

  /**
   * Enviar mensaje
   */
  async sendMessage(phoneNumberOrJid, text) {
    try {
      if (!this.sock || !this.connected) {
        logger.error('❌ No hay socket disponible o no está conectado');
        return false;
      }

      // Si ya es un JID completo (contiene @), usarlo directamente
      // Si no, construir el JID
      let jid = phoneNumberOrJid;
      if (!jid.includes('@')) {
        jid = `${jid}@s.whatsapp.net`;
      }

      logger.info(`📤 Enviando mensaje a ${jid}: ${text.substring(0, 50)}...`);

      await this.sock.sendMessage(jid, { text });

      logger.success(`✅ Mensaje enviado a ${jid}`);
      return true;

    } catch (error) {
      logger.error('❌ Error al enviar mensaje:', error);
      logger.error(`   Intentó enviar a: ${phoneNumberOrJid}`);
      return false;
    }
  }

  /**
   * Enviar imagen
   */
  async sendImage(phoneNumber, imageBuffer, filename = 'image.png', caption = null) {
    try {
      if (!this.sock || !this.connected) {
        logger.error('❌ No hay socket disponible o no está conectado');
        return false;
      }

      // Formatear número de teléfono
      let jid = phoneNumber;
      if (!jid.includes('@')) {
        jid = `${jid}@s.whatsapp.net`;
      }

      logger.info(`📤 Enviando imagen a ${jid}: ${filename}`);

      await this.sock.sendMessage(jid, {
        image: imageBuffer,
        caption: caption || filename
      });

      logger.success(`✅ Imagen enviada a ${phoneNumber}`);
      return true;

    } catch (error) {
      logger.error('❌ Error al enviar imagen:', error);
      return false;
    }
  }

  /**
   * Obtener estado del bot
   */
  getStatus() {
    return {
      connected: this.connected,
      isConnecting: this.isConnecting,
      messageHandlersConfigured: this.messageHandlersConfigured,
      hasQr: !!this.qrCode
    };
  }

  /**
   * Verificar si está conectado
   */
  isConnected() {
    return this.connected && !!this.sock;
  }

  /**
   * Desconectar
   */
  async disconnect() {
    try {
      if (this.sock) {
        await this.sock.end();
        this.sock = null;
      }
      this.connected = false;
      this.isConnecting = false;
      logger.info('✅ Desconectado de WhatsApp');
    } catch (error) {
      logger.error('❌ Error al desconectar:', error);
    }
  }

  /**
   * Obtener información de debug
   */
  async getDebugInfo() {
    return {
      connected: this.connected,
      isConnecting: this.isConnecting,
      messageHandlersConfigured: this.messageHandlersConfigured,
      hasQr: !!this.qrCode,
      hasSocket: !!this.sock
    };
  }

  /**
   * Forzar verificación de conexión
   */
  async forceCheckConnection() {
    if (this.sock && this.connected) {
      return true;
    }
    return false;
  }

  /**
   * Forzar configuración de handlers
   */
  async forceConfigureHandlers() {
    if (this.messageHandlersConfigured) {
      return true;
    }
    return await this.setupMessageHandlers();
  }
}

module.exports = new WhatsAppHandler();

