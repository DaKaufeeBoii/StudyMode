// StudyMode Audio Engine - Generative Lo-Fi & Multi-Stream Ambient System
// Supports 6 live 24/7 internet Lo-Fi radio streams + 4 offline Web Audio soundscapes.

class StudyAudioManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.isPlaying = false;
    this.currentMode = 'stream_chillhop'; // Default to 24/7 Live Chillhop Stream
    
    // Ambient layers
    this.vinylActive = true;
    this.rainActive = false;
    
    // Generators & nodes
    this.lofiTimer = null;
    this.currentChordProgression = 0;
    this.rainSource = null;
    this.rainGain = null;
    this.vinylSource = null;
    this.vinylGain = null;
    this.brownSource = null;
    this.brownGain = null;
    this.binauralOscL = null;
    this.binauralOscR = null;
    this.binauralGain = null;
    
    // Online stream audio element
    this.streamAudio = new Audio();
    this.streamAudio.crossOrigin = "anonymous";
    this.streamAudio.preload = "none";
    
    // Live 24/7 Internet Radio Streams
    this.streamStations = {
      'stream_chillhop': {
        name: '☕ Live: 24/7 Chillhop & Lofi',
        url: 'https://streams.ilovemusic.de/iloveradio17.mp3'
      },
      'stream_vgm_all': {
        name: '🎮 Live: Video Game Lofi & VGM',
        url: 'https://relay.rainwave.cc/all.mp3'
      },
      'stream_vgm_covers': {
        name: '🍄 Live: Nintendo & Game Remixes',
        url: 'https://relay.rainwave.cc/covers.mp3'
      },
      'stream_vgm_ocremix': {
        name: '⚔️ Live: OverClocked ReMix (VGM)',
        url: 'https://relay.rainwave.cc/ocremix.mp3'
      },
      'stream_vgm_chiptune': {
        name: '👾 Live: 8-Bit Chiptune Radio',
        url: 'https://relay.rainwave.cc/chiptune.mp3'
      },
      'stream_anime': {
        name: '🌸 Live: Anime & Cozy Lofi',
        url: 'https://stream.zeno.fm/0r0xa792kwzuv'
      },
      'stream_cafe': {
        name: '☕ Live: Cafe Lofi Beats',
        url: 'https://play.streamafrica.net/lofiradio'
      },
      'stream_berlin': {
        name: '🏙️ Live: Berlin Lofi Radio',
        url: 'https://lofi.stream.laut.fm/lofi'
      },
      'stream_nightwave': {
        name: '🌌 Live: Nightwave Plaza (Vaporwave/Chill)',
        url: 'https://radio.plaza.one/mp3'
      },
      'stream_chillout': {
        name: '🍃 Live: Ambient Chillout Lounge',
        url: 'https://hirschmilch.de:7000/chillout.mp3'
      }
    };

    // YouTube Live Streams catalog for the Visual Lounge
    this.youtubeStreams = [
      { id: 'jfKfPfyJRdk', title: 'Lofi Girl — beats to relax/study to', icon: '🎧' },
      { id: '1fueZCTYkpA', title: 'Nintendo Lofi Beats — Zelda & Mario', icon: '🍄' },
      { id: 'x_7sXb_x228', title: 'Animal Crossing Lofi — 24/7 Study', icon: '🍃' },
      { id: '4xDzrJKXOOY', title: 'Synthwave Boy — beats to chill/game to', icon: '🌆' },
      { id: '5yx6BWlEVcY', title: 'Chillhop Radio — jazzy & lofi hip hop', icon: '🦝' },
      { id: 'lTRiuFIWV54', title: 'Cozy Rainy Cafe — deep ambient focus', icon: '🌧️' }
    ];
    
    this.volume = 0.65;
  }

  initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
    if (this.streamAudio) {
      this.streamAudio.volume = this.volume;
    }
  }

  togglePlay() {
    this.initContext();
    if (this.isPlaying) {
      this.stop();
      return false;
    } else {
      this.start();
      return true;
    }
  }

  setMode(mode) {
    this.currentMode = mode;
    if (this.isPlaying) {
      this.stopAllGenerators();
      this.startCurrentMode();
    }
  }

  start() {
    this.initContext();
    this.isPlaying = true;
    this.startCurrentMode();
    if (this.vinylActive && (this.currentMode === 'lofi_synth' || this.currentMode.startsWith('stream_'))) {
      this.startVinyl();
    }
    if (this.rainActive) {
      this.startRain();
    }
  }

  stop() {
    this.isPlaying = false;
    this.stopAllGenerators();
    if (this.streamAudio) {
      this.streamAudio.pause();
    }
  }

  startCurrentMode() {
    if (this.currentMode.startsWith('stream_')) {
      const station = this.streamStations[this.currentMode];
      if (station) {
        this.startOnlineStream(station.url);
      } else {
        this.startOnlineStream(this.streamStations['stream_chillhop'].url);
      }
      return;
    }

    switch (this.currentMode) {
      case 'lofi_synth':
        this.startLofiSynth();
        break;
      case 'rain':
        this.startRain(true);
        break;
      case 'binaural':
        this.startBinaural();
        break;
      case 'brown_noise':
        this.startBrownNoise();
        break;
      default:
        this.startOnlineStream(this.streamStations['stream_chillhop'].url);
        break;
    }
  }

  stopAllGenerators() {
    // Stop Lo-Fi Synth
    if (this.lofiTimer) {
      clearInterval(this.lofiTimer);
      this.lofiTimer = null;
    }
    // Stop Rain
    if (this.rainSource) {
      try { this.rainSource.stop(); } catch(e) {}
      this.rainSource = null;
    }
    // Stop Vinyl
    if (this.vinylSource) {
      try { this.vinylSource.stop(); } catch(e) {}
      this.vinylSource = null;
    }
    // Stop Brown Noise
    if (this.brownSource) {
      try { this.brownSource.stop(); } catch(e) {}
      this.brownSource = null;
    }
    // Stop Binaural
    if (this.binauralOscL) {
      try { this.binauralOscL.stop(); } catch(e) {}
      this.binauralOscL = null;
    }
    if (this.binauralOscR) {
      try { this.binauralOscR.stop(); } catch(e) {}
      this.binauralOscR = null;
    }
    // Stop Stream
    if (this.streamAudio) {
      this.streamAudio.pause();
    }
  }

  // --- 1. ONLINE LIVE STREAM ENGINE ---
  startOnlineStream(url) {
    if (!this.streamAudio) {
      this.streamAudio = new Audio();
      this.streamAudio.crossOrigin = "anonymous";
    }
    this.streamAudio.pause();
    this.streamAudio.src = url;
    this.streamAudio.volume = this.volume;
    
    const playPromise = this.streamAudio.play();
    if (playPromise !== undefined) {
      playPromise.catch(err => {
        console.warn("Live stream network hiccup, gracefully falling back to offline Lo-Fi synth:", err);
        this.currentMode = 'lofi_synth';
        this.startLofiSynth();
      });
    }
  }

  // --- 2. GENERATIVE LO-FI ELECTRIC PIANO CHORDS (OFFLINE) ---
  startLofiSynth() {
    // 3 Different smooth jazz chord progressions
    const progressions = [
      // Progression 1: Classic Neo-Soul (Dm9 -> G13 -> Cmaj9 -> Am9)
      [
        [146.83, 220.00, 261.63, 329.63, 392.00], // Dm9: D3, A3, C4, E4, G4
        [196.00, 246.94, 293.66, 329.63, 349.23], // G13: G3, B3, D4, E4, F4
        [130.81, 196.00, 246.94, 293.66, 329.63], // Cmaj9: C3, G3, B3, D4, E4
        [220.00, 261.63, 329.63, 392.00, 493.88]  // Am9: A3, C4, E4, G4, B4
      ],
      // Progression 2: Rainy Cafe (Fmaj7 -> Em7 -> Dm7 -> Cmaj7)
      [
        [174.61, 261.63, 329.63, 349.23, 440.00], // Fmaj7
        [164.81, 246.94, 293.66, 329.63, 392.00], // Em7
        [146.83, 220.00, 261.63, 293.66, 349.23], // Dm7
        [130.81, 196.00, 246.94, 329.63, 392.00]  // Cmaj7
      ],
      // Progression 3: Late Night Rhodes (Bbmaj9 -> Am7 -> Gm9 -> Fmaj9)
      [
        [116.54, 174.61, 233.08, 293.66, 349.23], // Bbmaj9
        [110.00, 164.81, 220.00, 261.63, 329.63], // Am7
        [98.00, 146.83, 196.00, 246.94, 293.66],  // Gm9
        [87.31, 130.81, 174.61, 220.00, 261.63]   // Fmaj9
      ],
      // Progression 4: Zelda / Nintendo Nostalgia (Cmaj7 -> Em7 -> Fmaj7 -> Gsus4)
      [
        [130.81, 196.00, 246.94, 329.63, 392.00], // Cmaj7: C3, G3, B3, E4, G4
        [164.81, 246.94, 293.66, 329.63, 392.00], // Em7: E3, B3, D4, E4, G4
        [174.61, 261.63, 329.63, 349.23, 440.00], // Fmaj7: F3, C4, E4, F4, A4
        [196.00, 261.63, 293.66, 349.23, 392.00]  // Gsus4: G3, C4, D4, F4, G4
      ]
    ];

    const currentProg = progressions[this.currentChordProgression % progressions.length];
    this.currentChordProgression++;

    let chordIndex = 0;
    const playNext = () => {
      if (!this.isPlaying || this.currentMode !== 'lofi_synth') return;
      const notes = currentProg[chordIndex % currentProg.length];
      chordIndex++;
      this.playRhodesChord(notes, 4.0);
    };

    playNext();
    this.lofiTimer = setInterval(playNext, 4200);
  }

  playRhodesChord(freqs, duration) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    freqs.forEach((freq, idx) => {
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const noteGain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      // Warm vintage low-pass filter
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(850 + idx * 80, now);
      filter.frequency.exponentialRampToValueAtTime(320, now + duration);

      osc1.type = 'sine';
      osc2.type = 'triangle';

      const detune = (idx % 2 === 0 ? 1 : -1) * (2 + Math.random() * 3);
      osc1.frequency.setValueAtTime(freq, now);
      osc2.frequency.setValueAtTime(freq + detune, now);

      const stagger = idx * 0.045;
      const startTime = now + stagger;

      noteGain.gain.setValueAtTime(0.0001, startTime);
      noteGain.gain.linearRampToValueAtTime(0.07 / (1 + idx * 0.2), startTime + 0.08);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(noteGain);
      noteGain.connect(this.masterGain);

      osc1.start(startTime);
      osc2.start(startTime);
      osc1.stop(startTime + duration + 0.1);
      osc2.stop(startTime + duration + 0.1);
    });
  }

  // --- 3. RAIN SOUNDSCAPE ---
  startRain(isSolo = false) {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    this.rainSource = this.ctx.createBufferSource();
    this.rainSource.buffer = buffer;
    this.rainSource.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, this.ctx.currentTime);

    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.setValueAtTime(isSolo ? 0.35 : 0.15, this.ctx.currentTime);

    this.rainSource.connect(filter);
    filter.connect(this.rainGain);
    this.rainGain.connect(this.masterGain);

    this.rainSource.start();
  }

  // --- 4. ANALOG VINYL CRACKLE ---
  startVinyl() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      const isPop = Math.random() < 0.0025;
      data[i] = isPop ? (Math.random() * 2 - 1) * 0.8 : (Math.random() * 2 - 1) * 0.015;
    }

    this.vinylSource = this.ctx.createBufferSource();
    this.vinylSource.buffer = buffer;
    this.vinylSource.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2500, this.ctx.currentTime);
    filter.Q.setValueAtTime(1.5, this.ctx.currentTime);

    this.vinylGain = this.ctx.createGain();
    this.vinylGain.gain.setValueAtTime(0.12, this.ctx.currentTime);

    this.vinylSource.connect(filter);
    filter.connect(this.vinylGain);
    this.vinylGain.connect(this.masterGain);

    this.vinylSource.start();
  }

  // --- 5. 40Hz GAMMA DEEP FOCUS BINAURAL BEATS ---
  startBinaural() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    // Left ear 200 Hz, Right ear 240 Hz -> 40 Hz Gamma wave entrainment for sharp cognitive focus
    this.binauralOscL = this.ctx.createOscillator();
    this.binauralOscR = this.ctx.createOscillator();
    this.binauralOscL.type = 'sine';
    this.binauralOscR.type = 'sine';
    this.binauralOscL.frequency.setValueAtTime(200, now);
    this.binauralOscR.frequency.setValueAtTime(240, now);

    const merger = this.ctx.createChannelMerger(2);
    this.binauralOscL.connect(merger, 0, 0); // left channel
    this.binauralOscR.connect(merger, 0, 1); // right channel

    this.binauralGain = this.ctx.createGain();
    this.binauralGain.gain.setValueAtTime(0.15, now);

    merger.connect(this.binauralGain);
    this.binauralGain.connect(this.masterGain);

    this.binauralOscL.start();
    this.binauralOscR.start();
  }

  // --- 6. BROWN NOISE (PURE FOCUS / ADHD CALMING) ---
  startBrownNoise() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = data[i];
      data[i] *= 1.8;
    }

    this.brownSource = this.ctx.createBufferSource();
    this.brownSource.buffer = buffer;
    this.brownSource.loop = true;

    this.brownGain = this.ctx.createGain();
    this.brownGain.gain.setValueAtTime(0.3, this.ctx.currentTime);

    this.brownSource.connect(this.brownGain);
    this.brownGain.connect(this.masterGain);

    this.brownSource.start();
  }

  // --- TOGGLE AMBIENT LAYERS ---
  toggleVinyl() {
    this.vinylActive = !this.vinylActive;
    if (this.vinylActive && this.isPlaying) {
      this.startVinyl();
    } else if (!this.vinylActive && this.vinylSource) {
      try { this.vinylSource.stop(); } catch(e){}
      this.vinylSource = null;
    }
    return this.vinylActive;
  }

  toggleRain() {
    this.rainActive = !this.rainActive;
    if (this.rainActive && this.isPlaying) {
      this.startRain(false);
    } else if (!this.rainActive && this.rainSource && this.currentMode !== 'rain') {
      try { this.rainSource.stop(); } catch(e){}
      this.rainSource = null;
    }
    return this.rainActive;
  }

  // --- SOFT CHIME FOR TIMER ---
  playTimerBell() {
    this.initContext();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const bellGain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now); // A5
    osc.frequency.exponentialRampToValueAtTime(440, now + 1.2);

    bellGain.gain.setValueAtTime(0.001, now);
    bellGain.gain.exponentialRampToValueAtTime(0.4, now + 0.05);
    bellGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);

    osc.connect(bellGain);
    bellGain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 2.6);
  }
}

window.studyAudio = new StudyAudioManager();
