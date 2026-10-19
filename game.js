/**
 * ========================================================
 * 시골 마루의 밥알 세기 - 메인 게임 엔진 (game.js)
 * ========================================================
 */

(function () {
  'use strict';

  // 밥공기 난이도별 밥알 수 범위
  const BOWL_CONFIG = {
    snack: { min: 80, max: 150, name: '맛보기 한 숟갈' },
    small: { min: 450, max: 750, name: '어린이 밥공기' },
    standard: { min: 1900, max: 2500, name: '어른 밥 한 공기' },
    large: { min: 3400, max: 4200, name: '고봉 머슴밥' }
  };

  class RiceCountingGame {
    constructor() {
      // 메인 캔버스 및 2D 컨텍스트
      this.canvas = document.getElementById('game-canvas');
      this.ctx = this.canvas.getContext('2d');

      // 커스텀 젓가락 커서
      this.cursorEl = document.getElementById('chopsticks-cursor');

      // UI 요소들 (힌트/돋보기/센 밥알 삭제됨)
      this.guessInput = document.getElementById('guess-input');
      this.guessForm = document.getElementById('guess-form');
      this.btnSubmit = document.getElementById('btn-submit-guess');
      this.statusHint = document.getElementById('status-hint');
      this.bowlSelect = document.getElementById('bowl-size-select');
      this.btnNewBowl = document.getElementById('btn-new-bowl');
      this.btnAudioToggle = document.getElementById('btn-audio-toggle');
      this.audioIcon = document.getElementById('audio-icon');
      this.audioLabel = document.getElementById('audio-label');
      this.volumeSlider = document.getElementById('volume-slider');
      this.startOverlay = document.getElementById('start-overlay');
      this.btnStartGame = document.getElementById('btn-start-game');

      // 밥그릇 고정 버튼
      this.btnBowlLock = document.getElementById('btn-toggle-bowl-lock');
      this.bowlLockIcon = document.getElementById('bowl-lock-icon');
      this.bowlLockText = document.getElementById('bowl-lock-text');

      // 승리 모달
      this.victoryModal = document.getElementById('victory-modal');
      this.modalCorrectCount = document.getElementById('modal-correct-count');
      this.victoryAttemptsText = document.getElementById('victory-attempts-text');
      this.btnPlayAgain = document.getElementById('btn-play-again');
      this.btnKeepPlaying = document.getElementById('btn-keep-playing');

      // 게임 상태 변수
      this.targetCount = 0;
      this.guessAttempts = 0;
      this.isBowlLocked = false; // 밥그릇 이동 고정 여부
      this.isGameOver = false;

      // 원형 식탁 (소반)
      this.table = {
        x: 0,
        y: 0,
        radius: 380
      };

      // 밥그릇 (사기그릇)
      this.bowl = {
        x: 0,
        y: 0,
        radius: 175,
        height: 140,
        isDragging: false,
        dragOffsetX: 0,
        dragOffsetY: 0
      };

      // 밥알 배열
      this.riceGrains = [];
      this.draggedGrain = null;

      // 마우스 상태 (화면 좌표와 1:1 매핑)
      this.mouse = {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        isDown: false,
        hoveredGrain: null
      };

      // 폭죽 및 파티클
      this.fireworks = [];
      this.particles = [];
      this.fireworkTimer = null;

      // 쌀알 스프라이트 캐시 (성능 최적화)
      this.grainSprite = null;
      this.grainSpriteCounted = null;

      // 바인딩
      this.animate = this.animate.bind(this);
      this.handleResize = this.handleResize.bind(this);
      this.handleMouseMove = this.handleMouseMove.bind(this);
      this.handleMouseDown = this.handleMouseDown.bind(this);
      this.handleMouseUp = this.handleMouseUp.bind(this);

      this.init();
    }

    init() {
      this.handleResize();
      window.addEventListener('resize', this.handleResize);

      this.buildGrainSprites();
      this.initEvents();
      this.startNewGame();

      // 애니메이션 루프 시작
      requestAnimationFrame(this.animate);
    }

    // 쌀알 모양 캔버스 오프스크린 스프라이트 사전 렌더링
    buildGrainSprites() {
      const renderGrainOffscreen = (isCounted) => {
        const offCanvas = document.createElement('canvas');
        offCanvas.width = 36;
        offCanvas.height = 20;
        const octx = offCanvas.getContext('2d');
        const cx = 18;
        const cy = 10;

        octx.save();
        octx.translate(cx, cy);

        // 쌀알 본체
        octx.beginPath();
        octx.moveTo(-11, 0);
        octx.bezierCurveTo(-11, -5.5, 9, -5.5, 12, 0);
        octx.bezierCurveTo(9, 5.5, -11, 5.5, -11, 0);
        octx.closePath();

        if (isCounted) {
          // 세어진 밥알은 따뜻한 황금빛 윤기
          octx.fillStyle = '#ffecb3';
          octx.fill();
          octx.strokeStyle = '#e67e22';
          octx.lineWidth = 1.2;
          octx.stroke();

          // 쌀알 체크 점
          octx.beginPath();
          octx.arc(0, 0, 1.8, 0, Math.PI * 2);
          octx.fillStyle = '#d35400';
          octx.fill();
        } else {
          // 윤기 흐르는 흰 쌀알
          const grad = octx.createLinearGradient(-10, -5, 10, 5);
          grad.addColorStop(0, '#ffffff');
          grad.addColorStop(0.6, '#fbf8ee');
          grad.addColorStop(1, '#ebe4d3');
          octx.fillStyle = grad;
          octx.fill();

          octx.strokeStyle = 'rgba(190, 180, 160, 0.7)';
          octx.lineWidth = 0.8;
          octx.stroke();

          // 윤기 하이라이트
          octx.beginPath();
          octx.moveTo(-7, -2.5);
          octx.lineTo(5, -2.5);
          octx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
          octx.lineWidth = 1.2;
          octx.lineCap = 'round';
          octx.stroke();

          // 쌀눈 자국
          octx.beginPath();
          octx.arc(8.5, 0.5, 1, 0, Math.PI * 2);
          octx.fillStyle = '#d6cca8';
          octx.fill();
        }

        octx.restore();
        return offCanvas;
      };

      this.grainSprite = renderGrainOffscreen(false);
      this.grainSpriteCounted = renderGrainOffscreen(true);
    }

    // 윈도우 크기 변경 시 캔버스 1:1 풀스크린 리사이징
    handleResize() {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;

      // 식탁 위치: 화면 중앙 하단에 안정감 있게 배치
      this.table.x = this.canvas.width / 2;
      this.table.y = this.canvas.height * 0.62;
      this.table.radius = Math.min(this.canvas.width * 0.44, this.canvas.height * 0.42);

      // 밥그릇 초기 위치: 식탁 중앙
      if (!this.bowl.isDragging) {
        this.bowl.x = this.table.x;
        this.bowl.y = this.table.y - 10;
        this.bowl.radius = Math.min(185, this.table.radius * 0.52);
        this.bowl.height = this.bowl.radius * 0.75;
      }
    }

    // ========================================================
    // 새 게임 시작 (밥알 무작위 생성)
    // ========================================================
    startNewGame() {
      const modeKey = this.bowlSelect.value || 'standard';
      const config = BOWL_CONFIG[modeKey] || BOWL_CONFIG.standard;

      // 무작위 밥알 수 산출
      this.targetCount = Math.floor(Math.random() * (config.max - config.min + 1)) + config.min;
      this.guessAttempts = 0;
      this.isGameOver = false;

      // UI 초기화
      this.statusHint.textContent = `이 밥그릇 안엔 몇 알의 밥이 담겨 있을까요? (${config.name})`;
      this.statusHint.className = 'hint-text';
      this.guessInput.value = '';
      this.victoryModal.classList.add('hidden');
      this.stopFireworks();

      // 밥알 생성
      this.generateRiceGrains(this.targetCount);

      // 효과음
      if (window.countryAudio && window.countryAudio.isInitialized) {
        window.countryAudio.playBowlMoveSFX();
      }
    }

    generateRiceGrains(count) {
      this.riceGrains = [];
      const bowlR = this.bowl.radius;
      const bowlH = this.bowl.height;

      for (let i = 0; i < count; i++) {
        // 밥그릇 돔 형태 분포
        const u = Math.random();
        const v = Math.random();
        const rad = Math.sqrt(u) * (bowlR * 0.92);
        const theta = v * Math.PI * 2;

        const relX = rad * Math.cos(theta);
        const domeHeightFactor = Math.cos((rad / bowlR) * (Math.PI / 2));
        const relY = rad * Math.sin(theta) * 0.55 - (domeHeightFactor * (bowlH * 0.45));

        const baseAngle = Math.atan2(relY, relX) + Math.PI / 2;
        const angle = baseAngle + (Math.random() - 0.5) * 1.2;
        const scale = 0.88 + Math.random() * 0.24;

        this.riceGrains.push({
          id: i,
          relX: relX,
          relY: relY,
          x: this.bowl.x + relX,
          y: this.bowl.y + relY,
          angle: angle,
          scale: scale,
          inBowl: true,
          isCounted: false
        });
      }

      this.sortRiceGrains();
    }

    sortRiceGrains() {
      this.riceGrains.sort((a, b) => a.y - b.y);
    }

    // ========================================================
    // 이벤트 리스너 설정
    // ========================================================
    initEvents() {
      window.addEventListener('mousemove', this.handleMouseMove);
      window.addEventListener('mousedown', this.handleMouseDown);
      window.addEventListener('mouseup', this.handleMouseUp);

      // 우클릭 기본 방지
      window.addEventListener('contextmenu', (e) => e.preventDefault());

      // 정답 제출 폼
      this.guessForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.checkGuess();
      });
      this.btnSubmit.addEventListener('click', () => {
        this.checkGuess();
      });

      // 새 밥 짓기 버튼
      this.btnNewBowl.addEventListener('click', () => {
        this.startNewGame();
      });

      // 공기 크기 선택 변경
      this.bowlSelect.addEventListener('change', () => {
        this.startNewGame();
      });

      // 밥그릇 고정 토글 버튼
      if (this.btnBowlLock) {
        this.btnBowlLock.addEventListener('click', () => {
          this.toggleBowlLock();
        });
      }

      // 사운드 토글
      this.btnAudioToggle.addEventListener('click', () => {
        if (!window.countryAudio.isInitialized) {
          window.countryAudio.init();
        }
        const isPlaying = window.countryAudio.toggleMute();
        this.audioIcon.textContent = isPlaying ? '🔊' : '🔇';
        this.audioLabel.textContent = isPlaying ? '시골 소리 On' : '소리 꺼짐';
      });

      // 볼륨 조절 슬라이더
      this.volumeSlider.addEventListener('input', (e) => {
        if (!window.countryAudio.isInitialized) {
          window.countryAudio.init();
        }
        window.countryAudio.setVolume(parseFloat(e.target.value));
      });

      // 시작 배너 클릭
      this.btnStartGame.addEventListener('click', () => {
        if (window.countryAudio) {
          window.countryAudio.init();
        }
        this.startOverlay.classList.add('hidden');
      });

      // 승리 모달 버튼들
      this.btnPlayAgain.addEventListener('click', () => {
        this.startNewGame();
      });
      this.btnKeepPlaying.addEventListener('click', () => {
        this.victoryModal.classList.add('hidden');
      });
    }

    // 밥그릇 고정 토글
    toggleBowlLock() {
      this.isBowlLocked = !this.isBowlLocked;
      this.updateBowlLockUI();

      if (window.countryAudio) {
        window.countryAudio.playBowlMoveSFX();
      }

      if (this.isBowlLocked) {
        this.statusHint.textContent = '🔒 밥그릇이 고정되었습니다. 편안하게 밥알만 세어보세요!';
      } else {
        this.statusHint.textContent = '🔓 밥그릇 고정이 풀렸습니다. 밥그릇 테두리를 잡고 이동할 수 있습니다.';
      }
      this.statusHint.className = 'hint-text';
    }

    updateBowlLockUI() {
      const isLocked = this.isBowlLocked;
      const icon = isLocked ? '🔒' : '🔓';
      const text = isLocked ? '밥그릇 고정됨' : '밥그릇 이동 가능';
      const title = isLocked ? '밥그릇이 고정되어 클릭 및 이동되지 않습니다 (클릭하여 이동 허용)' : '밥그릇 테두리를 클릭하여 이동할 수 있습니다 (클릭하여 고정)';

      if (this.btnBowlLock) {
        this.btnBowlLock.className = `btn-bowl-lock ${isLocked ? 'locked' : 'unlocked'}`;
        this.btnBowlLock.title = title;
        if (this.bowlLockIcon) this.bowlLockIcon.textContent = icon;
        if (this.bowlLockText) this.bowlLockText.textContent = text;
      }
    }

    // ========================================================
    // 마우스 이벤트 & 젓가락 팁 100% 매핑
    // ========================================================
    handleMouseMove(e) {
      // 캔버스가 전체 화면(0,0)이므로 e.clientX, e.clientY가 곧 캔버스 내부 좌표
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;

      // 젓가락 커서 위치 갱신 (팁 오프셋은 CSS transform: translate(-14px, -147px)로 자동 처리)
      this.cursorEl.style.left = `${this.mouse.x}px`;
      this.cursorEl.style.top = `${this.mouse.y}px`;

      // 1. 밥알을 젓가락으로 집고 있는 경우 (젓가락 두 끝 사이에 100% 밀착)
      if (this.draggedGrain) {
        this.draggedGrain.x = this.mouse.x;
        this.draggedGrain.y = this.mouse.y;
        this.draggedGrain.angle = -0.78; // 젓가락 두 짝 사이로 집힌 각도 유지

        // 밥그릇 밖으로 나갔는지 판정
        const distFromBowl = Math.hypot(this.draggedGrain.x - this.bowl.x, this.draggedGrain.y - this.bowl.y);
        if (distFromBowl > this.bowl.radius * 0.95) {
          this.draggedGrain.inBowl = false;
        } else {
          this.draggedGrain.inBowl = true;
          this.draggedGrain.relX = this.draggedGrain.x - this.bowl.x;
          this.draggedGrain.relY = this.draggedGrain.y - this.bowl.y;
        }
        return;
      }

      // 2. 밥그릇 드래그 중인 경우 (고정 모드가 아닐 때만)
      if (this.bowl.isDragging && !this.isBowlLocked) {
        const newX = this.mouse.x + this.bowl.dragOffsetX;
        const newY = this.mouse.y + this.bowl.dragOffsetY;

        const distFromTable = Math.hypot(newX - this.table.x, newY - this.table.y);
        const maxDist = this.table.radius * 0.65;
        if (distFromTable < maxDist) {
          const deltaX = newX - this.bowl.x;
          const deltaY = newY - this.bowl.y;

          this.bowl.x = newX;
          this.bowl.y = newY;

          // 밥그릇 안의 밥알들도 함께 이동
          for (let i = 0; i < this.riceGrains.length; i++) {
            const grain = this.riceGrains[i];
            if (grain.inBowl) {
              grain.x += deltaX;
              grain.y += deltaY;
            }
          }
        }
        return;
      }

      this.mouse.hoveredGrain = this.findHoveredGrain(this.mouse.x, this.mouse.y);
    }

    handleMouseDown(e) {
      if (e.button !== 0) return;
      this.mouse.isDown = true;
      this.cursorEl.classList.add('pinching');

      // 오디오 최초 활성화
      if (window.countryAudio && !window.countryAudio.isInitialized) {
        window.countryAudio.init();
        this.startOverlay.classList.add('hidden');
      }

      const mx = e.clientX;
      const my = e.clientY;
      const distToBowl = Math.hypot(mx - this.bowl.x, my - this.bowl.y);

      // 1. 밥그릇 이동 가능 상태일 때: 도자기 하단 곡면 클릭 시 밥그릇 이동
      if (!this.isBowlLocked) {
        const isBowlCeramic = (my > this.bowl.y + 24 && distToBowl <= this.bowl.radius * 1.15) ||
                              (distToBowl >= this.bowl.radius * 0.90 && distToBowl <= this.bowl.radius * 1.15);

        if (isBowlCeramic) {
          this.bowl.isDragging = true;
          this.bowl.dragOffsetX = this.bowl.x - mx;
          this.bowl.dragOffsetY = this.bowl.y - my;
          if (window.countryAudio) {
            window.countryAudio.playBowlMoveSFX();
          }
          return;
        }
      }

      // 2. 밥알 클릭 및 집기 (최상단 밥알 1알 우선)
      const clickedGrain = this.findHoveredGrain(mx, my);
      if (clickedGrain) {
        this.draggedGrain = clickedGrain;
        // 젓가락 끝점(mx, my)에 밥알을 100% 일치시켜 집음
        this.draggedGrain.x = mx;
        this.draggedGrain.y = my;
        this.draggedGrain.savedAngle = clickedGrain.angle;
        this.draggedGrain.angle = -0.78; // 젓가락 물리는 각도 (-45도)

        // 밥알 세어짐 표시 토글
        clickedGrain.isCounted = !clickedGrain.isCounted;

        // 밥알 클릭 사운드
        if (window.countryAudio) {
          window.countryAudio.playRiceClickSFX();
        }
        return;
      }

      // 3. 밥알을 빗맞췄지만 밥그릇 내부인 경우 (이동 가능할 때만 드래그)
      if (!this.isBowlLocked && distToBowl <= this.bowl.radius * 1.15) {
        this.bowl.isDragging = true;
        this.bowl.dragOffsetX = this.bowl.x - mx;
        this.bowl.dragOffsetY = this.bowl.y - my;
        if (window.countryAudio) {
          window.countryAudio.playBowlMoveSFX();
        }
      }
    }

    handleMouseUp(e) {
      if (e.button !== 0) return;
      this.mouse.isDown = false;
      this.cursorEl.classList.remove('pinching');

      // 밥알 내려놓기
      if (this.draggedGrain) {
        if (window.countryAudio) {
          window.countryAudio.playRiceDropSFX();
        }
        // 자연스럽게 눕도록 각도 정리
        this.draggedGrain.angle = this.draggedGrain.savedAngle || ((Math.random() - 0.5) * 1.2);
        this.draggedGrain = null;
        this.sortRiceGrains();
      }

      // 밥그릇 놓기
      if (this.bowl.isDragging) {
        this.bowl.isDragging = false;
        if (window.countryAudio) {
          window.countryAudio.playBowlMoveSFX();
        }
      }
    }

    // 밥알 정밀 히트 테스트 (마우스 젓가락 끝점 기준 최상단 밥알 1알 탐색)
    findHoveredGrain(x, y) {
      let closestGrain = null;
      let minDistanceSq = 190; // 반경 약 13.8px

      for (let i = this.riceGrains.length - 1; i >= 0; i--) {
        const grain = this.riceGrains[i];
        const dx = x - grain.x;
        const dy = y - grain.y;
        const distSq = dx * dx + dy * dy;
        const hitRadiusSq = minDistanceSq * (grain.scale * grain.scale);

        if (distSq < hitRadiusSq) {
          closestGrain = grain;
          break; // 최상단 밥알 1알 정확히 타겟
        }
      }
      return closestGrain;
    }

    // ========================================================
    // 정답 판정 & 폭죽 축하 연출
    // ========================================================
    checkGuess() {
      const val = parseInt(this.guessInput.value, 10);
      if (isNaN(val) || val <= 0) {
        this.statusHint.textContent = '올바른 숫자를 입력해주세요! (예: 2200)';
        this.statusHint.className = 'hint-text';
        this.guessInput.focus();
        return;
      }

      this.guessAttempts++;

      if (val === this.targetCount) {
        // 🎉 정답 맞춤!
        this.handleVictory();
      } else if (val < this.targetCount) {
        const diff = this.targetCount - val;
        let hintMsg = `틀렸습니다! 실제 밥알은 입력한 것보다 더 많아요! (UP 🔼)`;
        if (diff > 500) hintMsg += ` [훨씬 더 많아요]`;
        else if (diff <= 50) hintMsg += ` [거의 다 왔어요! 아주 가까워요!]`;

        this.statusHint.textContent = hintMsg;
        this.statusHint.className = 'hint-text hint-up';
        if (window.countryAudio) window.countryAudio.playHintSFX(true);
      } else {
        const diff = val - this.targetCount;
        let hintMsg = `틀렸습니다! 실제 밥알은 입력한 것보다 더 적어요! (DOWN 🔽)`;
        if (diff > 500) hintMsg += ` [훨씬 더 적어요]`;
        else if (diff <= 50) hintMsg += ` [거의 다 왔어요! 아주 가까워요!]`;

        this.statusHint.textContent = hintMsg;
        this.statusHint.className = 'hint-text hint-down';
        if (window.countryAudio) window.countryAudio.playHintSFX(false);
      }

      this.guessInput.select();
    }

    handleVictory() {
      this.isGameOver = true;
      this.modalCorrectCount.textContent = this.targetCount.toLocaleString();
      this.victoryAttemptsText.textContent = `${this.guessAttempts}번 만에 맞추셨습니다! 시골 강아지 소리와 함께 밥 한 공기 뚝딱!`;
      this.victoryModal.classList.remove('hidden');

      if (window.countryAudio) {
        window.countryAudio.playVictoryFanfare();
      }
      this.startFireworks();
    }

    // ========================================================
    // 폭죽 (Fireworks) & 컨페티 파티클
    // ========================================================
    startFireworks() {
      this.stopFireworks();
      let count = 0;
      const launch = () => {
        this.launchFirework();
        count++;
        if (count < 20) {
          this.fireworkTimer = setTimeout(launch, 280 + Math.random() * 400);
        }
      };
      launch();
    }

    stopFireworks() {
      if (this.fireworkTimer) {
        clearTimeout(this.fireworkTimer);
        this.fireworkTimer = null;
      }
      this.fireworks = [];
      this.particles = [];
    }

    launchFirework() {
      const startX = window.innerWidth * (0.2 + Math.random() * 0.6);
      const startY = window.innerHeight;
      const targetX = window.innerWidth * (0.15 + Math.random() * 0.7);
      const targetY = window.innerHeight * (0.15 + Math.random() * 0.35);

      const colors = ['#ff4757', '#ffa502', '#2ed573', '#1e90ff', '#e056fd', '#fffa65', '#ffffff'];
      const color = colors[Math.floor(Math.random() * colors.length)];

      this.fireworks.push({
        x: startX,
        y: startY,
        targetX: targetX,
        targetY: targetY,
        vx: (targetX - startX) / 28,
        vy: (targetY - startY) / 28,
        color: color,
        trail: []
      });

      if (window.countryAudio) {
        window.countryAudio.playFireworkSFX();
      }
    }

    explodeFirework(x, y, baseColor) {
      const particleCount = 75 + Math.floor(Math.random() * 45);
      for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.5 + Math.random() * 6.5;
        this.particles.push({
          x: x,
          y: y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: Math.random() > 0.3 ? baseColor : '#ffffff',
          alpha: 1,
          decay: 0.012 + Math.random() * 0.018,
          gravity: 0.06,
          size: 2.5 + Math.random() * 2.5
        });
      }
    }

    updateFireworks() {
      for (let i = this.fireworks.length - 1; i >= 0; i--) {
        const fw = this.fireworks[i];
        fw.x += fw.vx;
        fw.y += fw.vy;
        fw.trail.push({ x: fw.x, y: fw.y });
        if (fw.trail.length > 5) fw.trail.shift();

        if (fw.y <= fw.targetY) {
          this.explodeFirework(fw.x, fw.y, fw.color);
          this.fireworks.splice(i, 1);
        }
      }

      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          this.particles.splice(i, 1);
        }
      }
    }

    // ========================================================
    // 렌더링 파이프라인
    // ========================================================
    render() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      // 1. 원형 식탁 (소반)
      this.drawWoodenTable(ctx);

      // 2. 식탁 위에 덜어놓은 밥알들
      this.drawSpilledRiceGrains(ctx);

      // 3. 밥그릇 본체
      this.drawBowl(ctx);

      // 4. 밥그릇 안의 밥알들
      this.drawInBowlRiceGrains(ctx);

      // 5. 드래그 중인 밥알 (젓가락 끝에 물려 있는 최상단 밥알)
      if (this.draggedGrain) {
        this.drawSingleGrain(ctx, this.draggedGrain, true);
      }

      // 6. 폭죽 파티클
      this.drawFireworks(ctx);
    }

    drawWoodenTable(ctx) {
      const { x, y, radius } = this.table;

      ctx.save();
      // 밥상 그림자
      ctx.beginPath();
      ctx.ellipse(x + 10, y + radius * 0.45 + 30, radius * 1.05, radius * 0.48, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(20, 10, 5, 0.45)';
      ctx.filter = 'blur(16px)';
      ctx.fill();
      ctx.filter = 'none';

      // 밥상 테두리 두께
      ctx.beginPath();
      ctx.ellipse(x, y + 16, radius, radius * 0.48, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#6e431e';
      ctx.fill();

      // 밥상 상판
      ctx.beginPath();
      ctx.ellipse(x, y, radius, radius * 0.48, 0, 0, Math.PI * 2);
      const tableGrad = ctx.createRadialGradient(x - radius * 0.25, y - radius * 0.2, radius * 0.1, x, y, radius);
      tableGrad.addColorStop(0, '#c68d57');
      tableGrad.addColorStop(0.55, '#ab723f');
      tableGrad.addColorStop(0.85, '#8c582c');
      tableGrad.addColorStop(1, '#663c1a');
      ctx.fillStyle = tableGrad;
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 230, 190, 0.35)';
      ctx.lineWidth = 3;
      ctx.stroke();

      // 나이테 무늬
      ctx.strokeStyle = 'rgba(90, 48, 16, 0.12)';
      ctx.lineWidth = 2;
      for (let r = radius * 0.35; r < radius * 0.9; r += radius * 0.22) {
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.48, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    drawBowl(ctx) {
      const { x, y, radius, height } = this.bowl;

      ctx.save();
      // 밥그릇 그림자
      ctx.beginPath();
      ctx.ellipse(x + 5, y + height * 0.65 + 10, radius * 0.95, radius * 0.38, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(40, 20, 10, 0.38)';
      ctx.filter = 'blur(10px)';
      ctx.fill();
      ctx.filter = 'none';

      // 밥그릇 본체
      ctx.beginPath();
      ctx.moveTo(x - radius, y);
      ctx.bezierCurveTo(x - radius * 0.9, y + height, x + radius * 0.9, y + height, x + radius, y);
      ctx.bezierCurveTo(x + radius * 0.8, y + height * 0.35, x - radius * 0.8, y + height * 0.35, x - radius, y);
      ctx.closePath();

      const bowlGrad = ctx.createLinearGradient(x - radius, y, x + radius, y + height);
      bowlGrad.addColorStop(0, '#f2f3f4');
      bowlGrad.addColorStop(0.35, '#ffffff');
      bowlGrad.addColorStop(0.75, '#dde3e8');
      bowlGrad.addColorStop(1, '#a6b5c2');
      ctx.fillStyle = bowlGrad;
      ctx.fill();

      // 청화 백자 문양
      ctx.beginPath();
      ctx.ellipse(x, y + height * 0.42, radius * 0.78, radius * 0.24, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(74, 119, 163, 0.35)';
      ctx.lineWidth = 4;
      ctx.stroke();

      // 밥그릇 테두리
      ctx.beginPath();
      ctx.ellipse(x, y, radius, radius * 0.42, 0, 0, Math.PI * 2);
      ctx.strokeStyle = '#c4d0da';
      ctx.lineWidth = 3;
      ctx.stroke();

      // 밥그릇 안쪽 그림자
      ctx.beginPath();
      ctx.ellipse(x, y, radius * 0.96, radius * 0.4, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(180, 170, 155, 0.35)';
      ctx.fill();

      // 밥그릇 고정 상태 시각적 피드백
      if (this.isBowlLocked) {
        ctx.save();
        ctx.font = 'bold 13px "Sunflower", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(140, 50, 10, 0.75)';
        ctx.fillText('🔒 밥그릇 고정됨', x, y + height * 0.88);
        ctx.restore();
      }

      ctx.restore();
    }

    drawSpilledRiceGrains(ctx) {
      for (let i = 0; i < this.riceGrains.length; i++) {
        const grain = this.riceGrains[i];
        if (!grain.inBowl && grain !== this.draggedGrain) {
          this.drawSingleGrain(ctx, grain, false);
        }
      }
    }

    drawInBowlRiceGrains(ctx) {
      for (let i = 0; i < this.riceGrains.length; i++) {
        const grain = this.riceGrains[i];
        if (grain.inBowl && grain !== this.draggedGrain) {
          this.drawSingleGrain(ctx, grain, false);
        }
      }
    }

    drawSingleGrain(ctx, grain, isElevated) {
      ctx.save();
      ctx.translate(grain.x, grain.y);
      ctx.rotate(grain.angle);

      const sprite = grain.isCounted ? this.grainSpriteCounted : this.grainSprite;

      if (isElevated) {
        // 젓가락에 집혀서 떠 있는 입체 그림자
        ctx.save();
        ctx.translate(3, 9);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.scale(grain.scale * 1.05, grain.scale * 1.05);
        ctx.beginPath();
        ctx.ellipse(0, 0, 11, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.scale(grain.scale * 1.15, grain.scale * 1.15);
      } else {
        ctx.scale(grain.scale, grain.scale);
      }

      ctx.drawImage(sprite, -18, -10);
      ctx.restore();
    }

    drawFireworks(ctx) {
      if (this.fireworks.length === 0 && this.particles.length === 0) return;

      ctx.save();
      for (let i = 0; i < this.fireworks.length; i++) {
        const fw = this.fireworks[i];
        ctx.strokeStyle = fw.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        if (fw.trail.length > 0) {
          ctx.moveTo(fw.trail[0].x, fw.trail[0].y);
          for (let j = 1; j < fw.trail.length; j++) {
            ctx.lineTo(fw.trail[j].x, fw.trail[j].y);
          }
        } else {
          ctx.moveTo(fw.x, fw.y);
        }
        ctx.lineTo(fw.x, fw.y);
        ctx.stroke();
      }

      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    animate() {
      this.updateFireworks();
      this.render();
      requestAnimationFrame(this.animate);
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    window.riceGame = new RiceCountingGame();
  });
})();
