// extra_content.js
// 新しいモンスター・クエスト・武器・防具・スキル・カスタム挙動をここに追加します。
window.EXTRA_CONTENT = {
  // ★既存クエストの表記・内容を上書きする箱
  questOverrides: {
    rathalos: {
      title: '蒼穹を舞う火竜',
      tag: '天空を統べる、蒼き王者',
      // stars: '☆2',
      // maxHp: 3500
    },
    rathian: {
      title: '大地に咲く災厄の華',
      tag: '大地に君臨する緑の女王'
    },
    zinogre: {
      title: '月下に吠える碧き雷光',
      tag: '無双の狩人ここに来たる'
    },
    kirin: {
      title: '幻獣、白き霊峰の主',
      tag: '天より降り注ぐ雷霆'
    }
  },

  // 追加武器（longsword / greatsword）
  weapons: {
    longsword: [],
    greatsword: []
  },

  // 追加防具（head / chest / arms / waist / legs）
  armors: {
    head: [],
    chest: [],
    arms: [],
    waist: [],
    legs: []
  },

  // 追加スキル名マップ
  skillNames: {},

  // 追加クエスト一覧（クエスト選択ボード＆F2弱点表に自動追加）
  quests: [],

  // 追加モンスターのAI更新・攻撃選択・描画フック
  hooks: {
    onChooseAction: null,
    onUpdateMonster: null,
    onDrawMonster: null,
    onUpdateProjectiles: null,
    onDrawProjectiles: null,
    onResetGame: null
  }
};
(function () {
  let magmaWaves = [];
  let magmaPillars = [];
  let stardustEmbers = [];
  let emberBlasts = [];

  function spawnMagmaWave(m, ctx) {
    const startX = m.facing === 1 ? m.x + m.w : m.x - 42;
    const speed = m.isCritical ? 9.6 : 7.8;
    magmaWaves.push({
      x: startX,
      y: ctx.GROUND_Y - 40,
      w: 42,
      h: 40,
      vx: m.facing * speed,
      hasHit: false
    });
    ctx.screenShake = Math.max(ctx.screenShake, 7);
    ctx.addParticles(startX + 20, ctx.GROUND_Y - 14, '#ff5722', 18, 6);
  }

  function spawnEruptionPillars(m, ctx) {
    const centerX = m.x + m.w / 2;
    const offsets = m.isCritical ? [-135, -75, 75, 135] : [-95, 95];
    offsets.forEach(off => {
      const px = Math.max(30, Math.min(ctx.canvas.width - 30, centerX + off));
      magmaPillars.push({
        x: px - 22,
        y: ctx.GROUND_Y - 125,
        w: 44,
        h: 125,
        life: 24,
        maxLife: 24,
        hasHit: false
      });
      ctx.addParticles(px, ctx.GROUND_Y - 20, '#ff9100', 18, 7);
    });
    ctx.screenShake = Math.max(ctx.screenShake, 12);
  }

  function spawnStardustEmbers(m, ctx) {
    const count = m.isCritical ? 4 : 3;
    const centerX = m.x + m.w / 2;
    for (let i = 0; i < count; i++) {
      const spreadX = (i - (count - 1) / 2) * 145 + (Math.random() - 0.5) * 40;
      const targetX = Math.max(55, Math.min(ctx.canvas.width - 55, centerX + spreadX));
      const targetY = ctx.GROUND_Y - 42 - (i % 2) * 34;
      stardustEmbers.push({
        x: targetX,
        y: targetY,
        baseY: targetY,
        r: 16,
        timer: 120,
        phase: i * 1.3
      });
      ctx.addParticles(targetX, targetY, '#ffd54f', 12, 4);
    }
  }

  const EC = window.EXTRA_CONTENT;

  // 1. 専用武器の追加
  EC.weapons.longsword.push({
    id: 'yalda_katana',
    type: 'longsword',
    name: '煉獄刀【円火】',
    element: 'fire',
    elementLabel: '火属性',
    attack: 145
  });

  EC.weapons.greatsword.push({
    id: 'yalda_gs',
    type: 'greatsword',
    name: '業火大剣ヤルダネウェ',
    element: 'fire',
    elementLabel: '火属性',
    attack: 190
  });

  // 2. 業火帝 ヤルダネウェ クエスト追加
  EC.quests.push({
    key: 'yaldanewe',
    title: '原初・破滅の始まり',
    stars: '☆3',
    starLevel: 3,
    hpText: 'HP 10000',
    themeColor: '#d84315',
    borderColor: '#ffab91',
    tag: '古龍種・業火帝 ヤルダネウェ',
    isMultiTarget: false,
    maxHp: 10000,
    effectiveness: { fire: 0, water: 1.5, thunder: 0.75, ice: 1.25, dragon: 1.0 },
    displayName: '業火帝 ヤルダネウェ',
    barColor: '#e64a19'
  });

  // 3. 専用AI・描画フック登録
  EC.hooks.onResetGame = function () {
    magmaWaves = [];
    magmaPillars = [];
    stardustEmbers = [];
    emberBlasts = [];
  };

  EC.hooks.onChooseAction = function (m, ctx) {
    if (m.species !== 'yaldanewe') return false;

    if (m.isCritical === undefined) {
      m.isCritical = false;
      m.criticalUsed = false;
      m.criticalDamageTaken = 0;
      m.lastTrackedHp = m.hp;
    }

    m.facing = ctx.player.x < m.x + m.w / 2 ? -1 : 1;
    m.hasHitThisAttack = false;
    m.attackHitbox = null;

    if (!m.isCritical && !m.criticalUsed && m.hp <= 6500) {
      m.state = 'yaldaRoarMode';
      m.stateTimer = 54;
      return true;
    }

    const r = Math.random();
    if (r < 0.36) {
      m.state = 'yaldaMagmaWave';
      m.stateTimer = m.isCritical ? 38 : 48;
    } else if (r < 0.70) {
      m.state = 'yaldaMeteorSlam';
      m.stateTimer = m.isCritical ? 64 : 74;
      m.slamTargetX = ctx.player.x + ctx.player.w / 2 - m.w / 2;
    } else {
      m.state = 'yaldaStardust';
      m.stateTimer = m.isCritical ? 38 : 46;
    }
    return true;
  };

  EC.hooks.onUpdateMonster = function (m, ctx) {
    if (m.species !== 'yaldanewe') return false;

    if (m.isCritical === undefined) {
      m.isCritical = false;
      m.criticalUsed = false;
      m.criticalDamageTaken = 0;
      m.lastTrackedHp = m.hp;
    }

    if (m.lastTrackedHp > m.hp) {
      const diff = m.lastTrackedHp - m.hp;
      if (m.isCritical) {
        m.criticalDamageTaken += diff;
        if (m.criticalDamageTaken >= 700) {
          m.isCritical = false;
          m.criticalDamageTaken = 0;
          m.state = 'stagger';
          m.stateTimer = 85;
          m.y = ctx.GROUND_Y;
          m.attackHitbox = null;
          ctx.screenShake = 14;
          ctx.addText('炉心鎮静！！大ダウン！', m.x - 20, m.y - 115, '#4fc3f7', 24);
          ctx.addParticles(m.x + m.w / 2, m.y - 45, '#80deea', 30, 8);
        }
      }
    }
    m.lastTrackedHp = m.hp;

    if (m.isCritical && Math.random() < 0.45) {
      ctx.addParticles(m.x + Math.random() * m.w, m.y - Math.random() * m.h, '#ffab00', 1, 2.8);
    } else if (Math.random() < 0.22) {
      ctx.addParticles(m.x + Math.random() * m.w, m.y - Math.random() * m.h, '#ff5722', 1, 2);
    }

    m.stateTimer--;

    if (m.state === 'idle') {
      m.y = ctx.GROUND_Y;
      m.facing = ctx.player.x < m.x + m.w / 2 ? -1 : 1;
      m.vx *= 0.8;
      if (m.stateTimer <= 0) {
        EC.hooks.onChooseAction(m, ctx);
      }
    } else if (m.state === 'yaldaRoarMode') {
      m.vx = 0;
      m.y = ctx.GROUND_Y;
      if (m.stateTimer % 3 === 0) {
        ctx.addParticles(m.x + m.w / 2, m.y - 55, '#ff6d00', 8, 7);
      }
      if (m.stateTimer === 18) {
        m.isCritical = true;
        m.criticalUsed = true;
        m.criticalDamageTaken = 0;
        ctx.screenShake = 14;
        ctx.addText('炉心解放・赤熱臨界！！', m.x - 30, m.y - 120, '#ffab00', 25);
        ctx.addParticles(m.x + m.w / 2, m.y - 50, '#ffd740', 34, 9);
      }
      if (m.stateTimer <= 0) {
        m.state = 'idle';
        m.stateTimer = 24;
      }
    } else if (m.state === 'yaldaMagmaWave') {
      m.vx = 0;
      m.y = ctx.GROUND_Y;
      const slamFrame = m.isCritical ? 20 : 25;
      if (m.stateTimer > slamFrame && m.stateTimer % 4 === 0) {
        const pawX = m.facing === 1 ? m.x + m.w - 15 : m.x + 15;
        ctx.addParticles(pawX, m.y - 55, '#ff9100', 3, 3);
      }
      if (m.stateTimer === slamFrame) {
        spawnMagmaWave(m, ctx);
      }
      if (m.stateTimer <= 0) {
        m.state = 'idle';
        m.stateTimer = m.isCritical ? 28 : 40;
      }
    } else if (m.state === 'yaldaMeteorSlam') {
      const totalDur = m.isCritical ? 64 : 74;
      const windupEnd = totalDur - 14;
      const airEnd = 24;

      if (m.stateTimer > windupEnd) {
        m.vx = 0;
        m.y = ctx.GROUND_Y;
        if (m.stateTimer % 3 === 0) {
          ctx.addParticles(m.x + m.w / 2, ctx.GROUND_Y - 12, '#ff6d00', 4, 4);
        }
      } else if (m.stateTimer > airEnd) {
        const airSpan = windupEnd - airEnd;
        const progress = (windupEnd - m.stateTimer) / airSpan;
        const targetX = Math.max(40, Math.min(ctx.canvas.width - m.w - 40, m.slamTargetX));
        m.x += (targetX - m.x) * 0.14;
        m.y = ctx.GROUND_Y - Math.sin(progress * Math.PI) * 185;
        m.attackHitbox = progress > 0.72 ? ctx.getMonsterBody(m) : null;
      } else {
        if (m.stateTimer === airEnd) {
          m.y = ctx.GROUND_Y;
          m.vx = 0;
          m.attackHitbox = ctx.getMonsterBody(m);
          spawnEruptionPillars(m, ctx);
        } else if (m.stateTimer < airEnd - 4) {
          m.attackHitbox = null;
        }
        m.y = ctx.GROUND_Y;
        m.vx = 0;
      }

      if (m.stateTimer <= 0) {
        m.y = ctx.GROUND_Y;
        m.state = 'idle';
        m.stateTimer = m.isCritical ? 26 : 36;
        m.attackHitbox = null;
      }
    } else if (m.state === 'yaldaStardust') {
      m.vx = 0;
      m.y = ctx.GROUND_Y;
      const releaseFrame = m.isCritical ? 20 : 25;
      if (m.stateTimer === releaseFrame) {
        spawnStardustEmbers(m, ctx);
      }
      if (m.stateTimer <= 0) {
        m.state = 'idle';
        m.stateTimer = m.isCritical ? 30 : 42;
      }
    } else if (m.state === 'stagger') {
      m.vx *= 0.8;
      m.y = ctx.GROUND_Y;
      m.attackHitbox = null;
      if (m.stateTimer <= 0) {
        m.state = 'idle';
        m.stateTimer = 30;
      }
    }

    m.x += m.vx;
    m.x = Math.max(30, Math.min(ctx.canvas.width - m.w - 30, m.x));

    if (m.attackHitbox && !m.hasHitThisAttack) {
      const pBox = { x: ctx.player.x, y: ctx.player.y - ctx.player.h, w: ctx.player.w, h: ctx.player.h };
      if (ctx.rectIntersect(m.attackHitbox, pBox)) {
        const dmg = m.isCritical ? 32 : 26;
        ctx.damagePlayer(dmg, m.isCritical, false, false, false);
        m.hasHitThisAttack = true;
      }
    }

    return true;
  };

  EC.hooks.onUpdateProjectiles = function (ctx) {
    const pBox = { x: ctx.player.x, y: ctx.player.y - ctx.player.h, w: ctx.player.w, h: ctx.player.h };
    const yalda = ctx.activeMonsters.find(m => m.species === 'yaldanewe' && m.hp > 0);
    const isCrit = yalda ? !!yalda.isCritical : false;

    for (let i = magmaWaves.length - 1; i >= 0; i--) {
      const mw = magmaWaves[i];
      mw.x += mw.vx;
      if (Math.random() < 0.65) {
        ctx.addParticles(mw.x + mw.w / 2, ctx.GROUND_Y - 12, '#ff6d00', 1, 3);
      }
      if (!mw.hasHit && ctx.rectIntersect(mw, pBox)) {
        mw.hasHit = true;
        ctx.damagePlayer(isCrit ? 28 : 22, true, false, false, false);
        ctx.addParticles(mw.x + mw.w / 2, ctx.GROUND_Y - 20, '#ffab00', 16, 6);
      }
      if (mw.x < -70 || mw.x > ctx.canvas.width + 70) {
        magmaWaves.splice(i, 1);
      }
    }

    for (let i = magmaPillars.length - 1; i >= 0; i--) {
      const mp = magmaPillars[i];
      mp.life--;
      if (!mp.hasHit && mp.life >= 8 && ctx.rectIntersect(mp, pBox)) {
        mp.hasHit = true;
        ctx.damagePlayer(isCrit ? 28 : 23, true, false, false, false);
        ctx.addParticles(mp.x + mp.w / 2, ctx.GROUND_Y - 40, '#ff3d00', 16, 6);
      }
      if (mp.life <= 0) {
        magmaPillars.splice(i, 1);
      }
    }

    for (let i = stardustEmbers.length - 1; i >= 0; i--) {
      const em = stardustEmbers[i];
      em.timer--;
      em.phase += 0.1;
      em.y = em.baseY + Math.sin(em.phase) * 7;

      if (em.timer % 7 === 0) {
        ctx.addParticles(em.x + (Math.random() - 0.5) * 20, em.y, '#ffd54f', 1, 2);
      }

      if (em.timer <= 0) {
        const blastR = 46;
        emberBlasts.push({ x: em.x, y: em.y, r: blastR, life: 15 });
        ctx.screenShake = Math.max(ctx.screenShake, 7);
        ctx.addParticles(em.x, em.y, '#ff6d00', 22, 6);
        ctx.addParticles(em.x, em.y, '#ffd740', 12, 5);

        const blastBox = {
          x: em.x - blastR,
          y: em.y - blastR,
          w: blastR * 2,
          h: blastR * 2
        };
        if (ctx.rectIntersect(blastBox, pBox)) {
          ctx.damagePlayer(isCrit ? 25 : 20, true, false, false, false);
        }
        stardustEmbers.splice(i, 1);
      }
    }

    for (let i = emberBlasts.length - 1; i >= 0; i--) {
      emberBlasts[i].life--;
      if (emberBlasts[i].life <= 0) {
        emberBlasts.splice(i, 1);
      }
    }
  };

  EC.hooks.onDrawMonster = function (m, ctx) {
    if (m.species !== 'yaldanewe') return false;

    const c = ctx.ctx;
    c.save();

    const rx = m.x;
    const ry = m.y;
    const rw = m.w + 18;
    const rh = m.h + 10;
    const offsetX = -9;

    if (m.state === 'yaldaMeteorSlam' && m.stateTimer > (m.isCritical ? 50 : 60)) {
      c.translate(rx + m.w / 2, ry);
      c.scale(1.08, 0.85);
      c.translate(-(rx + m.w / 2), -ry);
    }

    c.shadowColor = m.isCritical ? '#ffab00' : '#ff5722';
    c.shadowBlur = m.isCritical ? 24 : 12;

    const tailBaseX = m.facing === 1 ? rx + offsetX + 16 : rx + offsetX + rw - 16;
    c.strokeStyle = m.isCritical ? '#ff6d00' : '#4e342e';
    c.lineWidth = 18;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(tailBaseX, ry - 26);
    c.lineTo(tailBaseX - m.facing * 82, ry - 18 + Math.sin(Date.now() * 0.01) * 7);
    c.stroke();

    c.fillStyle = m.isCritical ? '#ffd740' : '#ff5722';
    c.beginPath();
    c.arc(tailBaseX - m.facing * 82, ry - 18 + Math.sin(Date.now() * 0.01) * 7, 13, 0, Math.PI * 2);
    c.fill();

    c.fillStyle = m.flashTimer > 0 ? '#ffffff' : (m.isCritical ? '#3e1409' : '#261c1a');
    c.beginPath();
    c.roundRect(rx + offsetX + 12, ry - rh + 24, rw - 24, rh - 36, 16);
    c.fill();

    c.fillStyle = m.isCritical ? '#ffd740' : '#ff6d00';
    c.beginPath();
    c.moveTo(rx + offsetX + 28, ry - rh + 24);
    c.lineTo(rx + offsetX + 44, ry - rh + 6);
    c.lineTo(rx + offsetX + 64, ry - rh + 16);
    c.lineTo(rx + offsetX + 84, ry - rh + 4);
    c.lineTo(rx + offsetX + 100, ry - rh + 24);
    c.closePath();
    c.fill();

    c.strokeStyle = m.isCritical ? '#ffe57f' : '#ff3d00';
    c.lineWidth = m.isCritical ? 4 : 2.5;
    c.beginPath();
    c.moveTo(rx + offsetX + 28, ry - 48);
    c.lineTo(rx + offsetX + 54, ry - 36);
    c.lineTo(rx + offsetX + 86, ry - 52);
    c.stroke();

    const headX = m.facing === 1 ? rx + offsetX + rw - 32 : rx + offsetX - 8;
    c.fillStyle = m.flashTimer > 0 ? '#ffffff' : '#1c1413';
    c.fillRect(headX, ry - rh + 14, 40, 28);

    c.fillStyle = m.isCritical ? '#ffd740' : '#ff6d00';
    const crownX = headX + 20;
    c.beginPath();
    c.moveTo(crownX - 10, ry - rh + 14);
    c.lineTo(crownX - 14, ry - rh - 10);
    c.lineTo(crownX - 3, ry - rh + 8);
    c.lineTo(crownX, ry - rh - 16);
    c.lineTo(crownX + 3, ry - rh + 8);
    c.lineTo(crownX + 14, ry - rh - 10);
    c.lineTo(crownX + 10, ry - rh + 14);
    c.closePath();
    c.fill();

    c.fillStyle = '#ffee58';
    c.fillRect(m.facing === 1 ? headX + 24 : headX + 8, ry - rh + 20, 7, 5);

    c.fillStyle = m.isCritical ? '#bf360c' : '#3e2723';
    c.fillRect(rx + offsetX + 22, ry - 18, 18, 18);
    c.fillRect(rx + offsetX + rw - 40, ry - 18, 18, 18);

    c.restore();
    return true;
  };

  EC.hooks.onDrawProjectiles = function (ctx) {
    const c = ctx.ctx;

    magmaWaves.forEach(mw => {
      c.save();
      c.shadowColor = '#ff3d00';
      c.shadowBlur = 16;
      c.fillStyle = '#d84315';
      c.beginPath();
      c.moveTo(mw.x, ctx.GROUND_Y);
      c.lineTo(mw.x + mw.w * 0.25, mw.y + 10);
      c.lineTo(mw.x + mw.w * 0.55, mw.y);
      c.lineTo(mw.x + mw.w * 0.85, mw.y + 12);
      c.lineTo(mw.x + mw.w, ctx.GROUND_Y);
      c.closePath();
      c.fill();

      c.fillStyle = '#ffd740';
      c.fillRect(mw.x + 8, ctx.GROUND_Y - 14, mw.w - 16, 12);
      c.restore();
    });

    magmaPillars.forEach(mp => {
      c.save();
      const alpha = mp.life / mp.maxLife;
      c.shadowColor = '#ff6d00';
      c.shadowBlur = 18;
      const grad = c.createLinearGradient(0, mp.y, 0, ctx.GROUND_Y);
      grad.addColorStop(0, `rgba(255, 215, 64, ${0.15 * alpha})`);
      grad.addColorStop(0.5, `rgba(255, 87, 34, ${0.8 * alpha})`);
      grad.addColorStop(1, `rgba(216, 67, 21, ${0.95 * alpha})`);
      c.fillStyle = grad;
      c.fillRect(mp.x, mp.y, mp.w, mp.h);

      c.fillStyle = `rgba(255, 245, 157, ${0.85 * alpha})`;
      c.fillRect(mp.x + 12, mp.y + 18, mp.w - 24, mp.h - 18);
      c.restore();
    });

    stardustEmbers.forEach(em => {
      c.save();
      const urgency = 1 - (em.timer / 120);
      const pulseR = em.r + Math.sin(em.timer * 0.35) * 3 + urgency * 6;
      c.shadowColor = '#ffab00';
      c.shadowBlur = 12 + urgency * 14;

      c.fillStyle = '#ff3d00';
      c.beginPath();
      c.arc(em.x, em.y, pulseR, 0, Math.PI * 2);
      c.fill();

      if (em.timer > 30 || Math.floor(em.timer / 3) % 2 === 0) {
        c.fillStyle = '#fff59d';
        c.beginPath();
        c.arc(em.x, em.y, pulseR * 0.55, 0, Math.PI * 2);
        c.fill();
      }
      c.restore();
    });

    emberBlasts.forEach(eb => {
      c.save();
      const alpha = eb.life / 15;
      c.fillStyle = `rgba(255, 87, 34, ${alpha * 0.7})`;
      c.beginPath();
      c.arc(eb.x, eb.y, eb.r * (1.2 - alpha * 0.25), 0, Math.PI * 2);
      c.fill();

      c.fillStyle = `rgba(255, 245, 157, ${alpha * 0.9})`;
      c.beginPath();
      c.arc(eb.x, eb.y, eb.r * 0.45, 0, Math.PI * 2);
      c.fill();
      c.restore();
    });
  };
})();
// ===== ここから下をコピーして extra_content.js の一番下に貼り付け（ミツネ装備＆双剣追加） =====
(function () {
  const EC = window.EXTRA_CONTENT;
  if (!EC) return;

  // 1. タマミツネ太刀「狐刀カカルクモナキ」追加
  EC.weapons.longsword.push({
    id: 'mizutsune_katana',
    type: 'longsword',
    name: '狐刀カカルクモナキ',
    element: 'water',
    elementLabel: '水属性',
    attack: 135
  });

  // 2. 新武器種「双剣」データ追加
  EC.weapons.dualblades = EC.weapons.dualblades || [];
  EC.weapons.dualblades.push({
    id: 'kirin_db',
    type: 'dualblades',
    name: '双雷剣キリン',
    element: 'thunder',
    elementLabel: '雷属性',
    attack: 170
  });

  // 3. ミツネ防具一式（各部位：防御7・水耐性4・スキル最大2つ）
  EC.armors.head.push({
    id: 'mizutsune_head',
    series: 'mizutsune',
    name: 'ミツネヘルム',
    def: 7,
    fireRes: 0,
    waterRes: 4,
    thunderRes: 0,
    skills: { attack: 1, bubblyDance: 1 }
  });

  EC.armors.chest.push({
    id: 'mizutsune_chest',
    series: 'mizutsune',
    name: 'ミツネメイル',
    def: 7,
    fireRes: 0,
    waterRes: 4,
    thunderRes: 0,
    skills: { waterAtk: 2, recoveryUp: 1 }
  });

  EC.armors.arms.push({
    id: 'mizutsune_arms',
    series: 'mizutsune',
    name: 'ミツネアーム',
    def: 7,
    fireRes: 0,
    waterRes: 4,
    thunderRes: 0,
    skills: { attack: 1, waterAtk: 1 }
  });

  EC.armors.waist.push({
    id: 'mizutsune_waist',
    series: 'mizutsune',
    name: 'ミツネコイル',
    def: 7,
    fireRes: 0,
    waterRes: 4,
    thunderRes: 0,
    skills: { recoveryUp: 1, iceAtk: 1 }
  });

  EC.armors.legs.push({
    id: 'mizutsune_legs',
    series: 'mizutsune',
    name: 'ミツネグリーヴ',
    def: 7,
    fireRes: 0,
    waterRes: 4,
    thunderRes: 0,
    skills: { attack: 1, dragonAtk: 1 }
  });

  // 4. 新スキル名称登録
  Object.assign(EC.skillNames, {
    fireAtk: '火属性ダメージ',
    waterAtk: '水属性ダメージ',
    thunderAtk: '雷属性ダメージ',
    iceAtk: '氷属性ダメージ',
    dragonAtk: '龍属性ダメージ',
    bubblyDance: '泡沫の舞'
  });
})();
// ===== ここから下をコピーして extra_content.js の一番下に貼り付け（ラージャン＆ネルギガンテ追加） =====
(function () {
  const EC = window.EXTRA_CONTENT;
  if (!EC) return;

  // 既存のフックを退避（ヤルダネウェの処理を維持するため）
  const prevOnResetGame = EC.hooks.onResetGame;
  const prevOnChooseAction = EC.hooks.onChooseAction;
  const prevOnUpdateMonster = EC.hooks.onUpdateMonster;
  const prevOnDrawMonster = EC.hooks.onDrawMonster;
  const prevOnUpdateProjectiles = EC.hooks.onUpdateProjectiles;
  const prevOnDrawProjectiles = EC.hooks.onDrawProjectiles;

  // 飛び道具・エフェクト用配列
  let rajangBeams = [];
  let rajangRocks = [];
  let rajangWaves = [];
  let nergiSpikes = [];

  // 1. クエスト追加（☆3 / HP10000）
  EC.quests.push(
    {
      key: 'rajang',
      title: '金獅子、襲来',
      stars: '☆3',
      starLevel: 3,
      hpText: 'HP 10000',
      themeColor: '#fbc02d',
      borderColor: '#fff59d',
      tag: '大地を砕く、金獅子の咆哮',
      isMultiTarget: false,
      maxHp: 10000,
      effectiveness: { fire: 0, water: 0.75, thunder: 0, ice: 1.25, dragon: 0 },
      displayName: '金獅子 ラージャン',
      barColor: '#f9a825'
    },
    {
      key: 'nergigante',
      title: '滅びを纏いし龍の王',
      stars: '☆3',
      starLevel: 3,
      hpText: 'HP 10000',
      themeColor: '#4e342e',
      borderColor: '#d7ccc8',
      tag: '古龍を喰らう、滅尽の覇者',
      isMultiTarget: false,
      maxHp: 10000,
      effectiveness: { fire: 0.75, water: 0.75, thunder: 1.25, ice: 0.75, dragon: 1.0 },
      displayName: '滅尽龍 ネルギガンテ',
      barColor: '#5d4037'
    }
  );

  // リセット処理
  EC.hooks.onResetGame = function (ctx) {
    if (typeof prevOnResetGame === 'function') prevOnResetGame(ctx);
    rajangBeams = [];
    rajangRocks = [];
    rajangWaves = [];
    nergiSpikes = [];
  };

  // ==========================================
  // 行動選択フック（ラージャン / ネルギガンテ）
  // ==========================================
  EC.hooks.onChooseAction = function (m, ctx) {
    // --- 金獅子 ラージャン ---
    if (m.species === 'rajang') {
      if (m.isGolden === undefined) {
        m.isGolden = false;
        m.goldenUsed = false;
        m.goldenDamageTaken = 0;
        m.lastTrackedHp = m.hp;
      }
      m.facing = ctx.player.x < m.x + m.w / 2 ? -1 : 1;
      m.hasHitThisAttack = false;
      m.attackHitbox = null;

      // HP6500以下で闘気硬化（1回発動）
      if (!m.isGolden && !m.goldenUsed && m.hp <= 6500) {
        m.state = 'rajangGoldenRoar';
        m.stateTimer = 50;
        return true;
      }

      const r = Math.random();
      if (r < 0.25) {
        // 1. 気功波ビーム
        m.state = 'rajangBeam';
        m.stateTimer = m.isGolden ? 54 : 64;
      } else if (r < 0.50) {
        // 2. 飛鳥文化アタック
        m.state = 'rajangBlank';
        m.stateTimer = m.isGolden ? 62 : 72;
        m.blankTargetX = ctx.player.x + ctx.player.w / 2 - m.w / 2;
      } else if (r < 0.78) {
        // 3. デンプシー・連続パンチ前進
        m.state = 'rajangDempsey';
        m.stateTimer = m.isGolden ? 56 : 66;
      } else {
        // 4. 岩石投げ
        m.state = 'rajangRockThrow';
        m.stateTimer = m.isGolden ? 44 : 52;
      }
      return true;
    }

    // --- 滅尽龍 ネルギガンテ ---
    if (m.species === 'nergigante') {
      if (m.spikeStage === undefined) {
        m.spikeStage = 1; // 0:なし, 1:白棘, 2:黒棘
        m.spikeGrowthTimer = 0;
        m.spikeDamageTaken = 0;
        m.lastTrackedHp = m.hp;
      }
      m.facing = ctx.player.x < m.x + m.w / 2 ? -1 : 1;
      m.hasHitThisAttack = false;
      m.attackHitbox = null;

      // 黒棘が全身に生え揃っている場合は「破棘滅尽旋・天」を優先使用
      if (m.spikeStage === 2) {
        m.state = 'nergiDiveBomb';
        m.stateTimer = 78;
        m.diveTargetX = ctx.player.x + ctx.player.w / 2 - m.w / 2;
        return true;
      }

      const r = Math.random();
      if (r < 0.35) {
        // 前脚叩きつけ＆棘飛ばし
        m.state = 'nergiSlamSpikes';
        m.stateTimer = 50;
      } else if (r < 0.68) {
        // 頭突き突き上げ＆棘バラ撒き
        m.state = 'nergiHeadbutt';
        m.stateTimer = 56;
      } else {
        // 翼薙ぎ払いラッシュ（2連撃）
        m.state = 'nergiWingSweep';
        m.stateTimer = 58;
      }
      return true;
    }

    if (typeof prevOnChooseAction === 'function') {
      return prevOnChooseAction(m, ctx);
    }
    return false;
  };

  // ==========================================
  // AI・状態更新フック（ラージャン / ネルギガンテ）
  // ==========================================
  EC.hooks.onUpdateMonster = function (m, ctx) {
    // ------------------------------------------
    // 1. 金獅子 ラージャン 更新処理
    // ------------------------------------------
    if (m.species === 'rajang') {
      if (m.isGolden === undefined) {
        m.isGolden = false;
        m.goldenUsed = false;
        m.goldenDamageTaken = 0;
        m.lastTrackedHp = m.hp;
      }

      // 闘気硬化中のダメージ蓄積判定（800ダメージで解除＆大ダウン）
      if (m.lastTrackedHp > m.hp) {
        const diff = m.lastTrackedHp - m.hp;
        if (m.isGolden) {
          m.goldenDamageTaken += diff;
          if (m.goldenDamageTaken >= 800) {
            m.isGolden = false;
            m.goldenDamageTaken = 0;
            m.state = 'rajangDown';
            m.stateTimer = 150; // 約2.5秒間大ダウン
            m.y = ctx.GROUND_Y;
            m.vx = 0;
            m.attackHitbox = null;
            ctx.screenShake = 15;
            ctx.addText('闘気解除！！大ダウン！', m.x - 20, m.y - 115, '#4fc3f7', 24);
            ctx.addParticles(m.x + m.w / 2, m.y - 45, '#fff59d', 32, 8);
          }
        }
      }
      m.lastTrackedHp = m.hp;

      if (m.isGolden && Math.random() < 0.45) {
        ctx.addParticles(m.x + Math.random() * m.w, m.y - Math.random() * m.h, '#ffd740', 1, 3);
      }

      m.stateTimer--;

      if (m.state === 'idle') {
        m.y = ctx.GROUND_Y;
        m.facing = ctx.player.x < m.x + m.w / 2 ? -1 : 1;
        m.vx *= 0.8;
        if (m.stateTimer <= 0) EC.hooks.onChooseAction(m, ctx);
      } else if (m.state === 'rajangDown') {
        m.y = ctx.GROUND_Y;
        m.vx = 0;
        m.attackHitbox = null;
        if (m.stateTimer % 20 === 0) {
          ctx.addParticles(m.x + m.w / 2, m.y - 25, '#90caf9', 4, 2);
        }
        if (m.stateTimer <= 0) {
          m.state = 'idle';
          m.stateTimer = 25;
        }
      } else if (m.state === 'rajangGoldenRoar') {
        m.vx = 0;
        m.y = ctx.GROUND_Y;
        if (m.stateTimer % 3 === 0) {
          ctx.addParticles(m.x + m.w / 2, m.y - 50, '#ffd600', 8, 7);
        }
        if (m.stateTimer === 16) {
          m.isGolden = true;
          m.goldenUsed = true;
          m.goldenDamageTaken = 0;
          ctx.screenShake = 14;
          ctx.addText('闘気硬化！！黄金の毛並み＆赤い腕！', m.x - 50, m.y - 120, '#ffd740', 24);
          ctx.addParticles(m.x + m.w / 2, m.y - 50, '#ff1744', 30, 9);
        }
        if (m.stateTimer <= 0) {
          m.state = 'idle';
          m.stateTimer = 22;
        }
      } else if (m.state === 'rajangBeam') {
        // 気功波ビーム（口からの極太黄金レーザー・単発大ダメージ）
        m.vx = 0;
        m.y = ctx.GROUND_Y;
        const fireFrame = m.isGolden ? 26 : 32;
        if (m.stateTimer > fireFrame && m.stateTimer % 3 === 0) {
          const mouthX = m.facing === 1 ? m.x + m.w : m.x;
          ctx.addParticles(mouthX, m.y - 58, '#ffee58', 4, 4);
        }
        if (m.stateTimer === fireFrame) {
          const mouthX = m.facing === 1 ? m.x + m.w : m.x;
          const beamLen = 780;
          rajangBeams.push({
            x: m.facing === 1 ? mouthX : mouthX - beamLen,
            y: m.y - 76,
            w: beamLen,
            h: 36,
            life: 18,
            maxLife: 18,
            hasHit: false
          });
          ctx.screenShake = 12;
          ctx.addParticles(mouthX, m.y - 58, '#ffd740', 24, 8);
        }
        if (m.stateTimer <= 0) {
          m.state = 'idle';
          m.stateTimer = m.isGolden ? 28 : 38;
        }
      } else if (m.state === 'rajangBlank') {
        // 飛鳥文化アタック（ローリングサンダー急降下＋衝撃波）
        const total = m.isGolden ? 62 : 72;
        const jumpStart = total - 12;
        const diveEnd = 18;
        if (m.stateTimer > jumpStart) {
          m.vx = 0;
          m.y = ctx.GROUND_Y;
        } else if (m.stateTimer > diveEnd) {
          const span = jumpStart - diveEnd;
          const prog = (jumpStart - m.stateTimer) / span;
          const tx = Math.max(40, Math.min(ctx.canvas.width - m.w - 40, m.blankTargetX));
          m.x += (tx - m.x) * 0.16;
          m.y = ctx.GROUND_Y - Math.sin(prog * Math.PI) * 215;
          m.spinAngle = prog * Math.PI * 6 * m.facing;
          m.attackHitbox = prog > 0.65 ? ctx.getMonsterBody(m) : null;
        } else {
          if (m.stateTimer === diveEnd) {
            m.y = ctx.GROUND_Y;
            m.spinAngle = 0;
            m.attackHitbox = ctx.getMonsterBody(m);
            ctx.screenShake = 14;
            ctx.addParticles(m.x + m.w / 2, ctx.GROUND_Y - 12, '#ffd740', 26, 8);
            // 着地衝撃波（左右に走る雷撃波）
            [-1, 1].forEach(dir => {
              rajangWaves.push({
                x: m.x + m.w / 2 - 18,
                y: ctx.GROUND_Y - 36,
                w: 36,
                h: 36,
                vx: dir * (m.isGolden ? 10.5 : 8.5),
                hasHit: false
              });
            });
          } else if (m.stateTimer < diveEnd - 4) {
            m.attackHitbox = null;
          }
          m.y = ctx.GROUND_Y;
          m.vx = 0;
        }
        if (m.stateTimer <= 0) {
          m.y = ctx.GROUND_Y;
          m.spinAngle = 0;
          m.attackHitbox = null;
          m.state = 'idle';
          m.stateTimer = m.isGolden ? 26 : 36;
        }
      } else if (m.state === 'rajangDempsey') {
        // デンプシー・連続パンチ前進
        const total = m.isGolden ? 56 : 66;
        const startPunch = total - 14;
        if (m.stateTimer > startPunch) {
          m.vx = -m.facing * 1.4;
        } else if (m.stateTimer > 10) {
          m.vx = m.facing * (m.isGolden ? 8.2 : 6.8);
          const punchX = m.facing === 1 ? m.x + 20 : m.x - 35;
          m.attackHitbox = { x: punchX, y: m.y - m.h, w: m.w + 15, h: m.h };
          if (m.stateTimer % 6 === 0) {
            // 連続パンチごとに多段判定リセット
            m.hasHitThisAttack = false;
            ctx.addParticles(punchX + (m.facing === 1 ? m.w : 0), m.y - 40, m.isGolden ? '#ff1744' : '#ffd740', 6, 4);
          }
        } else {
          m.vx *= 0.75;
          m.attackHitbox = null;
        }
        if (m.stateTimer <= 0) {
          m.attackHitbox = null;
          m.state = 'idle';
          m.stateTimer = m.isGolden ? 26 : 36;
        }
      } else if (m.state === 'rajangRockThrow') {
        // 岩石投げ（闘気硬化中は岩が2個に分裂）
        m.vx = 0;
        const throwFrame = m.isGolden ? 20 : 25;
        if (m.stateTimer === throwFrame) {
          const startX = m.facing === 1 ? m.x + m.w : m.x - 36;
          const startY = m.y - 68;
          const dist = Math.max(140, Math.abs((ctx.player.x + 15) - startX));
          const vxBase = m.facing * Math.min(11.5, Math.max(5.5, dist / 46));
          rajangRocks.push({
            x: startX, y: startY, r: 22,
            vx: vxBase, vy: -8.5, hasHit: false
          });
          if (m.isGolden) {
            rajangRocks.push({
              x: startX, y: startY - 12, r: 19,
              vx: vxBase * 1.24, vy: -10.5, hasHit: false
            });
          }
          ctx.screenShake = 8;
          ctx.addParticles(startX, ctx.GROUND_Y - 10, '#8d6e63', 18, 6);
        }
        if (m.stateTimer <= 0) {
          m.state = 'idle';
          m.stateTimer = m.isGolden ? 28 : 38;
        }
      }

      m.x += m.vx;
      m.x = Math.max(30, Math.min(ctx.canvas.width - m.w - 30, m.x));

      if (m.attackHitbox && !m.hasHitThisAttack) {
        const pBox = { x: ctx.player.x, y: ctx.player.y - ctx.player.h, w: ctx.player.w, h: ctx.player.h };
        if (ctx.rectIntersect(m.attackHitbox, pBox)) {
          const dmg = m.state === 'rajangDempsey'
            ? (m.isGolden ? 18 : 14)
            : (m.isGolden ? 34 : 27);
          ctx.damagePlayer(dmg, false, false, m.isGolden, false);
          m.hasHitThisAttack = true;
        }
      }
      return true;
    }

    // ------------------------------------------
    // 2. 滅尽龍 ネルギガンテ 更新処理
    // ------------------------------------------
    if (m.species === 'nergigante') {
      if (m.spikeStage === undefined) {
        m.spikeStage = 1;
        m.spikeGrowthTimer = 0;
        m.spikeDamageTaken = 0;
        m.lastTrackedHp = m.hp;
      }

      // 白棘の部位破壊判定（650ダメージで破棘・大ダウン）
      if (m.lastTrackedHp > m.hp) {
        const diff = m.lastTrackedHp - m.hp;
        if (m.spikeStage === 1) {
          m.spikeDamageTaken += diff;
          if (m.spikeDamageTaken >= 650) {
            m.spikeStage = 0;
            m.spikeDamageTaken = 0;
            m.spikeGrowthTimer = 0;
            m.state = 'nergiDown';
            m.stateTimer = 150; // 約2.5秒間大ダウン
            m.y = ctx.GROUND_Y;
            m.vx = 0;
            m.attackHitbox = null;
            ctx.screenShake = 15;
            ctx.addText('白棘破壊！！大ダウン！', m.x - 20, m.y - 115, '#ffffff', 24);
            ctx.addParticles(m.x + m.w / 2, m.y - 50, '#eceff1', 34, 9);
          }
        }
      }
      m.lastTrackedHp = m.hp;

      // 時間経過による棘の成長（なし → 白棘 → 黒棘）
      if (m.state !== 'nergiDown' && m.state !== 'nergiDiveBomb') {
        m.spikeGrowthTimer++;
        if (m.spikeStage === 0 && m.spikeGrowthTimer >= 360) {
          m.spikeStage = 1;
          m.spikeGrowthTimer = 0;
          m.spikeDamageTaken = 0;
          ctx.addText('白棘再生！', m.x + 15, m.y - 105, '#eceff1', 18);
          ctx.addParticles(m.x + m.w / 2, m.y - 55, '#ffffff', 16, 5);
        } else if (m.spikeStage === 1 && m.spikeGrowthTimer >= 540) {
          m.spikeStage = 2;
          m.spikeGrowthTimer = 0;
          ctx.screenShake = 8;
          ctx.addText('黒棘硬化！！破棘滅尽旋・天 警戒！', m.x - 45, m.y - 115, '#ff5252', 20);
          ctx.addParticles(m.x + m.w / 2, m.y - 55, '#212121', 24, 7);
        }
      }

      m.stateTimer--;

      if (m.state === 'idle') {
        m.y = ctx.GROUND_Y;
        m.facing = ctx.player.x < m.x + m.w / 2 ? -1 : 1;
        m.vx *= 0.8;
        if (m.stateTimer <= 0) EC.hooks.onChooseAction(m, ctx);
      } else if (m.state === 'nergiDown') {
        m.y = ctx.GROUND_Y;
        m.vx = 0;
        m.attackHitbox = null;
        if (m.stateTimer <= 0) {
          m.state = 'idle';
          m.stateTimer = 25;
        }
      } else if (m.state === 'nergiDiveBomb') {
        // 破棘滅尽旋・天（黒棘時の必殺ダイブ＋全方位黒棘飛散）
        if (m.stateTimer > 56) {
          m.vx = 0;
          m.y = ctx.GROUND_Y;
          if (m.stateTimer === 68) {
            ctx.screenShake = 10;
            ctx.addText('破棘滅尽旋・天！！', m.x - 15, m.y - 120, '#ff1744', 24);
          }
        } else if (m.stateTimer > 22) {
          const prog = (56 - m.stateTimer) / 34;
          const tx = Math.max(40, Math.min(ctx.canvas.width - m.w - 40, m.diveTargetX));
          m.x += (tx - m.x) * 0.16;
          m.y = ctx.GROUND_Y - Math.sin(prog * Math.PI) * 230;
          m.attackHitbox = prog > 0.65 ? ctx.getMonsterBody(m) : null;
        } else {
          if (m.stateTimer === 22) {
            m.y = ctx.GROUND_Y;
            m.vx = 0;
            m.attackHitbox = ctx.getMonsterBody(m);
            m.spikeStage = 0; // 大技後に棘リセット
            m.spikeGrowthTimer = 0;
            m.spikeDamageTaken = 0;
            ctx.screenShake = 16;
            ctx.addParticles(m.x + m.w / 2, ctx.GROUND_Y - 15, '#212121', 30, 9);

            // 前方・後方に放射状へ黒棘を飛散
            const cx = m.x + m.w / 2;
            const angles = [-2.7, -2.2, -1.8, -1.34, -0.94, -0.44];
            angles.forEach(ang => {
              nergiSpikes.push({
                x: cx,
                y: ctx.GROUND_Y - 28,
                vx: Math.cos(ang) * 9.5,
                vy: Math.sin(ang) * 9.5,
                isBlack: true,
                life: 85,
                hasHit: false
              });
            });
          } else if (m.stateTimer < 17) {
            m.attackHitbox = null;
          }
          m.y = ctx.GROUND_Y;
          m.vx = 0;
        }
        if (m.stateTimer <= 0) {
          m.y = ctx.GROUND_Y;
          m.attackHitbox = null;
          m.state = 'idle';
          m.stateTimer = 42;
        }
      } else if (m.state === 'nergiSlamSpikes') {
        // 前脚叩きつけ＆前方棘射出
        m.vx = 0;
        if (m.stateTimer === 24) {
          const hitX = m.facing === 1 ? m.x + m.w - 10 : m.x - 45;
          m.attackHitbox = { x: hitX, y: m.y - 65, w: 55, h: 65 };
          ctx.screenShake = 9;
          ctx.addParticles(hitX + 25, ctx.GROUND_Y - 10, '#d7ccc8', 16, 6);

          // 前方へ無数の白棘を扇状に飛ばす
          const startX = m.facing === 1 ? m.x + m.w : m.x;
          [-0.25, -0.08, 0.06].forEach((dy, idx) => {
            nergiSpikes.push({
              x: startX,
              y: ctx.GROUND_Y - 26 - idx * 12,
              vx: m.facing * (9.2 + idx * 0.8),
              vy: dy * 8,
              isBlack: m.spikeStage === 2,
              life: 80,
              hasHit: false
            });
          });
        } else if (m.stateTimer < 18) {
          m.attackHitbox = null;
        }
        if (m.stateTimer <= 0) {
          m.attackHitbox = null;
          m.state = 'idle';
          m.stateTimer = 36;
        }
      } else if (m.state === 'nergiHeadbutt') {
        // 頭突き突き上げ＆棘バラ撒き
        if (m.stateTimer > 36) {
          m.vx = -m.facing * 1.5;
        } else if (m.stateTimer > 16) {
          m.vx = m.facing * 10.5;
          m.attackHitbox = ctx.getMonsterBody(m);
          if (m.stateTimer === 17) {
            ctx.screenShake = 8;
            // 突き上げと同時に上空から棘を降らせる
            const baseX = m.x + m.w / 2;
            [-110, -40, 40, 110].forEach(off => {
              nergiSpikes.push({
                x: Math.max(40, Math.min(ctx.canvas.width - 40, baseX + off)),
                y: ctx.GROUND_Y - 220,
                vx: 0,
                vy: 8.8,
                isBlack: m.spikeStage === 2,
                life: 60,
                hasHit: false
              });
            });
          }
        } else {
          m.vx *= 0.72;
          m.attackHitbox = null;
        }
        if (m.stateTimer <= 0) {
          m.attackHitbox = null;
          m.state = 'idle';
          m.stateTimer = 38;
        }
      } else if (m.state === 'nergiWingSweep') {
        // 翼薙ぎ払いラッシュ（2連撃）
        if (m.stateTimer === 42 || m.stateTimer === 22) {
          m.hasHitThisAttack = false;
          m.vx = m.facing * 10.5;
          const sweepX = m.facing === 1 ? m.x + 15 : m.x - 45;
          m.attackHitbox = { x: sweepX, y: m.y - m.h, w: m.w + 30, h: m.h };
          ctx.addParticles(sweepX + (m.facing === 1 ? m.w : 0), m.y - 45, '#bcaaa4', 12, 5);
        } else if ((m.stateTimer < 33 && m.stateTimer > 22) || m.stateTimer < 13) {
          m.vx *= 0.78;
          m.attackHitbox = null;
        }
        if (m.stateTimer <= 0) {
          m.attackHitbox = null;
          m.state = 'idle';
          m.stateTimer = 38;
        }
      }

      m.x += m.vx;
      m.x = Math.max(30, Math.min(ctx.canvas.width - m.w - 30, m.x));

      if (m.attackHitbox && !m.hasHitThisAttack) {
        const pBox = { x: ctx.player.x, y: ctx.player.y - ctx.player.h, w: ctx.player.w, h: ctx.player.h };
        if (ctx.rectIntersect(m.attackHitbox, pBox)) {
          const dmg = m.state === 'nergiDiveBomb' ? 38 : (m.state === 'nergiWingSweep' ? 21 : 26);
          ctx.damagePlayer(dmg, false, false, false, false);
          m.hasHitThisAttack = true;
        }
      }
      return true;
    }

    if (typeof prevOnUpdateMonster === 'function') {
      return prevOnUpdateMonster(m, ctx);
    }
    return false;
  };

  // ==========================================
  // 飛び道具更新フック
  // ==========================================
  EC.hooks.onUpdateProjectiles = function (ctx) {
    if (typeof prevOnUpdateProjectiles === 'function') prevOnUpdateProjectiles(ctx);

    const pBox = { x: ctx.player.x, y: ctx.player.y - ctx.player.h, w: ctx.player.w, h: ctx.player.h };

    // ラージャン：気功波ビーム（雷属性・単発大ダメージ）
    for (let i = rajangBeams.length - 1; i >= 0; i--) {
      const bm = rajangBeams[i];
      bm.life--;
      if (!bm.hasHit && bm.life >= 6 && ctx.rectIntersect(bm, pBox)) {
        bm.hasHit = true;
        ctx.damagePlayer(36, false, false, true, false);
        ctx.addParticles(ctx.player.x + 15, ctx.player.y - 30, '#ffd740', 22, 7);
      }
      if (bm.life <= 0) rajangBeams.splice(i, 1);
    }

    // ラージャン：着地衝撃波
    for (let i = rajangWaves.length - 1; i >= 0; i--) {
      const rw = rajangWaves[i];
      rw.x += rw.vx;
      if (!rw.hasHit && ctx.rectIntersect(rw, pBox)) {
        rw.hasHit = true;
        ctx.damagePlayer(22, false, false, true, false);
      }
      if (rw.x < -60 || rw.x > ctx.canvas.width + 60) rajangWaves.splice(i, 1);
    }

    // ラージャン：岩石投げ
    for (let i = rajangRocks.length - 1; i >= 0; i--) {
      const rk = rajangRocks[i];
      rk.x += rk.vx;
      rk.y += rk.vy;
      rk.vy += 0.42;
      const rkBox = { x: rk.x - rk.r, y: rk.y - rk.r, w: rk.r * 2, h: rk.r * 2 };
      if (!rk.hasHit && ctx.rectIntersect(rkBox, pBox)) {
        rk.hasHit = true;
        ctx.damagePlayer(25, false, false, false, false);
        ctx.addParticles(rk.x, rk.y, '#8d6e63', 18, 6);
        rajangRocks.splice(i, 1);
        continue;
      }
      if (rk.y >= ctx.GROUND_Y) {
        ctx.addParticles(rk.x, ctx.GROUND_Y - 6, '#8d6e63', 16, 6);
        rajangRocks.splice(i, 1);
      }
    }

    // ネルギガンテ：飛散する白棘・黒棘
    for (let i = nergiSpikes.length - 1; i >= 0; i--) {
      const spk = nergiSpikes[i];
      spk.x += spk.vx;
      spk.y += spk.vy;
      spk.life--;
      const spkBox = { x: spk.x - 10, y: spk.y - 10, w: 20, h: 20 };
      if (!spk.hasHit && ctx.rectIntersect(spkBox, pBox)) {
        spk.hasHit = true;
        ctx.damagePlayer(spk.isBlack ? 24 : 18, false, false, false, false);
        ctx.addParticles(spk.x, spk.y, spk.isBlack ? '#212121' : '#eceff1', 12, 5);
        nergiSpikes.splice(i, 1);
        continue;
      }
      if (spk.life <= 0 || spk.y > ctx.GROUND_Y + 10 || spk.x < -40 || spk.x > ctx.canvas.width + 40) {
        nergiSpikes.splice(i, 1);
      }
    }
  };

  // ==========================================
  // モンスター描画フック（ラージャン / ネルギガンテ）
  // ==========================================
  EC.hooks.onDrawMonster = function (m, ctx) {
    const c = ctx.ctx;

    // --- 金獅子 ラージャン 描画 ---
    if (m.species === 'rajang') {
      c.save();
      const rx = m.x;
      const ry = m.y;
      const rw = m.w;
      const rh = m.h;

      if (m.spinAngle) {
        c.translate(rx + rw / 2, ry - rh / 2);
        c.rotate(m.spinAngle);
        c.translate(-(rx + rw / 2), -(ry - rh / 2));
      }

      c.shadowColor = m.isGolden ? '#ffd740' : '#4e342e';
      c.shadowBlur = m.isGolden ? 22 : 8;

      // 尻尾
      const tailBaseX = m.facing === 1 ? rx + 14 : rx + rw - 14;
      c.strokeStyle = m.isGolden ? '#ffd740' : '#212121';
      c.lineWidth = 9;
      c.beginPath();
      c.moveTo(tailBaseX, ry - 26);
      c.lineTo(tailBaseX - m.facing * 44, ry - 48);
      c.stroke();

      // 胴体（通常:黒毛 / 闘気硬化:黄金）
      c.fillStyle = m.flashTimer > 0 ? '#ffffff' : (m.isGolden ? '#fbc02d' : '#1c1917');
      c.beginPath();
      c.roundRect(rx + 14, ry - rh + 22, rw - 28, rh - 34, 14);
      c.fill();

      // 逆立つ黄金の背毛（闘気硬化時）
      if (m.isGolden) {
        c.fillStyle = '#fff59d';
        c.beginPath();
        c.moveTo(rx + 22, ry - rh + 22);
        c.lineTo(rx + 38, ry - rh + 2);
        c.lineTo(rx + 55, ry - rh + 18);
        c.lineTo(rx + 72, ry - rh + 2);
        c.lineTo(rx + 88, ry - rh + 22);
        c.fill();
      }

      // 頭部＆2本の角
      const headX = m.facing === 1 ? rx + rw - 32 : rx - 4;
      c.fillStyle = m.flashTimer > 0 ? '#ffffff' : (m.isGolden ? '#fdd835' : '#292524');
      c.fillRect(headX, ry - rh + 12, 36, 26);

      c.fillStyle = '#eceff1';
      const hornX = headX + 18;
      c.beginPath();
      c.moveTo(hornX - 6, ry - rh + 12);
      c.lineTo(hornX + m.facing * 12, ry - rh - 8);
      c.lineTo(hornX + 2, ry - rh + 12);
      c.fill();

      // 目（赤く光る）
      c.fillStyle = '#ff1744';
      c.fillRect(m.facing === 1 ? headX + 22 : headX + 8, ry - rh + 18, 6, 4);

      // 巨大な前腕（闘気硬化時は赤黒く硬化！）
      const armX = m.facing === 1 ? rx + rw - 26 : rx + 2;
      c.fillStyle = m.isGolden ? '#b71c1c' : '#3e2723';
      c.fillRect(armX, ry - 54, 24, 54);
      if (m.isGolden) {
        c.strokeStyle = '#ff5252';
        c.lineWidth = 2.5;
        c.strokeRect(armX, ry - 54, 24, 54);
      }

      // 後脚
      c.fillStyle = m.isGolden ? '#f9a825' : '#1c1917';
      c.fillRect(rx + 22, ry - 20, 18, 20);

      c.restore();
      return true;
    }

    // --- 滅尽龍 ネルギガンテ 描画 ---
    if (m.species === 'nergigante') {
      c.save();
      const rx = m.x;
      const ry = m.y;
      const rw = m.w + 14;
      const rh = m.h + 8;
      const offX = -7;

      c.shadowColor = m.spikeStage === 2 ? '#ff1744' : '#4e342e';
      c.shadowBlur = m.spikeStage === 2 ? 18 : 8;

      // 巨大な翼
      const wingFlap = Math.sin(Date.now() * 0.012) * 8;
      c.fillStyle = '#261c1a';
      c.beginPath();
      c.moveTo(rx + offX + rw / 2, ry - rh + 24);
      c.lineTo(rx + offX + rw / 2 - m.facing * 82, ry - rh - 32 + wingFlap);
      c.lineTo(rx + offX + rw / 2 - m.facing * 24, ry - 20);
      c.fill();

      // 胴体
      c.fillStyle = m.flashTimer > 0 ? '#ffffff' : '#3e2723';
      c.beginPath();
      c.roundRect(rx + offX + 14, ry - rh + 24, rw - 28, rh - 34, 14);
      c.fill();

      // 背中の無数の棘（stage 1: 白棘 / stage 2: 黒棘）
      if (m.spikeStage >= 1) {
        c.fillStyle = m.spikeStage === 2 ? '#111111' : '#f5f5f5';
        c.strokeStyle = m.spikeStage === 2 ? '#ff5252' : '#90a4ae';
        c.lineWidth = 1.5;
        for (let s = 0; s < 5; s++) {
          const sx = rx + offX + 24 + s * 16;
          c.beginPath();
          c.moveTo(sx - 5, ry - rh + 26);
          c.lineTo(sx - m.facing * 4, ry - rh + 2);
          c.lineTo(sx + 5, ry - rh + 26);
          c.closePath();
          c.fill();
          c.stroke();
        }
      }

      // 頭部＆巨大な2本の大角
      const headX = m.facing === 1 ? rx + offX + rw - 32 : rx + offX - 4;
      c.fillStyle = m.flashTimer > 0 ? '#ffffff' : '#2d1c18';
      c.fillRect(headX, ry - rh + 14, 36, 26);

      c.fillStyle = '#d7ccc8';
      const hornBase = headX + (m.facing === 1 ? 26 : 10);
      c.beginPath();
      c.moveTo(hornBase, ry - rh + 18);
      c.lineTo(hornBase + m.facing * 22, ry - rh + 4);
      c.lineTo(hornBase + m.facing * 14, ry - rh + 24);
      c.fill();

      // 目
      c.fillStyle = '#ffab00';
      c.fillRect(m.facing === 1 ? headX + 20 : headX + 8, ry - rh + 20, 6, 4);

      // 脚
      c.fillStyle = '#261c1a';
      c.fillRect(rx + offX + 24, ry - 18, 16, 18);
      c.fillRect(rx + offX + rw - 40, ry - 18, 16, 18);

      c.restore();
      return true;
    }

    if (typeof prevOnDrawMonster === 'function') {
      return prevOnDrawMonster(m, ctx);
    }
    return false;
  };

  // ==========================================
  // 飛び道具描画フック
  // ==========================================
  EC.hooks.onDrawProjectiles = function (ctx) {
    if (typeof prevOnDrawProjectiles === 'function') prevOnDrawProjectiles(ctx);

    const c = ctx.ctx;

    // ラージャン：気功波ビーム
    rajangBeams.forEach(bm => {
      c.save();
      const alpha = bm.life / bm.maxLife;
      c.shadowColor = '#ffd740';
      c.shadowBlur = 20;
      c.fillStyle = `rgba(255, 214, 0, ${0.85 * alpha})`;
      c.fillRect(bm.x, bm.y, bm.w, bm.h);
      c.fillStyle = `rgba(255, 255, 255, ${0.95 * alpha})`;
      c.fillRect(bm.x, bm.y + 9, bm.w, bm.h - 18);
      c.restore();
    });

    // ラージャン：着地衝撃波
    rajangWaves.forEach(rw => {
      c.save();
      c.shadowColor = '#ffd740';
      c.shadowBlur = 14;
      c.fillStyle = '#ffd740';
      c.fillRect(rw.x, rw.y, rw.w, rw.h);
      c.fillStyle = '#ffffff';
      c.fillRect(rw.x + 8, rw.y + 10, rw.w - 16, rw.h - 10);
      c.restore();
    });

    // ラージャン：岩石投げ
    rajangRocks.forEach(rk => {
      c.save();
      c.fillStyle = '#5d4037';
      c.beginPath();
      c.arc(rk.x, rk.y, rk.r, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#8d6e63';
      c.lineWidth = 3;
      c.stroke();
      c.restore();
    });

    // ネルギガンテ：白棘・黒棘
    nergiSpikes.forEach(spk => {
      c.save();
      c.fillStyle = spk.isBlack ? '#111111' : '#f5f5f5';
      c.strokeStyle = spk.isBlack ? '#ff5252' : '#78909c';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(spk.x, spk.y, 7, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.restore();
    });
  };
})();
// ===== ここから下をコピーして extra_content.js の一番下に貼り付け（アルヴァディオス 修正版 ☆4 / HP20000 v3） =====
(function () {
  const EC = window.EXTRA_CONTENT;
  if (!EC) return;

  // 既存のフックを退避
  const prevOnResetGame = EC.hooks.onResetGame;
  const prevOnChooseAction = EC.hooks.onChooseAction;
  const prevOnUpdateMonster = EC.hooks.onUpdateMonster;
  const prevOnDrawMonster = EC.hooks.onDrawMonster;
  const prevOnUpdateProjectiles = EC.hooks.onUpdateProjectiles;
  const prevOnDrawProjectiles = EC.hooks.onDrawProjectiles;

  // アルヴァディオス専用飛び道具・嵐エフェクト配列
  let arvaProjectiles = [];
  let stormRain = [];
  let weatherState = 'storm_light'; // 'storm_light' or 'storm_fury'
  let isArvaFight = false;

  // クエスト追加（☆4 / HP20000）
  EC.quests.push({
    key: 'arva',
    title: '原初の咆哮',
    stars: '☆4',
    starLevel: 4,
    hpText: 'HP 20000',
    themeColor: '#101820',
    borderColor: '#00e5ff',
    tag: '古龍種・天災龍 アルヴァディオス',
    isMultiTarget: false,
    maxHp: 20000,
    effectiveness: { fire: 0.75, water: 0.75, thunder: 0, ice: 0.75, dragon: 1.5 },
    displayName: '天災龍 アルヴァディオス',
    barColor: '#00b0ff'
  });

  // リセット処理
  EC.hooks.onResetGame = function (ctx) {
    if (typeof prevOnResetGame === 'function') prevOnResetGame(ctx);
    arvaProjectiles = [];
    stormRain = [];
    weatherState = 'storm_light';
    isArvaFight = false;
    if (ctx.canvas) ctx.canvas.style.background = '#1a1a2e';
  };

  // 行動選択フック
  EC.hooks.onChooseAction = function (m, ctx) {
    if (m.species === 'arva') {
      if (!isArvaFight) {
        isArvaFight = true;
        if (ctx.canvas) {
          ctx.canvas.style.background = 'linear-gradient(180deg, #090d14 0%, #16222f 55%, #0b1118 100%)';
        }
      }

      // HP10000以下で超暴風雷雨へ天候急変（1回のみ）
      if (m.hp <= 10000 && weatherState === 'storm_light') {
        weatherState = 'storm_fury';
        m.state = 'arvaWeatherShift';
        m.stateTimer = 95;
        if (ctx.canvas) {
          ctx.canvas.style.background = 'radial-gradient(circle at 50% 25%, #243b55 0%, #101923 48%, #04070a 100%)';
        }
        ctx.screenShake = 20;
        ctx.addParticles(m.x + m.w / 2, m.y - 50, '#00e5ff', 36, 10);
        ctx.addText('天災覚醒！！暴風雷雨が荒れ狂う！！', m.x - 65, m.y - 125, '#00e5ff', 26);
        m.vx = 0;
        return true;
      }

      m.facing = ctx.player.x < m.x + m.w / 2 ? -1 : 1;
      m.hasHitThisAttack = false;
      m.attackHitbox = null;

      // 壁際（左端または右端）に追い詰められている場合は飛翔技で位置取りをリセットしやすくする
      const nearWall = m.x <= 80 || m.x >= ctx.canvas.width - m.w - 80;
      const isSuper = weatherState === 'storm_fury' ? Math.random() < 0.6 : Math.random() < 0.32;

      const r = Math.random();
      if (nearWall && r < 0.45) {
        // 壁際脱出も兼ねて天災飛翔・雷轟
        m.state = 'arvaDiveBeam';
        m.stateTimer = 72;
        m.diveTargetX = ctx.canvas.width / 2 - m.w / 2;
      } else if (isSuper) {
        if (r < 0.55) {
          // C. 超電導・拡散雷爆
          m.state = 'arvaSuperNova';
          m.stateTimer = 64;
        } else {
          // D. 天災飛翔・雷轟
          m.state = 'arvaDiveBeam';
          m.stateTimer = 72;
          m.diveTargetX = ctx.player.x;
        }
      } else {
        if (r < 0.52) {
          // A. 雷光爪
          m.state = 'arvaClaw';
          m.stateTimer = 48;
        } else {
          // B. 帯電尻尾叩きつけ＆周囲落雷
          m.state = 'arvaTailSlam';
          m.stateTimer = 54;
        }
      }
      return true;
    }

    if (typeof prevOnChooseAction === 'function') {
      return prevOnChooseAction(m, ctx);
    }
    return false;
  };

  // 更新フック
  EC.hooks.onUpdateMonster = function (m, ctx) {
    if (m.species === 'arva') {
      if (!isArvaFight) {
        isArvaFight = true;
        if (ctx.canvas) {
          ctx.canvas.style.background = 'linear-gradient(180deg, #090d14 0%, #16222f 55%, #0b1118 100%)';
        }
      }

      // 嵐の雨粒エフェクト生成
      const rainCount = weatherState === 'storm_fury' ? 6 : 3;
      for (let i = 0; i < rainCount; i++) {
        stormRain.push({
          x: Math.random() * (ctx.canvas.width + 300),
          y: -30,
          vx: weatherState === 'storm_fury' ? -8.5 : -5,
          vy: weatherState === 'storm_fury' ? 19 : 14,
          len: weatherState === 'storm_fury' ? 26 : 18
        });
      }

      // 嵐による定期落雷（5ダメージ固定・頻度を適正化）
      const boltChance = weatherState === 'storm_fury' ? 0.025 : 0.008;
      if (Math.random() < boltChance) {
        const targetX = Math.random() * ctx.canvas.width;
        arvaProjectiles.push({
          x: targetX - 30, y: -90, w: 60, h: ctx.GROUND_Y + 90,
          life: 18, type: 'randomBolt', hasHit: false
        });
        if (Math.random() < 0.4) ctx.screenShake = 5;
      }

      m.stateTimer--;

      if (m.state === 'idle') {
        m.y = ctx.GROUND_Y;
        m.facing = ctx.player.x < m.x + m.w / 2 ? -1 : 1;
        // プレイヤーと近すぎるときは少し距離を取り、離れていれば近づく
        const dist = Math.abs((ctx.player.x + ctx.player.w / 2) - (m.x + m.w / 2));
        if (dist < 70) {
          // 壁際なら中央へ、そうでなければ後ろへ下がる
          const escapeDir = m.x <= 90 ? 1 : (m.x >= ctx.canvas.width - m.w - 90 ? -1 : -m.facing);
          m.vx = escapeDir * 2.2;
        } else {
          m.vx = m.facing * 2.6;
        }
        if (m.stateTimer <= 0) EC.hooks.onChooseAction(m, ctx);

      } else if (m.state === 'arvaWeatherShift') {
        m.vx = 0;
        m.y = ctx.GROUND_Y;
        if (m.stateTimer % 8 === 0) ctx.addParticles(m.x + m.w / 2, m.y - 50, '#00e5ff', 12, 6);
        if (m.stateTimer <= 0) {
          m.state = 'idle';
          m.stateTimer = 20;
          m.isFurious = true;
        }

      } else if (m.state === 'arvaClaw') {
        // A. 雷光爪（前方強烈薙ぎ払い・雷属性やられ）
        if (m.stateTimer > 32) {
          m.vx = m.facing * 2.5; // 踏み込み
        } else if (m.stateTimer === 32) {
          m.vx = m.facing * 6;
          m.attackHitbox = { x: m.facing === 1 ? m.x + m.w - 10 : m.x - 84, y: m.y - 82, w: 96, h: 84 };
          ctx.screenShake = 10;
          ctx.addParticles(m.attackHitbox.x + m.attackHitbox.w / 2, m.y - 40, '#80d8ff', 22, 6);
        } else {
          m.vx *= 0.8;
          if (m.stateTimer < 24) m.attackHitbox = null;
        }
        if (m.stateTimer <= 0) {
          m.attackHitbox = null;
          m.state = 'idle';
          m.stateTimer = 26;
        }

      } else if (m.state === 'arvaTailSlam') {
        // B. 帯電尻尾叩きつけ＆周囲落雷
        if (m.stateTimer > 28) {
          m.vx = -m.facing * 2.2;
          m.y -= 1.2;
        } else if (m.stateTimer === 28) {
          m.vx = 0;
          m.y = ctx.GROUND_Y;
          m.attackHitbox = { x: m.x + m.w / 2 - 55, y: m.y - 62, w: 110, h: 62 };
          ctx.screenShake = 12;
          ctx.addParticles(m.x + m.w / 2, m.y - 10, '#40c4ff', 26, 8);
          for (let i = 0; i < 3; i++) {
            arvaProjectiles.push({
              x: m.x + m.w / 2 + (i - 1) * 135 - 26, y: -50, w: 52, h: ctx.GROUND_Y + 50,
              life: 24, type: 'bolt', hasHit: false
            });
          }
        } else {
          m.vx = 0;
          if (m.stateTimer < 20) m.attackHitbox = null;
        }
        if (m.stateTimer <= 0) {
          m.attackHitbox = null;
          m.state = 'idle';
          m.stateTimer = 32;
        }

      } else if (m.state === 'arvaSuperNova') {
        // C. 超電導・拡散雷爆（広範囲蒼い雷大爆発）
        if (m.stateTimer > 24) {
          m.vx = 0;
          m.y = ctx.GROUND_Y;
          if (m.stateTimer % 4 === 0) ctx.addParticles(m.x + m.w / 2, m.y - m.h / 2, '#00e5ff', 7, 4);
        } else if (m.stateTimer === 24) {
          ctx.screenShake = 20;
          ctx.addParticles(m.x + m.w / 2, m.y - 55, '#84ffff', 48, 10);
          arvaProjectiles.push({
            x: m.x + m.w / 2 - 420, y: m.y - 135, w: 840, h: 135,
            life: 24, type: 'nova', hasHit: false, facing: m.facing
          });
        } else if (m.stateTimer < 14) {
          m.attackHitbox = null;
        }
        if (m.stateTimer <= 0) {
          m.attackHitbox = null;
          m.state = 'idle';
          m.stateTimer = 22;
        }

      } else if (m.state === 'arvaDiveBeam') {
        // D. 天災飛翔・雷轟（上空から連続極太雷ビーム）
        if (m.stateTimer > 50) {
          m.vx = 0;
          m.y = ctx.GROUND_Y;
        } else if (m.stateTimer > 24) {
          // 空中へ飛び上がりつつ中央・ターゲット方向へ移動
          const targetCenter = m.x <= 120 ? ctx.canvas.width * 0.45 : (m.x >= ctx.canvas.width - m.w - 120 ? ctx.canvas.width * 0.55 : m.diveTargetX);
          m.vx = (targetCenter - m.x) * 0.06;
          m.y = ctx.GROUND_Y - 175;
          m.attackHitbox = ctx.getMonsterBody(m);
          if (m.stateTimer % 4 === 0) {
            arvaProjectiles.push({
              x: m.facing === 1 ? m.x + m.w - 18 : m.x - 8, y: m.y - 30,
              vx: m.facing * 9.5, vy: 7.5, r: 10, life: 66, type: 'beam', hasHit: false
            });
          }
        } else if (m.stateTimer === 24) {
          m.vx = m.facing * 12;
          m.y = ctx.GROUND_Y;
          m.attackHitbox = ctx.getMonsterBody(m);
          ctx.screenShake = 15;
        } else {
          m.vx *= 0.82;
          if (m.stateTimer < 18) m.attackHitbox = null;
        }
        if (m.stateTimer <= 0) {
          m.attackHitbox = null;
          m.state = 'idle';
          m.stateTimer = 24;
        }

      } else {
        // 【重要】本体側の怯み・ダウン等（flinch / stagger / down 等）に入った場合の復帰保証
        m.vx *= 0.8;
        m.y = ctx.GROUND_Y;
        m.attackHitbox = null;
        if (m.stateTimer <= 0 || isNaN(m.stateTimer)) {
          m.state = 'idle';
          m.stateTimer = 20;
        }
      }

      m.x += m.vx;
      m.x = Math.max(40, Math.min(ctx.canvas.width - m.w - 40, m.x));
      if (m.state !== 'arvaDiveBeam') {
        if (m.y < ctx.GROUND_Y) m.y += 4;
        else m.y = ctx.GROUND_Y;
      }

      if (m.attackHitbox && !m.hasHitThisAttack) {
        const pBox = { x: ctx.player.x, y: ctx.player.y - ctx.player.h, w: ctx.player.w, h: ctx.player.h };
        if (ctx.rectIntersect(m.attackHitbox, pBox)) {
          const dmg = m.state === 'arvaSuperNova' ? 42 : (m.state === 'arvaClaw' ? 30 : 36);
          ctx.damagePlayer(dmg, false, false, true, false);
          m.hasHitThisAttack = true;
        }
      }
      return true;
    }
    if (typeof prevOnUpdateMonster === 'function') return prevOnUpdateMonster(m, ctx);
    return false;
  };

  // 飛び道具更新フック
  EC.hooks.onUpdateProjectiles = function (ctx) {
    if (typeof prevOnUpdateProjectiles === 'function') prevOnUpdateProjectiles(ctx);

    for (let i = stormRain.length - 1; i >= 0; i--) {
      const rn = stormRain[i];
      rn.x += rn.vx;
      rn.y += rn.vy;
      if (rn.y > ctx.GROUND_Y + 10) stormRain.splice(i, 1);
    }

    const pBox = { x: ctx.player.x, y: ctx.player.y - ctx.player.h, w: ctx.player.w, h: ctx.player.h };
    for (let i = arvaProjectiles.length - 1; i >= 0; i--) {
      const p = arvaProjectiles[i];
      p.life--;
      if (!p.hasHit && ctx.rectIntersect(p, pBox)) {
        p.hasHit = true;
        // 嵐・落雷系は5ダメージ固定、超電導爆発やビームは通常ダメージ
        const projDmg = (p.type === 'randomBolt' || p.type === 'bolt') ? 5 : (p.type === 'nova' ? 36 : 26);
        ctx.damagePlayer(projDmg, false, false, true, false);
        if (p.type === 'beam') {
          arvaProjectiles.splice(i, 1);
          continue;
        }
      }
      if (p.type === 'beam') { p.x += p.vx; p.y += p.vy; }
      if (p.life <= 0) arvaProjectiles.splice(i, 1);
    }
  };

  // 描画フック（絵柄はそのまま維持）
  EC.hooks.onDrawMonster = function (m, ctx) {
    if (m.species === 'arva') {
      const c = ctx.ctx;
      c.save();

      const cx = m.x + m.w / 2;
      const by = m.y;
      c.translate(cx, by);
      c.scale(m.facing, 1);

      const isFlash = m.flashTimer > 0;
      const isSuper = m.state === 'arvaSuperNova' || weatherState === 'storm_fury';
      const pulse = 0.7 + 0.3 * Math.sin(Date.now() * 0.015);
      const wingFlap = Math.sin(Date.now() * 0.016) * (m.state === 'arvaDiveBeam' ? 28 : 12);

      c.shadowColor = isSuper ? '#00e5ff' : '#0288d1';
      c.shadowBlur = isSuper ? 26 : 14;

      // 1. 奥側の翼
      c.fillStyle = isFlash ? '#ffffff' : '#080c12';
      c.beginPath();
      c.moveTo(-10, -78);
      c.lineTo(-92, -138 + wingFlap * 0.8);
      c.lineTo(-105, -95 + wingFlap * 0.8);
      c.lineTo(-70, -75);
      c.lineTo(-42, -52);
      c.closePath();
      c.fill();

      // 2. 尻尾
      c.strokeStyle = isFlash ? '#ffffff' : '#101822';
      c.lineWidth = 11;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(-36, -28);
      c.quadraticCurveTo(-72, -32, -96, -54 + Math.sin(Date.now() * 0.012) * 8);
      c.stroke();

      c.strokeStyle = `rgba(0, 229, 255, ${pulse})`;
      c.lineWidth = 2.5;
      c.beginPath();
      c.moveTo(-40, -28);
      c.quadraticCurveTo(-72, -32, -96, -54 + Math.sin(Date.now() * 0.012) * 8);
      c.stroke();

      // 3. 脚
      c.fillStyle = isFlash ? '#ffffff' : '#111924';
      c.beginPath();
      c.roundRect(-34, -34, 22, 34, 6);
      c.roundRect(14, -42, 20, 42, 6);
      c.fill();

      c.fillStyle = '#84ffff';
      for (let cl = 0; cl < 3; cl++) {
        c.beginPath();
        c.moveTo(30, -10 + cl * 4);
        c.lineTo(44, -6 + cl * 4);
        c.lineTo(30, -4 + cl * 4);
        c.fill();
      }

      // 4. 胴体
      c.fillStyle = isFlash ? '#ffffff' : '#0f1722';
      c.beginPath();
      c.moveTo(-42, -30);
      c.quadraticCurveTo(-38, -76, 4, -84);
      c.lineTo(28, -104);
      c.lineTo(44, -88);
      c.quadraticCurveTo(42, -40, 26, -22);
      c.lineTo(-28, -22);
      c.closePath();
      c.fill();

      c.fillStyle = isFlash ? '#ffffff' : '#1b2838';
      for (let sc = 0; sc < 4; sc++) {
        c.beginPath();
        c.ellipse(-18 + sc * 13, -52 - sc * 4, 9, 13, -0.3, 0, Math.PI * 2);
        c.fill();
      }

      // 5. 体表の稲妻
      c.strokeStyle = `rgba(0, 229, 255, ${pulse})`;
      c.lineWidth = isSuper ? 3 : 2;
      c.beginPath();
      c.moveTo(22, -82);
      c.lineTo(14, -66);
      c.lineTo(24, -54);
      c.lineTo(10, -38);
      c.moveTo(14, -66);
      c.lineTo(-4, -58);
      c.lineTo(-18, -42);
      c.stroke();

      // 6. 背棘
      c.fillStyle = isFlash ? '#ffffff' : '#1c2836';
      for (let sp = 0; sp < 5; sp++) {
        const sx = -24 + sp * 11;
        const sy = -68 - sp * 7;
        c.beginPath();
        c.moveTo(sx - 5, sy + 6);
        c.lineTo(sx - 12, sy - 12);
        c.lineTo(sx + 4, sy + 2);
        c.fill();
      }

      // 7. 頭部・角・牙・瞳
      const horns = [
        { bx: 24, by: -102, tx: -8, ty: -146, w: 6, col: '#263238' },
        { bx: 20, by: -98,  tx: -14, ty: -134, w: 5, col: '#263238' },
        { bx: 18, by: -92,  tx: -12, ty: -120, w: 4, col: '#263238' },
        { bx: 28, by: -104, tx: 2,  ty: -152, w: 7, col: '#455a64' },
        { bx: 24, by: -99,  tx: -6, ty: -138, w: 6, col: '#546e7a' },
        { bx: 20, by: -93,  tx: -8, ty: -123, w: 5, col: '#37474f' }
      ];
      horns.forEach(h => {
        c.fillStyle = isFlash ? '#ffffff' : h.col;
        c.beginPath();
        c.moveTo(h.bx - h.w / 2, h.by);
        c.quadraticCurveTo(h.bx - 6, (h.by + h.ty) / 2, h.tx, h.ty);
        c.quadraticCurveTo(h.bx + 2, (h.by + h.ty) / 2, h.bx + h.w / 2, h.by);
        c.fill();
      });

      c.fillStyle = isFlash ? '#ffffff' : '#16202c';
      c.beginPath();
      c.moveTo(20, -104);
      c.lineTo(58, -96);
      c.lineTo(55, -86);
      c.lineTo(24, -86);
      c.closePath();
      c.fill();

      c.fillStyle = isFlash ? '#ffffff' : '#101822';
      c.beginPath();
      c.moveTo(24, -84);
      c.lineTo(52, -80);
      c.lineTo(48, -74);
      c.lineTo(22, -76);
      c.closePath();
      c.fill();

      c.fillStyle = '#eceff1';
      for (let t = 0; t < 4; t++) {
        const tx = 34 + t * 5;
        c.beginPath();
        c.moveTo(tx, -86);
        c.lineTo(tx + 1.5, -81);
        c.lineTo(tx + 3, -86);
        c.fill();
      }

      c.shadowColor = '#00e5ff';
      c.shadowBlur = 14;
      c.fillStyle = '#00e5ff';
      c.beginPath();
      c.moveTo(34, -95);
      c.lineTo(44, -93);
      c.lineTo(38, -90);
      c.closePath();
      c.fill();

      // 8. 手前側の翼
      c.shadowColor = isSuper ? '#00e5ff' : '#0277bd';
      c.shadowBlur = isSuper ? 22 : 10;
      c.fillStyle = isFlash ? '#ffffff' : 'rgba(13, 19, 28, 0.94)';
      c.beginPath();
      c.moveTo(-4, -74);
      c.lineTo(-76, -132 + wingFlap);
      c.lineTo(-96, -84 + wingFlap);
      c.lineTo(-64, -76 + wingFlap * 0.5);
      c.lineTo(-44, -64 + wingFlap * 0.3);
      c.lineTo(-22, -48);
      c.closePath();
      c.fill();

      c.strokeStyle = isFlash ? '#ffffff' : '#263238';
      c.lineWidth = 4.5;
      c.beginPath();
      c.moveTo(-4, -74);
      c.lineTo(-76, -132 + wingFlap);
      c.lineTo(-96, -84 + wingFlap);
      c.stroke();

      c.strokeStyle = `rgba(0, 229, 255, ${pulse})`;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(-24, -84 + wingFlap * 0.2);
      c.lineTo(-56, -104 + wingFlap * 0.6);
      c.lineTo(-76, -88 + wingFlap * 0.7);
      c.stroke();

      c.restore();
      return true;
    }
    if (typeof prevOnDrawMonster === 'function') return prevOnDrawMonster(m, ctx);
    return false;
  };

  // 飛び道具描画フック
  EC.hooks.onDrawProjectiles = function (ctx) {
    if (typeof prevOnDrawProjectiles === 'function') prevOnDrawProjectiles(ctx);
    const c = ctx.ctx;

    if (stormRain.length > 0) {
      c.save();
      c.strokeStyle = weatherState === 'storm_fury' ? 'rgba(0, 229, 255, 0.42)' : 'rgba(144, 202, 249, 0.25)';
      c.lineWidth = 1.5;
      c.beginPath();
      stormRain.forEach(rn => {
        c.moveTo(rn.x, rn.y);
        c.lineTo(rn.x + rn.vx * (rn.len / rn.vy), rn.y + rn.len);
      });
      c.stroke();
      c.restore();
    }

    arvaProjectiles.forEach(p => {
      c.save();
      if (p.type === 'randomBolt' || p.type === 'bolt') {
        c.shadowColor = '#00e5ff'; c.shadowBlur = 20;
        c.fillStyle = 'rgba(0, 229, 255, 0.82)'; c.fillRect(p.x, p.y, p.w, p.h);
        c.fillStyle = '#ffffff'; c.fillRect(p.x + 20, p.y, p.w - 40, p.h);
      } else if (p.type === 'nova') {
        const alpha = p.life / 24;
        c.fillStyle = `rgba(0, 176, 255, ${0.38 * alpha})`;
        c.fillRect(p.x, p.y, p.w, p.h);
        c.fillStyle = `rgba(224, 247, 250, ${0.75 * alpha})`;
        c.fillRect(p.x, p.y + 24, p.w, p.h - 48);
      } else if (p.type === 'beam') {
        c.shadowColor = '#00e5ff'; c.shadowBlur = 12; c.fillStyle = '#ffffff';
        c.beginPath(); c.arc(p.x, p.y, p.r, 0, Math.PI * 2); c.fill();
      }
      c.restore();
    });
  };
})();
// ============================================================
// 追加コンテンツ：深海龍 ネレグラディス（☆4古龍・水属性・HP 20000）
// ============================================================
(function () {
  window.EXTRA_CONTENT = window.EXTRA_CONTENT || {
    weapons: { longsword: [], greatsword: [], dualblades: [] },
    armors: { head: [], chest: [], arms: [], waist: [], legs: [] },
    skillNames: {},
    quests: [],
    hooks: {}
  };

  const EXTRA = window.EXTRA_CONTENT;
  EXTRA.quests = EXTRA.quests || [];
  EXTRA.hooks = EXTRA.hooks || {};

  // 既存フック（アルヴァディオス等）があれば保持して連結する
  const prevHooks = {
    onResetGame: EXTRA.hooks.onResetGame,
    onUpdateMonster: EXTRA.hooks.onUpdateMonster,
    onChooseAction: EXTRA.hooks.onChooseAction,
    onUpdateProjectiles: EXTRA.hooks.onUpdateProjectiles,
    onDrawMonster: EXTRA.hooks.onDrawMonster,
    onDrawProjectiles: EXTRA.hooks.onDrawProjectiles
  };

  // クエストボード＆F2肉質表へ自動登録（☆4 / HP 20000）
  if (!EXTRA.quests.some(q => q.key === 'neregladis')) {
    EXTRA.quests.push({
      key: 'neregladis',
      title: '原初の崇拝',
      displayName: '深海龍 ネレグラディス',
      stars: '☆4',
      starLevel: 4,
      hpText: 'HP 20000',
      maxHp: 20000,
      themeColor: '#0277bd',
      borderColor: '#80deea',
      barColor: '#00b0ff',
      tag: '古龍種・深海龍 ネレグラディス',
      isMultiTarget: false,
      // 肉質：雷(50=1.5)大弱点 / 龍(40=1.25)弱点 / 火(25=0.75) / 水(10=0.25) / 氷(10=0.25)
      effectiveness: { fire: 0.75, water: 0.25, thunder: 1.5, ice: 0.25, dragon: 1.25 }
    });
  }

  // ネレグラディス専用ギミック状態
  const nereState = {
    beams: [],        // 大潮流ブレス
    whirlpools: [],   // 深淵の渦潮・拘束陣
    geysers: [],      // 蒼煌の激流滑走の跡から噴き上がる時間差水柱
    blindTimer: 0,    // 蒼白の閃光（目くらまし残像タイマー）
    flashBurst: 0,    // 閃光瞬間の白フラッシュ
    marineSnow: []    // 深海背景の浮遊粒子
  };

  function initMarineSnow(canvas) {
    nereState.marineSnow = [];
    for (let i = 0; i < 48; i++) {
      nereState.marineSnow.push({
        x: Math.random() * canvas.width,
        y: Math.random() * 390,
        r: 1 + Math.random() * 2.2,
        vy: 0.22 + Math.random() * 0.45,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  function clearNereObjects() {
    nereState.beams = [];
    nereState.whirlpools = [];
    nereState.geysers = [];
    nereState.blindTimer = 0;
    nereState.flashBurst = 0;
  }

  function hasActiveNeregladis(ctxObj) {
    return ctxObj.activeMonsters && ctxObj.activeMonsters.some(m => m.species === 'neregladis');
  }

  // ------------------------------------------------------------
  // 1. リセット時の初期化
  // ------------------------------------------------------------
  EXTRA.hooks.onResetGame = function (ctxObj) {
    if (typeof prevHooks.onResetGame === 'function') prevHooks.onResetGame(ctxObj);
    clearNereObjects();
    initMarineSnow(ctxObj.canvas);

    ctxObj.activeMonsters.forEach(m => {
      if (m.species === 'neregladis') {
        m.w = 152;
        m.h = 114;
        m.x = 635;
        m.glowPulse = 0;
        m.geyserCooldown = 0;
      }
    });
  };

  // ------------------------------------------------------------
  // 2. 行動選択（4種の攻撃パターン）
  // ------------------------------------------------------------
  EXTRA.hooks.onChooseAction = function (m, ctxObj) {
    if (m.species !== 'neregladis') {
      return typeof prevHooks.onChooseAction === 'function' ? prevHooks.onChooseAction(m, ctxObj) : false;
    }

    const r = Math.random();
    if (r < 0.28) {
      // ① 大潮流ブレス（巨大水流ビーム）
      m.state = 'nereTorrentBeam';
      m.stateTimer = 76;
    } else if (r < 0.52) {
      // ② 蒼白の閃光（発光器官による目くらまし）
      m.state = 'nereBlindingFlash';
      m.stateTimer = 58;
    } else if (r < 0.76) {
      // ③ 深淵の渦潮・拘束陣（長大な胴体旋回による引き寄せ＋尾撃）
      m.state = 'nereAbyssWhirlpool';
      m.stateTimer = 86;
    } else {
      // ④ 蒼煌の激流滑走（地形を削る高速滑走＋時間差水柱）
      m.state = 'nereTorrentDash';
      m.stateTimer = 64;
      m.geyserCooldown = 0;
    }
    return true;
  };

  // ------------------------------------------------------------
  // 3. ネレグラディスAI更新
  // ------------------------------------------------------------
  EXTRA.hooks.onUpdateMonster = function (m, ctxObj) {
    if (m.species !== 'neregladis') {
      return typeof prevHooks.onUpdateMonster === 'function' ? prevHooks.onUpdateMonster(m, ctxObj) : false;
    }

    const { player, GROUND_Y, canvas, addText, addParticles, damagePlayer, rectIntersect, getMonsterBody } = ctxObj;
    m.isFlying = false;
    m.y += (GROUND_Y - m.y) * 0.12;
    m.glowPulse = (m.glowPulse || 0) + 0.08;

    // 常に青白＆紫の発光粒子を漂わせる
    if (Math.random() < 0.38) {
      addParticles(m.x + Math.random() * m.w, m.y - Math.random() * m.h, Math.random() < 0.7 ? '#80deea' : '#ea80fc', 1, 1.8);
    }

    m.stateTimer--;

    if (m.state === 'idle') {
      m.facing = player.x < m.x + m.w / 2 ? -1 : 1;
      m.vx *= 0.8;
      if (m.stateTimer <= 0) {
        EXTRA.hooks.onChooseAction(m, ctxObj);
      }
    } else if (m.state === 'stagger') {
      m.vx *= 0.82;
      m.attackHitbox = null;
      if (m.stateTimer <= 0) {
        m.state = 'idle';
        m.stateTimer = 28;
      }
    } else if (m.state === 'nereTorrentBeam') {
      // ① 大潮流ブレス
      m.vx = 0;
      if (m.stateTimer > 42) {
        m.facing = player.x < m.x + m.w / 2 ? -1 : 1;
        if (m.stateTimer % 3 === 0) {
          const mouthX = m.facing === 1 ? m.x + m.w + 14 : m.x - 14;
          addParticles(mouthX, m.y - 78, '#4fc3f7', 5, 4);
        }
      } else if (m.stateTimer === 42) {
        const mouthX = m.facing === 1 ? m.x + m.w + 12 : m.x - 12;
        const mouthY = m.y - 76;
        nereState.beams.push({
          x: mouthX,
          y: mouthY,
          dir: m.facing,
          timer: 34,
          maxTimer: 34,
          hitCooldown: 0
        });
        ctxObj.screenShake = Math.max(ctxObj.screenShake, 11);
        addText('大潮流ブレス！！', m.x + 10, m.y - 132, '#4fc3f7', 22);
      }

      if (m.stateTimer <= 0) {
        m.state = 'idle';
        m.stateTimer = 40;
      }
    } else if (m.state === 'nereBlindingFlash') {
      // ② 蒼白の閃光（目くらまし）
      m.vx = 0;
      if (m.stateTimer > 22) {
        if (m.stateTimer % 2 === 0) {
          addParticles(m.x + m.w / 2, m.y - 68, '#e0f7fa', 6, 5);
        }
        if (m.stateTimer === 45) {
          addText('発光器官が激しく明滅している…！', m.x - 35, m.y - 132, '#80deea', 17);
        }
      } else if (m.stateTimer === 22) {
        nereState.flashBurst = 24;
        ctxObj.screenShake = Math.max(ctxObj.screenShake, 9);
        addParticles(m.x + m.w / 2, m.y - 60, '#ffffff', 38, 10);

        const dist = Math.abs((player.x + player.w / 2) - (m.x + m.w / 2));
        if (dist < 460) {
          const isForesight = player.state === 'foresight' && player.stateTimer >= 12;
          const isDodgeInvuln = player.invulnTimer > 0;
          damagePlayer(16, false, false, false, true);
          if (!isForesight && !isDodgeInvuln) {
            nereState.blindTimer = 210; // 3.5秒間の目くらまし残像
            addText('蒼白の閃光！視界が奪われた！', player.x - 45, player.y - 98, '#e0f7fa', 18);
          }
        }
      }

      if (m.stateTimer <= 0) {
        m.state = 'idle';
        m.stateTimer = 36;
      }
    } else if (m.state === 'nereAbyssWhirlpool') {
      // ③ 深淵の渦潮・拘束陣（胴体旋回による引き寄せ＋フィニッシュ尾撃）
      m.vx = 0;
      if (m.stateTimer === 70) {
        const targetX = Math.max(150, Math.min(canvas.width - 150, player.x + player.w / 2));
        nereState.whirlpools.push({
          x: targetX,
          y: GROUND_Y,
          radius: 155,
          timer: 66,
          maxTimer: 66,
          erupted: false
        });
        addText('深淵の渦潮！引き寄せられる！', targetX - 110, GROUND_Y - 125, '#29b6f6', 18);
      }

      if (m.stateTimer <= 0) {
        m.state = 'idle';
        m.stateTimer = 40;
      }
    } else if (m.state === 'nereTorrentDash') {
      // ④ 蒼煌の激流滑走（地形を削る高速突進＋時間差水柱）
      if (m.stateTimer > 42) {
        m.facing = player.x < m.x + m.w / 2 ? -1 : 1;
        m.vx = -m.facing * 2.4;
        if (m.stateTimer % 3 === 0) {
          addParticles(m.x + m.w / 2, GROUND_Y - 14, '#4fc3f7', 4, 4);
        }
      } else if (m.stateTimer > 12) {
        m.vx = m.facing * 15.0;
        m.attackHitbox = getMonsterBody(m);
        m.isPoisonAttack = false;
        m.isElectricAttack = false;
        m.isBubbleAttack = true;

        ctxObj.screenShake = Math.max(ctxObj.screenShake, 4);
        addParticles(m.x + m.w / 2, GROUND_Y - 10, '#80deea', 4, 5);

        m.geyserCooldown = (m.geyserCooldown || 0) - 1;
        if (m.geyserCooldown <= 0) {
          m.geyserCooldown = 7;
          nereState.geysers.push({
            x: m.x + m.w / 2,
            y: GROUND_Y,
            w: 46,
            h: 145,
            delay: 24,
            activeTimer: 18,
            hasHit: false
          });
        }
      } else {
        m.vx *= 0.72;
        m.attackHitbox = null;
        m.isBubbleAttack = false;
      }

      if (m.stateTimer <= 0) {
        m.state = 'idle';
        m.stateTimer = 42;
        m.attackHitbox = null;
        m.isBubbleAttack = false;
      }
    }

    m.x += m.vx;
    m.x = Math.max(25, Math.min(canvas.width - m.w - 25, m.x));

    if (m.attackHitbox && !m.hasHitThisAttack) {
      const pBox = { x: player.x, y: player.y - player.h, w: player.w, h: player.h };
      if (rectIntersect(m.attackHitbox, pBox)) {
        damagePlayer(32, false, false, false, true);
        m.hasHitThisAttack = true;
      }
    }

    return true;
  };

  // ------------------------------------------------------------
  // 4. ギミック・攻撃判定の更新
  // ------------------------------------------------------------
  EXTRA.hooks.onUpdateProjectiles = function (ctxObj) {
    if (typeof prevHooks.onUpdateProjectiles === 'function') prevHooks.onUpdateProjectiles(ctxObj);

    const { player, GROUND_Y, canvas, addParticles, damagePlayer, rectIntersect } = ctxObj;
    const pBox = { x: player.x, y: player.y - player.h, w: player.w, h: player.h };

    // 深海浮遊粒子
    nereState.marineSnow.forEach(s => {
      s.y -= s.vy;
      s.x += Math.sin(Date.now() * 0.002 + s.phase) * 0.25;
      if (s.y < 0) {
        s.y = GROUND_Y - 4;
        s.x = Math.random() * canvas.width;
      }
    });

    if (nereState.blindTimer > 0) nereState.blindTimer--;
    if (nereState.flashBurst > 0) nereState.flashBurst--;

    // ① 大潮流ブレス判定
    for (let i = nereState.beams.length - 1; i >= 0; i--) {
      const b = nereState.beams[i];
      b.timer--;
      if (b.hitCooldown > 0) b.hitCooldown--;

      const beamX = b.dir === 1 ? b.x : 0;
      const beamW = b.dir === 1 ? (canvas.width - b.x) : b.x;
      const beamBox = { x: beamX, y: b.y - 34, w: Math.max(0, beamW), h: 68 };

      if (b.timer % 2 === 0) {
        addParticles(b.x + b.dir * Math.random() * Math.max(40, beamW), b.y + (Math.random() - 0.5) * 44, '#80deea', 2, 4);
      }

      if (b.hitCooldown <= 0 && rectIntersect(beamBox, pBox)) {
        b.hitCooldown = 18;
        damagePlayer(30, false, false, false, true);
      }

      if (b.timer <= 0) {
        nereState.beams.splice(i, 1);
      }
    }

    // ③ 深淵の渦潮・拘束陣判定（引き寄せ＋ラスト尾撃）
    for (let i = nereState.whirlpools.length - 1; i >= 0; i--) {
      const wp = nereState.whirlpools[i];
      wp.timer--;

      const pCenterX = player.x + player.w / 2;
      const dx = wp.x - pCenterX;
      const dist = Math.abs(dx);

      if (wp.timer > 12) {
        // 渦潮範囲内なら中心へ強く引き寄せる
        if (dist < wp.radius) {
          const pullStrength = 3.6 * (1 - dist / (wp.radius * 1.3));
          player.x += Math.sign(dx) * pullStrength;
          player.x = Math.max(20, Math.min(canvas.width - 50, player.x));
        }
        if (wp.timer % 4 === 0) {
          addParticles(wp.x + (Math.random() - 0.5) * wp.radius * 1.4, GROUND_Y - 12, '#4fc3f7', 2, 3);
        }
      } else if (!wp.erupted) {
        // 収束時に尾ビレ＆高圧水流が炸裂
        wp.erupted = true;
        ctxObj.screenShake = Math.max(ctxObj.screenShake, 11);
        addParticles(wp.x, GROUND_Y - 35, '#80deea', 28, 8);
        const burstBox = { x: wp.x - 62, y: GROUND_Y - 130, w: 124, h: 130 };
        if (rectIntersect(burstBox, pBox)) {
          damagePlayer(34, false, false, false, true);
        }
      }

      if (wp.timer <= 0) {
        nereState.whirlpools.splice(i, 1);
      }
    }

    // ④ 蒼煌の激流滑走・時間差水柱
    for (let i = nereState.geysers.length - 1; i >= 0; i--) {
      const g = nereState.geysers[i];
      if (g.delay > 0) {
        g.delay--;
        if (g.delay % 5 === 0) {
          addParticles(g.x + (Math.random() - 0.5) * g.w, GROUND_Y - 4, '#4fc3f7', 1, 2);
        }
      } else {
        g.activeTimer--;
        if (g.activeTimer === 17) {
          addParticles(g.x, GROUND_Y - 40, '#e0f7fa', 12, 6);
        }
        const gBox = { x: g.x - g.w / 2, y: GROUND_Y - g.h, w: g.w, h: g.h };
        if (!g.hasHit && rectIntersect(gBox, pBox)) {
          g.hasHit = true;
          damagePlayer(26, false, false, false, true);
        }
        if (g.activeTimer <= 0) {
          nereState.geysers.splice(i, 1);
        }
      }
    }
  };

  // ------------------------------------------------------------
  // 5. 深海背景＆ネレグラディス本体描画（IMG_2553_2.JPG風デザイン）
  // ------------------------------------------------------------
  EXTRA.hooks.onDrawMonster = function (m, ctxObj) {
    if (m.species !== 'neregladis') {
      return typeof prevHooks.onDrawMonster === 'function' ? prevHooks.onDrawMonster(m, ctxObj) : false;
    }

    const { ctx, canvas, GROUND_Y } = ctxObj;

    // 暗めの深海風専用背景を背後へ描画（destination-overで地面とモンスターの奥に敷く）
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';

    // 深淵の海底洞窟グラデーション
    const abyssGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    abyssGrad.addColorStop(0, '#020813');
    abyssGrad.addColorStop(0.55, '#071b2e');
    abyssGrad.addColorStop(1, '#0b2942');
    ctx.fillStyle = abyssGrad;
    ctx.fillRect(0, 0, canvas.width, GROUND_Y);

    // 頭上からわずかに差し込む深海の光の筋
    const rayGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    rayGrad.addColorStop(0, 'rgba(79, 195, 247, 0.16)');
    rayGrad.addColorStop(1, 'rgba(79, 195, 247, 0.0)');
    ctx.fillStyle = rayGrad;
    ctx.beginPath();
    ctx.moveTo(560, 0);
    ctx.lineTo(740, 0);
    ctx.lineTo(620, GROUND_Y);
    ctx.lineTo(410, GROUND_Y);
    ctx.closePath();
    ctx.fill();

    // 暗い深海岩礁のシルエット
    ctx.fillStyle = '#04101d';
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(0, 210);
    ctx.lineTo(95, 145);
    ctx.lineTo(185, 255);
    ctx.lineTo(260, 220);
    ctx.lineTo(340, GROUND_Y);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(canvas.width, GROUND_Y);
    ctx.lineTo(canvas.width, 175);
    ctx.lineTo(790, 120);
    ctx.lineTo(695, 240);
    ctx.lineTo(610, 290);
    ctx.lineTo(540, GROUND_Y);
    ctx.closePath();
    ctx.fill();

    // マリンスノー（青白い深海浮遊光）
    nereState.marineSnow.forEach(s => {
      ctx.fillStyle = 'rgba(179, 229, 252, 0.32)';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });

    // 深海岩盤の地面
    ctx.fillStyle = '#0d1f2d';
    ctx.fillRect(0, GROUND_Y, canvas.width, canvas.height - GROUND_Y);
    ctx.fillStyle = '#1b4965';
    ctx.fillRect(0, GROUND_Y, canvas.width, 5);

    ctx.restore();

    // --- ネレグラディス本体描画（写真IMG_2553_2.JPGのシルエット・発光器官を再現） ---
    ctx.save();
    const cx = m.x + m.w / 2;
    const cy = m.y - m.h / 2;
    ctx.translate(cx, cy);
    ctx.scale(m.facing, 1); // 右向き基準で描画し、向きに応じて反転

    const pulse = 0.75 + Math.sin(m.glowPulse || 0) * 0.25;
    const isFlash = m.flashTimer > 0;

    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = m.state === 'nereBlindingFlash' ? 28 : 14;

    // 1. 長くうねる尾
    ctx.strokeStyle = isFlash ? '#ffffff' : '#263849';
    ctx.lineWidth = 15;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-36, 18);
    ctx.quadraticCurveTo(-78, 28, -104, 6 + Math.sin(Date.now() * 0.008) * 10);
    ctx.stroke();

    // 尾の発光ライン
    ctx.strokeStyle = `rgba(128, 222, 234, ${pulse})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-36, 17);
    ctx.quadraticCurveTo(-78, 26, -102, 6 + Math.sin(Date.now() * 0.008) * 10);
    ctx.stroke();

    // 2. 後方の翼ヒレ（上向きに伸びる鋭いヒレ）
    ctx.fillStyle = isFlash ? '#ffffff' : '#4a6b82';
    ctx.beginPath();
    ctx.moveTo(-28, 6);
    ctx.lineTo(-76, -42);
    ctx.lineTo(-14, 14);
    ctx.closePath();
    ctx.fill();

    // 3. 背中の結晶状背ビレ（画像の紫〜青白ルーン発光を再現）
    const finPositions = [
      { x: -16, y: -6, h: 34 },
      { x: -4, y: -12, h: 42 },
      { x: 9, y: -16, h: 38 },
      { x: 21, y: -14, h: 28 }
    ];
    finPositions.forEach((fp, idx) => {
      ctx.fillStyle = isFlash ? '#ffffff' : (idx % 2 === 0 ? '#5c6bc0' : '#4dd0e1');
      ctx.beginPath();
      ctx.moveTo(fp.x - 6, fp.y + 8);
      ctx.lineTo(fp.x - 2, fp.y - fp.h);
      ctx.lineTo(fp.x + 8, fp.y + 8);
      ctx.closePath();
      ctx.fill();

      // 背ビレ内部のピンク紫ルーン発光
      ctx.strokeStyle = `rgba(234, 128, 252, ${pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(fp.x, fp.y + 2);
      ctx.lineTo(fp.x, fp.y - fp.h * 0.65);
      ctx.stroke();
    });

    // 4. 胴体〜長い首（プレシオサウルス風のS字ライン）
    ctx.fillStyle = isFlash ? '#ffffff' : '#2c3e50';
    ctx.beginPath();
    ctx.moveTo(-42, 22);
    ctx.quadraticCurveTo(-10, 34, 24, 18);
    ctx.quadraticCurveTo(42, 4, 48, -28);
    ctx.lineTo(28, -32);
    ctx.quadraticCurveTo(20, -4, -6, 2);
    ctx.quadraticCurveTo(-28, 4, -42, 22);
    ctx.closePath();
    ctx.fill();

    // 体側の青白＆紫の生物発光ストライプ
    ctx.strokeStyle = `rgba(128, 222, 234, ${pulse})`;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(-34, 16);
    ctx.quadraticCurveTo(4, 18, 34, -22);
    ctx.stroke();

    ctx.strokeStyle = `rgba(224, 64, 251, ${pulse * 0.9})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-30, 11);
    ctx.quadraticCurveTo(6, 12, 31, -25);
    ctx.stroke();

    // 首〜腹部のギザギザしたヒレ突起
    ctx.fillStyle = '#1c2833';
    for (let s = 0; s < 6; s++) {
      const sx = -24 + s * 10;
      const sy = 25 - s * 4;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - 3, sy + 10);
      ctx.lineTo(sx + 5, sy + 2);
      ctx.closePath();
      ctx.fill();
    }

    // 5. 前方の巨大な翼ヒレ（手前側・青白く透けるヒレ）
    ctx.fillStyle = isFlash ? '#ffffff' : '#6ea8c9';
    ctx.beginPath();
    ctx.moveTo(6, 16);
    ctx.lineTo(-42, 54);
    ctx.lineTo(-18, 56);
    ctx.lineTo(20, 22);
    ctx.closePath();
    ctx.fill();

    // ヒレ先の紫アクセント
    ctx.fillStyle = '#ab47bc';
    ctx.beginPath();
    ctx.moveTo(-34, 48);
    ctx.lineTo(-42, 54);
    ctx.lineTo(-28, 55);
    ctx.closePath();
    ctx.fill();

    // 6. 頭部（鋭い顎・後ろに伸びる湾曲角・長いヒゲ）
    ctx.fillStyle = isFlash ? '#ffffff' : '#34495e';
    ctx.beginPath();
    ctx.roundRect(24, -46, 48, 22, 6);
    ctx.fill();

    // 後ろへ大きく反り伸びる特徴的な角（画像の赤紫〜蒼白の角）
    ctx.strokeStyle = isFlash ? '#ffffff' : '#80deea';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(36, -44);
    ctx.quadraticCurveTo(10, -58, -14, -36);
    ctx.stroke();

    ctx.fillStyle = '#ce93d8';
    ctx.beginPath();
    ctx.arc(-14, -36, 4, 0, Math.PI * 2);
    ctx.fill();

    // 顎下から流れる2本の長い触鬚（ヒゲ）
    ctx.strokeStyle = 'rgba(224, 247, 250, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(52, -26);
    ctx.quadraticCurveTo(18, -22, -16, -28 + Math.sin(Date.now() * 0.01) * 5);
    ctx.stroke();

    // 鋭い歯と口元のピンク紫発光（画像の口内発光を再現）
    ctx.fillStyle = '#e0f7fa';
    for (let t = 0; t < 5; t++) {
      ctx.fillRect(46 + t * 5, -33, 2, 4);
    }
    ctx.fillStyle = `rgba(234, 128, 252, ${pulse})`;
    ctx.beginPath();
    ctx.ellipse(54, -34, 10, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // 青白く輝く瞳
    ctx.fillStyle = '#00e5ff';
    ctx.fillRect(54, -42, 7, 4);

    // 攻撃予兆（口元の高圧水流チャージ）
    if (m.state === 'nereTorrentBeam' && m.stateTimer > 42) {
      ctx.fillStyle = '#4fc3f7';
      ctx.beginPath();
      ctx.arc(74, -34, 12, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
    return true;
  };

  // ------------------------------------------------------------
  // 6. 大潮流ブレス・渦潮・時間差水柱・目くらまし残像の描画
  // ------------------------------------------------------------
  EXTRA.hooks.onDrawProjectiles = function (ctxObj) {
    if (typeof prevHooks.onDrawProjectiles === 'function') prevHooks.onDrawProjectiles(ctxObj);

    const { ctx, canvas, GROUND_Y } = ctxObj;

    // ① 大潮流ブレス描画
    nereState.beams.forEach(b => {
      ctx.save();
      const alpha = Math.min(1, b.timer / 10);
      const startX = b.dir === 1 ? b.x : 0;
      const width = b.dir === 1 ? (canvas.width - b.x) : b.x;

      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 18;
      ctx.fillStyle = `rgba(2, 136, 209, ${0.72 * alpha})`;
      ctx.fillRect(startX, b.y - 30, width, 60);

      ctx.fillStyle = `rgba(128, 222, 234, ${0.85 * alpha})`;
      ctx.fillRect(startX, b.y - 16, width, 32);

      ctx.fillStyle = `rgba(255, 255, 255, ${0.95 * alpha})`;
      ctx.fillRect(startX, b.y - 6, width, 12);
      ctx.restore();
    });

    // ③ 深淵の渦潮・拘束陣描画
    nereState.whirlpools.forEach(wp => {
      ctx.save();
      const ratio = 1 - wp.timer / wp.maxTimer;
      const spin = Date.now() * 0.015;

      // 渦潮の引き寄せフィールド
      const grad = ctx.createRadialGradient(wp.x, GROUND_Y - 12, 10, wp.x, GROUND_Y - 12, wp.radius);
      grad.addColorStop(0, 'rgba(0, 229, 255, 0.55)');
      grad.addColorStop(0.6, 'rgba(2, 136, 209, 0.28)');
      grad.addColorStop(1, 'rgba(2, 136, 209, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(wp.x, GROUND_Y - 8, wp.radius, 26, 0, 0, Math.PI * 2);
      ctx.fill();

      // 旋回する水流リング
      ctx.strokeStyle = '#80deea';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(wp.x, GROUND_Y - 10, wp.radius * (1 - ratio * 0.55), 18, 0, spin, spin + Math.PI * 1.4);
      ctx.stroke();

      // 水の竜巻柱
      ctx.fillStyle = `rgba(79, 195, 247, ${0.22 + ratio * 0.25})`;
      ctx.beginPath();
      ctx.moveTo(wp.x - 24, GROUND_Y);
      ctx.lineTo(wp.x - 56 - Math.sin(spin) * 10, GROUND_Y - 115);
      ctx.lineTo(wp.x + 56 + Math.sin(spin) * 10, GROUND_Y - 115);
      ctx.lineTo(wp.x + 24, GROUND_Y);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });

    // ④ 蒼煌の激流滑走・時間差水柱描画
    nereState.geysers.forEach(g => {
      ctx.save();
      if (g.delay > 0) {
        // 地面から青白い水脈が光る予兆
        ctx.fillStyle = 'rgba(0, 229, 255, 0.65)';
        ctx.fillRect(g.x - g.w / 2, GROUND_Y - 6, g.w, 6);
      } else {
        const alpha = g.activeTimer / 18;
        ctx.shadowColor = '#00e5ff';
        ctx.shadowBlur = 14;
        ctx.fillStyle = `rgba(41, 182, 246, ${0.75 * alpha})`;
        ctx.fillRect(g.x - g.w / 2, GROUND_Y - g.h, g.w, g.h);
        ctx.fillStyle = `rgba(224, 247, 250, ${0.9 * alpha})`;
        ctx.fillRect(g.x - g.w * 0.25, GROUND_Y - g.h, g.w * 0.5, g.h);
      }
      ctx.restore();
    });

    // ② 蒼白の閃光（目くらまし残像オーバーレイ）
    if (nereState.flashBurst > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(224, 247, 250, ${(nereState.flashBurst / 24) * 0.85})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    } else if (nereState.blindTimer > 0 && hasActiveNeregladis(ctxObj)) {
      ctx.save();
      const blindAlpha = Math.min(0.68, (nereState.blindTimer / 210) * 0.72);
      const blindGrad = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 60,
        canvas.width / 2, canvas.height / 2, 460
      );
      blindGrad.addColorStop(0, `rgba(224, 247, 250, ${blindAlpha * 0.75})`);
      blindGrad.addColorStop(1, `rgba(178, 235, 242, ${blindAlpha})`);
      ctx.fillStyle = blindGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
  };
})();
// ============================================================
// 追加コンテンツ：轟牙獣 グラドヴォル（☆4古龍・火属性・HP 21000）
// ============================================================
(function () {
  window.EXTRA_CONTENT = window.EXTRA_CONTENT || {
    weapons: { longsword: [], greatsword: [], dualblades: [] },
    armors: { head: [], chest: [], arms: [], waist: [], legs: [] },
    skillNames: {},
    quests: [],
    hooks: {}
  };

  const EXTRA = window.EXTRA_CONTENT;
  EXTRA.quests = EXTRA.quests || [];
  EXTRA.hooks = EXTRA.hooks || {};

  // 既存フック（アルヴァディオス・ネレグラディス等）を保持して連結
  const prevHooks = {
    onResetGame: EXTRA.hooks.onResetGame,
    onUpdateMonster: EXTRA.hooks.onUpdateMonster,
    onChooseAction: EXTRA.hooks.onChooseAction,
    onUpdateProjectiles: EXTRA.hooks.onUpdateProjectiles,
    onDrawMonster: EXTRA.hooks.onDrawMonster,
    onDrawProjectiles: EXTRA.hooks.onDrawProjectiles
  };

  // クエストボード＆F2肉質表へ登録（☆4 / HP 21000）
  if (!EXTRA.quests.some(q => q.key === 'gradvol')) {
    EXTRA.quests.push({
      key: 'gradvol',
      title: '原初の大災害',
      displayName: '轟牙獣 グラドヴォル',
      stars: '☆4',
      starLevel: 4,
      hpText: 'HP 21000',
      maxHp: 21000,
      themeColor: '#d84315',
      borderColor: '#ffab40',
      barColor: '#ff6d00',
      tag: '古龍種・轟牙獣 グラドヴォル',
      isMultiTarget: false,
      // 肉質：水(50=1.5)大弱点 / 氷(40=1.25)弱点 / 雷(25=0.75) / 龍(30=0.9) / 火(5=0.1)
      effectiveness: { fire: 0.1, water: 1.5, thunder: 0.75, ice: 1.25, dragon: 0.9 }
    });
  }

  // グラドヴォル専用ギミック状態
  const gradState = {
    meteors: [],      // 火山弾・流星の雨（上空から降る燃える岩塊）
    magmaPillars: [], // 地殻穿ち突進の跡から噴き上がる溶岩柱
    lavaPools: [],    // 怒り叩きつけで残る溶岩だまり
    novaWaves: [],    // 炎環解放・大噴火ノヴァ
    embers: []        // 火山背景の火の粉パーティクル
  };

  function initVolcanoEmbers(canvas) {
    gradState.embers = [];
    for (let i = 0; i < 45; i++) {
      gradState.embers.push({
        x: Math.random() * canvas.width,
        y: Math.random() * 390,
        r: 1.2 + Math.random() * 2.2,
        vy: 0.4 + Math.random() * 0.8,
        vx: (Math.random() - 0.5) * 0.6,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  function clearGradObjects() {
    gradState.meteors = [];
    gradState.magmaPillars = [];
    gradState.lavaPools = [];
    gradState.novaWaves = [];
  }

  // ------------------------------------------------------------
  // 1. リセット時の初期化
  // ------------------------------------------------------------
  EXTRA.hooks.onResetGame = function (ctxObj) {
    if (typeof prevHooks.onResetGame === 'function') prevHooks.onResetGame(ctxObj);
    clearGradObjects();
    initVolcanoEmbers(ctxObj.canvas);

    ctxObj.activeMonsters.forEach(m => {
      if (m.species === 'gradvol') {
        m.w = 158;
        m.h = 112;
        m.x = 630;
        m.isEnraged = false;
        m.pillarCooldown = 0;
        m.haloAngle = 0;
      }
    });
  };

  // ------------------------------------------------------------
  // 2. 行動選択（原案1種＋アレンジ2種＋怒り専用大技）
  // ------------------------------------------------------------
  EXTRA.hooks.onChooseAction = function (m, ctxObj) {
    if (m.species !== 'gradvol') {
      return typeof prevHooks.onChooseAction === 'function' ? prevHooks.onChooseAction(m, ctxObj) : false;
    }

    const r = Math.random();
    if (m.isEnraged && r < 0.22) {
      // 【怒り限定】炎環解放・大噴火ノヴァ
      m.state = 'gradHaloNova';
      m.stateTimer = 76;
    } else if (r < 0.48) {
      // ① 剛腕の焦土叩きつけ（原案：前足叩きつけ＋怒り時溶岩残留）
      m.state = 'gradPawSlam';
      m.stateTimer = 58;
    } else if (r < 0.75) {
      // ② 【アレンジ①】紅蓮牙・地殻穿ち突進（牙で地面を削る突進＋時間差溶岩柱）
      m.state = 'gradFangPlowDash';
      m.stateTimer = 66;
      m.pillarCooldown = 0;
    } else {
      // ③ 【アレンジ②】火山弾・流星の雨（掘り起こした岩石を打ち上げ空から降らせる）
      m.state = 'gradVolcanicMeteor';
      m.stateTimer = 74;
    }
    return true;
  };

  // ------------------------------------------------------------
  // 3. グラドヴォルAI更新
  // ------------------------------------------------------------
  EXTRA.hooks.onUpdateMonster = function (m, ctxObj) {
    if (m.species !== 'gradvol') {
      return typeof prevHooks.onUpdateMonster === 'function' ? prevHooks.onUpdateMonster(m, ctxObj) : false;
    }

    const { player, GROUND_Y, canvas, addText, addParticles, damagePlayer, rectIntersect, getMonsterBody } = ctxObj;
    m.isFlying = false;
    m.y += (GROUND_Y - m.y) * 0.14;
    m.haloAngle = (m.haloAngle || 0) + (m.isEnraged ? 0.06 : 0.025);

    // HP60%以下で怒り状態（牙の赤熱化）へ移行
    if (!m.isEnraged && m.hp <= m.maxHp * 0.6) {
      m.isEnraged = true;
      m.state = 'gradEnrageRoar';
      m.stateTimer = 54;
      m.attackHitbox = null;
      ctxObj.screenShake = Math.max(ctxObj.screenShake, 14);
      addParticles(m.x + m.w / 2, m.y - 60, '#ff6d00', 36, 9);
      addText('轟牙獣が怒り状態に移行！巨大な牙が赤熱化した！！', m.x - 110, m.y - 138, '#ffab40', 20);
    }

    // 怒り時は牙と炎環から常に灼熱の火花が散る
    if (m.isEnraged && Math.random() < 0.45) {
      const fangX = m.facing === 1 ? m.x + m.w - 10 : m.x + 10;
      addParticles(fangX, m.y - 42, '#ffab40', 1, 2.5);
    }

    m.stateTimer--;

    if (m.state === 'idle') {
      m.facing = player.x < m.x + m.w / 2 ? -1 : 1;
      m.vx *= 0.8;
      if (m.stateTimer <= 0) {
        EXTRA.hooks.onChooseAction(m, ctxObj);
      }
    } else if (m.state === 'stagger') {
      m.vx *= 0.82;
      m.attackHitbox = null;
      if (m.stateTimer <= 0) {
        m.state = 'idle';
        m.stateTimer = 26;
      }
    } else if (m.state === 'gradEnrageRoar') {
      m.vx = 0;
      if (m.stateTimer % 4 === 0) {
        addParticles(m.x + m.w / 2, m.y - 65, '#ff3d00', 6, 6);
      }
      if (m.stateTimer <= 0) {
        m.state = 'idle';
        m.stateTimer = 20;
      }
    } else if (m.state === 'gradPawSlam') {
      // ① 剛腕の焦土叩きつけ
      if (m.stateTimer > 26) {
        m.facing = player.x < m.x + m.w / 2 ? -1 : 1;
        // 距離が離れていれば少し踏み込む
        const dist = (player.x + player.w / 2) - (m.x + m.w / 2);
        if (Math.abs(dist) > 130) {
          m.vx = Math.sign(dist) * 5.2;
        } else {
          m.vx *= 0.7;
        }
      } else if (m.stateTimer === 26) {
        m.vx = m.facing * 4;
        const slamX = m.facing === 1 ? m.x + m.w - 20 : m.x - 75;
        m.attackHitbox = { x: slamX, y: GROUND_Y - 82, w: 95, h: 82 };
        m.hasHitThisAttack = false;
        ctxObj.screenShake = Math.max(ctxObj.screenShake, 12);
        addParticles(slamX + 45, GROUND_Y - 12, '#ff6d00', 24, 7);

        // 怒り状態（牙赤熱化）なら地面に溶岩だまりを生成
        if (m.isEnraged) {
          gradState.lavaPools.push({
            x: slamX + 45,
            y: GROUND_Y,
            w: 110,
            timer: 180,
            tickCooldown: 0
          });
        }
      } else if (m.stateTimer < 16) {
        m.vx *= 0.7;
        m.attackHitbox = null;
      }

      if (m.stateTimer <= 0) {
        m.state = 'idle';
        m.stateTimer = m.isEnraged ? 28 : 38;
        m.attackHitbox = null;
      }
    } else if (m.state === 'gradFangPlowDash') {
      // ② 【アレンジ①】紅蓮牙・地殻穿ち突進（牙で地面を削りながら突進＋時間差溶岩柱）
      if (m.stateTimer > 44) {
        m.facing = player.x < m.x + m.w / 2 ? -1 : 1;
        m.vx = -m.facing * 2.2;
        if (m.stateTimer % 3 === 0) {
          const fangX = m.facing === 1 ? m.x + m.w : m.x;
          addParticles(fangX, GROUND_Y - 10, '#ffab40', 4, 4);
        }
      } else if (m.stateTimer > 12) {
        const speed = m.isEnraged ? 15.8 : 13.8;
        m.vx = m.facing * speed;
        m.attackHitbox = getMonsterBody(m);
        ctxObj.screenShake = Math.max(ctxObj.screenShake, 5);

        const fangX = m.facing === 1 ? m.x + m.w - 10 : m.x + 10;
        addParticles(fangX, GROUND_Y - 8, '#ff3d00', 4, 5);

        m.pillarCooldown = (m.pillarCooldown || 0) - 1;
        if (m.pillarCooldown <= 0) {
          m.pillarCooldown = m.isEnraged ? 6 : 8;
          gradState.magmaPillars.push({
            x: fangX,
            y: GROUND_Y,
            w: 44,
            h: m.isEnraged ? 145 : 120,
            delay: 24,
            activeTimer: 18,
            hasHit: false
          });
        }
      } else {
        m.vx *= 0.72;
        m.attackHitbox = null;
      }

      if (m.stateTimer <= 0) {
        m.state = 'idle';
        m.stateTimer = m.isEnraged ? 30 : 40;
        m.attackHitbox = null;
      }
    } else if (m.state === 'gradVolcanicMeteor') {
      // ③ 【アレンジ②】火山弾・流星の雨（掘り起こした岩石を打ち上げ空から降らせる）
      m.vx = 0;
      if (m.stateTimer === 52) {
        ctxObj.screenShake = Math.max(ctxObj.screenShake, 9);
        const fangX = m.facing === 1 ? m.x + m.w : m.x;
        addParticles(fangX, GROUND_Y - 15, '#ff9100', 26, 9);
        addText('火山弾・流星の雨！！', m.x - 10, m.y - 130, '#ffab40', 20);

        const count = m.isEnraged ? 6 : 4;
        for (let k = 0; k < count; k++) {
          const targetX = k === 0
            ? Math.max(60, Math.min(canvas.width - 60, player.x + player.w / 2))
            : 80 + Math.random() * (canvas.width - 160);
          gradState.meteors.push({
            targetX: targetX,
            x: targetX + (Math.random() - 0.5) * 90,
            y: -40 - k * 55,
            vy: m.isEnraged ? 12.5 : 10.5,
            radius: m.isEnraged ? 26 : 22,
            exploded: false
          });
        }
      }

      if (m.stateTimer <= 0) {
        m.state = 'idle';
        m.stateTimer = m.isEnraged ? 32 : 42;
      }
    } else if (m.state === 'gradHaloNova') {
      // ④ 【怒り限定】炎環解放・大噴火ノヴァ
      m.vx = 0;
      if (m.stateTimer > 28) {
        if (m.stateTimer % 2 === 0) {
          addParticles(m.x + m.w / 2, m.y - 70, '#ffab40', 6, 5);
        }
        if (m.stateTimer === 64) {
          addText('背中の炎環が臨界まで燃え上がる…！！', m.x - 65, m.y - 136, '#ff3d00', 18);
        }
      } else if (m.stateTimer === 28) {
        ctxObj.screenShake = Math.max(ctxObj.screenShake, 15);
        const cx = m.x + m.w / 2;
        addParticles(cx, GROUND_Y - 40, '#ff6d00', 45, 11);
        gradState.novaWaves.push({
          x: cx,
          y: GROUND_Y,
          radius: 40,
          maxRadius: 270,
          timer: 20,
          hasHit: false
        });
      }

      if (m.stateTimer <= 0) {
        m.state = 'idle';
        m.stateTimer = 42;
      }
    }

    m.x += m.vx;
    m.x = Math.max(25, Math.min(canvas.width - m.w - 25, m.x));

    if (m.attackHitbox && !m.hasHitThisAttack) {
      const pBox = { x: player.x, y: player.y - player.h, w: player.w, h: player.h };
      if (rectIntersect(m.attackHitbox, pBox)) {
        const dmg = m.isEnraged ? 36 : 28;
        damagePlayer(dmg, false, false, false, false);
        m.hasHitThisAttack = true;
      }
    }

    return true;
  };

  // ------------------------------------------------------------
  // 4. ギミック・火山弾・溶岩柱判定の更新
  // ------------------------------------------------------------
  EXTRA.hooks.onUpdateProjectiles = function (ctxObj) {
    if (typeof prevHooks.onUpdateProjectiles === 'function') prevHooks.onUpdateProjectiles(ctxObj);

    const { player, GROUND_Y, canvas, addParticles, damagePlayer, rectIntersect } = ctxObj;
    const pBox = { x: player.x, y: player.y - player.h, w: player.w, h: player.h };

    // 火山背景の火の粉更新
    gradState.embers.forEach(e => {
      e.y -= e.vy;
      e.x += e.vx + Math.sin(Date.now() * 0.003 + e.phase) * 0.3;
      if (e.y < 0) {
        e.y = GROUND_Y - 4;
        e.x = Math.random() * canvas.width;
      }
    });

    // 火山弾・流星の雨
    for (let i = gradState.meteors.length - 1; i >= 0; i--) {
      const mt = gradState.meteors[i];
      mt.y += mt.vy;
      mt.x += (mt.targetX - mt.x) * 0.08;
      if (Math.random() < 0.6) {
        addParticles(mt.x, mt.y, '#ff6d00', 1, 3);
      }

      if (mt.y >= GROUND_Y - mt.radius * 0.5) {
        ctxObj.screenShake = Math.max(ctxObj.screenShake, 7);
        addParticles(mt.targetX, GROUND_Y - 12, '#ff3d00', 18, 7);
        const blastBox = {
          x: mt.targetX - mt.radius * 1.6,
          y: GROUND_Y - 75,
          w: mt.radius * 3.2,
          h: 75
        };
        if (rectIntersect(blastBox, pBox)) {
          damagePlayer(28, false, false, false, false);
        }
        gradState.meteors.splice(i, 1);
      }
    }

    // 地殻穿ち突進・時間差溶岩柱
    for (let i = gradState.magmaPillars.length - 1; i >= 0; i--) {
      const mp = gradState.magmaPillars[i];
      if (mp.delay > 0) {
        mp.delay--;
        if (mp.delay % 5 === 0) {
          addParticles(mp.x + (Math.random() - 0.5) * mp.w, GROUND_Y - 4, '#ff6d00', 1, 2);
        }
      } else {
        mp.activeTimer--;
        if (mp.activeTimer === 17) {
          addParticles(mp.x, GROUND_Y - 45, '#ffab40', 12, 6);
        }
        const mpBox = { x: mp.x - mp.w / 2, y: GROUND_Y - mp.h, w: mp.w, h: mp.h };
        if (!mp.hasHit && rectIntersect(mpBox, pBox)) {
          mp.hasHit = true;
          damagePlayer(26, false, false, false, false);
        }
        if (mp.activeTimer <= 0) {
          gradState.magmaPillars.splice(i, 1);
        }
      }
    }

    // 怒り叩きつけ残留溶岩だまり
    for (let i = gradState.lavaPools.length - 1; i >= 0; i--) {
      const lp = gradState.lavaPools[i];
      lp.timer--;
      if (lp.tickCooldown > 0) lp.tickCooldown--;
      if (lp.timer % 6 === 0) {
        addParticles(lp.x + (Math.random() - 0.5) * lp.w, GROUND_Y - 5, '#ff6d00', 1, 2);
      }
      const lpBox = { x: lp.x - lp.w / 2, y: GROUND_Y - 22, w: lp.w, h: 22 };
      if (lp.tickCooldown <= 0 && rectIntersect(lpBox, pBox)) {
        lp.tickCooldown = 28;
        damagePlayer(10, false, false, false, false);
      }
      if (lp.timer <= 0) {
        gradState.lavaPools.splice(i, 1);
      }
    }

    // 炎環解放・大噴火ノヴァ
    for (let i = gradState.novaWaves.length - 1; i >= 0; i--) {
      const nv = gradState.novaWaves[i];
      nv.timer--;
      nv.radius += (nv.maxRadius - nv.radius) * 0.25;
      const nvBox = { x: nv.x - nv.radius, y: GROUND_Y - 125, w: nv.radius * 2, h: 125 };
      if (!nv.hasHit && rectIntersect(nvBox, pBox)) {
        nv.hasHit = true;
        damagePlayer(38, false, false, false, false);
      }
      if (nv.timer <= 0) {
        gradState.novaWaves.splice(i, 1);
      }
    }
  };

  // ------------------------------------------------------------
  // 5. 火山地帯背景＆グラドヴォル本体描画（IMG_2554_2.JPG風デザイン）
  // ------------------------------------------------------------
  EXTRA.hooks.onDrawMonster = function (m, ctxObj) {
    if (m.species !== 'gradvol') {
      return typeof prevHooks.onDrawMonster === 'function' ? prevHooks.onDrawMonster(m, ctxObj) : false;
    }

    const { ctx, canvas, GROUND_Y } = ctxObj;

    // --- 火山地帯専用背景（destination-overで地面・モンスター背後に敷く） ---
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';

    // 火山灰と灼熱の空グラデーション
    const volcSky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    volcSky.addColorStop(0, '#12090c');
    volcSky.addColorStop(0.52, '#2c110d');
    volcSky.addColorStop(1, '#5d1d0c');
    ctx.fillStyle = volcSky;
    ctx.fillRect(0, 0, canvas.width, GROUND_Y);

    // 遠景の活火山シルエット
    ctx.fillStyle = '#1b0b09';
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(140, 165);
    ctx.lineTo(220, 175);
    ctx.lineTo(390, GROUND_Y);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(520, GROUND_Y);
    ctx.lineTo(720, 125);
    ctx.lineTo(790, 132);
    ctx.lineTo(canvas.width, GROUND_Y);
    ctx.closePath();
    ctx.fill();

    // 火口からの溶岩流筋
    ctx.strokeStyle = 'rgba(255, 109, 0, 0.55)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(745, 130);
    ctx.quadraticCurveTo(715, 220, 680, GROUND_Y);
    ctx.stroke();

    // 舞い上がる火の粉パーティクル
    gradState.embers.forEach(e => {
      ctx.fillStyle = 'rgba(255, 171, 64, 0.6)';
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.fill();
    });

    // 溶岩亀裂の走る黒曜石地面
    ctx.fillStyle = '#1e1311';
    ctx.fillRect(0, GROUND_Y, canvas.width, canvas.height - GROUND_Y);
    ctx.fillStyle = '#bf360c';
    ctx.fillRect(0, GROUND_Y, canvas.width, 5);

    ctx.restore();

    // --- グラドヴォル本体描画（IMG_2554_2.JPGの四足サーベル巨獣＆炎環＆2本牙を再現） ---
    ctx.save();
    const cx = m.x + m.w / 2;
    const cy = m.y - m.h / 2;
    ctx.translate(cx, cy);
    ctx.scale(m.facing, 1);

    const isFlash = m.flashTimer > 0;
    const enraged = m.isEnraged;

    ctx.shadowColor = enraged ? '#ff3d00' : '#ff9100';
    ctx.shadowBlur = enraged ? 24 : 14;

    // 1. 背中の黄金炎環（IMG_2554_2.JPGの象徴的な光背リング＋放射光線）
    ctx.save();
    ctx.translate(-6, -18);
    ctx.strokeStyle = isFlash ? '#ffffff' : (enraged ? '#ff6d00' : '#ffd54f');
    ctx.lineWidth = enraged ? 4.5 : 3.2;
    ctx.beginPath();
    ctx.arc(0, 0, 52, Math.PI * 0.92, Math.PI * 1.92);
    ctx.stroke();

    // 炎環から放射状に伸びる光の針
    for (let r = 0; r < 5; r++) {
      const ang = Math.PI * (1.05 + r * 0.2);
      const x1 = Math.cos(ang) * 44;
      const y1 = Math.sin(ang) * 44;
      const x2 = Math.cos(ang) * 66;
      const y2 = Math.sin(ang) * 66;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.restore();

    // 2. 重厚な尻尾
    ctx.fillStyle = isFlash ? '#ffffff' : '#261a17';
    ctx.beginPath();
    ctx.moveTo(-58, 4);
    ctx.quadraticCurveTo(-92, 10, -106, 26);
    ctx.lineTo(-96, 32);
    ctx.quadraticCurveTo(-78, 22, -54, 18);
    ctx.closePath();
    ctx.fill();

    // 3. 後脚
    ctx.fillStyle = isFlash ? '#ffffff' : '#2d1e1a';
    ctx.beginPath();
    ctx.moveTo(-56, 12);
    ctx.lineTo(-74, 54);
    ctx.lineTo(-54, 54);
    ctx.lineTo(-36, 18);
    ctx.closePath();
    ctx.fill();

    // 4. 岩石外殻の巨大な胴体
    ctx.fillStyle = isFlash ? '#ffffff' : '#33221d';
    ctx.beginPath();
    ctx.ellipse(-6, 4, 58, 36, -0.06, 0, Math.PI * 2);
    ctx.fill();

    // 腹〜胸にかけて輝くマグマの亀裂（IMG_2554_2.JPGの胸部の灼熱発光）
    ctx.strokeStyle = enraged ? '#ff3d00' : '#ffab40';
    ctx.lineWidth = enraged ? 4 : 2.8;
    ctx.beginPath();
    ctx.moveTo(-26, 22);
    ctx.quadraticCurveTo(4, 30, 34, 12);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-12, 12);
    ctx.lineTo(24, 4);
    ctx.stroke();

    // 5. 背中の鋭い岩角スパイク（炎環に沿う5本の棘甲）
    const spikes = [
      { x: -42, y: -22, h: 24 },
      { x: -26, y: -30, h: 30 },
      { x: -8, y: -33, h: 32 },
      { x: 10, y: -30, h: 28 },
      { x: 26, y: -24, h: 22 }
    ];
    spikes.forEach(sp => {
      ctx.fillStyle = isFlash ? '#ffffff' : '#241613';
      ctx.beginPath();
      ctx.moveTo(sp.x - 8, sp.y + 8);
      ctx.lineTo(sp.x - 4, sp.y - sp.h);
      ctx.lineTo(sp.x + 10, sp.y + 8);
      ctx.closePath();
      ctx.fill();

      // スパイク縁の溶岩ライン
      ctx.strokeStyle = enraged ? '#ff3d00' : '#ff9100';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sp.x - 4, sp.y - sp.h);
      ctx.lineTo(sp.x + 8, sp.y + 6);
      ctx.stroke();
    });

    // 6. 強靭な前脚（岩石装甲＋爪）
    ctx.fillStyle = isFlash ? '#ffffff' : '#261815';
    ctx.beginPath();
    ctx.moveTo(16, 10);
    ctx.lineTo(26, 56);
    ctx.lineTo(48, 56);
    ctx.lineTo(42, 8);
    ctx.closePath();
    ctx.fill();

    // 前脚のマグマ亀裂
    ctx.strokeStyle = enraged ? '#ff3d00' : '#ff9100';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(28, 16);
    ctx.lineTo(35, 48);
    ctx.stroke();

    // 7. 猛獣の頭部＆2本の巨大なサーベル牙（怒り時は牙が赤熱化！）
    ctx.fillStyle = isFlash ? '#ffffff' : '#3a2620';
    ctx.beginPath();
    ctx.roundRect(30, -24, 46, 30, 8);
    ctx.fill();

    // 獣の耳と眉骨
    ctx.fillStyle = '#241613';
    ctx.beginPath();
    ctx.moveTo(36, -24);
    ctx.lineTo(32, -36);
    ctx.lineTo(45, -24);
    ctx.closePath();
    ctx.fill();

    // 口内の灼熱コア（IMG_2554_2.JPGの黄金に燃える口内）
    ctx.fillStyle = enraged ? '#ff3d00' : '#ffd54f';
    ctx.beginPath();
    ctx.ellipse(58, -4, 12, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2本の巨大な牙（通常は鉱石色の硬質牙、怒り状態では真紅〜白熱に赤熱化！）
    ctx.save();
    if (enraged) {
      ctx.shadowColor = '#ff1744';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#ff5252';
    } else {
      ctx.fillStyle = isFlash ? '#ffffff' : '#eceff1';
    }

    // 奥の巨大牙
    ctx.beginPath();
    ctx.moveTo(64, -6);
    ctx.quadraticCurveTo(68, 12, 58, 22);
    ctx.lineTo(54, -6);
    ctx.closePath();
    ctx.fill();

    // 手前の巨大牙
    ctx.beginPath();
    ctx.moveTo(54, -5);
    ctx.quadraticCurveTo(58, 15, 47, 25);
    ctx.lineTo(44, -5);
    ctx.closePath();
    ctx.fill();

    if (enraged) {
      // 赤熱化した牙の白熱エッジ
      ctx.strokeStyle = '#ffeb3b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(56, 0);
      ctx.lineTo(48, 23);
      ctx.stroke();
    }
    ctx.restore();

    // 鋭い眼光
    ctx.fillStyle = enraged ? '#ff1744' : '#ffab00';
    ctx.fillRect(54, -17, 8, 4);

    ctx.restore();
    return true;
  };

  // ------------------------------------------------------------
  // 6. 火山弾・溶岩柱・溶岩だまり・ノヴァの描画
  // ------------------------------------------------------------
  EXTRA.hooks.onDrawProjectiles = function (ctxObj) {
    if (typeof prevHooks.onDrawProjectiles === 'function') prevHooks.onDrawProjectiles(ctxObj);

    const { ctx, GROUND_Y } = ctxObj;

    // 怒り叩きつけ残留溶岩だまり
    gradState.lavaPools.forEach(lp => {
      ctx.save();
      const alpha = Math.min(1, lp.timer / 30);
      ctx.fillStyle = `rgba(255, 61, 0, ${0.75 * alpha})`;
      ctx.beginPath();
      ctx.ellipse(lp.x, GROUND_Y - 2, lp.w / 2, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(255, 213, 79, ${0.85 * alpha})`;
      ctx.beginPath();
      ctx.ellipse(lp.x, GROUND_Y - 2, lp.w / 3, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 火山弾・流星の雨（落下予兆＋燃える岩塊）
    gradState.meteors.forEach(mt => {
      ctx.save();
      // 地面の着弾予兆マーカー
      ctx.fillStyle = 'rgba(255, 61, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(mt.targetX, GROUND_Y - 2, mt.radius * 1.5, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      // 落下中の灼熱火山弾
      ctx.shadowColor = '#ff3d00';
      ctx.shadowBlur = 16;
      ctx.fillStyle = '#3e2723';
      ctx.beginPath();
      ctx.arc(mt.x, mt.y, mt.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ff9100';
      ctx.lineWidth = 3.5;
      ctx.stroke();
      ctx.restore();
    });

    // 地殻穿ち突進・時間差溶岩柱
    gradState.magmaPillars.forEach(mp => {
      ctx.save();
      if (mp.delay > 0) {
        ctx.fillStyle = 'rgba(255, 109, 0, 0.7)';
        ctx.fillRect(mp.x - mp.w / 2, GROUND_Y - 6, mp.w, 6);
      } else {
        const alpha = mp.activeTimer / 18;
        ctx.shadowColor = '#ff3d00';
        ctx.shadowBlur = 15;
        ctx.fillStyle = `rgba(255, 61, 0, ${0.8 * alpha})`;
        ctx.fillRect(mp.x - mp.w / 2, GROUND_Y - mp.h, mp.w, mp.h);
        ctx.fillStyle = `rgba(255, 213, 79, ${0.9 * alpha})`;
        ctx.fillRect(mp.x - mp.w * 0.25, GROUND_Y - mp.h, mp.w * 0.5, mp.h);
      }
      ctx.restore();
    });

    // 炎環解放・大噴火ノヴァ
    gradState.novaWaves.forEach(nv => {
      ctx.save();
      const alpha = nv.timer / 20;
      const grad = ctx.createRadialGradient(nv.x, GROUND_Y - 30, 10, nv.x, GROUND_Y - 30, nv.radius);
      grad.addColorStop(0, `rgba(255, 235, 59, ${0.8 * alpha})`);
      grad.addColorStop(0.55, `rgba(255, 87, 34, ${0.55 * alpha})`);
      grad.addColorStop(1, 'rgba(255, 61, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(nv.x, GROUND_Y - 20, nv.radius, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  };
})();
// ============================================================
// 追加コンテンツ：幻影虫 ミラセクト（☆4鋏角種・毒＆麻痺・HP 21000）
// ============================================================
(function () {
  window.EXTRA_CONTENT = window.EXTRA_CONTENT || {
    weapons: { longsword: [], greatsword: [], dualblades: [] },
    armors: { head: [], chest: [], arms: [], waist: [], legs: [] },
    skillNames: {},
    quests: [],
    hooks: {}
  };

  const EXTRA = window.EXTRA_CONTENT;
  EXTRA.quests = EXTRA.quests || [];
  EXTRA.hooks = EXTRA.hooks || {};

  // 既存フックを保持して連結
  const prevHooks = {
    onResetGame: EXTRA.hooks.onResetGame,
    onUpdateMonster: EXTRA.hooks.onUpdateMonster,
    onChooseAction: EXTRA.hooks.onChooseAction,
    onUpdateProjectiles: EXTRA.hooks.onUpdateProjectiles,
    onDrawMonster: EXTRA.hooks.onDrawMonster,
    onDrawProjectiles: EXTRA.hooks.onDrawProjectiles
  };

  // クエストボード＆F2肉質表へ登録（☆4 / HP 21000）
  if (!EXTRA.quests.some(q => q.key === 'mirasect')) {
    EXTRA.quests.push({
      key: 'mirasect',
      title: '原初の網魔',
      displayName: '幻影虫 ミラセクト',
      stars: '☆4',
      starLevel: 4,
      hpText: 'HP 21000',
      maxHp: 21000,
      themeColor: '#00695c',
      borderColor: '#64ffda',
      barColor: '#1de9b6',
      tag: '鋏角種・幻影虫 ミラセクト',
      isMultiTarget: false,
      // 肉質：火(50=1.5)大弱点 / 氷(40=1.25)弱点 / 雷(25=0.75) / 水(20=0.6) / 龍(20=0.6)
      effectiveness: { fire: 1.5, water: 0.6, thunder: 0.75, ice: 1.25, dragon: 0.6 }
    });
  }

  // ミラセクト専用ギミック状態
  const miraState = {
    silkThreads: [],  // 千条の麻痺糸
    poisonNeedles: [],// 紫毒の棘雨・拡散針陣
    illusions: [],    // 虚実の黄脚幻影（蜘蛛の足部分だけ黄色）
    spores: []        // 森林背景の浮遊胞子・木漏れ日粒子
  };

  function initForestSpores(canvas) {
    miraState.spores = [];
    for (let i = 0; i < 45; i++) {
      miraState.spores.push({
        x: Math.random() * canvas.width,
        y: Math.random() * 390,
        r: 1.2 + Math.random() * 2.2,
        vy: 0.18 + Math.random() * 0.4,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  function clearMiraObjects() {
    miraState.silkThreads = [];
    miraState.poisonNeedles = [];
    miraState.illusions = [];
  }

  // ミラセクト本体＆幻影共通の蜘蛛描画関数（IMG_2555_2.JPG風デザイン）
  function drawMirasectSpider(ctx, x, y, w, h, facing, alpha, isIllusion, isFlash, legPhase) {
    ctx.save();
    ctx.globalAlpha = Math.max(0.08, Math.min(1, alpha));

    const cx = x + w / 2;
    const cy = y - h / 2;
    ctx.translate(cx, cy);
    ctx.scale(facing, 1);

    const glowColor = isIllusion ? '#ffd600' : '#00e5ff';
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = isIllusion ? 18 : 14;

    // 1. 8本の長い蜘蛛脚（幻影時は脚部分だけが鮮やかな黄色になる！）
    const legConfigs = [
      { bx: -24, by: -6, mx: -54, my: -36, ex: -74, ey: 54 },
      { bx: -12, by: -4, mx: -34, my: -42, ex: -46, ey: 56 },
      { bx: 4,   by: -2, mx: -8,  my: -40, ex: -14, ey: 56 },
      { bx: 18,  by: 0,  mx: 18,  my: -34, ex: 22,  ey: 54 }
    ];

    legConfigs.forEach((lg, idx) => {
      const swing = Math.sin(legPhase + idx * 1.4) * 7;

      // 奥側の脚（やや暗め）
      ctx.strokeStyle = isFlash ? '#ffffff' : (isIllusion ? '#fbc02d' : '#1b2836');
      ctx.lineWidth = 4.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(lg.bx - 4, lg.by - 4);
      ctx.lineTo(lg.mx - 6, lg.my - 6 - swing * 0.5);
      ctx.lineTo(lg.ex - 8, lg.ey);
      ctx.stroke();

      // 手前側の脚
      ctx.strokeStyle = isFlash ? '#ffffff' : (isIllusion ? '#ffea00' : '#263849');
      ctx.lineWidth = 5.5;
      ctx.beginPath();
      ctx.moveTo(lg.bx, lg.by);
      ctx.lineTo(lg.mx, lg.my + swing);
      ctx.lineTo(lg.ex + swing * 0.6, lg.ey);
      ctx.stroke();

      // 脚の関節＆先端の蛍光ライン（幻影は脚全体が黄色く強調発光）
      ctx.strokeStyle = isFlash ? '#ffffff' : (isIllusion ? '#ffff00' : '#64ffda');
      ctx.lineWidth = isIllusion ? 3.2 : 1.8;
      ctx.beginPath();
      ctx.moveTo(lg.mx, lg.my + swing);
      ctx.lineTo(lg.ex + swing * 0.6, lg.ey);
      ctx.stroke();
    });

    // 2. 巨大な球形の腹部（背後にそびえる結晶文様の腹部）
    ctx.fillStyle = isFlash ? '#ffffff' : (isIllusion ? 'rgba(38, 50, 56, 0.72)' : '#1a2634');
    ctx.beginPath();
    ctx.ellipse(-24, -18, 44, 38, -0.15, 0, Math.PI * 2);
    ctx.fill();

    // 腹部背面の鋭い棘（IMG_2555_2.JPGの背面のトゲ列）
    ctx.fillStyle = isFlash ? '#ffffff' : '#37474f';
    for (let s = 0; s < 6; s++) {
      const ang = Math.PI * (1.05 + s * 0.14);
      const sx = -24 + Math.cos(ang) * 42;
      const sy = -18 + Math.sin(ang) * 36;
      ctx.beginPath();
      ctx.moveTo(sx - 3, sy);
      ctx.lineTo(sx + Math.cos(ang) * 14, sy + Math.sin(ang) * 14);
      ctx.lineTo(sx + 4, sy + 3);
      ctx.closePath();
      ctx.fill();
    }

    // 腹部の渦巻き文様＆エメラルド〜シアンの宝玉発光
    ctx.strokeStyle = isIllusion ? 'rgba(255, 234, 0, 0.45)' : 'rgba(100, 255, 218, 0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-22, -20, 24, 0.2, Math.PI * 1.7);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(-18, -14, 14, Math.PI * 0.5, Math.PI * 2.1);
    ctx.stroke();

    // 腹部に埋め込まれた輝く結晶コア
    const gems = [
      { gx: -32, gy: -26, r: 5, col: '#00e676' },
      { gx: -14, gy: -28, r: 4.5, col: '#00e5ff' },
      { gx: -10, gy: -10, r: 6, col: '#64ffda' },
      { gx: -28, gy: -6, r: 4, col: '#b388ff' }
    ];
    gems.forEach(gm => {
      ctx.fillStyle = isFlash ? '#ffffff' : (isIllusion ? '#ffd600' : gm.col);
      ctx.beginPath();
      ctx.arc(gm.gx, gm.gy, gm.r, 0, Math.PI * 2);
      ctx.fill();
    });

    // 3. 頭胸部（前方の甲殻）
    ctx.fillStyle = isFlash ? '#ffffff' : (isIllusion ? 'rgba(38, 50, 56, 0.78)' : '#21303f');
    ctx.beginPath();
    ctx.ellipse(24, 4, 26, 18, 0.08, 0, Math.PI * 2);
    ctx.fill();

    // 4. 太い触肢（ペディパルプ：前方に構える2本の腕状器官）
    ctx.strokeStyle = isFlash ? '#ffffff' : (isIllusion ? '#ffea00' : '#2c3e50');
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(40, 8);
    ctx.quadraticCurveTo(56, 14, 52, 28);
    ctx.stroke();

    // 5. 多数の輝く単眼クラスター（IMG_2555_2.JPGの青緑に光る複眼群）
    const eyes = [
      { ex: 38, ey: -2, r: 3.2 },
      { ex: 45, ey: 0,  r: 2.8 },
      { ex: 34, ey: 4,  r: 2.4 },
      { ex: 42, ey: 5,  r: 2.4 },
      { ex: 32, ey: -6, r: 2.2 }
    ];
    ctx.fillStyle = isFlash ? '#ffffff' : (isIllusion ? '#ffff00' : '#1de9b6');
    eyes.forEach(ey => {
      ctx.beginPath();
      ctx.arc(ey.ex, ey.ey, ey.r, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  }

  // ------------------------------------------------------------
  // 1. リセット時の初期化
  // ------------------------------------------------------------
  EXTRA.hooks.onResetGame = function (ctxObj) {
    if (typeof prevHooks.onResetGame === 'function') prevHooks.onResetGame(ctxObj);
    clearMiraObjects();
    initForestSpores(ctxObj.canvas);

    ctxObj.activeMonsters.forEach(m => {
      if (m.species === 'mirasect') {
        m.w = 146;
        m.h = 112;
        m.x = 645;
        m.stealthAlpha = 0.25; // 初期は風景に溶け込む光学擬態状態
        m.legPhase = 0;
      }
    });
  };

  // ------------------------------------------------------------
  // 2. 行動選択（原案1種＋アレンジ2種＋幻影跳躍）
  // ------------------------------------------------------------
  EXTRA.hooks.onChooseAction = function (m, ctxObj) {
    if (m.species !== 'mirasect') {
      return typeof prevHooks.onChooseAction === 'function' ? prevHooks.onChooseAction(m, ctxObj) : false;
    }

    const r = Math.random();
    if (r < 0.28) {
      // ① 千条の麻痺糸（原案：モンスターがいる方向から何本も糸が飛んでくる）
      m.state = 'miraSilkBarrage';
      m.stateTimer = 68;
    } else if (r < 0.56) {
      // ② 【アレンジ①】紫毒の棘雨・拡散針陣（扇状毒針＋上空からの時間差毒針雨）
      m.state = 'miraPoisonNeedleRain';
      m.stateTimer = 72;
    } else if (r < 0.82) {
      // ③ 【アレンジ②】虚実の黄脚幻影・挟撃陣（足だけ黄色の幻影を複数召喚して四方から挟撃）
      m.state = 'miraYellowLegIllusion';
      m.stateTimer = 86;
    } else {
      // ④ 幻影跳躍・蜘蛛脚プレス
      m.state = 'miraShadowLeap';
      m.stateTimer = 56;
    }
    return true;
  };

  // ------------------------------------------------------------
  // 3. ミラセクトAI更新
  // ------------------------------------------------------------
  EXTRA.hooks.onUpdateMonster = function (m, ctxObj) {
    if (m.species !== 'mirasect') {
      return typeof prevHooks.onUpdateMonster === 'function' ? prevHooks.onUpdateMonster(m, ctxObj) : false;
    }

    const { player, GROUND_Y, canvas, addText, addParticles, damagePlayer, rectIntersect, getMonsterBody } = ctxObj;
    m.isFlying = false;
    m.y += (GROUND_Y - m.y) * 0.14;
    m.legPhase = (m.legPhase || 0) + (Math.abs(m.vx) > 0.5 ? 0.28 : 0.08);

    // 光学擬態（距離が離れている＆待機中は風景に溶け込んで半透明化、近づくと姿が現れる）
    const distToPlayer = Math.abs((player.x + player.w / 2) - (m.x + m.w / 2));
    let targetAlpha = 1.0;
    if (m.state === 'miraYellowLegIllusion' && m.stateTimer > 16) {
      targetAlpha = 0.08; // 幻影展開中はほぼ完全に姿を消す
    } else if (m.state === 'idle') {
      targetAlpha = distToPlayer > 230 ? 0.18 : Math.min(1.0, 1.15 - distToPlayer / 320);
    } else {
      targetAlpha = 0.96;
    }
    m.stealthAlpha = (m.stealthAlpha || 0.25) + (targetAlpha - (m.stealthAlpha || 0.25)) * 0.14;

    m.stateTimer--;

    if (m.state === 'idle') {
      m.facing = player.x < m.x + m.w / 2 ? -1 : 1;
      // 擬態しながらじわじわと距離を詰める
      if (distToPlayer > 210) {
        m.vx = m.facing * 2.2;
      } else {
        m.vx *= 0.82;
      }
      if (m.stateTimer <= 0) {
        EXTRA.hooks.onChooseAction(m, ctxObj);
      }
    } else if (m.state === 'stagger') {
      m.vx *= 0.82;
      m.stealthAlpha = 1.0;
      m.attackHitbox = null;
      if (m.stateTimer <= 0) {
        m.state = 'idle';
        m.stateTimer = 28;
      }
    } else if (m.state === 'miraSilkBarrage') {
      // ① 千条の麻痺糸（モンスターがいる方向から放射状に無数の麻痺糸を射出）
      m.vx = 0;
      if (m.stateTimer > 42) {
        m.facing = player.x < m.x + m.w / 2 ? -1 : 1;
        if (m.stateTimer === 62) {
          addText('擬態の奥から無数の麻痺糸が迫る…！', m.x - 45, m.y - 126, '#64ffda', 17);
        }
      } else if (m.stateTimer === 42 || m.stateTimer === 28) {
        const originX = m.facing === 1 ? m.x + m.w - 10 : m.x + 10;
        const originY = m.y - 54;
        const angles = [-0.26, -0.14, -0.04, 0.06, 0.16];
        angles.forEach(ang => {
          const speed = 11.5;
          miraState.silkThreads.push({
            originX: originX,
            originY: originY,
            x: originX,
            y: originY,
            vx: m.facing * Math.cos(ang) * speed,
            vy: Math.sin(ang) * speed,
            life: 62
          });
        });
        addParticles(originX, originY, '#e0f7fa', 12, 5);
      }

      if (m.stateTimer <= 0) {
        m.state = 'idle';
        m.stateTimer = 38;
      }
    } else if (m.state === 'miraPoisonNeedleRain') {
      // ② 【アレンジ①】紫毒の棘雨・拡散針陣（扇状毒針＋上空からの時間差毒針雨）
      m.vx = 0;
      if (m.stateTimer === 50) {
        m.facing = player.x < m.x + m.w / 2 ? -1 : 1;
        const originX = m.x + m.w / 2;
        const originY = m.y - 72;
        addText('紫毒の棘雨！！', m.x + 10, m.y - 128, '#e040fb', 20);
        addParticles(originX, originY, '#e040fb', 20, 7);

        // 水平・斜め扇状毒針（3本）
        [-0.12, 0.0, 0.12].forEach(ang => {
          miraState.poisonNeedles.push({
            x: originX + m.facing * 35,
            y: originY + 12,
            vx: m.facing * Math.cos(ang) * 11,
            vy: Math.sin(ang) * 11,
            isRain: false,
            life: 70
          });
        });

        // 上空から時間差で降り注ぐ毒針雨（5本）
        for (let k = 0; k < 5; k++) {
          const dropX = k === 0
            ? Math.max(60, Math.min(canvas.width - 60, player.x + player.w / 2))
            : 80 + Math.random() * (canvas.width - 160);
          miraState.poisonNeedles.push({
            x: dropX,
            y: -30 - k * 38,
            vx: 0,
            vy: 9.8,
            isRain: true,
            life: 90
          });
        }
      }

      if (m.stateTimer <= 0) {
        m.state = 'idle';
        m.stateTimer = 40;
      }
    } else if (m.state === 'miraYellowLegIllusion') {
      // ③ 【アレンジ②】虚実の黄脚幻影・挟撃陣（蜘蛛の足部分だけ黄色の幻影を作り出し挟撃）
      m.vx = 0;
      if (m.stateTimer === 74) {
        addText('幻影展開！足が黄色く光る偽物に惑わされるな！', m.x - 95, m.y - 130, '#ffea00', 18);
        addParticles(m.x + m.w / 2, m.y - 55, '#ffea00', 26, 8);

        // 本体も別位置へワープして幻影と混ぜる
        const side = Math.random() < 0.5 ? 1 : -1;
        m.x = side === 1 ? 80 : canvas.width - m.w - 80;
        m.facing = side;

        // 足だけ黄色の幻影2体を左右から走らせる
        miraState.illusions.push({
          x: 60,
          y: GROUND_Y,
          w: m.w,
          h: m.h,
          vx: 8.8,
          facing: 1,
          legPhase: 0,
          life: 62,
          hasHit: false
        });
        miraState.illusions.push({
          x: canvas.width - m.w - 60,
          y: GROUND_Y,
          w: m.w,
          h: m.h,
          vx: -8.8,
          facing: -1,
          legPhase: 1.5,
          life: 62,
          hasHit: false
        });
      } else if (m.stateTimer === 24) {
        // 幻影に紛れて本体も奇襲突進！
        m.stealthAlpha = 1.0;
        m.vx = m.facing * 13.5;
        m.attackHitbox = getMonsterBody(m);
        m.hasHitThisAttack = false;
      } else if (m.stateTimer < 12) {
        m.vx *= 0.75;
        m.attackHitbox = null;
      }

      if (m.stateTimer <= 0) {
        m.state = 'idle';
        m.stateTimer = 42;
        m.attackHitbox = null;
      }
    } else if (m.state === 'miraShadowLeap') {
      // ④ 幻影跳躍・蜘蛛脚プレス
      if (m.stateTimer > 34) {
        m.facing = player.x < m.x + m.w / 2 ? -1 : 1;
        m.vx = -m.facing * 2.0;
      } else if (m.stateTimer > 12) {
        m.vx = m.facing * 12.5;
        m.attackHitbox = getMonsterBody(m);
      } else {
        m.vx *= 0.72;
        m.attackHitbox = null;
      }

      if (m.stateTimer <= 0) {
        m.state = 'idle';
        m.stateTimer = 36;
        m.attackHitbox = null;
      }
    }

    m.x += m.vx;
    m.x = Math.max(25, Math.min(canvas.width - m.w - 25, m.x));

    if (m.attackHitbox && !m.hasHitThisAttack) {
      const pBox = { x: player.x, y: player.y - player.h, w: player.w, h: player.h };
      if (rectIntersect(m.attackHitbox, pBox)) {
        // 本体攻撃には毒属性付与
        damagePlayer(28, true, false, false, false);
        m.hasHitThisAttack = true;
      }
    }

    return true;
  };

  // ------------------------------------------------------------
  // 4. ギミック・麻痺糸・毒針・黄脚幻影の更新
  // ------------------------------------------------------------
  EXTRA.hooks.onUpdateProjectiles = function (ctxObj) {
    if (typeof prevHooks.onUpdateProjectiles === 'function') prevHooks.onUpdateProjectiles(ctxObj);

    const { player, GROUND_Y, canvas, addParticles, damagePlayer, rectIntersect } = ctxObj;
    const pBox = { x: player.x, y: player.y - player.h, w: player.w, h: player.h };

    // 森林背景の浮遊胞子
    miraState.spores.forEach(sp => {
      sp.y -= sp.vy;
      sp.x += Math.sin(Date.now() * 0.002 + sp.phase) * 0.35;
      if (sp.y < 0) {
        sp.y = GROUND_Y - 4;
        sp.x = Math.random() * canvas.width;
      }
    });

    // ① 千条の麻痺糸（当たると麻痺状態！）
    for (let i = miraState.silkThreads.length - 1; i >= 0; i--) {
      const st = miraState.silkThreads[i];
      st.x += st.vx;
      st.y += st.vy;
      st.life--;

      const sBox = { x: st.x - 8, y: st.y - 8, w: 16, h: 16 };
      if (rectIntersect(sBox, pBox)) {
        // 第3引数 true = 麻痺（電撃・麻痺蓄積）
        damagePlayer(18, false, true, false, false);
        addParticles(st.x, st.y, '#ffea00', 10, 5);
        miraState.silkThreads.splice(i, 1);
        continue;
      }

      if (st.life <= 0 || st.x < 0 || st.x > canvas.width || st.y >= GROUND_Y) {
        miraState.silkThreads.splice(i, 1);
      }
    }

    // ② 紫毒の棘雨・拡散針陣（当たると猛毒！）
    for (let i = miraState.poisonNeedles.length - 1; i >= 0; i--) {
      const pn = miraState.poisonNeedles[i];
      pn.x += pn.vx;
      pn.y += pn.vy;
      pn.life--;

      const nBox = { x: pn.x - 8, y: pn.y - 8, w: 16, h: 16 };
      if (rectIntersect(nBox, pBox)) {
        // 第2引数 true = 毒付与
        damagePlayer(22, true, false, false, false);
        addParticles(pn.x, pn.y, '#e040fb', 10, 5);
        miraState.poisonNeedles.splice(i, 1);
        continue;
      }

      if (pn.life <= 0 || pn.x < 0 || pn.x > canvas.width || pn.y >= GROUND_Y) {
        if (pn.y >= GROUND_Y) {
          addParticles(pn.x, GROUND_Y - 4, '#ce93d8', 4, 3);
        }
        miraState.poisonNeedles.splice(i, 1);
      }
    }

    // ③ 虚実の黄脚幻影（蜘蛛の足部分だけ黄色い分身）
    for (let i = miraState.illusions.length - 1; i >= 0; i--) {
      const il = miraState.illusions[i];
      il.x += il.vx;
      il.legPhase += 0.34;
      il.life--;

      const ilBox = { x: il.x + 20, y: il.y - il.h + 20, w: il.w - 40, h: il.h - 20 };
      if (!il.hasHit && rectIntersect(ilBox, pBox)) {
        il.hasHit = true;
        // 幻影の接触は幻惑ダメージ＋麻痺蓄積
        damagePlayer(16, false, true, false, false);
        addParticles(il.x + il.w / 2, il.y - 50, '#ffea00', 16, 6);
      }

      if (il.life <= 0 || il.x < -120 || il.x > canvas.width + 120) {
        miraState.illusions.splice(i, 1);
      }
    }
  };

  // ------------------------------------------------------------
  // 5. 森林背景＆ミラセクト本体描画
  // ------------------------------------------------------------
  EXTRA.hooks.onDrawMonster = function (m, ctxObj) {
    if (m.species !== 'mirasect') {
      return typeof prevHooks.onDrawMonster === 'function' ? prevHooks.onDrawMonster(m, ctxObj) : false;
    }

    const { ctx, canvas, GROUND_Y } = ctxObj;

    // --- 神秘的な深緑の森林専用背景（destination-overで地面・モンスター背後に敷く） ---
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';

    // 深い霧と森のグラデーション
    const forestGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    forestGrad.addColorStop(0, '#071712');
    forestGrad.addColorStop(0.55, '#0f2e24');
    forestGrad.addColorStop(1, '#1b4737');
    ctx.fillStyle = forestGrad;
    ctx.fillRect(0, 0, canvas.width, GROUND_Y);

    // 樹冠から差し込む淡い木漏れ日
    const sunBeam = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    sunBeam.addColorStop(0, 'rgba(167, 255, 235, 0.14)');
    sunBeam.addColorStop(1, 'rgba(167, 255, 235, 0)');
    ctx.fillStyle = sunBeam;
    ctx.beginPath();
    ctx.moveTo(220, 0);
    ctx.lineTo(380, 0);
    ctx.lineTo(480, GROUND_Y);
    ctx.lineTo(290, GROUND_Y);
    ctx.closePath();
    ctx.fill();

    // 巨木の幹シルエット（左右＆奥）
    ctx.fillStyle = '#091c15';
    const treeXs = [45, 190, 680, 845];
    treeXs.forEach((tx, idx) => {
      const tw = idx % 2 === 0 ? 46 : 32;
      ctx.fillRect(tx, 0, tw, GROUND_Y);
      // 枝のシルエット
      ctx.beginPath();
      ctx.moveTo(tx + tw / 2, 120);
      ctx.lineTo(tx - 45, 65);
      ctx.lineTo(tx + tw / 2, 138);
      ctx.closePath();
      ctx.fill();
    });

    // 森林のシダ植物・茂みシルエット
    ctx.fillStyle = '#0d291f';
    for (let b = 0; b < canvas.width; b += 95) {
      ctx.beginPath();
      ctx.arc(b + 40, GROUND_Y, 44, Math.PI, Math.PI * 2);
      ctx.fill();
    }

    // 森に舞う光る胞子
    miraState.spores.forEach(sp => {
      ctx.fillStyle = 'rgba(100, 255, 218, 0.42)';
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2);
      ctx.fill();
    });

    // 苔むした森林の大地
    ctx.fillStyle = '#14261c';
    ctx.fillRect(0, GROUND_Y, canvas.width, canvas.height - GROUND_Y);
    ctx.fillStyle = '#2e7d5b';
    ctx.fillRect(0, GROUND_Y, canvas.width, 5);

    ctx.restore();

    // --- ミラセクト本体描画（光学擬態の透過率 m.stealthAlpha を反映） ---
    drawMirasectSpider(
      ctx,
      m.x,
      m.y,
      m.w,
      m.h,
      m.facing,
      m.flashTimer > 0 ? 1.0 : (m.stealthAlpha || 0.3),
      false,
      m.flashTimer > 0,
      m.legPhase || 0
    );

    return true;
  };

  // ------------------------------------------------------------
  // 6. 麻痺糸・毒針・黄脚幻影の描画
  // ------------------------------------------------------------
  EXTRA.hooks.onDrawProjectiles = function (ctxObj) {
    if (typeof prevHooks.onDrawProjectiles === 'function') prevHooks.onDrawProjectiles(ctxObj);

    const { ctx } = ctxObj;

    // ① 千条の麻痺糸（モンスターの方向から伸びる発光糸）
    miraState.silkThreads.forEach(st => {
      ctx.save();
      ctx.strokeStyle = 'rgba(224, 247, 250, 0.78)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(st.originX, st.originY);
      ctx.lineTo(st.x, st.y);
      ctx.stroke();

      // 先端の麻痺針節
      ctx.fillStyle = '#ffff00';
      ctx.beginPath();
      ctx.arc(st.x, st.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // ② 紫毒の棘雨・拡散針陣
    miraState.poisonNeedles.forEach(pn => {
      ctx.save();
      ctx.translate(pn.x, pn.y);
      const ang = Math.atan2(pn.vy, pn.vx);
      ctx.rotate(ang);

      ctx.shadowColor = '#e040fb';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#d500f9';
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-10, -4);
      ctx.lineTo(-6, 0);
      ctx.lineTo(-10, 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });

    // ③ 虚実の黄脚幻影（蜘蛛の足部分だけ黄色い分身）
    miraState.illusions.forEach(il => {
      const alpha = Math.min(0.85, il.life / 15);
      drawMirasectSpider(
        ctx,
        il.x,
        il.y,
        il.w,
        il.h,
        il.facing,
        alpha,
        true, // isIllusion = true（脚部分が黄色く輝く）
        false,
        il.legPhase
      );
    });
  };
})();
// ============================================================
// 追加コンテンツ：終焉龍 エクリプシア（☆5古龍・龍属性・HP 30000）
// ============================================================
(function () {
  window.EXTRA_CONTENT = window.EXTRA_CONTENT || {
    weapons: { longsword: [], greatsword: [], dualblades: [] },
    armors: { head: [], chest: [], arms: [], waist: [], legs: [] },
    skillNames: {},
    quests: [],
    hooks: {}
  };

  const EXTRA = window.EXTRA_CONTENT;
  EXTRA.quests = EXTRA.quests || [];
  EXTRA.hooks = EXTRA.hooks || {};

  // 既存フックを保持して連結
  const prevHooks = {
    onResetGame: EXTRA.hooks.onResetGame,
    onUpdateMonster: EXTRA.hooks.onUpdateMonster,
    onChooseAction: EXTRA.hooks.onChooseAction,
    onUpdateProjectiles: EXTRA.hooks.onUpdateProjectiles,
    onDrawMonster: EXTRA.hooks.onDrawMonster,
    onDrawProjectiles: EXTRA.hooks.onDrawProjectiles
  };

  // クエストボード＆F2肉質表へ登録（☆5 / HP 30000 / パッケージモンスター）
  if (!EXTRA.quests.some(q => q.key === 'eclipsia')) {
    EXTRA.quests.push({
      key: 'eclipsia',
      title: '終焉の刻',
      displayName: '終焉龍 エクリプシア',
      stars: '☆5',
      starLevel: 5,
      hpText: 'HP 30000',
      maxHp: 30000,
      themeColor: '#1a237e',
      borderColor: '#ffd54f',
      barColor: '#d500f9',
      tag: '伝説の古龍・終焉龍 エクリプシア',
      isMultiTarget: false,
      // 肉質：龍(55=1.6)特効・抑制必須 / 火(30=0.9) / 雷(30=0.9) / 水(25=0.75) / 氷(25=0.75)
      effectiveness: { fire: 0.9, water: 0.75, thunder: 0.9, ice: 0.75, dragon: 1.6 }
    });
  }

  // エクリプシア専用ギミック状態
  const ecliState = {
    lightLasers: [],   // 第一形態アレンジ：白昼の星雨・軌道光刃
    dragonPillars: [], // 第二形態アレンジ：終焉の地殻崩壊・龍脈噴火
    dragonBeams: [],   // 第二形態：黒蝕の龍閃ブレス
    absorbOrbs: [],    // エネルギー吸収の光の玉
    apocalypseBall: null, // 第三形態大規模必殺技：エクリプスアポカリプス
    starParticles: []  // 黄昏空の星屑
  };

  function initStarParticles(canvas) {
    ecliState.starParticles = [];
    for (let i = 0; i < 40; i++) {
      ecliState.starParticles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * 210,
        r: 0.8 + Math.random() * 1.6,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  function clearEcliObjects() {
    ecliState.lightLasers = [];
    ecliState.dragonPillars = [];
    ecliState.dragonBeams = [];
    ecliState.absorbOrbs = [];
    ecliState.apocalypseBall = null;
  }

  // ------------------------------------------------------------
  // 1. リセット時の初期化
  // ------------------------------------------------------------
  EXTRA.hooks.onResetGame = function (ctxObj) {
    if (typeof prevHooks.onResetGame === 'function') prevHooks.onResetGame(ctxObj);
    clearEcliObjects();
    initStarParticles(ctxObj.canvas);

    ctxObj.activeMonsters.forEach(m => {
      if (m.species === 'eclipsia') {
        m.w = 164;
        m.h = 128;
        m.x = 620;
        m.phase = 1; // 1: 白き姿, 2: 黒き姿, 3: 終焉の姿
        m.wingBeat = 0;
        m.powerBuff = 1.0;
        m.ultimateDone = false;
        m.lastTrackedHp = m.hp;
        m.dragonSuppressDamage = 0;
      }
    });
  };

  // ------------------------------------------------------------
  // 2. 行動選択（形態に応じた攻撃パターン）
  // ------------------------------------------------------------
  EXTRA.hooks.onChooseAction = function (m, ctxObj) {
    if (m.species !== 'eclipsia') {
      return typeof prevHooks.onChooseAction === 'function' ? prevHooks.onChooseAction(m, ctxObj) : false;
    }

    const r = Math.random();
    if (m.phase === 1) {
      // 第一形態：白き姿（空中高速攻撃＆軌道光刃＆エネルギー吸収）
      if (r < 0.38) {
        m.state = 'ecliWhiteDive';
        m.stateTimer = 78;
        m.diveCount = 0;
      } else if (r < 0.74) {
        m.state = 'ecliWhiteStarLasers';
        m.stateTimer = 72;
      } else {
        m.state = 'ecliEnergyAbsorb';
        m.stateTimer = 80;
      }
    } else if (m.phase === 2) {
      // 第二形態：黒き姿（龍属性ブレス＆地殻崩壊ウェーブ＆エネルギー吸収）
      if (r < 0.38) {
        m.state = 'ecliBlackBeam';
        m.stateTimer = 76;
      } else if (r < 0.76) {
        m.state = 'ecliBlackQuakeWave';
        m.stateTimer = 82;
      } else {
        m.state = 'ecliEnergyAbsorb';
        m.stateTimer = 80;
      }
    } else {
      // 第三形態：終焉の姿（白と黒の融合連撃）
      if (r < 0.3) {
        m.state = 'ecliWhiteStarLasers';
        m.stateTimer = 68;
      } else if (r < 0.62) {
        m.state = 'ecliBlackQuakeWave';
        m.stateTimer = 76;
      } else if (r < 0.84) {
        m.state = 'ecliWhiteDive';
        m.stateTimer = 72;
        m.diveCount = 0;
      } else {
        m.state = 'ecliBlackBeam';
        m.stateTimer = 70;
      }
    }
    return true;
  };

  // ------------------------------------------------------------
  // 3. エクリプシアAI更新（三形態進化＆大規模必殺技抑制判定）
  // ------------------------------------------------------------
  EXTRA.hooks.onUpdateMonster = function (m, ctxObj) {
    if (m.species !== 'eclipsia') {
      return typeof prevHooks.onUpdateMonster === 'function' ? prevHooks.onUpdateMonster(m, ctxObj) : false;
    }

    const { player, GROUND_Y, canvas, addText, addParticles, damagePlayer, rectIntersect, getMonsterBody } = ctxObj;
    m.wingBeat = (m.wingBeat || 0) + (m.phase === 1 ? 0.14 : 0.1);

    // ダメージ監視（第三形態の大規模必殺技チャージ中の龍属性ダメージ抑制用）
    if (m.lastTrackedHp === undefined) m.lastTrackedHp = m.hp;
    const deltaHp = m.lastTrackedHp - m.hp;
    if (deltaHp > 0 && m.state === 'ecliApocalypseCharge') {
      const wElem = (ctxObj.currentWeapon && ctxObj.currentWeapon.element) || '';
      if (wElem === 'dragon') {
        m.dragonSuppressDamage += deltaHp;
      } else {
        // 龍属性以外でもわずかに削れるが、龍属性が圧倒的に有効
        m.dragonSuppressDamage += deltaHp * 0.25;
      }
    }
    m.lastTrackedHp = m.hp;

    // 形態変化判定（HP 66%以下で第二形態、HP 33%以下で第三形態）
    if (m.phase === 1 && m.hp <= m.maxHp * 0.66) {
      m.phase = 2;
      m.state = 'ecliPhaseShift';
      m.stateTimer = 60;
      m.attackHitbox = null;
      ctxObj.screenShake = Math.max(ctxObj.screenShake, 14);
      addParticles(m.x + m.w / 2, m.y - 70, '#7c4dff', 40, 10);
      addText('【第二形態：黒き姿】漆黒の龍力が解放される…！！', m.x - 115, m.y - 145, '#b388ff', 20);
    } else if (m.phase === 2 && m.hp <= m.maxHp * 0.33) {
      m.phase = 3;
      m.state = 'ecliPhaseShift';
      m.stateTimer = 64;
      m.attackHitbox = null;
      ctxObj.screenShake = Math.max(ctxObj.screenShake, 16);
      addParticles(m.x + m.w / 2, m.y - 70, '#ffd54f', 45, 11);
      addText('【第三形態：終焉の姿】白と黒の力が融合した！！', m.x - 110, m.y - 148, '#ffd54f', 21);
    }

    // 第三形態に入ったら一度、大規模必殺技「終焉ノ刻・エクリプスアポカリプス」を発動
    if (m.phase === 3 && !m.ultimateDone && m.state === 'idle' && m.stateTimer <= 10) {
      m.ultimateDone = true;
      m.state = 'ecliApocalypseCharge';
      m.stateTimer = 240; // 4秒間の抑制チャレンジ
      m.dragonSuppressDamage = 0;
      ecliState.apocalypseBall = {
        x: canvas.width / 2,
        y: 155,
        radius: 26,
        maxRadius: 115
      };
      addText('終焉ノ刻・詠唱開始！龍属性攻撃で力を抑え込め！！', canvas.width / 2 - 210, 120, '#ff4081', 20);
    }

    // 浮遊制御（普段は少し宙に浮いて神々しく翼を羽ばたかせる）
    const hoverTargetY = (m.state === 'ecliWhiteDive' && m.stateTimer > 42) || m.state === 'ecliApocalypseCharge'
      ? GROUND_Y - 115
      : GROUND_Y - 16 + Math.sin(m.wingBeat * 0.6) * 6;
    if (m.state !== 'ecliWhiteDive' || m.stateTimer > 42) {
      m.y += (hoverTargetY - m.y) * 0.1;
    }

    m.stateTimer--;
    const dmgScale = (m.powerBuff || 1.0) * (m.phase === 3 ? 1.15 : 1.0);

    if (m.state === 'idle') {
      m.facing = player.x < m.x + m.w / 2 ? -1 : 1;
      m.vx *= 0.82;
      if (m.stateTimer <= 0) {
        EXTRA.hooks.onChooseAction(m, ctxObj);
      }
    } else if (m.state === 'stagger') {
      m.vx *= 0.82;
      m.y += (GROUND_Y - m.y) * 0.2;
      m.attackHitbox = null;
      if (m.stateTimer <= 0) {
        m.state = 'idle';
        m.stateTimer = 28;
      }
    } else if (m.state === 'ecliPhaseShift') {
      m.vx = 0;
      if (m.stateTimer % 4 === 0) {
        addParticles(m.x + m.w / 2, m.y - 65, m.phase === 2 ? '#d500f9' : '#ffffff', 8, 7);
      }
      if (m.stateTimer <= 0) {
        m.state = 'idle';
        m.stateTimer = 18;
      }
    } else if (m.state === 'ecliWhiteDive') {
      // 【第一形態】天翔の白翼・連続滑空斬（2連続高速ダイブ）
      if (m.stateTimer > 44) {
        m.facing = player.x < m.x + m.w / 2 ? -1 : 1;
        m.vx = -m.facing * 2.5;
        if (m.stateTimer % 3 === 0) {
          addParticles(m.x + m.w / 2, m.y - 70, '#ffffff', 4, 4);
        }
      } else if (m.stateTimer === 44 || m.stateTimer === 22) {
        m.facing = player.x < m.x + m.w / 2 ? -1 : 1;
        m.vx = m.facing * 17.5;
        m.y = GROUND_Y - 6;
        m.attackHitbox = getMonsterBody(m);
        m.hasHitThisAttack = false;
        ctxObj.screenShake = Math.max(ctxObj.screenShake, 7);
        addParticles(m.x + m.w / 2, m.y - 50, '#e0f7fa', 16, 7);
      } else {
        m.vx *= 0.86;
        if (m.stateTimer < 10) m.attackHitbox = null;
      }

      if (m.stateTimer <= 0) {
        m.state = 'idle';
        m.stateTimer = 32;
        m.attackHitbox = null;
      }
    } else if (m.state === 'ecliWhiteStarLasers') {
      // 【アレンジ①】白昼の星雨・軌道光刃（交差する白銀レーザーネット）
      m.vx = 0;
      if (m.stateTimer === 52) {
        addText('白昼の星雨・軌道光刃！', m.x - 10, m.y - 140, '#e0f7fa', 19);
        const px = player.x + player.w / 2;
        // 交差する3本の軌道レーザーを配置
        [-110, 0, 110].forEach((offset, idx) => {
          const lx = Math.max(60, Math.min(canvas.width - 60, px + offset));
          ecliState.lightLasers.push({
            x1: lx - 65,
            y1: 0,
            x2: lx + 65,
            y2: GROUND_Y,
            warnTimer: 32 + idx * 6,
            activeTimer: 16,
            hasHit: false
          });
        });
      }

      if (m.stateTimer <= 0) {
        m.state = 'idle';
        m.stateTimer = 34;
      }
    } else if (m.state === 'ecliBlackBeam') {
      // 【第二形態】黒蝕の龍閃ブレス
      m.vx = 0;
      if (m.stateTimer > 42) {
        m.facing = player.x < m.x + m.w / 2 ? -1 : 1;
        if (m.stateTimer % 3 === 0) {
          const mouthX = m.facing === 1 ? m.x + m.w : m.x;
          addParticles(mouthX, m.y - 84, '#d500f9', 5, 4);
        }
      } else if (m.stateTimer === 42) {
        const mouthX = m.facing === 1 ? m.x + m.w : m.x;
        ecliState.dragonBeams.push({
          x: mouthX,
          y: m.y - 80,
          dir: m.facing,
          timer: 34,
          hitCooldown: 0
        });
        ctxObj.screenShake = Math.max(ctxObj.screenShake, 11);
        addText('黒蝕の龍閃ブレス！！', m.x, m.y - 142, '#ea80fc', 21);
      }

      if (m.stateTimer <= 0) {
        m.state = 'idle';
        m.stateTimer = 36;
      }
    } else if (m.state === 'ecliBlackQuakeWave') {
      // 【アレンジ②】終焉の地殻崩壊・龍脈噴火（鏡面大地を砕く連鎖龍脈柱ウェーブ）
      m.vx = 0;
      if (m.stateTimer === 56) {
        m.facing = player.x < m.x + m.w / 2 ? -1 : 1;
        ctxObj.screenShake = Math.max(ctxObj.screenShake, 12);
        addText('地殻崩壊・龍脈連鎖噴火！！', m.x - 30, m.y - 142, '#ff1744', 20);

        const startX = m.x + m.w / 2;
        for (let k = 1; k <= 6; k++) {
          const px = startX + m.facing * k * 115;
          if (px > 30 && px < canvas.width - 30) {
            ecliState.dragonPillars.push({
              x: px,
              y: GROUND_Y,
              w: 54,
              h: 155,
              delay: k * 9, // 時間差で波のように噴き上がる
              activeTimer: 18,
              hasHit: false
            });
          }
        }
      }

      if (m.stateTimer <= 0) {
        m.state = 'idle';
        m.stateTimer = 38;
      }
    } else if (m.state === 'ecliEnergyAbsorb') {
      // 【アレンジ③】虚無のエネルギー吸収・重力環
      m.vx = 0;
      if (m.stateTimer === 72) {
        addText('周囲のエネルギーを吸収している…！', m.x - 50, m.y - 142, '#ffd54f', 18);
        for (let k = 0; k < 10; k++) {
          const ang = (Math.PI * 2 * k) / 10;
          ecliState.absorbOrbs.push({
            x: m.x + m.w / 2 + Math.cos(ang) * 260,
            y: m.y - 65 + Math.sin(ang) * 160,
            tx: m.x + m.w / 2,
            ty: m.y - 65,
            life: 62
          });
        }
      }

      if (m.stateTimer > 14 && m.stateTimer < 72) {
        // ハンターをじわじわ引き寄せる重力場
        const dx = (m.x + m.w / 2) - (player.x + player.w / 2);
        if (Math.abs(dx) < 380) {
          player.x += Math.sign(dx) * 2.1;
          player.x = Math.max(20, Math.min(canvas.width - 50, player.x));
        }
      } else if (m.stateTimer === 14) {
        m.powerBuff = 1.25;
        addParticles(m.x + m.w / 2, m.y - 65, '#ffd54f', 26, 8);
        addText('エネルギー吸収完了！攻撃力が上昇した！', m.x - 65, m.y - 144, '#ffd54f', 18);
      }

      if (m.stateTimer <= 0) {
        m.state = 'idle';
        m.stateTimer = 34;
      }
    } else if (m.state === 'ecliApocalypseCharge') {
      // 【第三形態・大規模必殺技】終焉ノ刻・エクリプスアポカリプス
      m.vx = 0;
      m.x += (canvas.width / 2 - m.w / 2 - m.x) * 0.08;

      if (ecliState.apocalypseBall) {
        ecliState.apocalypseBall.x = m.x + m.w / 2;
        ecliState.apocalypseBall.radius = Math.min(
          ecliState.apocalypseBall.maxRadius,
          ecliState.apocalypseBall.radius + 0.38
        );
      }

      if (m.stateTimer % 4 === 0) {
        addParticles(m.x + m.w / 2, 155, '#ff4081', 6, 6);
      }

      // 龍属性ダメージ一定値（950以上）で抑制成功・大ダウン！
      if (m.dragonSuppressDamage >= 950) {
        ecliState.apocalypseBall = null;
        m.state = 'stagger';
        m.stateTimer = 110;
        m.y = GROUND_Y;
        ctxObj.screenShake = Math.max(ctxObj.screenShake, 18);
        addParticles(m.x + m.w / 2, m.y - 60, '#00e5ff', 50, 12);
        addText('龍封力抑制成功！！終焉の力を打ち消した！！', canvas.width / 2 - 200, 140, '#00e5ff', 22);
      } else if (m.stateTimer <= 0) {
        // 抑制失敗：大規模必殺技炸裂！
        ecliState.apocalypseBall = null;
        ctxObj.screenShake = Math.max(ctxObj.screenShake, 22);
        addParticles(canvas.width / 2, GROUND_Y - 80, '#ff1744', 65, 14);
        addText('終焉ノ刻・エクリプスアポカリプス！！', canvas.width / 2 - 185, 130, '#ff1744', 24);
        damagePlayer(65, false, false, true, false);
        m.state = 'idle';
        m.stateTimer = 45;
      }
    }

    m.x += m.vx;
    m.x = Math.max(25, Math.min(canvas.width - m.w - 25, m.x));

    if (m.attackHitbox && !m.hasHitThisAttack) {
      const pBox = { x: player.x, y: player.y - player.h, w: player.w, h: player.h };
      if (rectIntersect(m.attackHitbox, pBox)) {
        const isDragon = m.phase >= 2;
        damagePlayer(Math.round(28 * dmgScale), false, false, isDragon, false);
        m.hasHitThisAttack = true;
      }
    }

    return true;
  };

  // ------------------------------------------------------------
  // 4. ギミック・レーザー・龍脈柱・ブレス判定の更新
  // ------------------------------------------------------------
  EXTRA.hooks.onUpdateProjectiles = function (ctxObj) {
    if (typeof prevHooks.onUpdateProjectiles === 'function') prevHooks.onUpdateProjectiles(ctxObj);

    const { player, GROUND_Y, canvas, addParticles, damagePlayer, rectIntersect } = ctxObj;
    const pBox = { x: player.x, y: player.y - player.h, w: player.w, h: player.h };

    // ① 白昼の星雨・軌道光刃
    for (let i = ecliState.lightLasers.length - 1; i >= 0; i--) {
      const lz = ecliState.lightLasers[i];
      if (lz.warnTimer > 0) {
        lz.warnTimer--;
      } else {
        lz.activeTimer--;
        const midX = (lz.x1 + lz.x2) / 2;
        const lBox = { x: midX - 24, y: GROUND_Y - 140, w: 48, h: 140 };
        if (!lz.hasHit && rectIntersect(lBox, pBox)) {
          lz.hasHit = true;
          damagePlayer(26, false, false, false, false);
        }
        if (lz.activeTimer <= 0) {
          ecliState.lightLasers.splice(i, 1);
        }
      }
    }

    // ② 黒蝕の龍閃ブレス
    for (let i = ecliState.dragonBeams.length - 1; i >= 0; i--) {
      const b = ecliState.dragonBeams[i];
      b.timer--;
      if (b.hitCooldown > 0) b.hitCooldown--;

      const beamX = b.dir === 1 ? b.x : 0;
      const beamW = b.dir === 1 ? (canvas.width - b.x) : b.x;
      const beamBox = { x: beamX, y: b.y - 34, w: Math.max(0, beamW), h: 68 };

      if (b.timer % 2 === 0) {
        addParticles(b.x + b.dir * Math.random() * Math.max(40, beamW), b.y + (Math.random() - 0.5) * 40, '#ea80fc', 2, 4);
      }

      if (b.hitCooldown <= 0 && rectIntersect(beamBox, pBox)) {
        b.hitCooldown = 18;
        // 第4引数 true = 龍属性やられ
        damagePlayer(32, false, false, true, false);
      }

      if (b.timer <= 0) {
        ecliState.dragonBeams.splice(i, 1);
      }
    }

    // ③ 終焉の地殻崩壊・龍脈噴火
    for (let i = ecliState.dragonPillars.length - 1; i >= 0; i--) {
      const dp = ecliState.dragonPillars[i];
      if (dp.delay > 0) {
        dp.delay--;
        if (dp.delay % 5 === 0) {
          addParticles(dp.x + (Math.random() - 0.5) * dp.w, GROUND_Y - 4, '#d500f9', 1, 2);
        }
      } else {
        dp.activeTimer--;
        if (dp.activeTimer === 17) {
          addParticles(dp.x, GROUND_Y - 50, '#ff1744', 14, 7);
        }
        const dpBox = { x: dp.x - dp.w / 2, y: GROUND_Y - dp.h, w: dp.w, h: dp.h };
        if (!dp.hasHit && rectIntersect(dpBox, pBox)) {
          dp.hasHit = true;
          damagePlayer(30, false, false, true, false);
        }
        if (dp.activeTimer <= 0) {
          ecliState.dragonPillars.splice(i, 1);
        }
      }
    }

    // ④ エネルギー吸収の光の玉
    for (let i = ecliState.absorbOrbs.length - 1; i >= 0; i--) {
      const ob = ecliState.absorbOrbs[i];
      ob.life--;
      ob.x += (ob.tx - ob.x) * 0.08;
      ob.y += (ob.ty - ob.y) * 0.08;
      if (ob.life <= 0) {
        ecliState.absorbOrbs.splice(i, 1);
      }
    }
  };

  // エクリプシアの6枚翼＆白黒二色龍の描画ヘルパー（鏡面反射にも対応）
  function drawEclipsiaDragon(ctx, m, isReflection) {
    const cx = m.x + m.w / 2;
    const cy = m.y - m.h / 2;
    const flap = Math.sin(m.wingBeat || 0) * 14;
    const isFlash = !isReflection && m.flashTimer > 0;
    const phase = m.phase || 1;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(m.facing, 1);

    // 形態ごとの白・黒カラーテーマ
    const whiteWingCol = isFlash ? '#ffffff' : (phase === 2 ? '#263238' : '#eceff1');
    const blackWingCol = isFlash ? '#ffffff' : (phase === 1 ? '#cfd8dc' : '#12151f');
    const edgeGlowCol = phase === 1 ? '#80deea' : (phase === 2 ? '#d500f9' : '#ffd54f');

    ctx.shadowColor = edgeGlowCol;
    ctx.shadowBlur = isReflection ? 4 : 18;

    // 1. 背中の6枚の翼（上段・中段・下段の3対：IMG_2556.jpgの壮大な翼シルエット）
    // 上段翼（白き翼）
    ctx.fillStyle = whiteWingCol;
    ctx.beginPath();
    ctx.moveTo(-10, -14);
    ctx.quadraticCurveTo(-78, -82 - flap, -138, -46 - flap * 1.2);
    ctx.lineTo(-104, -18 - flap * 0.6);
    ctx.lineTo(-76, -24 - flap * 0.4);
    ctx.lineTo(-42, -6);
    ctx.closePath();
    ctx.fill();

    // 中段翼（黒き翼）
    ctx.fillStyle = blackWingCol;
    ctx.beginPath();
    ctx.moveTo(-14, -4);
    ctx.quadraticCurveTo(-88, -42 - flap * 0.6, -148, 4 - flap * 0.7);
    ctx.lineTo(-112, 16);
    ctx.lineTo(-78, 8);
    ctx.lineTo(-36, 4);
    ctx.closePath();
    ctx.fill();

    // 下段翼（融合細翼）
    ctx.fillStyle = phase === 3 ? '#ffd54f' : whiteWingCol;
    ctx.beginPath();
    ctx.moveTo(-16, 6);
    ctx.lineTo(-110, 34 + flap * 0.4);
    ctx.lineTo(-74, 32 + flap * 0.3);
    ctx.lineTo(-28, 14);
    ctx.closePath();
    ctx.fill();

    // 前方側にもう3枚の翼シルエット（計6枚翼の立体表現）
    ctx.fillStyle = blackWingCol;
    ctx.beginPath();
    ctx.moveTo(8, -12);
    ctx.quadraticCurveTo(56, -74 - flap, 108, -44 - flap);
    ctx.lineTo(74, -18);
    ctx.lineTo(32, -4);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = whiteWingCol;
    ctx.beginPath();
    ctx.moveTo(10, -2);
    ctx.lineTo(116, -6 - flap * 0.5);
    ctx.lineTo(80, 14);
    ctx.lineTo(28, 6);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = phase === 3 ? '#d500f9' : blackWingCol;
    ctx.beginPath();
    ctx.moveTo(6, 8);
    ctx.lineTo(86, 30 + flap * 0.3);
    ctx.lineTo(44, 24);
    ctx.closePath();
    ctx.fill();

    // 2. 長く優美にうねる尾（IMG_2556.jpgのS字の尾）
    ctx.strokeStyle = isFlash ? '#ffffff' : '#1c2331';
    ctx.lineWidth = 11;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-24, 18);
    ctx.quadraticCurveTo(-68, 52, -32, 68);
    ctx.quadraticCurveTo(4, 78, 34, 60);
    ctx.stroke();

    // 3. 白と黒の二色に分かれた胴体＆長い首
    // 胴体下半分（黒）
    ctx.fillStyle = isFlash ? '#ffffff' : '#141824';
    ctx.beginPath();
    ctx.ellipse(-6, 8, 30, 24, -0.1, 0, Math.PI * 2);
    ctx.fill();

    // 胴体上半分〜首（白銀）
    ctx.fillStyle = isFlash ? '#ffffff' : (phase === 2 ? '#263238' : '#eceff1');
    ctx.beginPath();
    ctx.moveTo(-26, 2);
    ctx.quadraticCurveTo(-4, -14, 14, -46);
    ctx.lineTo(28, -42);
    ctx.quadraticCurveTo(18, -2, -4, 12);
    ctx.closePath();
    ctx.fill();

    // 白と黒の境界を走るエネルギーライン
    ctx.strokeStyle = edgeGlowCol;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-26, 4);
    ctx.quadraticCurveTo(4, -4, 22, -42);
    ctx.stroke();

    // 4. 鋭い後脚（空中ホバリング姿勢）
    ctx.strokeStyle = isFlash ? '#ffffff' : '#1c2331';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-8, 22);
    ctx.lineTo(-14, 48);
    ctx.lineTo(-6, 58);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(4, 22);
    ctx.lineTo(2, 48);
    ctx.lineTo(10, 56);
    ctx.stroke();

    // 5. 冠のような多枝角を持つ頭部（IMG_2556.jpgのシルエット）
    ctx.fillStyle = isFlash ? '#ffffff' : (phase === 2 ? '#1c2331' : '#f5f5f5');
    ctx.beginPath();
    ctx.roundRect(10, -58, 32, 16, 5);
    ctx.fill();

    // 頭頂の多枝の冠角
    ctx.strokeStyle = isFlash ? '#ffffff' : edgeGlowCol;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(16, -56);
    ctx.lineTo(4, -76);
    ctx.moveTo(22, -57);
    ctx.lineTo(16, -78);
    ctx.moveTo(27, -56);
    ctx.lineTo(28, -72);
    ctx.stroke();

    // 鋭い眼光
    ctx.fillStyle = phase === 1 ? '#00e5ff' : (phase === 2 ? '#ff1744' : '#ffd54f');
    ctx.fillRect(30, -53, 6, 3.5);

    ctx.restore();
  }

  // ------------------------------------------------------------
  // 5. ウユニ塩湖＆月食背景＋エクリプシア本体＆鏡面反射描画
  // ------------------------------------------------------------
  EXTRA.hooks.onDrawMonster = function (m, ctxObj) {
    if (m.species !== 'eclipsia') {
      return typeof prevHooks.onDrawMonster === 'function' ? prevHooks.onDrawMonster(m, ctxObj) : false;
    }

    const { ctx, canvas, GROUND_Y } = ctxObj;
    const eclipseX = canvas.width / 2;
    const eclipseY = 92;

    // --- ウユニ塩湖＆皆既月食専用背景（destination-overで地面・モンスター背後に敷く） ---
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';

    // 1. 黄昏の蒼と夕焼けのグラデーション空（IMG_2556.jpgの空色を再現）
    const skyGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    skyGrad.addColorStop(0, '#091428');
    skyGrad.addColorStop(0.45, '#1d3557');
    skyGrad.addColorStop(0.78, '#457b9d');
    skyGrad.addColorStop(0.93, '#e09f7d');
    skyGrad.addColorStop(1, '#f4a261');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, canvas.width, GROUND_Y);

    // 星空の瞬き
    ecliState.starParticles.forEach(st => {
      const a = 0.25 + Math.sin(Date.now() * 0.003 + st.phase) * 0.2;
      ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
      ctx.fill();
    });

    // 2. 宙にポツンと浮かぶ皆既月食（ダイヤモンドリング＆コロナ光輪）
    ctx.save();
    const coronaGrad = ctx.createRadialGradient(eclipseX, eclipseY, 22, eclipseX, eclipseY, 88);
    if (m.phase === 3) {
      coronaGrad.addColorStop(0, 'rgba(255, 64, 129, 0.95)');
      coronaGrad.addColorStop(0.4, 'rgba(213, 0, 249, 0.45)');
      coronaGrad.addColorStop(1, 'rgba(213, 0, 249, 0)');
    } else {
      coronaGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      coronaGrad.addColorStop(0.35, 'rgba(179, 229, 252, 0.45)');
      coronaGrad.addColorStop(1, 'rgba(179, 229, 252, 0)');
    }
    ctx.fillStyle = coronaGrad;
    ctx.beginPath();
    ctx.arc(eclipseX, eclipseY, 88, 0, Math.PI * 2);
    ctx.fill();

    // 放射状のコロナ光線
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1.4;
    for (let ray = 0; ray < 16; ray++) {
      const ang = (Math.PI * 2 * ray) / 16 + Date.now() * 0.0002;
      ctx.beginPath();
      ctx.moveTo(eclipseX + Math.cos(ang) * 28, eclipseY + Math.sin(ang) * 28);
      ctx.lineTo(eclipseX + Math.cos(ang) * (54 + (ray % 2) * 18), eclipseY + Math.sin(ang) * (54 + (ray % 2) * 18));
      ctx.stroke();
    }

    // 漆黒の月食本体＋金白の縁取りリング
    ctx.fillStyle = '#070913';
    ctx.beginPath();
    ctx.arc(eclipseX, eclipseY, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = m.phase === 3 ? '#ff80ab' : '#fff9c4';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    // 3. 遠景の低い山並みシルエット
    ctx.fillStyle = 'rgba(20, 33, 61, 0.72)';
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(0, GROUND_Y - 18);
    ctx.quadraticCurveTo(180, GROUND_Y - 34, 340, GROUND_Y - 12);
    ctx.quadraticCurveTo(560, GROUND_Y - 8, 760, GROUND_Y - 28);
    ctx.lineTo(canvas.width, GROUND_Y - 16);
    ctx.lineTo(canvas.width, GROUND_Y);
    ctx.closePath();
    ctx.fill();

    // 4. ウユニ塩湖のような鏡面反射の大地（GROUND_Y以下）
    const mirrorGrad = ctx.createLinearGradient(0, GROUND_Y, 0, canvas.height);
    mirrorGrad.addColorStop(0, '#c8967d');
    mirrorGrad.addColorStop(0.28, '#3d5a80');
    mirrorGrad.addColorStop(1, '#0d1b2a');
    ctx.fillStyle = mirrorGrad;
    ctx.fillRect(0, GROUND_Y, canvas.width, canvas.height - GROUND_Y);

    // 水鏡に映る月食のリフレクション
    ctx.fillStyle = 'rgba(255, 249, 196, 0.22)';
    ctx.beginPath();
    ctx.ellipse(eclipseX, GROUND_Y + 42, 28, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // 水面のさざ波ハイライト
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y + 1);
    ctx.lineTo(canvas.width, GROUND_Y + 1);
    ctx.stroke();

    ctx.restore();

    // 5. ウユニ塩湖の水面に映るエクリプシアの逆さ影（リフレクション）
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, GROUND_Y, canvas.width, canvas.height - GROUND_Y);
    ctx.clip();
    ctx.translate(0, GROUND_Y * 2);
    ctx.scale(1, -1);
    ctx.globalAlpha = 0.26;
    drawEclipsiaDragon(ctx, m, true);
    ctx.restore();

    // 6. エクリプシア本体描画
    drawEclipsiaDragon(ctx, m, false);

    return true;
  };

  // ------------------------------------------------------------
  // 6. 軌道光刃・龍閃ブレス・龍脈柱・大規模必殺技球の描画
  // ------------------------------------------------------------
  EXTRA.hooks.onDrawProjectiles = function (ctxObj) {
    if (typeof prevHooks.onDrawProjectiles === 'function') prevHooks.onDrawProjectiles(ctxObj);

    const { ctx, canvas, GROUND_Y } = ctxObj;

    // ① 白昼の星雨・軌道光刃
    ecliState.lightLasers.forEach(lz => {
      ctx.save();
      if (lz.warnTimer > 0) {
        ctx.strokeStyle = 'rgba(224, 247, 250, 0.45)';
        ctx.setLineDash([8, 6]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(lz.x1, lz.y1);
        ctx.lineTo(lz.x2, lz.y2);
        ctx.stroke();
      } else {
        const alpha = lz.activeTimer / 16;
        ctx.shadowColor = '#00e5ff';
        ctx.shadowBlur = 18;
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.95 * alpha})`;
        ctx.lineWidth = 22 * alpha;
        ctx.beginPath();
        ctx.moveTo(lz.x1, lz.y1);
        ctx.lineTo(lz.x2, lz.y2);
        ctx.stroke();
      }
      ctx.restore();
    });

    // ② 黒蝕の龍閃ブレス
    ecliState.dragonBeams.forEach(b => {
      ctx.save();
      const alpha = Math.min(1, b.timer / 10);
      const startX = b.dir === 1 ? b.x : 0;
      const width = b.dir === 1 ? (canvas.width - b.x) : b.x;

      ctx.shadowColor = '#d500f9';
      ctx.shadowBlur = 20;
      ctx.fillStyle = `rgba(74, 20, 140, ${0.8 * alpha})`;
      ctx.fillRect(startX, b.y - 30, width, 60);

      ctx.fillStyle = `rgba(213, 0, 249, ${0.85 * alpha})`;
      ctx.fillRect(startX, b.y - 16, width, 32);

      ctx.fillStyle = `rgba(255, 23, 68, ${0.95 * alpha})`;
      ctx.fillRect(startX, b.y - 6, width, 12);
      ctx.restore();
    });

    // ③ 終焉の地殻崩壊・龍脈噴火
    ecliState.dragonPillars.forEach(dp => {
      ctx.save();
      if (dp.delay > 0) {
        ctx.fillStyle = 'rgba(213, 0, 249, 0.75)';
        ctx.fillRect(dp.x - dp.w / 2, GROUND_Y - 6, dp.w, 6);
      } else {
        const alpha = dp.activeTimer / 18;
        ctx.shadowColor = '#ff1744';
        ctx.shadowBlur = 16;
        ctx.fillStyle = `rgba(170, 0, 255, ${0.8 * alpha})`;
        ctx.fillRect(dp.x - dp.w / 2, GROUND_Y - dp.h, dp.w, dp.h);
        ctx.fillStyle = `rgba(255, 138, 128, ${0.9 * alpha})`;
        ctx.fillRect(dp.x - dp.w * 0.25, GROUND_Y - dp.h, dp.w * 0.5, dp.h);
      }
      ctx.restore();
    });

    // ④ エネルギー吸収の光の玉
    ecliState.absorbOrbs.forEach(ob => {
      ctx.save();
      ctx.shadowColor = '#ffd54f';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#fff59d';
      ctx.beginPath();
      ctx.arc(ob.x, ob.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // ⑤ 第三形態大規模必殺技：エクリプスアポカリプス球＆抑制ゲージ
    if (ecliState.apocalypseBall) {
      const ab = ecliState.apocalypseBall;
      ctx.save();
      const grad = ctx.createRadialGradient(ab.x, ab.y, 10, ab.x, ab.y, ab.radius);
      grad.addColorStop(0, '#000000');
      grad.addColorStop(0.55, '#4a148c');
      grad.addColorStop(0.85, '#ff1744');
      grad.addColorStop(1, 'rgba(255, 213, 79, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(ab.x, ab.y, ab.radius, 0, Math.PI * 2);
      ctx.fill();

      // 龍封力抑制プログレスバー
      const ecliM = ctxObj.activeMonsters && ctxObj.activeMonsters.find(m => m.species === 'eclipsia');
      if (ecliM) {
        const ratio = Math.min(1, (ecliM.dragonSuppressDamage || 0) / 950);
        const bw = 240;
        const bx = canvas.width / 2 - bw / 2;
        const by = 48;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(bx - 2, by - 2, bw + 4, 16);
        ctx.fillStyle = '#00e5ff';
        ctx.fillRect(bx, by, bw * ratio, 12);
        ctx.strokeStyle = '#ffd54f';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(bx - 2, by - 2, bw + 4, 16);
      }
      ctx.restore();
    }
  };
})();
// ============================================================
// 追加コンテンツ：☆4四天王 連続乱入クエスト（4体討伐・各HP 20000）
// 出現順：アルヴァディオス →(残HP2000)→ ネレグラディス →(残HP2000)→ ミラセクト →(残HP2000)→ グラドヴォル
// ============================================================
(function () {
  window.EXTRA_CONTENT = window.EXTRA_CONTENT || {
    weapons: { longsword: [], greatsword: [], dualblades: [] },
    armors: { head: [], chest: [], arms: [], waist: [], legs: [] },
    skillNames: {},
    quests: [],
    hooks: {}
  };

  const EXTRA = window.EXTRA_CONTENT;
  EXTRA.quests = EXTRA.quests || [];
  EXTRA.hooks = EXTRA.hooks || {};

  // 既存フックを保持して連結
  const prevHooks = {
    onResetGame: EXTRA.hooks.onResetGame,
    onUpdateMonster: EXTRA.hooks.onUpdateMonster,
    onChooseAction: EXTRA.hooks.onChooseAction,
    onUpdateProjectiles: EXTRA.hooks.onUpdateProjectiles,
    onDrawMonster: EXTRA.hooks.onDrawMonster,
    onDrawProjectiles: EXTRA.hooks.onDrawProjectiles
  };

  // クエストボード登録
  if (!EXTRA.quests.some(q => q.key === 'four_calamities')) {
    EXTRA.quests.push({
      key: 'four_calamities',
      title: '四災の輪廻',
      displayName: '四災の輪廻',
      stars: '☆5',
      starLevel: 5,
      hpText: 'HP 20000 × 4体',
      maxHp: 20000,
      themeColor: '#311b92',
      borderColor: '#ffd740',
      barColor: '#ffab00',
      tag: '英雄の証',
      isMultiTarget: true,
      effectiveness: { fire: 1.0, water: 1.0, thunder: 1.0, ice: 1.0, dragon: 1.0 }
    });
  }

  // 乱入管理ステート
  const gauntletState = {
    isActive: false,
    stage: 0, // 1:アルヴァ出現済, 2:ネレグラ乱入済, 3:ミラセクト乱入済, 4:グラドヴォル乱入済
    spawnCooldown: 0,
    spawnedKeys: {}
  };

  // クエスト判定ヘルパー
  function isFourCalamitiesQuest(ctxObj) {
    if (!ctxObj) return false;
    if (ctxObj.questKey === 'four_calamities') return true;
    if (ctxObj.currentQuestKey === 'four_calamities') return true;
    if (ctxObj.selectedQuest === 'four_calamities') return true;
    if (ctxObj.quest && ctxObj.quest.key === 'four_calamities') return true;
    if (ctxObj.currentQuest && ctxObj.currentQuest.key === 'four_calamities') return true;
    if (typeof window.currentQuestKey !== 'undefined' && window.currentQuestKey === 'four_calamities') return true;
    if (typeof window.questKey !== 'undefined' && window.questKey === 'four_calamities') return true;
    if (Array.isArray(ctxObj.activeMonsters) && ctxObj.activeMonsters.some(m => m.species === 'four_calamities' || m.key === 'four_calamities')) {
      return true;
    }
    return false;
  }

  // 増援モンスター生成ヘルパー（HP20000の完全新規エンティティとして生成）
  function spawnReinforcement(ctxObj, speciesKey, displayName, spawnX) {
    if (gauntletState.spawnedKeys[speciesKey]) return;
    gauntletState.spawnedKeys[speciesKey] = true;
    gauntletState.spawnCooldown = 30; // 連続暴発防止の安全タイマー

    const list = ctxObj.activeMonsters;
    if (!Array.isArray(list)) return;

    const groundY = ctxObj.GROUND_Y || (list[0] ? list[0].y : 360);

    const newMon = {
      species: speciesKey,
      key: speciesKey,
      name: displayName,
      displayName: displayName,
      hp: 20000,
      maxHp: 20000,
      x: spawnX,
      y: groundY,
      w: 170,
      h: 115,
      vx: 0,
      vy: 0,
      facing: spawnX < 450 ? 1 : -1,
      state: 'idle',
      stateTimer: 35,
      attackHitbox: null,
      hasHitThisAttack: false,
      flashTimer: 18,
      isFlying: false,
      isDead: false,
      dead: false
    };

    if (speciesKey === 'neregladis') {
      newMon.w = 185;
      newMon.h = 115;
    } else if (speciesKey === 'mirasect') {
      newMon.w = 146;
      newMon.h = 112;
      newMon.stealthAlpha = 0.85;
      newMon.legPhase = 0;
    } else if (speciesKey === 'gradvol') {
      newMon.w = 195;
      newMon.h = 128;
      newMon.isEnraged = false;
    }

    list.push(newMon);

    if (typeof ctxObj.addText === 'function') {
      ctxObj.addText(`【乱入】${displayName} が現れた！！`, (ctxObj.canvas ? ctxObj.canvas.width / 2 - 170 : 260), 115, '#ffd740', 22);
    }
    if (typeof ctxObj.addParticles === 'function') {
      ctxObj.addParticles(newMon.x + newMon.w / 2, newMon.y - 60, '#ffd740', 30, 9);
    }
  }

  // ------------------------------------------------------------
  // 1. リセット時の初期化（1体目：アルヴァディオスをHP20000で配置）
  // ------------------------------------------------------------
  EXTRA.hooks.onResetGame = function (ctxObj) {
    if (typeof prevHooks.onResetGame === 'function') prevHooks.onResetGame(ctxObj);

    gauntletState.isActive = isFourCalamitiesQuest(ctxObj);
    gauntletState.stage = 0;
    gauntletState.spawnCooldown = 0;
    gauntletState.spawnedKeys = {};

    if (!gauntletState.isActive) return;

    gauntletState.stage = 1;
    gauntletState.spawnedKeys['arva'] = true;

    if (Array.isArray(ctxObj.activeMonsters) && ctxObj.activeMonsters.length > 0) {
      const first = ctxObj.activeMonsters[0];
      first.species = 'arva';
      first.key = 'arva';
      first.name = '天災龍 アルヴァディオス';
      first.displayName = '天災龍 アルヴァディオス';
      first.hp = 20000;
      first.maxHp = 20000;
      first.w = 175;
      first.h = 120;
      first.x = 640;
      first.state = 'idle';
      first.stateTimer = 35;

      ctxObj.activeMonsters.length = 1;
    }
  };

  // ------------------------------------------------------------
  // 2. 更新フック内で残りHPをチェックして1体ずつ順番に乱入させる
  // ------------------------------------------------------------
  EXTRA.hooks.onUpdateProjectiles = function (ctxObj) {
    if (typeof prevHooks.onUpdateProjectiles === 'function') prevHooks.onUpdateProjectiles(ctxObj);

    if (!gauntletState.isActive && isFourCalamitiesQuest(ctxObj)) {
      EXTRA.hooks.onResetGame(ctxObj);
    }

    if (!gauntletState.isActive || !Array.isArray(ctxObj.activeMonsters)) return;

    if (gauntletState.spawnCooldown > 0) {
      gauntletState.spawnCooldown--;
      return;
    }

    if (gauntletState.stage === 1) {
      // ① アルヴァディオスのHPが2000以下になったらネレグラディス登場
      const arva = ctxObj.activeMonsters.find(m => m.species === 'arva');
      if (arva && arva.hp <= 2000) {
        gauntletState.stage = 2;
        spawnReinforcement(ctxObj, 'neregladis', '深海龍 ネレグラディス', 110);
      }
    } else if (gauntletState.stage === 2) {
      // ② ネレグラディスのHPが2000以下になったらミラセクト登場
      const nere = ctxObj.activeMonsters.find(m => m.species === 'neregladis');
      if (nere && nere.hp <= 2000) {
        gauntletState.stage = 3;
        spawnReinforcement(ctxObj, 'mirasect', '幻影虫 ミラセクト', 660);
      }
    } else if (gauntletState.stage === 3) {
      // ③ ミラセクトのHPが2000以下になったらグラドヴォル登場
      const mira = ctxObj.activeMonsters.find(m => m.species === 'mirasect');
      if (mira && mira.hp <= 2000) {
        gauntletState.stage = 4;
        spawnReinforcement(ctxObj, 'gradvol', '轟牙獣 グラドヴォル', 130);
      }
    }
  };
})();