/**
 * ========================================================
 * 시골 마루의 밥알 세기 - 오디오 시스템 (audio.js)
 * Web Audio API를 활용한 순수 절차적 합성 사운드 엔진
 * (어쿠스틱 시골 BGM, 시냇물 소리, 새소리, 바람, 젓가락/밥알 SFX, 폭죽음)
 * ========================================================
 */

class CountryAudioEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.masterVolume = 0.7;

    // 게인 노드들
    this.masterGain = null;
    this.bgmGain = null;
    this.ambientGain = null;
    this.sfxGain = null;

    // 앰비언스 노드들
    this.riverNode = null;
    this.windNode = null;
    this.birdTimer = null;
    this.dogTimer = null;
    this.bgmTimer = null;

    this.isInitialized = false;
    this.isPlaying = false;
  }

  // 사용자 제스처(클릭) 시 오디오 컨텍스트 초기화
  init() {
    if (this.isInitialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();

      // 마스터 게인
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // BGM 게인
      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      this.bgmGain.connect(this.masterGain);

      // 앰비언스 게인
      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
      this.ambientGain.connect(this.masterGain);

      // SFX 게인
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(0.65, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      this.isInitialized = true;
      this.startAmbience();
      this.startPeacefulBGM();
      this.isPlaying = true;
    } catch (e) {
      console.warn('Web Audio API not supported or blocked:', e);
    }
  }

  // 볼륨 제어
  setVolume(vol) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime, 0.05);
    }
  }

  // 음소거 토글
  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime, 0.05);
    }
    return !this.isMuted;
  }

  // ========================================================
  // 1. 자연의 소리 (시냇물 + 산들바람 + 새소리)
  // ========================================================
  startAmbience() {
    if (!this.ctx) return;
    this.createRiverStreamSound();
    this.createGentleWindSound();
    this.scheduleBirdChirps();
    this.scheduleDogBarks();
  }

  // 시원한 강물/시냇물 흐르는 소리 (Pink Noise + Bandpass Filter + LFO)
  createRiverStreamSound() {
    const bufferSize = this.ctx.sampleRate * 3;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    // 핑크 노이즈 생성
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.08;
      b6 = white * 0.115926;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    // 시냇물 느낌의 밴드패스 필터
    const bandpass = this.ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(650, this.ctx.currentTime);
    bandpass.Q.setValueAtTime(1.8, this.ctx.currentTime);

    // 물결 출렁임을 주는 LFO
    const lfo = this.ctx.createOscillator();
    lfo.frequency.setValueAtTime(0.35, this.ctx.currentTime);
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(180, this.ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(bandpass.frequency);

    const streamGain = this.ctx.createGain();
    streamGain.gain.setValueAtTime(0.55, this.ctx.currentTime);

    whiteNoise.connect(bandpass);
    bandpass.connect(streamGain);
    streamGain.connect(this.ambientGain);

    whiteNoise.start();
    lfo.start();
  }

  // 살랑살랑 부는 산들바람 소리
  createGentleWindSound() {
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * 0.04;
    }

    const windSource = this.ctx.createBufferSource();
    windSource.buffer = noiseBuffer;
    windSource.loop = true;

    const lowpass = this.ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(320, this.ctx.currentTime);

    const windLFO = this.ctx.createOscillator();
    windLFO.frequency.setValueAtTime(0.12, this.ctx.currentTime);
    const windLFOGain = this.ctx.createGain();
    windLFOGain.gain.setValueAtTime(120, this.ctx.currentTime);
    windLFO.connect(windLFOGain);
    windLFOGain.connect(lowpass.frequency);

    const windGain = this.ctx.createGain();
    windGain.gain.setValueAtTime(0.4, this.ctx.currentTime);

    windSource.connect(lowpass);
    lowpass.connect(windGain);
    windGain.connect(this.ambientGain);

    windSource.start();
    windLFO.start();
  }

  // 주기적으로 지저귀는 맑고 고운 시골 새소리
  scheduleBirdChirps() {
    const playChirp = () => {
      if (this.ctx && !this.isMuted) {
        this.playSingleBirdChirp();
      }
      // 3.5초 ~ 8.5초 사이 랜덤 주기
      const nextDelay = 3500 + Math.random() * 5000;
      this.birdTimer = setTimeout(playChirp, nextDelay);
    };
    this.birdTimer = setTimeout(playChirp, 2000);
  }

  playSingleBirdChirp() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    // 시골 참새/박새의 지저귐 주파수 패턴 (빠른 상승 및 굴림)
    const baseFreq = 2200 + Math.random() * 800;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq + 1200, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(baseFreq + 400, now + 0.16);
    osc.frequency.exponentialRampToValueAtTime(baseFreq + 1600, now + 0.22);
    osc.frequency.exponentialRampToValueAtTime(baseFreq - 200, now + 0.32);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.ambientGain);

    osc.start(now);
    osc.stop(now + 0.36);

    // 간혹 더블 짹짹
    if (Math.random() > 0.45) {
      setTimeout(() => {
        if (!this.ctx) return;
        const t2 = this.ctx.currentTime;
        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(baseFreq + 300, t2);
        osc2.frequency.exponentialRampToValueAtTime(baseFreq + 1800, t2 + 0.1);
        osc2.frequency.exponentialRampToValueAtTime(baseFreq, t2 + 0.22);

        gain2.gain.setValueAtTime(0, t2);
        gain2.gain.linearRampToValueAtTime(0.15, t2 + 0.03);
        gain2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.24);

        osc2.connect(gain2);
        gain2.connect(this.ambientGain);
        osc2.start(t2);
        osc2.stop(t2 + 0.25);
      }, 160);
    }
  }

  // ========================================================
  // 시골 똥강아지 한번씩 짖는 소리 (14~30초마다 "멍! 멍!")
  // ========================================================
  scheduleDogBarks() {
    const triggerBark = () => {
      if (this.ctx && !this.isMuted) {
        this.playVillageDogBark();
      }
      // 14초 ~ 30초 사이 무작위 간격으로 들려옴
      const nextDelay = 14000 + Math.random() * 16000;
      this.dogTimer = setTimeout(triggerBark, nextDelay);
    };
    // 최초 6초 후 첫 멍멍
    this.dogTimer = setTimeout(triggerBark, 6000);
  }

  playVillageDogBark() {
    if (!this.ctx) return;

    // 1회차 멍!
    this.playSingleBark(0);

    // 65% 확률로 2회차 연속 멍! ("멍! ... 멍!")
    if (Math.random() > 0.35) {
      setTimeout(() => {
        if (!this.ctx || this.isMuted) return;
        this.playSingleBark(0.04);
      }, 260 + Math.random() * 80);
    }
  }

  playSingleBark(pitchOffset) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // 1. 개 짖는 목소리 포먼트 (삼각파 오실레이터)
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // 밴드패스 필터로 개의 구수한 목청 울림 구현
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(680, now);
    filter.Q.setValueAtTime(2.2, now);

    // 피치 변화: "머-엉" (빠른 상승 후 급하강)
    const baseFreq = 340 * (1 + pitchOffset);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.6, now + 0.035);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.75, now + 0.16);

    // 볼륨 엔벨로프 (탁 터지며 사라짐)
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    // 2. 가벼운 노이즈 버스트(숨소리/헐떡임) 합성
    const bufferSize = this.ctx.sampleRate * 0.08;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * 0.08;
    }
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.12, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    // 연결
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ambientGain);

    noiseSource.connect(noiseGain);
    noiseGain.connect(this.ambientGain);

    osc.start(now);
    osc.stop(now + 0.2);
    noiseSource.start(now);
    noiseSource.stop(now + 0.09);
  }

  // ========================================================
  // 2. 평온하고 따뜻한 시골 힐링 BGM (어쿠스틱 칼림바/기타풍 선율)
  // ========================================================
  startPeacefulBGM() {
    if (!this.ctx) return;

    // 따뜻한 펜타토닉 음계 (G Major Pentatonic / C Major 힐링 코드)
    // C4, D4, E4, G4, A4, C5, D5, E5, G5
    const notes = [
      261.63, 293.66, 329.63, 392.00, 440.00,
      523.25, 587.33, 659.25, 783.99
    ];

    // 평화로운 시골 멜로디 루프 패턴 (노트 인덱스)
    const melodyPattern = [
      { n: 2, d: 0.8 }, { n: 4, d: 0.8 }, { n: 5, d: 1.2 }, { n: 3, d: 0.8 },
      { n: 1, d: 0.8 }, { n: 2, d: 0.8 }, { n: 4, d: 1.4 }, { n: 0, d: 1.0 },
      { n: 3, d: 0.8 }, { n: 5, d: 0.8 }, { n: 6, d: 1.2 }, { n: 4, d: 0.8 },
      { n: 2, d: 0.8 }, { n: 3, d: 0.8 }, { n: 1, d: 1.6 }, { n: 0, d: 1.2 }
    ];

    let step = 0;
    const playNextNote = () => {
      if (!this.ctx || this.isMuted) {
        this.bgmTimer = setTimeout(playNextNote, 1000);
        return;
      }

      const item = melodyPattern[step % melodyPattern.length];
      const freq = notes[item.n];
      this.playKalimbaNote(freq, item.d * 1.5);

      // 저음 베이스 화음 동시 반주
      if (step % 4 === 0) {
        const bassFreq = notes[item.n % 3] / 2;
        this.playSoftBassNote(bassFreq, 2.5);
      }

      step++;
      const nextTime = item.d * 1000;
      this.bgmTimer = setTimeout(playNextNote, nextTime);
    };

    this.bgmTimer = setTimeout(playNextNote, 1000);
  }

  // 맑고 영롱한 칼림바 / 통기타 멜로디 톤
  playKalimbaNote(freq, duration) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);

    // 하모닉스 살리기
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.bgmGain);

    osc.start(now);
    osc.stop(now + duration + 0.1);
  }

  // 부드러운 저음 어쿠스틱 베이스
  playSoftBassNote(freq, duration) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.bgmGain);

    osc.start(now);
    osc.stop(now + duration + 0.1);
  }

  // ========================================================
  // 3. 인터랙션 SFX (밥알 클릭, 젓가락, 밥그릇, 정답, 폭죽)
  // ========================================================

  // 밥알 하나 톡! 집는/클릭 소리 (경쾌한 우드블록 틱)
  playRiceClickSFX() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // 밥알 클릭마다 미세하게 다른 음높이로 생생함 부여
    const pitch = 1400 + Math.random() * 600;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.4, now + 0.05);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.06);
  }

  // 밥알 내려놓는 소리 (부드러운 착지)
  playRiceDropSFX() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const pitch = 800 + Math.random() * 200;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.04);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  // 밥그릇 달그락 스치는 소리
  playBowlMoveSFX() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320 + Math.random() * 40, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.12);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.13);
  }

  // 정답 맞췄을 때 승리 팡파레 (도-미-솔-도!)
  playVictoryFanfare() {
    if (!this.ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      setTimeout(() => {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.35, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + (i === 3 ? 1.5 : 0.45));

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(now);
        osc.stop(now + (i === 3 ? 1.6 : 0.5));
      }, i * 160);
    });
  }

  // 폭죽 팡 터지는 소리 (화려한 폭죽 발사 & 팡!)
  playFireworkSFX() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // 1. 발사 휘파람 (피슈웅~)
    const whistle = this.ctx.createOscillator();
    const whistleGain = this.ctx.createGain();
    whistle.type = 'sine';
    whistle.frequency.setValueAtTime(450, now);
    whistle.frequency.exponentialRampToValueAtTime(1400, now + 0.25);
    whistleGain.gain.setValueAtTime(0.12, now);
    whistleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    whistle.connect(whistleGain);
    whistleGain.connect(this.sfxGain);
    whistle.start(now);
    whistle.stop(now + 0.26);

    // 2. 팡! 폭발음 (저역 폭발 노이즈)
    setTimeout(() => {
      if (!this.ctx) return;
      const tNow = this.ctx.currentTime;
      const bufferSize = this.ctx.sampleRate * 0.5;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.1));
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400, tNow);

      const expGain = this.ctx.createGain();
      expGain.gain.setValueAtTime(0.45, tNow);
      expGain.gain.exponentialRampToValueAtTime(0.001, tNow + 0.45);

      noise.connect(filter);
      filter.connect(expGain);
      expGain.connect(this.sfxGain);

      noise.start(tNow);
      noise.stop(tNow + 0.48);
    }, 240);
  }

  // 틀렸을 때 힌트 사운드 (UP/DOWN)
  playHintSFX(isUp) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    if (isUp) {
      // 상승 톤 (더 많아요!)
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(660, now + 0.18);
    } else {
      // 하강 톤 (더 적어요!)
      osc.frequency.setValueAtTime(660, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.18);
    }

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.22);
  }
}

// 전역 인스턴스 생성
window.countryAudio = new CountryAudioEngine();
