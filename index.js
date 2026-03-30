const BITRATE = 384000;

let unpatchAll = [];

module.exports = {
  onLoad() {
    const vd = window.bunny || window.vendetta;
    if (!vd) return console.error("[RawAudio] No bunny/vendetta found");

    const { findByProps, findByStoreName } = vd.metro;
    const patcher = vd.patcher || vd.api?.patcher;
    const before = patcher?.before?.bind(patcher);

    // Strategy 1: Direct setTransportOptions
    try {
      const mod = findByProps("setTransportOptions");
      if (mod?.setTransportOptions) {
        const unpatch = before("setTransportOptions", mod, (args) => {
          const o = args[0];
          if (o?.audioEncoder) {
            o.audioEncoder.channels = 2;
            o.audioEncoder.rate = BITRATE;
            o.audioEncoder.params = Object.assign({}, o.audioEncoder.params, {
              stereo: "1", usedtx: "0", useinbandfec: "0",
              maxaveragebitrate: String(BITRATE),
            });
          }
          if (o?.encodingVoiceBitRate != null) o.encodingVoiceBitRate = BITRATE;
          if (o?.fec !== undefined) o.fec = false;
          console.log("[RawAudio] Patched transport: " + BITRATE + "bps stereo");
        });
        if (unpatch) unpatchAll.push(unpatch);
        console.log("[RawAudio] Hooked setTransportOptions");
      }
    } catch (e) { console.error("[RawAudio] S1:", e); }

    // Strategy 2: Connection prototype
    try {
      const mod2 = findByProps("updateVideoQuality", "setTransportOptions");
      if (mod2 && mod2 !== undefined) {
        const unpatch = before("setTransportOptions", mod2, (args) => {
          const o = args[0];
          if (o?.audioEncoder) {
            o.audioEncoder.channels = 2;
            o.audioEncoder.rate = BITRATE;
            o.audioEncoder.params = Object.assign({}, o.audioEncoder.params, {
              stereo: "1", usedtx: "0", useinbandfec: "0",
            });
          }
          if (o?.encodingVoiceBitRate != null) o.encodingVoiceBitRate = BITRATE;
          if (o?.fec !== undefined) o.fec = false;
        });
        if (unpatch) unpatchAll.push(unpatch);
        console.log("[RawAudio] Hooked via connection module");
      }
    } catch (e) { console.error("[RawAudio] S2:", e); }

    // Strategy 3: Prototype patch
    try {
      const mod3 = findByProps("getAttenuationOptions");
      if (mod3?.setBitRate) {
        const unpatch = before("setBitRate", mod3, (args) => {
          args[0] = BITRATE;
        });
        if (unpatch) unpatchAll.push(unpatch);
        console.log("[RawAudio] Hooked setBitRate");
      }
    } catch (e) { console.error("[RawAudio] S3:", e); }

    console.log("[RawAudio] Loaded - " + BITRATE + "bps stereo, no filters");
  },

  onUnload() {
    unpatchAll.forEach(u => u?.());
    unpatchAll = [];
    console.log("[RawAudio] Unloaded");
  },
};
