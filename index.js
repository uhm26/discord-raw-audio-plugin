const BITRATE = 384000;

const plugin = definePlugin({
  start() {
    const logger = bunny.plugin.logger;
    logger.info("Raw Audio Patcher starting...");

    // Strategy 1: Find and patch setTransportOptions on voice connections
    try {
      const voiceModule = bunny.metro.findByProps("setTransportOptions");
      if (voiceModule) {
        bunny.api.patcher.before("setTransportOptions", voiceModule, (args) => {
          const options = args[0];
          if (options?.audioEncoder) {
            options.audioEncoder.channels = 2;
            options.audioEncoder.rate = BITRATE;
            options.audioEncoder.params = Object.assign(
              {},
              options.audioEncoder.params,
              { stereo: "1", usedtx: "0", useinbandfec: "0", maxaveragebitrate: String(BITRATE) }
            );
          }
          if (options?.encodingVoiceBitRate != null) {
            options.encodingVoiceBitRate = BITRATE;
          }
          if (options?.fec !== undefined) {
            options.fec = false;
          }
          logger.info("Patched transport options: " + BITRATE + "bps stereo");
        });
        logger.info("Hooked setTransportOptions via findByProps");
      }
    } catch (e) {
      logger.error("Strategy 1 failed: " + e);
    }

    // Strategy 2: Find the connection prototype and patch there
    try {
      const connModule = bunny.metro.findByProps("updateVideoQuality", "setTransportOptions");
      if (connModule && connModule !== undefined) {
        bunny.api.patcher.before("setTransportOptions", connModule, (args) => {
          const options = args[0];
          if (options?.audioEncoder) {
            options.audioEncoder.channels = 2;
            options.audioEncoder.rate = BITRATE;
            options.audioEncoder.params = Object.assign(
              {},
              options.audioEncoder.params,
              { stereo: "1", usedtx: "0", useinbandfec: "0" }
            );
          }
          if (options?.encodingVoiceBitRate != null) {
            options.encodingVoiceBitRate = BITRATE;
          }
          if (options?.fec !== undefined) {
            options.fec = false;
          }
        });
        logger.info("Hooked setTransportOptions via connection module");
      }
    } catch (e) {
      logger.error("Strategy 2 failed: " + e);
    }

    // Strategy 3: Find by prototype fields (like Vencord/BetterDiscord approach)
    try {
      const protoModule = bunny.metro.findByProps("getAttenuationOptions");
      if (protoModule) {
        // Patch setBitRate to prevent Discord from overriding our bitrate
        if (protoModule.setBitRate) {
          bunny.api.patcher.instead("setBitRate", protoModule, (args, orig) => {
            // Force our bitrate instead of whatever Discord wants
            return orig.call(this, BITRATE);
          });
          logger.info("Hooked setBitRate");
        }
      }
    } catch (e) {
      logger.error("Strategy 3 failed: " + e);
    }

    // Strategy 4: Intercept Flux events related to voice
    try {
      bunny.api.flux.intercept((event) => {
        if (event.type === "MEDIA_ENGINE_SET_TRANSPORT_OPTIONS") {
          if (event.transportOptions?.audioEncoder) {
            event.transportOptions.audioEncoder.channels = 2;
            event.transportOptions.audioEncoder.rate = BITRATE;
            event.transportOptions.audioEncoder.params = Object.assign(
              {},
              event.transportOptions.audioEncoder.params,
              { stereo: "1", usedtx: "0", useinbandfec: "0" }
            );
          }
          if (event.transportOptions?.encodingVoiceBitRate != null) {
            event.transportOptions.encodingVoiceBitRate = BITRATE;
          }
        }
      });
      logger.info("Intercepting Flux voice events");
    } catch (e) {
      logger.error("Strategy 4 failed: " + e);
    }

    // Strategy 5: Find MediaEngineStore and patch getMediaEngine
    try {
      const mediaEngine = bunny.metro.findByProps("getMediaEngine");
      if (mediaEngine) {
        const engine = mediaEngine.getMediaEngine();
        if (engine?.setTransportOptions) {
          const origSet = engine.setTransportOptions.bind(engine);
          engine.setTransportOptions = function(options) {
            if (options?.audioEncoder) {
              options.audioEncoder.channels = 2;
              options.audioEncoder.rate = BITRATE;
              options.audioEncoder.params = Object.assign(
                {},
                options.audioEncoder.params,
                { stereo: "1", usedtx: "0", useinbandfec: "0" }
              );
            }
            if (options?.encodingVoiceBitRate != null) {
              options.encodingVoiceBitRate = BITRATE;
            }
            if (options?.fec !== undefined) {
              options.fec = false;
            }
            return origSet(options);
          };
          logger.info("Patched MediaEngine.setTransportOptions directly");
        }
      }
    } catch (e) {
      logger.error("Strategy 5 failed: " + e);
    }

    logger.info("Raw Audio Patcher loaded - " + BITRATE + "bps stereo, no FEC/DTX");
  },

  stop() {
    bunny.plugin.logger.info("Raw Audio Patcher stopped");
  },
});
