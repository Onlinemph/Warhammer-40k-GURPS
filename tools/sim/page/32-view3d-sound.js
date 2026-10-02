// Part of makeView3D, one function body split into files by section (tools/sim/page/30-37): the locals and
// helpers declared in earlier parts are in scope here. tools/sim/README.md has the layout.
    // ================= sound (optional, from the same local pack as the models)
    // tools/dow/build_pack.py also writes site/models/sounds.js: the game's own weapon, impact, explosion and melee
    // sounds, as it stores them (IMA ADPCM, a quarter the size of plain samples), keyed by what happens in the
    // replay: "fire.bolt", "hit.armour", "blast", "swing.chain"... A key may end in a race ("fire.slug.ork") for a
    // sound only that race makes. Nothing plays unless the Sound button is on and the replay is running. The units'
    // voices come the same way (further down).
    const SND = { ctx: null, out: null, lib: null, bufs: new Map(), last: new Map(), live: 0, on: false };
    const ADPCM_STEP = [7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45, 50, 55, 60, 66, 73, 80, 88, 97, 107, 118, 130, 143, 157, 173, 190, 209, 230, 253, 279, 307, 337, 371, 408, 449, 494, 544, 598, 658, 724, 796, 876, 963, 1060, 1166, 1282, 1411, 1552, 1707, 1878, 2066, 2272, 2499, 2749, 3024, 3327, 3660, 4026, 4428, 4871, 5358, 5894, 6484, 7132, 7845, 8630, 9493, 10442, 11487, 12635, 13899, 15289, 16818, 18500, 20350, 22385, 24623, 27086, 29794, 32767];
    const ADPCM_MOVE = [-1, -1, -1, -1, 2, 4, 6, 8];
    // blocks of 36 bytes: a starting sample and step index, then 64 four-bit steps, low half of each byte first
    function decodeAdpcm(b64, loop) {
      const raw = atob(b64), n = Math.floor(raw.length / 36), out = new Float32Array(n * 64);
      let at = 0;
      for (let b = 0; b < n * 36; b += 36) {
        let pred = (raw.charCodeAt(b) | raw.charCodeAt(b + 1) << 8) << 16 >> 16, idx = Math.min(88, raw.charCodeAt(b + 2));
        for (let k = 4; k < 36; k++) {
          const byte = raw.charCodeAt(b + k);
          for (let half = 0; half < 2; half++) {
            const nib = half ? byte >> 4 : byte & 15, step = ADPCM_STEP[idx];
            let diff = step >> 3; if (nib & 1) diff += step >> 2; if (nib & 2) diff += step >> 1; if (nib & 4) diff += step;
            pred = Math.max(-32768, Math.min(32767, nib & 8 ? pred - diff : pred + diff));
            idx = Math.max(0, Math.min(88, idx + ADPCM_MOVE[nib & 7]));
            out[at++] = pred / 32768;
          }
        }
      }
      return levelled(out, loop);
    }
    // 8-bit mu-law, one byte a sample: what the pack holds for sounds that weren't ADPCM in their game
    function decodeUlaw(b64) {
      const raw = atob(b64), out = new Float32Array(raw.length);
      for (let i = 0; i < raw.length; i++) { const y = raw.charCodeAt(i) / 127.5 - 1; out[i] = Math.sign(y) * (Math.pow(256, Math.abs(y)) - 1) / 255; }
      return levelled(out);
    }
    function levelled(out, loop) {
      // even out the recordings (they differ sixfold in loudness), and fade the end: a long one may have been cut
      let sq = 0, peak = .01; for (let i = 0; i < out.length; i++) { sq += out[i] * out[i]; peak = Math.max(peak, Math.abs(out[i])); }
      const level = Math.min(1.2 / peak, Math.max(.4, Math.min(2.5, .22 / Math.max(.01, Math.sqrt(sq / Math.max(1, out.length)))))), tail = Math.min(4000, out.length >> 2);
      for (let i = 0; i < out.length; i++) out[i] *= level * (loop ? 1 : Math.min(1, (out.length - i) / tail));   // a loop runs into its own start: no fade
      return out;
    }
    function soundBuffer(key, i, item, loop) {
      const id = key + "#" + i;
      if (!SND.bufs.has(id)) { const pcm = item[2] === "u" ? decodeUlaw(item[1]) : decodeAdpcm(item[1], loop), buf = SND.ctx.createBuffer(1, Math.max(1, pcm.length), item[0]); buf.getChannelData(0).set(pcm); SND.bufs.set(id, buf); }
      return SND.bufs.get(id);
    }
    const raceOf = F => { const f = ros[F.i].faction || ""; return /Ork/.test(f) ? "ork" : /Tyranid/.test(f) ? "nid" : /Aeldari|Drukhari/.test(f) ? "eld" : /Guard|Cultist/.test(f) ? "ig" : ""; };
    // where: a figure, or a point; louder near the camera, and from the side of the screen it is on
    function playSound(key, where, vol = 1) {
      if (!SND.on || !SND.lib || !lastSt.playing) return;
      const F = where && where.g ? where : null, pos = F ? F.g.position : where;
      const full = F && SND.lib[key + "." + raceOf(F)] ? key + "." + raceOf(F) : SND.lib[key] ? key : key.split(".")[0];
      const list = SND.lib[full]; if (!list || !list.length) return;
      const now = SND.ctx.currentTime;
      if (now - (SND.last.get(full) ?? -1) < .045 || SND.live >= 18) return;   // a volley is a few voices, not forty
      SND.last.set(full, now);
      const i = Math.floor(rnd() * list.length);
      SND.live++; emit(soundBuffer(full, i, list[i]), pos, vol, .95 + rnd() * .1, () => { SND.live--; });
    }
    function emit(buffer, pos, vol, rate, done) {
      const src = SND.ctx.createBufferSource(), gain = SND.ctx.createGain();
      src.buffer = buffer; src.playbackRate.value = rate;
      gain.gain.value = Math.min(1, vol * 14 / (10 + (pos ? camera.position.distanceTo(pos) : 10)));
      let end = gain;
      if (pos && SND.ctx.createStereoPanner) { end = SND.ctx.createStereoPanner(); end.pan.value = Math.max(-1, Math.min(1, pos.clone().project(camera).x)) * .7; gain.connect(end); }
      src.connect(gain); end.connect(SND.out);
      src.onended = done;
      src.start();
    }

    // ---- voices (optional, from the same pack): the units' own lines from Dawn of War II. site/models/voices.js says
    // which roster entries speak with which voices; each voice is a file of its own (voice_<id>.js), fetched only for
    // the voices in this battle. A voice has lines by event: "attack", "charge", "fire" (under fire), "kill", "down"
    // (a comrade falls), and the grunts "pain", "effort" and "death"; "attack.o" is a line said only of Orks.
    const VOX = { rules: null, of: new Map(), lib: {}, live: 0, grunts: 0, lastLine: -9, lastBy: new Map() };
    const GRUNT = { pain: 1, effort: 1, death: 1 };
    const foeLetter = F => { const f = ros[F.i].faction || ""; return /Heretic|Chaos|Rubric/.test(f) ? "c" : /Astartes|Custodes|Deathwatch/.test(f) ? "s" : /Aeldari|Drukhari/.test(f) ? "e" : /Ork/.test(f) ? "o" : /Tyranid/.test(f) ? "t" : /Militarum|Guard/.test(f) ? "i" : ""; };
    async function loadVoices() {
      if (VOX.rules) return;
      VOX.rules = [];
      try { if (!window.DOW_VOICES) await loadScript(PACK + "voices.js"); } catch (e) { return; }   // a pack without voices
      VOX.rules = window.DOW_VOICES.rules.map(r => ({ ...r, re: new RegExp(r.match), nre: r.not ? new RegExp(r.not) : null }));
      const share = new Map();   // a rule with several voices deals them out in turn
      figs.forEach(F => {
        const r = ros[F.i], s = `${r.faction || ""} ${r.template || ""} ${r.veh || ""} | ${r.kit || ""}`, rule = VOX.rules.find(u => u.re.test(s) && !(u.nre && u.nre.test(s)));
        if (!rule) return;
        const n = share.get(rule) || 0; share.set(rule, n + 1); VOX.of.set(F.i, rule.voices[n % rule.voices.length]);
      });
      for (const id of new Set(VOX.of.values())) loadScript(PACK + "voice_" + id + ".js").then(() => { VOX.lib[id] = (window.DOW_VOICE || {})[id]; }, () => {});
    }
    // a figure speaks. Lines don't pile up: two at once at most, a breath between them, and nobody again for a while;
    // grunts and screams are short and come freely. `foe` picks a line about that foe's race when the voice has one.
    function say(F, event, foe, chance = 1) {
      if (!SND.on || !lastSt.playing || !F || rnd() > chance) return;
      const id = VOX.of.get(F.i), lib = id && VOX.lib[id]; if (!lib) return;
      const now = SND.ctx.currentTime, grunt = GRUNT[event], since = now - (VOX.lastBy.get(F.i) ?? -9);
      if (grunt ? VOX.grunts >= 4 || (event !== "death" && since < .6) : VOX.live >= 2 || now - VOX.lastLine < 1.1 || since < 6) return;
      const about = foe ? event + "." + foeLetter(foe) : "", key = lib[about] && (!lib[event] || rnd() < .4) ? about : event, list = lib[key];
      if (!list) return;
      const i = Math.floor(rnd() * list.length);
      VOX.lastBy.set(F.i, now);
      if (grunt) { VOX.grunts++; emit(soundBuffer("voice:" + id + ":" + key, i, list[i]), F.g.position, 1.3, .97 + rnd() * .06, () => { VOX.grunts--; }); return; }
      VOX.live++; VOX.lastLine = now;
      emit(soundBuffer("voice:" + id + ":" + key, i, list[i]), F.g.position, 1.7, 1, () => { VOX.live--; });
    }
    // ---- loops: the distant battle under everything, and for each vehicle its engine and, as it drives, its tracks
    const LOOPS = { amb: null, veh: new Map() };
    function startLoop(key, i) {
      const list = SND.lib[key]; if (!list || !list.length) return null;
      const src = SND.ctx.createBufferSource(), gain = SND.ctx.createGain();
      src.buffer = soundBuffer(key, i % list.length, list[i % list.length], true); src.loop = true; gain.gain.value = 0;
      src.connect(gain); gain.connect(SND.out); src.start(0, rnd() * src.buffer.duration);
      return gain.gain;
    }
    function loopSounds() {
      if (!SND.ctx || !SND.lib) return;
      const on = SND.on && lastSt.playing, now = SND.ctx.currentTime, set = (g, v) => { if (g) g.setTargetAtTime(v, now, .25); };
      if (on && !LOOPS.amb) LOOPS.amb = { g: startLoop("ambience", Math.floor(rnd() * 8)) };
      if (LOOPS.amb) set(LOOPS.amb.g, on ? .45 : 0);
      for (const F of figs) {
        if (!F.veh || F.walker) continue;
        let L = LOOPS.veh.get(F.i);
        const alive = on && F.g.visible && !deathOf(F.i, last.t), near = alive ? Math.min(1, 9 / (10 + camera.position.distanceTo(F.g.position))) : 0;
        if (!L) { if (!alive) continue; LOOPS.veh.set(F.i, L = { engine: startLoop(SND.lib["engine." + raceOf(F)] ? "engine." + raceOf(F) : "engine", F.i), treads: F.model && F.model.tracks ? startLoop("treads", F.i) : null }); }
        set(L.engine, near * (.45 + .55 * F.walk)); set(L.treads, near * F.walk);
      }
    }
    // true if sound is now as asked; false if there is no sound pack or no audio here
    async function setSound(on) {
      if (!on) { SND.on = false; return true; }
      try { if (!window.DOW_SOUNDS) await loadScript(PACK + "sounds.js"); } catch (e) { return false; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!window.DOW_SOUNDS || !AC) return false;
      SND.lib = window.DOW_SOUNDS;
      if (!SND.ctx) {
        SND.ctx = new AC(); SND.out = SND.ctx.createGain(); SND.out.gain.value = .55;
        const squash = SND.ctx.createDynamicsCompressor(); SND.out.connect(squash); squash.connect(SND.ctx.destination);
        keep({ dispose() { SND.on = false; SND.ctx.close(); } });
      }
      if (SND.ctx.state === "suspended") await SND.ctx.resume();
      SND.on = true; loadVoices(); return true;
    }
