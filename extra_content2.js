window.EXTRA_CONTENT = window.EXTRA_CONTENT || {
  weaponTypes: [],
  weapons: { longsword: [], greatsword: [], dualblades: [] },
  armors: { head: [], chest: [], arms: [], waist: [], legs: [] },
  skillNames: {},
  quests: [],
  hooks: {}
};

(function () {
  const EC = window.EXTRA_CONTENT;
  EC.weaponTypes = EC.weaponTypes || [];
  EC.hooks = EC.hooks || {};

  // 1. 新武器種「ハンマー」を登録
  EC.weaponTypes.push({
    key: 'hammer',
    label: 'ハンマー',
    controlsHtml: `縦振り: <span class="key">J</span>/<span class="key">Z</span> ｜ 溜め叩きつけ: <span class="key">K</span>/<span class="key">X</span> ｜ アッパー: <span class="key">L</span>/<span class="key">C</span>`
  });

  // 2. ハンマーの武器データを登録
  EC.weapons.hammer = [
    { id: 'iron_hammer', type: 'hammer', name: 'アイアンハンマー', element: 'none', elementLabel: '無属性', attack: 105 },
    { id: 'zinogre_hammer', type: 'hammer', name: '王牙鎚【大雷】', element: 'thunder', elementLabel: '雷属性', attack: 165 }
  ];

  // （既存のフックがある場合に備えて退避）
  const prevAction = EC.hooks.onPlayerAction;
  const prevUpdate = EC.hooks.onUpdatePlayer;
  const prevDrawWpn = EC.hooks.onDrawPlayerWeapon;
  const prevDrawUI = EC.hooks.onDrawWeaponUI;

  // 3. キー入力アクション
  EC.hooks.onPlayerAction = function (code, h) {
    if (h.player.weaponType !== 'hammer') {
      if (prevAction) prevAction(code, h);
      return;
    }
    const p = h.player;
    if ((code === 'KeyJ' || code === 'KeyZ') && ['idle', 'run', 'jump'].includes(p.state)) {
      p.state = 'hammerSwing';
      p.stateTimer = 24;
      h.resetMonsterSwingHitFlags();
    }
  };

  // 4. 毎フレームの移動・当たり判定・ダメージ処理
  EC.hooks.onUpdatePlayer = function (h) {
    if (h.player.weaponType !== 'hammer') {
      return prevUpdate ? prevUpdate(h) : false;
    }
    const p = h.player;

    // 移動・重力の基本処理
    p.stamina = Math.min(p.maxStamina, p.stamina + 0.35);
    if (['idle', 'run', 'jump'].includes(p.state)) {
      let move = 0;
      if (h.keys['KeyA'] || h.keys['ArrowLeft']) move -= 1;
      if (h.keys['KeyD'] || h.keys['ArrowRight']) move += 1;
      if (move !== 0) {
        p.facing = move;
        p.vx = move * 4.3;
        if (p.y >= h.GROUND_Y) p.state = 'run';
      } else {
        p.vx *= 0.7;
        if (p.y >= h.GROUND_Y) p.state = 'idle';
      }
      if ((h.keys['KeyW'] || h.keys['Space'] || h.keys['ArrowUp']) && p.y >= h.GROUND_Y) {
        p.vy = -12.5;
        p.state = 'jump';
      }
    } else if (p.state === 'hammerSwing') {
      p.vx *= 0.8;
      p.stateTimer--;
      if (p.stateTimer >= 8 && p.stateTimer <= 16) {
        p.attackHitbox = {
          x: p.facing === 1 ? p.x + 15 : p.x - 95,
          y: p.y - 80,
          w: 95,
          h: 80
        };
      } else {
        p.attackHitbox = null;
      }
      if (p.stateTimer <= 0) {
        p.state = 'idle';
        p.attackHitbox = null;
      }
    } else if (p.state === 'dodge' || p.state === 'hurt') {
      p.vx *= 0.9;
      p.stateTimer--;
      if (p.stateTimer <= 0) p.state = 'idle';
    }

    p.vy += h.GRAVITY;
    p.x = Math.max(20, Math.min(h.canvas.width - 50, p.x + p.vx));
    p.y += p.vy;
    if (p.y >= h.GROUND_Y) { p.y = h.GROUND_Y; p.vy = 0; }

    // ヒット判定＆ダメージ計算（既存の属性・スキル計算をそのまま流用可能！）
    if (p.attackHitbox) {
      const wpn = h.getCurrentWeapon();
      for (const m of h.activeMonsters) {
        if (m.hp <= 0 || m.hasHitThisSwingByPlayer) continue;
        if (h.rectIntersect(p.attackHitbox, h.getMonsterBody(m))) {
          m.hasHitThisSwingByPlayer = true;
          m.flashTimer = 6;
          const res = h.computeWeaponHitDamage(42, wpn, 1.0, m.species);
          m.hp -= res.dmg;
          h.screenShake = 6;
          h.addText(res.dmg, m.x + 40, m.y - 60, '#ffd700', 24);
          h.addParticles(m.x + 40, m.y - 45, '#ffaa00', 14, 6);
        }
      }
    }
    return true; // trueを返すと標準のupdatePlayerをスキップ
  };

  // 5. 武器のグラフィック描画
  EC.hooks.onDrawPlayerWeapon = function (handX, handY, h) {
    if (h.player.weaponType !== 'hammer') {
      if (prevDrawWpn) prevDrawWpn(handX, handY, h);
      return;
    }
    const ctx = h.ctx;
    const p = h.player;
    ctx.save();
    ctx.translate(handX, handY);
    ctx.rotate(p.state === 'hammerSwing' ? (p.facing === 1 ? 0.2 : Math.PI - 0.2) : (p.facing === 1 ? -2.2 : -0.9));
    // 柄
    ctx.fillStyle = '#8d6e63';
    ctx.fillRect(0, -3, 55, 6);
    // ハンマーの頭
    ctx.fillStyle = '#78909c';
    ctx.fillRect(45, -18, 26, 36);
    ctx.restore();
  };

  // 6. ゲージUI描画
  EC.hooks.onDrawWeaponUI = function (h) {
    if (h.player.weaponType !== 'hammer') {
      if (prevDrawUI) prevDrawUI(h);
      return;
    }
    // 独自のゲージがあればここに描画（不要なら空でもOK）
  };
})();
// ==========================================
// 新武器種：片手剣（Sword & Shield）追加モジュール
// ==========================================
(function() {
  const EC = window.EXTRA_CONTENT = window.EXTRA_CONTENT || {};
  EC.weaponTypes = EC.weaponTypes || [];
  EC.weapons = EC.weapons || {};
  EC.hooks = EC.hooks || {};

  // 1. 武器種登録
  EC.weaponTypes.push({
    key: 'sns',
    label: '片手剣',
    controlsHtml: '斬り: <span class="key">J</span>/<span class="key">Z</span> ｜ 盾攻撃: <span class="key">K</span>/<span class="key">X</span> ｜ ガード: <span class="key">L</span>/<span class="key">C</span>（抜刀アイテム可）'
  });

  // 2. 片手剣ラインナップ登録
  EC.weapons.sns = [
    { id: 'hunter_knife', type: 'sns', name: 'ハンターナイフ', element: 'none', elementLabel: '無属性', attack: 85 },
    { id: 'corona_sns', type: 'sns', name: 'コロナ', element: 'fire', elementLabel: '火属性', attack: 120 },
    { id: 'zinogre_sns', type: 'sns', name: '王牙剣【折雷】', element: 'thunder', elementLabel: '雷属性', attack: 125 },
    { id: 'barioth_sns', type: 'sns', name: 'ハイフロストエッジ', element: 'ice', elementLabel: '氷属性', attack: 135 },
    { id: 'gore_sns', type: 'sns', name: 'THEディテクター', element: 'dragon', elementLabel: '龍属性', attack: 155 }
  ];

  // 既存フック（ハンマー等）を消さないように退避
  const prevOnPlayerAction = EC.hooks.onPlayerAction;
  const prevOnUpdatePlayer = EC.hooks.onUpdatePlayer;
  const prevOnDrawPlayerWeapon = EC.hooks.onDrawPlayerWeapon;
  const prevOnDrawWeaponUI = EC.hooks.onDrawWeaponUI;
  const prevOnResetGame = EC.hooks.onResetGame;
  const prevOnSwitchWeapon = EC.hooks.onSwitchWeapon;

  // 片手剣専用ステータス初期化
  function initSnsState(player) {
    if (typeof player.snsGuardTimer !== 'number') player.snsGuardTimer = 0;
    if (typeof player.snsJustGuardWindow !== 'number') player.snsJustGuardWindow = 0;
    if (typeof player.snsCounterTimer !== 'number') player.snsCounterTimer = 0;
  }

  // 3. アクション入力フック
  EC.hooks.onPlayerAction = function(code, ctx) {
    const { player, keys, addText, addParticles, resetMonsterSwingHitFlags } = ctx;
    if (player.weaponType !== 'sns') {
      if (prevOnPlayerAction) return prevOnPlayerAction(code, ctx);
      return;
    }
    initSnsState(player);

    // 片手剣の固有能力：攻撃やガードの硬直中でも回復・解毒アイテム使用可能！
    if (['snsSlash', 'snsBash', 'snsGuard', 'snsCounter'].includes(player.state)) {
      if (code === 'KeyH' && player.potions > 0 && player.hp < player.maxHp) {
        player.potions--;
        player.hp = Math.min(player.maxHp, player.hp + 45);
        addText('+45 抜刀回復!', player.x, player.y - 75, '#4eff4e', 18);
        addParticles(player.x + 15, player.y - 30, '#4eff4e', 12, 3);
      }
      if (code === 'KeyB' && player.megaPotions > 0 && player.hp < player.maxHp) {
        player.megaPotions--;
        player.hp = Math.min(player.maxHp, player.hp + 68);
        addText('+68 抜刀大回復!', player.x - 6, player.y - 78, '#00e676', 20);
        addParticles(player.x + 15, player.y - 30, '#00e676', 18, 4);
      }
      if (code === 'KeyG' && player.antidotes > 0 && player.poisonTimer > 0) {
        player.antidotes--;
        player.poisonTimer = 0;
        addText('抜刀毒解除！', player.x, player.y - 75, '#55aaff', 18);
        addParticles(player.x + 15, player.y - 30, '#55aaff', 12, 3);
      }
    }

    // J / Z : 回転斬り（素早い踏み込み斬り）
    if ((code === 'KeyJ' || code === 'KeyZ') && ['idle', 'run', 'jump', 'snsBash'].includes(player.state)) {
      player.state = 'snsSlash';
      player.stateTimer = 14;
      resetMonsterSwingHitFlags();
      player.vx = player.facing * 3.8;
    }

    // K / X : シールドバッシュ（盾殴り・高怯み値）
    if ((code === 'KeyK' || code === 'KeyX') && ['idle', 'run', 'jump', 'snsSlash'].includes(player.state)) {
      player.state = 'snsBash';
      player.stateTimer = 18;
      resetMonsterSwingHitFlags();
      player.vx = player.facing * 4.5;
    }

    // L / C : ガード構え（最初の10Fはジャストガード受付）
    if ((code === 'KeyL' || code === 'KeyC') && ['idle', 'run', 'snsSlash', 'snsBash'].includes(player.state) && player.stamina >= 15) {
      player.state = 'snsGuard';
      player.stateTimer = 32;
      player.snsJustGuardWindow = 10;
      player.attackHitbox = null;
      player.vx = 0;
      addParticles(player.x + (player.facing === 1 ? 26 : 4), player.y - 35, '#ffd54f', 6, 2);
    }
  };

  // 4. プレイヤー更新フック（ガード判定・攻撃判定）
  EC.hooks.onUpdatePlayer = function(ctx) {
    const {
      canvas, GROUND_Y, GRAVITY, player, activeMonsters, keys,
      addText, addParticles, rectIntersect, getMonsterBody,
      getCurrentWeapon, computeWeaponHitDamage, resetMonsterSwingHitFlags
    } = ctx;

    if (player.weaponType !== 'sns') {
      if (prevOnUpdatePlayer) return prevOnUpdatePlayer(ctx);
      return false;
    }
    initSnsState(player);

    if (player.state !== 'dodge') {
      player.stamina = Math.min(player.maxStamina, player.stamina + 0.4);
    }
    if (player.bubblyBuffTimer > 0) player.bubblyBuffTimer--;
    if (player.burnTimer > 0) {
      player.burnTimer--;
      if (player.burnTimer % 30 === 0) player.hp = Math.max(1, player.hp - 2);
    }
    if (player.thunderBlightTimer > 0) player.thunderBlightTimer--;
    if (player.bubbleTimer > 0) player.bubbleTimer--;
    if (player.poisonTimer > 0) {
      player.poisonTimer--;
      if (player.poisonTimer % 35 === 0) player.hp = Math.max(1, player.hp - 2);
    }
    if (player.invulnTimer > 0) player.invulnTimer--;

    const isBubbled = player.bubbleTimer > 0;

    if (player.paralysisTimer > 0) {
      player.paralysisTimer--;
      player.vx *= 0.7;
      player.attackHitbox = null;
      if (player.state !== 'hurt') player.state = 'idle';
    } else if (['idle', 'run', 'jump'].includes(player.state)) {
      let move = 0;
      if (keys['KeyA'] || keys['ArrowLeft']) move -= 1;
      if (keys['KeyD'] || keys['ArrowRight']) move += 1;
      const maxSpeed = 5.4; // 片手剣は機動力が高い
      if (move !== 0) {
        player.facing = move;
        player.vx = isBubbled ? Math.max(-maxSpeed * 1.25, Math.min(maxSpeed * 1.25, player.vx + move * 0.45)) : move * maxSpeed;
        if (player.y >= GROUND_Y) player.state = 'run';
      } else {
        player.vx *= isBubbled ? 0.95 : 0.7;
        if (Math.abs(player.vx) < 0.08) player.vx = 0;
        if (player.y >= GROUND_Y) player.state = 'idle';
      }
      if ((keys['KeyW'] || keys['Space'] || keys['ArrowUp']) && player.y >= GROUND_Y) {
        player.vy = -12.8;
        player.state = 'jump';
      }
    } else if (player.state === 'snsSlash') {
      player.vx *= 0.84;
      player.stateTimer--;
      if (player.stateTimer >= 4 && player.stateTimer <= 11) {
        player.attackHitbox = {
          x: player.facing === 1 ? player.x + 16 : player.x - 74,
          y: player.y - 68,
          w: 74,
          h: 68
        };
      } else {
        player.attackHitbox = null;
      }
      if (player.stateTimer <= 0) {
        player.state = 'idle';
        player.attackHitbox = null;
      }
    } else if (player.state === 'snsBash') {
      player.vx *= 0.85;
      player.stateTimer--;
      if (player.stateTimer >= 5 && player.stateTimer <= 13) {
        player.attackHitbox = {
          x: player.facing === 1 ? player.x + 15 : player.x - 62,
          y: player.y - 62,
          w: 62,
          h: 62
        };
      } else {
        player.attackHitbox = null;
      }
      if (player.stateTimer <= 0) {
        player.state = 'idle';
        player.attackHitbox = null;
      }
    } else if (player.state === 'snsGuard') {
      player.vx *= 0.6;
      player.stateTimer--;
      if (player.snsJustGuardWindow > 0) player.snsJustGuardWindow--;

      // ガード中にモンスターの攻撃判定に触れたらガード成立！
      const pBox = { x: player.x, y: player.y - player.h, w: player.w, h: player.h };
      for (const m of activeMonsters) {
        if (m.hp > 0 && m.attackHitbox && !m.hasHitThisAttack && rectIntersect(m.attackHitbox, pBox)) {
          m.hasHitThisAttack = true;
          if (player.snsJustGuardWindow > 0) {
            // ジャストガード成功！ノーダメージ＋即座にカウンター斬りへ移行
            player.invulnTimer = 25;
            player.state = 'snsCounter';
            player.stateTimer = 18;
            resetMonsterSwingHitFlags();
            player.vx = player.facing * 7.5;
            ctx.screenShake = 8;
            addText('ジャストガード！！', player.x - 20, player.y - 82, '#ffd700', 20);
            addParticles(player.x + 15, player.y - 35, '#ffd700', 22, 6);
          } else {
            // 通常ガード：ダメージ大幅軽減＆ノックバック
            player.stamina = Math.max(0, player.stamina - 15);
            player.hp = Math.max(1, player.hp - 5);
            player.invulnTimer = 30;
            player.vx = -player.facing * 5.5;
            ctx.screenShake = 4;
            addText('ガード！ (-5)', player.x - 10, player.y - 72, '#90caf9', 17);
            addParticles(player.x + 15, player.y - 35, '#90caf9', 14, 4);
          }
          break;
        }
      }

      if (player.state === 'snsGuard' && player.stateTimer <= 0) {
        player.state = 'idle';
      }
    } else if (player.state === 'snsCounter') {
      player.vx *= 0.86;
      player.stateTimer--;
      if (player.stateTimer >= 5 && player.stateTimer <= 15) {
        player.attackHitbox = {
          x: player.facing === 1 ? player.x + 15 : player.x - 95,
          y: player.y - 80,
          w: 95,
          h: 80
        };
      } else {
        player.attackHitbox = null;
      }
      if (player.stateTimer <= 0) {
        player.state = 'idle';
        player.attackHitbox = null;
      }
    } else if (player.state === 'dodge' || player.state === 'hurt') {
      player.vx *= isBubbled ? 0.94 : 0.9;
      player.stateTimer--;
      if (player.stateTimer <= 0) player.state = 'idle';
    }

    player.vy += GRAVITY;
    player.x += player.vx;
    player.y += player.vy;
    if (player.y >= GROUND_Y) {
      player.y = GROUND_Y;
      player.vy = 0;
    }
    player.x = Math.max(20, Math.min(canvas.width - 50, player.x));

    // 攻撃ヒット処理
    if (player.attackHitbox) {
      const weapon = getCurrentWeapon();
      const sparkColors = { fire: '#ff6d00', water: '#4fc3f7', thunder: '#00e5ff', ice: '#80deea', dragon: '#d500f9', none: '#fff' };
      const hitSparkColor = sparkColors[weapon.element] || '#fff';

      for (const m of activeMonsters) {
        if (m.hp <= 0 || m.hasHitThisSwingByPlayer) continue;
        if (!rectIntersect(player.attackHitbox, getMonsterBody(m))) continue;

        m.hasHitThisSwingByPlayer = true;
        m.flashTimer = 6;
        player.hasHitThisSwing = true;

        let result;
        let staggerChance = 0.10;
        if (player.state === 'snsBash') {
          // 盾殴りは無属性打撃扱いだが、怯み率が30%と超高い！
          result = computeWeaponHitDamage(26, { ...weapon, element: 'none' }, 1.0, m.species);
          staggerChance = 0.30;
          ctx.screenShake = Math.max(ctx.screenShake, 4);
          addParticles(m.x + 40, m.y - 45, '#ffd54f', 14, 6);
        } else if (player.state === 'snsCounter') {
          // ジャストガード反撃斬り
          result = computeWeaponHitDamage(54, weapon, 1.15, m.species);
          staggerChance = 0.25;
          ctx.screenShake = Math.max(ctx.screenShake, 7);
          addParticles(m.x + 40, m.y - 45, '#ffd700', 20, 7);
        } else {
          // 通常斬り（属性ダメージ反映率が高い）
          result = computeWeaponHitDamage(25, weapon, 1.05, m.species);
          addParticles(m.x + 40, m.y - 45, hitSparkColor, 11, 5);
        }

        m.hp -= result.dmg;
        const dmgColor = player.state === 'snsBash' ? '#ffd54f' : (result.elemMult >= 1.25 ? '#00e5ff' : '#ffd700');
        addText(result.dmg, m.x + 40 + (Math.random() * 18 - 9), m.y - 60, dmgColor, player.state === 'snsCounter' ? 25 : 21);

        if (m.hp <= 0) {
          m.hp = 0;
          m.attackHitbox = null;
          addText('部位破壊・討伐！', m.x + 10, m.y - 95, '#ffd700', 22);
          addParticles(m.x + m.w / 2, m.y - 45, '#ffd700', 24, 7);
          continue;
        }

        if (Math.random() < staggerChance && m.state !== 'stagger') {
          m.state = 'stagger';
          m.stateTimer = 50;
          m.isFlying = false;
          m.isCharged = false;
          m.somersaultAngle = 0;
          m.attackHitbox = null;
          addText(player.state === 'snsBash' ? '盾スタン・怯み！' : '怯み！', m.x + 25, m.y - 100, '#ffaa00', 24);
        }
      }
    }

    return true; // 標準updatePlayerをスキップ
  };

  // 5. 武器＆盾の描画フック
  EC.hooks.onDrawPlayerWeapon = function(handX, handY, hookCtx) {
    const { ctx, player, getCurrentWeapon } = hookCtx;
    if (player.weaponType !== 'sns') {
      if (prevOnDrawPlayerWeapon) return prevOnDrawPlayerWeapon(handX, handY, hookCtx);
      return;
    }
    initSnsState(player);

    const wpn = getCurrentWeapon();
    const elemColors = {
      fire: '#ff6d00',
      thunder: '#00e5ff',
      ice: '#80deea',
      dragon: '#d500f9',
      none: '#cfd8dc'
    };
    const bladeCol = elemColors[wpn.element] || '#cfd8dc';

    ctx.save();
    // 片手剣（刀身）の描画
    const isSlashing = player.state === 'snsSlash' || player.state === 'snsCounter';
    ctx.strokeStyle = bladeCol;
    ctx.lineWidth = 4;
    if (wpn.element !== 'none' || player.state === 'snsCounter') {
      ctx.shadowColor = player.state === 'snsCounter' ? '#ffd700' : bladeCol;
      ctx.shadowBlur = 10;
    }
    ctx.beginPath();
    ctx.moveTo(handX, handY);
    if (isSlashing) {
      ctx.lineTo(handX + player.facing * 56, handY - 6);
    } else {
      ctx.lineTo(handX - player.facing * 32, handY - 30);
    }
    ctx.stroke();

    // 斬撃エフェクト
    if (isSlashing) {
      ctx.fillStyle = player.state === 'snsCounter' ? 'rgba(255, 215, 0, 0.38)' : 'rgba(255, 255, 255, 0.28)';
      ctx.beginPath();
      ctx.arc(handX, handY, 64, player.facing === 1 ? -0.7 : Math.PI - 0.5, player.facing === 1 ? 0.5 : Math.PI + 0.7);
      ctx.lineTo(handX, handY);
      ctx.fill();
    }

    // 盾（シールド）の描画
    const isShieldFront = player.state === 'snsGuard' || player.state === 'snsBash';
    const shieldX = isShieldFront
      ? (player.facing === 1 ? handX + 10 : handX - 24)
      : (player.facing === 1 ? handX - 14 : handX + 2);
    const shieldY = handY - 14;

    ctx.fillStyle = player.state === 'snsGuard' && player.snsJustGuardWindow > 0 ? '#ffd700' : '#78909c';
    ctx.strokeStyle = '#eceff1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(shieldX, shieldY, 14, 24, 4);
    ctx.fill();
    ctx.stroke();

    // ガード中のバリアリング表示
    if (player.state === 'snsGuard') {
      ctx.strokeStyle = player.snsJustGuardWindow > 0 ? 'rgba(255, 215, 0, 0.85)' : 'rgba(144, 202, 249, 0.65)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(shieldX + 7, shieldY + 12, 20, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  };

  // 6. 武器専用UIバーの描画フック（ジャストガード受付・抜刀アイテム可表示）
  EC.hooks.onDrawWeaponUI = function(hookCtx) {
    const { ctx, player } = hookCtx;
    if (player.weaponType !== 'sns') {
      if (prevOnDrawWeaponUI) return prevOnDrawWeaponUI(hookCtx);
      return;
    }
    initSnsState(player);

    ctx.fillStyle = '#222';
    ctx.fillRect(20, 56, 180, 12);
    if (player.state === 'snsGuard') {
      ctx.fillStyle = player.snsJustGuardWindow > 0 ? '#ffd700' : '#4fc3f7';
      ctx.fillRect(20, 56, 180 * (player.stateTimer / 32), 12);
    } else {
      ctx.fillStyle = '#66bb6a';
      ctx.fillRect(20, 56, 180, 12);
    }
    ctx.strokeStyle = '#a5d6a7';
    ctx.strokeRect(20, 56, 180, 12);
  };

  // 7. リセット・武器切替フック
  EC.hooks.onResetGame = function(hookCtx) {
    initSnsState(hookCtx.player);
    hookCtx.player.snsGuardTimer = 0;
    hookCtx.player.snsJustGuardWindow = 0;
    if (prevOnResetGame) prevOnResetGame(hookCtx);
  };

  EC.hooks.onSwitchWeapon = function(hookCtx) {
    initSnsState(hookCtx.player);
    if (prevOnSwitchWeapon) prevOnSwitchWeapon(hookCtx);
  };
})();
// ==========================================
// 新武器種：ランス（Lance）追加モジュール（全攻撃カウンター対応版）
// ==========================================
(function() {
  const EC = window.EXTRA_CONTENT = window.EXTRA_CONTENT || {};
  EC.weaponTypes = EC.weaponTypes || [];
  EC.weapons = EC.weapons || {};
  EC.hooks = EC.hooks || {};

  // 1. 武器種登録
  EC.weaponTypes.push({
    key: 'lance',
    label: 'ランス',
    controlsHtml: '三段突き: <span class="key">J</span>/<span class="key">Z</span> ｜ カウンターガード: <span class="key">K</span>/<span class="key">X</span> ｜ 突進: <span class="key">L</span>/<span class="key">C</span>'
  });

  // 2. ランスラインナップ登録
  EC.weapons.lance = [
    { id: 'iron_lance', type: 'lance', name: 'アイアンランス', element: 'none', elementLabel: '無属性', attack: 90 },
    { id: 'rathalos_lance', type: 'lance', name: 'レッドテイル', element: 'fire', elementLabel: '火属性', attack: 125 },
    { id: 'zinogre_lance', type: 'lance', name: '王牙槍【若雷】', element: 'thunder', elementLabel: '雷属性', attack: 130 },
    { id: 'barioth_lance', type: 'lance', name: 'セイバートゥース', element: 'ice', elementLabel: '氷属性', attack: 140 },
    { id: 'gore_lance', type: 'lance', name: 'ハイエストofグレイブ', element: 'dragon', elementLabel: '龍属性', attack: 160 }
  ];

  // 既存フック（ハンマー・片手剣等）を退避
  const prevOnPlayerAction = EC.hooks.onPlayerAction;
  const prevOnUpdatePlayer = EC.hooks.onUpdatePlayer;
  const prevOnDrawPlayerWeapon = EC.hooks.onDrawPlayerWeapon;
  const prevOnDrawWeaponUI = EC.hooks.onDrawWeaponUI;
  const prevOnResetGame = EC.hooks.onResetGame;
  const prevOnSwitchWeapon = EC.hooks.onSwitchWeapon;

  function initLanceState(player) {
    if (typeof player.lanceCombo !== 'number') player.lanceCombo = 0;
    if (typeof player.lanceComboWindow !== 'number') player.lanceComboWindow = 0;
  }

  // カウンターガード成立時の共通処理（直接攻撃・飛び道具のどちらからでも呼ばれる）
  function triggerLanceCounter(ctx) {
    const { player, addText, addParticles, resetMonsterSwingHitFlags } = ctx;
    if (player.state !== 'lanceGuard') return false;

    player.stamina = Math.max(0, player.stamina - 15);
    player.invulnTimer = 32;
    player.state = 'lanceCounter';
    player.stateTimer = 22;
    resetMonsterSwingHitFlags();
    player.vx = player.facing * 8.2;
    ctx.screenShake = 9;
    addText('カウンターガード！！', player.x - 24, player.y - 84, '#00e5ff', 21);
    addParticles(player.x + 15, player.y - 35, '#00e5ff', 26, 6);
    return true;
  }

  // 3. アクション入力フック
  EC.hooks.onPlayerAction = function(code, ctx) {
    const { player, addParticles, resetMonsterSwingHitFlags } = ctx;
    if (player.weaponType !== 'lance') {
      if (prevOnPlayerAction) return prevOnPlayerAction(code, ctx);
      return;
    }
    initLanceState(player);

    // J / Z : 三段突き（連続入力で1段→2段→3段目フィニッシュへ派生）
    if ((code === 'KeyJ' || code === 'KeyZ') &&
        (['idle', 'run', 'jump'].includes(player.state) || (player.state === 'lanceThrust' && player.stateTimer <= 8))) {
      if (player.state === 'lanceThrust' || player.lanceComboWindow > 0) {
        player.lanceCombo = (player.lanceCombo + 1) % 3;
      } else {
        player.lanceCombo = 0;
      }
      player.state = 'lanceThrust';
      player.stateTimer = player.lanceCombo === 2 ? 20 : 15;
      player.lanceComboWindow = 32;
      resetMonsterSwingHitFlags();
      player.vx = player.facing * (player.lanceCombo === 2 ? 4.2 : 2.4);
    }

    // K / X : カウンターガード構え（水色バリアとゲージ表示中、全攻撃に対してカウンター可能）
    if ((code === 'KeyK' || code === 'KeyX') &&
        ['idle', 'run', 'lanceThrust'].includes(player.state) && player.stamina >= 15) {
      player.state = 'lanceGuard';
      player.stateTimer = 48; // 0.8秒間、水色バリアとゲージを展開
      player.lanceCombo = 0;
      player.attackHitbox = null;
      player.vx = 0;
      addParticles(player.x + (player.facing === 1 ? 26 : 4), player.y - 35, '#80deea', 8, 2.5);
    }

    // L / C : ランス突進（多段ヒット＋フィニッシュ突き）
    if ((code === 'KeyL' || code === 'KeyC') &&
        ['idle', 'run', 'lanceThrust', 'lanceGuard'].includes(player.state) && player.stamina >= 25) {
      player.state = 'lanceCharge';
      player.stateTimer = 34;
      player.stamina -= 25;
      player.lanceCombo = 0;
      resetMonsterSwingHitFlags();
      player.vx = player.facing * 10.5;
    }
  };

  // 4. プレイヤー更新フック
  EC.hooks.onUpdatePlayer = function(ctx) {
    const {
      canvas, GROUND_Y, GRAVITY, player, activeMonsters, keys,
      addText, addParticles, rectIntersect, getMonsterBody,
      getCurrentWeapon, computeWeaponHitDamage, resetMonsterSwingHitFlags
    } = ctx;

    if (player.weaponType !== 'lance') {
      if (prevOnUpdatePlayer) return prevOnUpdatePlayer(ctx);
      return false;
    }
    initLanceState(player);

    if (player.lanceComboWindow > 0) {
      player.lanceComboWindow--;
      if (player.lanceComboWindow <= 0 && player.state !== 'lanceThrust') {
        player.lanceCombo = 0;
      }
    }

    if (player.state !== 'dodge' && player.state !== 'lanceCharge') {
      player.stamina = Math.min(player.maxStamina, player.stamina + 0.38);
    }
    if (player.bubblyBuffTimer > 0) player.bubblyBuffTimer--;
    if (player.burnTimer > 0) {
      player.burnTimer--;
      if (player.burnTimer % 30 === 0) player.hp = Math.max(1, player.hp - 2);
    }
    if (player.thunderBlightTimer > 0) player.thunderBlightTimer--;
    if (player.bubbleTimer > 0) player.bubbleTimer--;
    if (player.poisonTimer > 0) {
      player.poisonTimer--;
      if (player.poisonTimer % 35 === 0) player.hp = Math.max(1, player.hp - 2);
    }
    if (player.invulnTimer > 0) player.invulnTimer--;

    const isBubbled = player.bubbleTimer > 0;

    if (player.paralysisTimer > 0) {
      player.paralysisTimer--;
      player.vx *= 0.7;
      player.attackHitbox = null;
      if (player.state !== 'hurt') player.state = 'idle';
    } else if (['idle', 'run', 'jump'].includes(player.state)) {
      let move = 0;
      if (keys['KeyA'] || keys['ArrowLeft']) move -= 1;
      if (keys['KeyD'] || keys['ArrowRight']) move += 1;
      const maxSpeed = 3.6;
      if (move !== 0) {
        player.facing = move;
        player.vx = isBubbled ? Math.max(-maxSpeed * 1.25, Math.min(maxSpeed * 1.25, player.vx + move * 0.4)) : move * maxSpeed;
        if (player.y >= GROUND_Y) player.state = 'run';
      } else {
        player.vx *= isBubbled ? 0.95 : 0.7;
        if (Math.abs(player.vx) < 0.08) player.vx = 0;
        if (player.y >= GROUND_Y) player.state = 'idle';
      }
      if ((keys['KeyW'] || keys['Space'] || keys['ArrowUp']) && player.y >= GROUND_Y) {
        player.vy = -12.0;
        player.state = 'jump';
      }
    } else if (player.state === 'lanceThrust') {
      player.vx *= 0.82;
      player.stateTimer--;
      const reach = player.lanceCombo === 2 ? 122 : 108;
      if (player.stateTimer >= 4 && player.stateTimer <= 13) {
        player.attackHitbox = {
          x: player.facing === 1 ? player.x + 15 : player.x - reach,
          y: player.y - 58,
          w: reach,
          h: 44
        };
      } else {
        player.attackHitbox = null;
      }
      if (player.stateTimer <= 0) {
        player.state = 'idle';
        player.attackHitbox = null;
      }
    } else if (player.state === 'lanceGuard') {
      player.vx *= 0.5;
      player.stateTimer--;

      // ガード中にモンスターの直接攻撃判定に触れた場合も即カウンター
      const pBox = { x: player.x - 4, y: player.y - player.h, w: player.w + 8, h: player.h };
      for (const m of activeMonsters) {
        if (m.hp > 0 && m.attackHitbox && !m.hasHitThisAttack && rectIntersect(m.attackHitbox, pBox)) {
          m.hasHitThisAttack = true;
          triggerLanceCounter(ctx);
          break;
        }
      }

      if (player.state === 'lanceGuard' && player.stateTimer <= 0) {
        player.state = 'idle';
      }
    } else if (player.state === 'lanceCounter') {
      player.vx *= 0.86;
      player.stateTimer--;
      if (player.stateTimer >= 5 && player.stateTimer <= 18) {
        player.attackHitbox = {
          x: player.facing === 1 ? player.x + 15 : player.x - 135,
          y: player.y - 68,
          w: 135,
          h: 56
        };
      } else {
        player.attackHitbox = null;
      }
      if (player.stateTimer <= 0) {
        player.state = 'idle';
        player.attackHitbox = null;
      }
    } else if (player.state === 'lanceCharge') {
      player.stateTimer--;
      if (player.stateTimer > 8) {
        player.vx = player.facing * 10.2;
        if (player.stateTimer % 8 === 0) {
          resetMonsterSwingHitFlags();
          addParticles(player.x + 15, GROUND_Y - 12, '#cfd8dc', 4, 3);
        }
        player.attackHitbox = {
          x: player.facing === 1 ? player.x + 10 : player.x - 95,
          y: player.y - 58,
          w: 105,
          h: 48
        };
      } else {
        if (player.stateTimer === 8) {
          resetMonsterSwingHitFlags();
        }
        player.vx *= 0.78;
        player.attackHitbox = {
          x: player.facing === 1 ? player.x + 15 : player.x - 122,
          y: player.y - 62,
          w: 122,
          h: 50
        };
      }
      if (player.stateTimer <= 0) {
        player.state = 'idle';
        player.attackHitbox = null;
      }
    } else if (player.state === 'dodge' || player.state === 'hurt') {
      player.vx *= isBubbled ? 0.94 : 0.9;
      player.stateTimer--;
      if (player.stateTimer <= 0) player.state = 'idle';
    }

    player.vy += GRAVITY;
    player.x += player.vx;
    player.y += player.vy;
    if (player.y >= GROUND_Y) {
      player.y = GROUND_Y;
      player.vy = 0;
    }
    player.x = Math.max(20, Math.min(canvas.width - 50, player.x));

    // 攻撃ヒット処理
    if (player.attackHitbox) {
      const weapon = getCurrentWeapon();
      const sparkColors = { fire: '#ff6d00', water: '#4fc3f7', thunder: '#00e5ff', ice: '#80deea', dragon: '#d500f9', none: '#fff' };
      const hitSparkColor = sparkColors[weapon.element] || '#fff';

      for (const m of activeMonsters) {
        if (m.hp <= 0 || m.hasHitThisSwingByPlayer) continue;
        if (!rectIntersect(player.attackHitbox, getMonsterBody(m))) continue;

        m.hasHitThisSwingByPlayer = true;
        m.flashTimer = 6;
        player.hasHitThisSwing = true;

        let mv = 26;
        let staggerChance = 0.12;
        let textSize = 21;

        if (player.state === 'lanceThrust') {
          mv = [25, 29, 44][player.lanceCombo];
          staggerChance = player.lanceCombo === 2 ? 0.22 : 0.11;
          textSize = player.lanceCombo === 2 ? 24 : 20;
        } else if (player.state === 'lanceCounter') {
          mv = 58;
          staggerChance = 0.28;
          textSize = 26;
          ctx.screenShake = Math.max(ctx.screenShake, 7);
        } else if (player.state === 'lanceCharge') {
          if (player.stateTimer > 8) {
            mv = 15;
            staggerChance = 0.06;
            textSize = 18;
          } else {
            mv = 48;
            staggerChance = 0.25;
            textSize = 25;
            ctx.screenShake = Math.max(ctx.screenShake, 7);
          }
        }

        const result = computeWeaponHitDamage(mv, weapon, 1.05, m.species);
        m.hp -= result.dmg;

        const dmgColor = player.state === 'lanceCounter' ? '#00e5ff' : (result.elemMult >= 1.25 ? '#80ffff' : '#ffd700');
        addParticles(m.x + 40, m.y - 45, hitSparkColor, 12, 5);
        addText(result.dmg, m.x + 40 + (Math.random() * 18 - 9), m.y - 60, dmgColor, textSize);

        if (m.hp <= 0) {
          m.hp = 0;
          m.attackHitbox = null;
          addText('部位破壊・討伐！', m.x + 10, m.y - 95, '#ffd700', 22);
          addParticles(m.x + m.w / 2, m.y - 45, '#ffd700', 24, 7);
          continue;
        }

        if (Math.random() < staggerChance && m.state !== 'stagger') {
          m.state = 'stagger';
          m.stateTimer = 50;
          m.isFlying = false;
          m.isCharged = false;
          m.somersaultAngle = 0;
          m.attackHitbox = null;
          addText('怯み！', m.x + 25, m.y - 100, '#ffaa00', 24);
        }
      }
    }

    return true;
  };

  // 5. 長槍＆タワーシールドの描画フック
  EC.hooks.onDrawPlayerWeapon = function(handX, handY, hookCtx) {
    const { ctx, player, getCurrentWeapon } = hookCtx;
    if (player.weaponType !== 'lance') {
      if (prevOnDrawPlayerWeapon) return prevOnDrawPlayerWeapon(handX, handY, hookCtx);
      return;
    }
    initLanceState(player);

    const wpn = getCurrentWeapon();
    const elemColors = {
      fire: '#ff6d00',
      thunder: '#00e5ff',
      ice: '#80deea',
      dragon: '#d500f9',
      none: '#cfd8dc'
    };
    const lanceCol = elemColors[wpn.element] || '#cfd8dc';

    ctx.save();
    const isThrusting = ['lanceThrust', 'lanceCounter', 'lanceCharge'].includes(player.state);
    const tipX = isThrusting
      ? handX + player.facing * (player.lanceCombo === 2 || player.state === 'lanceCounter' ? 118 : 98)
      : handX + player.facing * 52;
    const tipY = isThrusting ? handY - 2 : handY - 34;

    if (wpn.element !== 'none' || player.state === 'lanceCounter' || player.state === 'lanceCharge') {
      ctx.shadowColor = player.state === 'lanceCounter' ? '#00e5ff' : lanceCol;
      ctx.shadowBlur = 12;
    }

    ctx.fillStyle = lanceCol;
    ctx.beginPath();
    ctx.moveTo(handX - player.facing * 12, handY + (isThrusting ? 0 : 8));
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(handX - player.facing * 12, handY - (isThrusting ? 8 : -2));
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(handX, handY - 2);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();

    if (isThrusting) {
      ctx.strokeStyle = player.state === 'lanceCounter' ? 'rgba(0, 229, 255, 0.7)' : 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(tipX - player.facing * 26, tipY - 12);
      ctx.lineTo(tipX + player.facing * 10, tipY);
      ctx.lineTo(tipX - player.facing * 26, tipY + 12);
      ctx.stroke();
    }

    const shieldFront = player.state === 'lanceGuard' || player.state === 'lanceCharge';
    const shieldX = shieldFront
      ? (player.facing === 1 ? handX + 8 : handX - 26)
      : (player.facing === 1 ? handX - 18 : handX + 2);
    const shieldY = handY - 22;

    ctx.fillStyle = player.state === 'lanceGuard' ? '#00acc1' : '#546e7a';
    ctx.strokeStyle = '#eceff1';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(shieldX, shieldY, 18, 38, 4);
    ctx.fill();
    ctx.stroke();

    // 水色の全周囲カウンターバリア表示
    if (player.state === 'lanceGuard') {
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.9)';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(handX, handY - 4, 34, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(0, 229, 255, 0.14)';
      ctx.beginPath();
      ctx.arc(handX, handY - 4, 34, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  };

  // 6. 武器専用UIバー（水色カウンター受付ゲージ＆三段突き表示）
  EC.hooks.onDrawWeaponUI = function(hookCtx) {
    const { ctx, player } = hookCtx;
    if (player.weaponType !== 'lance') {
      if (prevOnDrawWeaponUI) return prevOnDrawWeaponUI(hookCtx);
      return;
    }
    initLanceState(player);

    ctx.fillStyle = '#222';
    ctx.fillRect(20, 56, 180, 12);

    if (player.state === 'lanceGuard') {
      ctx.fillStyle = '#00e5ff';
      ctx.fillRect(20, 56, 180 * (player.stateTimer / 48), 12);
    } else if (player.state === 'lanceCharge') {
      ctx.fillStyle = '#ff9100';
      ctx.fillRect(20, 56, 180 * (player.stateTimer / 34), 12);
    } else {
      const activeBlocks = (player.state === 'lanceThrust' || player.lanceComboWindow > 0) ? (player.lanceCombo + 1) : 0;
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = i < activeBlocks ? (i === 2 ? '#ff5252' : '#4dd0e1') : '#37474f';
        ctx.fillRect(22 + i * 59, 58, 56, 8);
      }
    }
    ctx.strokeStyle = '#80deea';
    ctx.strokeRect(20, 56, 180, 12);
  };

  // 7. リセット・武器切替フック
  EC.hooks.onResetGame = function(hookCtx) {
    initLanceState(hookCtx.player);
    hookCtx.player.lanceCombo = 0;
    hookCtx.player.lanceComboWindow = 0;
    if (prevOnResetGame) prevOnResetGame(hookCtx);
  };

  EC.hooks.onSwitchWeapon = function(hookCtx) {
    initLanceState(hookCtx.player);
    hookCtx.player.lanceCombo = 0;
    hookCtx.player.lanceComboWindow = 0;
    if (prevOnSwitchWeapon) prevOnSwitchWeapon(hookCtx);
  };

  // 8. 全攻撃（火球・毒・雷・水・泡・落雷・爆発・氷ビーム・氷の槍・追加モンスター技）に対するカウンター捕捉
  window.addEventListener('load', function() {
    if (typeof window.damagePlayer === 'function') {
      const origDamagePlayer = window.damagePlayer;
      window.damagePlayer = function(amount, isFire, isPoison, isElectric, isBubble) {
        if (player.weaponType === 'lance' && player.state === 'lanceGuard') {
          triggerLanceCounter(getHookContext());
          return; // ダメージ・状態異常を完全無効化！
        }
        return origDamagePlayer.apply(this, arguments);
      };
    }
  });
})();
// ==========================================
// 新武器種：ガンランス（Gunlance）追加モジュール
// ==========================================
(function() {
  const EC = window.EXTRA_CONTENT = window.EXTRA_CONTENT || {};
  EC.weaponTypes = EC.weaponTypes || [];
  EC.weapons = EC.weapons || {};
  EC.hooks = EC.hooks || {};

  // 1. 武器種登録
  EC.weaponTypes.push({
    key: 'gunlance',
    label: 'ガンランス',
    controlsHtml: '突き: <span class="key">J</span>/<span class="key">Z</span> ｜ 砲撃/装填: <span class="key">K</span>/<span class="key">X</span> ｜ 竜撃砲: <span class="key">L</span>/<span class="key">C</span>'
  });

  // 2. ガンランスラインナップ登録
  EC.weapons.gunlance = [
    { id: 'iron_gl', type: 'gunlance', name: 'アイアンガンランス', element: 'none', elementLabel: '無属性', attack: 95 },
    { id: 'rathalos_gl', type: 'gunlance', name: 'レッドルーク', element: 'fire', elementLabel: '火属性', attack: 130 },
    { id: 'zinogre_gl', type: 'gunlance', name: '王牙銃槍【火雷】', element: 'thunder', elementLabel: '雷属性', attack: 135 },
    { id: 'barioth_gl', type: 'gunlance', name: 'ウルクスキー', element: 'ice', elementLabel: '氷属性', attack: 145 },
    { id: 'gore_gl', type: 'gunlance', name: 'THEフォートレス', element: 'dragon', elementLabel: '龍属性', attack: 165 }
  ];

  // 既存フックを退避
  const prevOnPlayerAction = EC.hooks.onPlayerAction;
  const prevOnUpdatePlayer = EC.hooks.onUpdatePlayer;
  const prevOnDrawPlayerWeapon = EC.hooks.onDrawPlayerWeapon;
  const prevOnDrawWeaponUI = EC.hooks.onDrawWeaponUI;
  const prevOnResetGame = EC.hooks.onResetGame;
  const prevOnSwitchWeapon = EC.hooks.onSwitchWeapon;

  const MAX_SHELLS = 5;
  const WYVERN_CD_MAX = 900; // 15秒（60fps換算）

  function initGunlanceState(player) {
    if (typeof player.glShells !== 'number') player.glShells = MAX_SHELLS;
    if (typeof player.glWyvernCd !== 'number') player.glWyvernCd = 0;
    if (typeof player.glBlastEffect !== 'number') player.glBlastEffect = 0;
    if (typeof player.glWyvernBeam !== 'number') player.glWyvernBeam = 0;
  }

  // 3. アクション入力フック
  EC.hooks.onPlayerAction = function(code, ctx) {
    const { player, addText, addParticles, resetMonsterSwingHitFlags } = ctx;
    if (player.weaponType !== 'gunlance') {
      if (prevOnPlayerAction) return prevOnPlayerAction(code, ctx);
      return;
    }
    initGunlanceState(player);

    // J / Z : 銃槍突き（砲撃の直後は踏み込み叩きつけに派生）
    if ((code === 'KeyJ' || code === 'KeyZ') && ['idle', 'run', 'jump', 'glShell'].includes(player.state)) {
      player.state = player.state === 'glShell' ? 'glSlam' : 'glThrust';
      player.stateTimer = player.state === 'glSlam' ? 20 : 16;
      resetMonsterSwingHitFlags();
      player.vx = player.facing * (player.state === 'glSlam' ? 4.8 : 2.6);
    }

    // K / X : 砲撃（弾があれば発射、0発ならクイックリロード）
    if ((code === 'KeyK' || code === 'KeyX') && ['idle', 'run', 'jump', 'glThrust', 'glSlam'].includes(player.state)) {
      if (player.glShells > 0) {
        player.glShells--;
        player.state = 'glShell';
        player.stateTimer = 16;
        player.glBlastEffect = 12;
        resetMonsterSwingHitFlags();
        player.vx = -player.facing * 2.2; // 反動ステップ
        const muzzleX = player.x + 15 + player.facing * 75;
        addParticles(muzzleX, player.y - 34, '#ff6d00', 18, 6);
        addParticles(muzzleX, player.y - 34, '#ffee58', 10, 4);
      } else {
        // クイックリロード
        player.state = 'glReload';
        player.stateTimer = 20;
        player.glShells = MAX_SHELLS;
        player.attackHitbox = null;
        player.vx = 0;
        addText('リロード完了！(5発)', player.x - 16, player.y - 76, '#ffd54f', 17);
        addParticles(player.x + 15, player.y - 35, '#ffd54f', 12, 3);
      }
    }

    // L / C : 竜撃砲（特大爆発ビーム）
    if ((code === 'KeyL' || code === 'KeyC') && ['idle', 'run', 'glThrust', 'glShell', 'glSlam'].includes(player.state)) {
      if (player.glWyvernCd > 0) {
        const sec = Math.ceil(player.glWyvernCd / 60);
        addText(`竜撃砲 冷却中(あと${sec}秒)`, player.x - 24, player.y - 75, '#ff8a80', 16);
        return;
      }
      player.state = 'glWyvernCharge';
      player.stateTimer = 34; // 溜め構え（この間はガード状態）
      player.attackHitbox = null;
      player.vx = 0;
      addText('竜撃砲 収束開始！', player.x - 18, player.y - 80, '#ff9100', 18);
    }
  };

  // 4. プレイヤー更新フック
  EC.hooks.onUpdatePlayer = function(ctx) {
    const {
      canvas, GROUND_Y, GRAVITY, player, activeMonsters, keys,
      addText, addParticles, rectIntersect, getMonsterBody,
      getCurrentWeapon, computeWeaponHitDamage, resetMonsterSwingHitFlags
    } = ctx;

    if (player.weaponType !== 'gunlance') {
      if (prevOnUpdatePlayer) return prevOnUpdatePlayer(ctx);
      return false;
    }
    initGunlanceState(player);

    if (player.glWyvernCd > 0) player.glWyvernCd--;
    if (player.glBlastEffect > 0) player.glBlastEffect--;
    if (player.glWyvernBeam > 0) player.glWyvernBeam--;

    if (player.state !== 'dodge') {
      player.stamina = Math.min(player.maxStamina, player.stamina + 0.36);
    }
    if (player.bubblyBuffTimer > 0) player.bubblyBuffTimer--;
    if (player.burnTimer > 0) {
      player.burnTimer--;
      if (player.burnTimer % 30 === 0) player.hp = Math.max(1, player.hp - 2);
    }
    if (player.thunderBlightTimer > 0) player.thunderBlightTimer--;
    if (player.bubbleTimer > 0) player.bubbleTimer--;
    if (player.poisonTimer > 0) {
      player.poisonTimer--;
      if (player.poisonTimer % 35 === 0) player.hp = Math.max(1, player.hp - 2);
    }
    if (player.invulnTimer > 0) player.invulnTimer--;

    const isBubbled = player.bubbleTimer > 0;

    if (player.paralysisTimer > 0) {
      player.paralysisTimer--;
      player.vx *= 0.7;
      player.attackHitbox = null;
      if (player.state !== 'hurt') player.state = 'idle';
    } else if (['idle', 'run', 'jump'].includes(player.state)) {
      let move = 0;
      if (keys['KeyA'] || keys['ArrowLeft']) move -= 1;
      if (keys['KeyD'] || keys['ArrowRight']) move += 1;
      const maxSpeed = 3.5; // ガンランスは重装備
      if (move !== 0) {
        player.facing = move;
        player.vx = isBubbled ? Math.max(-maxSpeed * 1.25, Math.min(maxSpeed * 1.25, player.vx + move * 0.4)) : move * maxSpeed;
        if (player.y >= GROUND_Y) player.state = 'run';
      } else {
        player.vx *= isBubbled ? 0.95 : 0.7;
        if (Math.abs(player.vx) < 0.08) player.vx = 0;
        if (player.y >= GROUND_Y) player.state = 'idle';
      }
      if ((keys['KeyW'] || keys['Space'] || keys['ArrowUp']) && player.y >= GROUND_Y) {
        player.vy = -11.8;
        player.state = 'jump';
      }
    } else if (player.state === 'glThrust') {
      player.vx *= 0.82;
      player.stateTimer--;
      player.attackHitbox = (player.stateTimer >= 4 && player.stateTimer <= 13)
        ? { x: player.facing === 1 ? player.x + 15 : player.x - 108, y: player.y - 60, w: 108, h: 48 }
        : null;
      if (player.stateTimer <= 0) { player.state = 'idle'; player.attackHitbox = null; }
    } else if (player.state === 'glSlam') {
      player.vx *= 0.84;
      player.stateTimer--;
      player.attackHitbox = (player.stateTimer >= 5 && player.stateTimer <= 15)
        ? { x: player.facing === 1 ? player.x + 15 : player.x - 118, y: player.y - 84, w: 118, h: 84 }
        : null;
      if (player.stateTimer <= 0) { player.state = 'idle'; player.attackHitbox = null; }
    } else if (player.state === 'glShell') {
      player.vx *= 0.82;
      player.stateTimer--;
      // 銃口前方の広範囲爆風判定
      player.attackHitbox = (player.stateTimer >= 6 && player.stateTimer <= 15)
        ? { x: player.facing === 1 ? player.x + 40 : player.x - 140, y: player.y - 72, w: 130, h: 64 }
        : null;
      if (player.stateTimer <= 0) { player.state = 'idle'; player.attackHitbox = null; }
    } else if (player.state === 'glReload') {
      player.vx *= 0.7;
      player.stateTimer--;
      if (player.stateTimer <= 0) player.state = 'idle';
    } else if (player.state === 'glWyvernCharge') {
      player.vx = 0;
      player.stateTimer--;
      if (player.stateTimer % 3 === 0) {
        const muzzleX = player.x + 15 + player.facing * 72;
        addParticles(muzzleX, player.y - 34, '#ff9100', 4, 3);
      }
      if (player.stateTimer <= 0) {
        // 竜撃砲発射！！
        player.state = 'glWyvernFire';
        player.stateTimer = 22;
        player.glWyvernBeam = 20;
        player.glWyvernCd = WYVERN_CD_MAX;
        player.glShells = 0;
        resetMonsterSwingHitFlags();
        player.vx = -player.facing * 9.5; // 特大反動
        ctx.screenShake = 14;
        const muzzleX = player.x + 15 + player.facing * 75;
        addText('竜撃砲！！', player.x - 12, player.y - 86, '#ff3d00', 24);
        addParticles(muzzleX, player.y - 34, '#ff3d00', 32, 9);
        addParticles(muzzleX, player.y - 34, '#ffee58', 22, 7);
      }
    } else if (player.state === 'glWyvernFire') {
      player.vx *= 0.85;
      player.stateTimer--;
      // 超巨大爆炎ビーム判定
      player.attackHitbox = (player.stateTimer >= 6 && player.stateTimer <= 21)
        ? { x: player.facing === 1 ? player.x + 25 : player.x - 215, y: player.y - 88, w: 220, h: 82 }
        : null;
      if (player.stateTimer <= 0) { player.state = 'idle'; player.attackHitbox = null; }
    } else if (player.state === 'dodge' || player.state === 'hurt') {
      player.vx *= isBubbled ? 0.94 : 0.9;
      player.stateTimer--;
      if (player.stateTimer <= 0) player.state = 'idle';
    }

    player.vy += GRAVITY;
    player.x += player.vx;
    player.y += player.vy;
    if (player.y >= GROUND_Y) { player.y = GROUND_Y; player.vy = 0; }
    player.x = Math.max(20, Math.min(canvas.width - 50, player.x));

    // 攻撃ヒット処理
    if (player.attackHitbox) {
      const weapon = getCurrentWeapon();
      const sparkColors = { fire: '#ff6d00', water: '#4fc3f7', thunder: '#00e5ff', ice: '#80deea', dragon: '#d500f9', none: '#fff' };
      const hitSparkColor = sparkColors[weapon.element] || '#fff';

      for (const m of activeMonsters) {
        if (m.hp <= 0 || m.hasHitThisSwingByPlayer) continue;
        if (!rectIntersect(player.attackHitbox, getMonsterBody(m))) continue;

        m.hasHitThisSwingByPlayer = true;
        m.flashTimer = 6;
        player.hasHitThisSwing = true;

        let dmg = 0;
        let staggerChance = 0.12;
        let textColor = '#ffd700';
        let textSize = 21;

        if (player.state === 'glShell') {
          // 砲撃：肉質無視の爆発固定ダメージ＋武器攻撃力補正
          dmg = Math.round(38 + weapon.attack * 0.22);
          staggerChance = 0.18;
          textColor = '#ff9100';
          textSize = 23;
          ctx.screenShake = Math.max(ctx.screenShake, 5);
          addParticles(m.x + 40, m.y - 45, '#ff6d00', 18, 7);
        } else if (player.state === 'glWyvernFire') {
          // 竜撃砲：特大爆発ダメージ＆超高怯み率！
          dmg = Math.round(135 + weapon.attack * 0.65);
          staggerChance = 0.45;
          textColor = '#ff3d00';
          textSize = 30;
          addParticles(m.x + 40, m.y - 45, '#ff3d00', 30, 9);
        } else if (player.state === 'glSlam') {
          const res = computeWeaponHitDamage(44, weapon, 1.05, m.species);
          dmg = res.dmg;
          staggerChance = 0.22;
          textSize = 24;
          ctx.screenShake = Math.max(ctx.screenShake, 5);
          addParticles(m.x + 40, m.y - 45, hitSparkColor, 14, 6);
        } else {
          const res = computeWeaponHitDamage(27, weapon, 1.0, m.species);
          dmg = res.dmg;
          addParticles(m.x + 40, m.y - 45, hitSparkColor, 11, 5);
        }

        m.hp -= dmg;
        addText(dmg, m.x + 40 + (Math.random() * 18 - 9), m.y - 60, textColor, textSize);

        if (m.hp <= 0) {
          m.hp = 0;
          m.attackHitbox = null;
          addText('部位破壊・討伐！', m.x + 10, m.y - 95, '#ffd700', 22);
          addParticles(m.x + m.w / 2, m.y - 45, '#ffd700', 24, 7);
          continue;
        }

        if (Math.random() < staggerChance && m.state !== 'stagger') {
          m.state = 'stagger';
          m.stateTimer = 50;
          m.isFlying = false;
          m.isCharged = false;
          m.somersaultAngle = 0;
          m.attackHitbox = null;
          addText('怯み！', m.x + 25, m.y - 100, '#ffaa00', 24);
        }
      }
    }

    return true;
  };

  // 5. 銃槍＆大盾＋砲撃エフェクト描画
  EC.hooks.onDrawPlayerWeapon = function(handX, handY, hookCtx) {
    const { ctx, player, getCurrentWeapon } = hookCtx;
    if (player.weaponType !== 'gunlance') {
      if (prevOnDrawPlayerWeapon) return prevOnDrawPlayerWeapon(handX, handY, hookCtx);
      return;
    }
    initGunlanceState(player);

    const wpn = getCurrentWeapon();
    const elemColors = {
      fire: '#ff6d00',
      thunder: '#00e5ff',
      ice: '#80deea',
      dragon: '#d500f9',
      none: '#90a4ae'
    };
    const barrelCol = elemColors[wpn.element] || '#90a4ae';

    ctx.save();
    const isForward = ['glThrust', 'glSlam', 'glShell', 'glWyvernCharge', 'glWyvernFire'].includes(player.state);
    const tipX = isForward ? handX + player.facing * 96 : handX + player.facing * 48;
    const tipY = isForward ? handY - 2 : handY - 30;

    if (wpn.element !== 'none' || player.state === 'glWyvernCharge') {
      ctx.shadowColor = player.state === 'glWyvernCharge' ? '#ff9100' : barrelCol;
      ctx.shadowBlur = 12;
    }

    // 太い銃槍バレル（砲身）
    ctx.strokeStyle = barrelCol;
    ctx.lineWidth = 10;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(handX - player.facing * 10, handY + (isForward ? 0 : 6));
    ctx.lineTo(tipX, tipY);
    ctx.stroke();

    // 銃槍の放熱フィン・ハイライト
    ctx.strokeStyle = '#eceff1';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(handX, handY - 2);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();

    // 砲撃の爆風エフェクト
    if (player.glBlastEffect > 0) {
      const alpha = player.glBlastEffect / 12;
      ctx.fillStyle = `rgba(255, 111, 0, ${alpha * 0.7})`;
      ctx.beginPath();
      ctx.arc(tipX + player.facing * 35, tipY, 44 * (1.2 - alpha * 0.3), 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(255, 238, 88, ${alpha * 0.9})`;
      ctx.beginPath();
      ctx.arc(tipX + player.facing * 24, tipY, 24 * alpha, 0, Math.PI * 2);
      ctx.fill();
    }

    // 竜撃砲の超巨大爆炎ビームエフェクト
    if (player.glWyvernBeam > 0) {
      const alpha = player.glWyvernBeam / 20;
      const beamLen = 210;
      const endX = tipX + player.facing * beamLen;

      ctx.strokeStyle = `rgba(255, 61, 0, ${alpha * 0.85})`;
      ctx.lineWidth = 46 * alpha + 10;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(endX, tipY);
      ctx.stroke();

      ctx.strokeStyle = `rgba(255, 245, 157, ${alpha})`;
      ctx.lineWidth = 18 * alpha + 4;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(endX, tipY);
      ctx.stroke();
    }

    // 大盾（タワーシールド）
    const shieldFront = player.state === 'glWyvernCharge';
    const shieldX = shieldFront
      ? (player.facing === 1 ? handX + 8 : handX - 26)
      : (player.facing === 1 ? handX - 18 : handX + 2);
    const shieldY = handY - 22;

    ctx.fillStyle = shieldFront ? '#ff8f00' : '#455a64';
    ctx.strokeStyle = '#cfd8dc';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(shieldX, shieldY, 18, 38, 4);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  };

  // 6. 武器専用UI（砲撃弾数5発＆竜撃砲ゲージ）
  EC.hooks.onDrawWeaponUI = function(hookCtx) {
    const { ctx, player } = hookCtx;
    if (player.weaponType !== 'gunlance') {
      if (prevOnDrawWeaponUI) return prevOnDrawWeaponUI(hookCtx);
      return;
    }
    initGunlanceState(player);

    // 砲撃弾（5発の薬莢アイコン）
    for (let i = 0; i < MAX_SHELLS; i++) {
      const bx = 20 + i * 22;
      ctx.fillStyle = i < player.glShells ? '#ff9100' : '#263238';
      ctx.fillRect(bx, 56, 18, 12);
      ctx.strokeStyle = i < player.glShells ? '#ffe082' : '#546e7a';
      ctx.strokeRect(bx, 56, 18, 12);
    }

    // 竜撃砲ヒートゲージ（右隣に表示）
    const wyvernReady = player.glWyvernCd <= 0;
    const wyvernRatio = wyvernReady ? 1 : (1 - player.glWyvernCd / WYVERN_CD_MAX);
    ctx.fillStyle = '#222';
    ctx.fillRect(136, 56, 64, 12);
    ctx.fillStyle = wyvernReady ? '#ff3d00' : '#78909c';
    ctx.fillRect(136, 56, 64 * wyvernRatio, 12);
    ctx.strokeStyle = wyvernReady ? '#ffab91' : '#888';
    ctx.strokeRect(136, 56, 64, 12);
  };

  // 7. 竜撃砲構え中のガード軽減・リセット・武器切替フック
  EC.hooks.onResetGame = function(hookCtx) {
    initGunlanceState(hookCtx.player);
    hookCtx.player.glShells = MAX_SHELLS;
    hookCtx.player.glWyvernCd = 0;
    hookCtx.player.glBlastEffect = 0;
    hookCtx.player.glWyvernBeam = 0;
    if (prevOnResetGame) prevOnResetGame(hookCtx);
  };

  EC.hooks.onSwitchWeapon = function(hookCtx) {
    initGunlanceState(hookCtx.player);
    if (prevOnSwitchWeapon) prevOnSwitchWeapon(hookCtx);
  };

  // 竜撃砲収束構え中は被ダメージ70%カット（スーパーアーマー）
  window.addEventListener('load', function() {
    if (typeof window.damagePlayer === 'function') {
      const origDamagePlayer = window.damagePlayer;
      window.damagePlayer = function(amount, isFire, isPoison, isElectric, isBubble) {
        if (player.weaponType === 'gunlance' && player.state === 'glWyvernCharge') {
          const reduced = Math.max(1, Math.floor(amount * 0.3));
          player.hp = Math.max(0, player.hp - reduced);
          player.invulnTimer = 25;
          addText(`-${reduced} (竜撃盾耐え)`, player.x - 16, player.y - 72, '#ffab40', 17);
          return;
        }
        return origDamagePlayer.apply(this, arguments);
      };
    }
  });
})();
// ==========================================
// 新武器種：スラッシュアックス（Switch Axe）追加モジュール
// ==========================================
(function() {
  const EC = window.EXTRA_CONTENT = window.EXTRA_CONTENT || {};
  EC.weaponTypes = EC.weaponTypes || [];
  EC.weapons = EC.weapons || {};
  EC.hooks = EC.hooks || {};

  // 1. 武器種登録
  EC.weaponTypes.push({
    key: 'switchaxe',
    label: 'スラッシュアックス',
    controlsHtml: '斧/剣斬り: <span class="key">J</span>/<span class="key">Z</span> ｜ 変形斬り: <span class="key">K</span>/<span class="key">X</span> ｜ 属性解放突き: <span class="key">L</span>/<span class="key">C</span>'
  });

  // 2. スラッシュアックスラインナップ登録
  EC.weapons.switchaxe = [
    { id: 'iron_sa', type: 'switchaxe', name: 'アイアンアックス', element: 'none', elementLabel: '無属性', attack: 95 },
    { id: 'rathalos_sa', type: 'switchaxe', name: '火竜斧【銀火】', element: 'fire', elementLabel: '火属性', attack: 130 },
    { id: 'zinogre_sa', type: 'switchaxe', name: '王牙剣斧【裂雷】', element: 'thunder', elementLabel: '雷属性', attack: 135 },
    { id: 'barioth_sa', type: 'switchaxe', name: '琥珀の鋭剣斧', element: 'ice', elementLabel: '氷属性', attack: 145 },
    { id: 'gore_sa', type: 'switchaxe', name: 'THEグラント', element: 'dragon', elementLabel: '龍属性', attack: 165 }
  ];

  // 既存フックを退避
  const prevOnPlayerAction = EC.hooks.onPlayerAction;
  const prevOnUpdatePlayer = EC.hooks.onUpdatePlayer;
  const prevOnDrawPlayerWeapon = EC.hooks.onDrawPlayerWeapon;
  const prevOnDrawWeaponUI = EC.hooks.onDrawWeaponUI;
  const prevOnResetGame = EC.hooks.onResetGame;
  const prevOnSwitchWeapon = EC.hooks.onSwitchWeapon;

  function initSwitchAxeState(player) {
    if (typeof player.saMode !== 'string') player.saMode = 'axe'; // 'axe' or 'sword'
    if (typeof player.saGauge !== 'number') player.saGauge = 100;
    if (typeof player.saExplosionFx !== 'number') player.saExplosionFx = 0;
  }

  // 3. アクション入力フック
  EC.hooks.onPlayerAction = function(code, ctx) {
    const { player, addText, addParticles, resetMonsterSwingHitFlags } = ctx;
    if (player.weaponType !== 'switchaxe') {
      if (prevOnPlayerAction) return prevOnPlayerAction(code, ctx);
      return;
    }
    initSwitchAxeState(player);

    // J / Z : 斧モード斬り or 剣モード二連斬り
    if ((code === 'KeyJ' || code === 'KeyZ') && ['idle', 'run', 'jump'].includes(player.state)) {
      if (player.saMode === 'sword') {
        if (player.saGauge >= 15) {
          player.saGauge -= 15;
          player.state = 'saSwordSlash';
          player.stateTimer = 18;
          resetMonsterSwingHitFlags();
          player.vx = player.facing * 3.2;
        } else {
          // ゲージ不足時は自動で斧モードへ強制変形
          player.saMode = 'axe';
          player.state = 'saMorph';
          player.stateTimer = 18;
          player.saGauge = Math.min(100, player.saGauge + 25);
          resetMonsterSwingHitFlags();
          addText('ゲージ不足・斧変形！', player.x - 18, player.y - 76, '#ffab40', 16);
        }
      } else {
        player.state = 'saAxeSlash';
        player.stateTimer = 19;
        resetMonsterSwingHitFlags();
        player.vx = player.facing * 3.0;
      }
    }

    // K / X : 変形斬り（斧 ⇄ 剣）
    if ((code === 'KeyK' || code === 'KeyX') && ['idle', 'run', 'jump', 'saAxeSlash', 'saSwordSlash'].includes(player.state)) {
      if (player.saMode === 'axe') {
        if (player.saGauge >= 30) {
          player.saMode = 'sword';
          player.state = 'saMorph';
          player.stateTimer = 18;
          resetMonsterSwingHitFlags();
          player.vx = player.facing * 4.8;
          addText('剣モード変形！', player.x - 14, player.y - 76, '#00e5ff', 17);
          addParticles(player.x + 15, player.y - 35, '#00e5ff', 12, 4);
        } else {
          addText('スラッシュゲージ不足(30必要)', player.x - 28, player.y - 74, '#ff8a80', 15);
        }
      } else {
        player.saMode = 'axe';
        player.saGauge = Math.min(100, player.saGauge + 25);
        player.state = 'saMorph';
        player.stateTimer = 18;
        resetMonsterSwingHitFlags();
        player.vx = player.facing * 4.2;
        addText('斧変形・ゲージ回復！', player.x - 20, player.y - 76, '#ffd54f', 17);
        addParticles(player.x + 15, player.y - 35, '#ffd54f', 12, 4);
      }
    }

    // L / C : 属性解放突き＆爆発フィニッシュ
    if ((code === 'KeyL' || code === 'KeyC') && ['idle', 'run', 'saSwordSlash', 'saMorph'].includes(player.state)) {
      if (player.saMode === 'sword' && player.saGauge >= 25) {
        player.state = 'saDischarge';
        player.stateTimer = 36;
        resetMonsterSwingHitFlags();
        player.vx = player.facing * 5.5;
        addText('属性解放突き！', player.x - 14, player.y - 80, '#ea80fc', 18);
      } else if (player.saMode === 'axe') {
        addText('剣モード(K/X)中に発動可能！', player.x - 28, player.y - 74, '#ffab40', 15);
      } else {
        addText('ゲージ不足(25必要)', player.x - 20, player.y - 74, '#ff8a80', 15);
      }
    }
  };

  // 4. プレイヤー更新フック
  EC.hooks.onUpdatePlayer = function(ctx) {
    const {
      canvas, GROUND_Y, GRAVITY, player, activeMonsters, keys,
      addText, addParticles, rectIntersect, getMonsterBody,
      getCurrentWeapon, computeWeaponHitDamage, resetMonsterSwingHitFlags
    } = ctx;

    if (player.weaponType !== 'switchaxe') {
      if (prevOnUpdatePlayer) return prevOnUpdatePlayer(ctx);
      return false;
    }
    initSwitchAxeState(player);

    if (player.saExplosionFx > 0) player.saExplosionFx--;

    // 斧モード中はスラッシュゲージが自然回復
    if (player.saMode === 'axe') {
      player.saGauge = Math.min(100, player.saGauge + 0.16);
    }

    if (player.state !== 'dodge') {
      player.stamina = Math.min(player.maxStamina, player.stamina + 0.36);
    }
    if (player.bubblyBuffTimer > 0) player.bubblyBuffTimer--;
    if (player.burnTimer > 0) {
      player.burnTimer--;
      if (player.burnTimer % 30 === 0) player.hp = Math.max(1, player.hp - 2);
    }
    if (player.thunderBlightTimer > 0) player.thunderBlightTimer--;
    if (player.bubbleTimer > 0) player.bubbleTimer--;
    if (player.poisonTimer > 0) {
      player.poisonTimer--;
      if (player.poisonTimer % 35 === 0) player.hp = Math.max(1, player.hp - 2);
    }
    if (player.invulnTimer > 0) player.invulnTimer--;

    const isBubbled = player.bubbleTimer > 0;

    if (player.paralysisTimer > 0) {
      player.paralysisTimer--;
      player.vx *= 0.7;
      player.attackHitbox = null;
      if (player.state !== 'hurt') player.state = 'idle';
    } else if (['idle', 'run', 'jump'].includes(player.state)) {
      let move = 0;
      if (keys['KeyA'] || keys['ArrowLeft']) move -= 1;
      if (keys['KeyD'] || keys['ArrowRight']) move += 1;
      const maxSpeed = player.saMode === 'axe' ? 4.7 : 3.9; // 斧は機動力高め、剣は重厚
      if (move !== 0) {
        player.facing = move;
        player.vx = isBubbled ? Math.max(-maxSpeed * 1.25, Math.min(maxSpeed * 1.25, player.vx + move * 0.42)) : move * maxSpeed;
        if (player.y >= GROUND_Y) player.state = 'run';
      } else {
        player.vx *= isBubbled ? 0.95 : 0.7;
        if (Math.abs(player.vx) < 0.08) player.vx = 0;
        if (player.y >= GROUND_Y) player.state = 'idle';
      }
      if ((keys['KeyW'] || keys['Space'] || keys['ArrowUp']) && player.y >= GROUND_Y) {
        player.vy = -12.3;
        player.state = 'jump';
      }
    } else if (player.state === 'saAxeSlash') {
      player.vx *= 0.83;
      player.stateTimer--;
      player.attackHitbox = (player.stateTimer >= 5 && player.stateTimer <= 15)
        ? { x: player.facing === 1 ? player.x + 15 : player.x - 115, y: player.y - 84, w: 115, h: 84 }
        : null;
      if (player.stateTimer <= 0) { player.state = 'idle'; player.attackHitbox = null; }
    } else if (player.state === 'saSwordSlash') {
      player.vx *= 0.84;
      player.stateTimer--;
      // 剣モード二連斬り（前半と後半でヒットリセット）
      if (player.stateTimer === 9) resetMonsterSwingHitFlags();
      player.attackHitbox = (player.stateTimer >= 3 && player.stateTimer <= 15)
        ? { x: player.facing === 1 ? player.x + 15 : player.x - 98, y: player.y - 78, w: 98, h: 78 }
        : null;
      if (player.stateTimer <= 0) { player.state = 'idle'; player.attackHitbox = null; }
    } else if (player.state === 'saMorph') {
      player.vx *= 0.85;
      player.stateTimer--;
      player.attackHitbox = (player.stateTimer >= 4 && player.stateTimer <= 14)
        ? { x: player.facing === 1 ? player.x + 15 : player.x - 108, y: player.y - 82, w: 108, h: 82 }
        : null;
      if (player.stateTimer <= 0) { player.state = 'idle'; player.attackHitbox = null; }
    } else if (player.state === 'saDischarge') {
      player.stateTimer--;
      if (player.stateTimer > 10) {
        // 連続突き刺し多段ヒット（6フレームごと）
        player.vx *= 0.82;
        if (player.stateTimer % 6 === 0) {
          resetMonsterSwingHitFlags();
          const tipX = player.x + 15 + player.facing * 85;
          addParticles(tipX, player.y - 38, '#00e5ff', 6, 4);
        }
        player.attackHitbox = {
          x: player.facing === 1 ? player.x + 15 : player.x - 105,
          y: player.y - 68,
          w: 105,
          h: 58
        };
      } else if (player.stateTimer === 10) {
        // 属性解放フィニッシュ大爆発！！
        resetMonsterSwingHitFlags();
        player.saExplosionFx = 14;
        player.saGauge = 0;
        player.saMode = 'axe'; // フィニッシュ後は自動で斧モードへ戻る
        player.vx = -player.facing * 7.5;
        ctx.screenShake = 12;
        const boomX = player.x + 15 + player.facing * 92;
        addText('属性解放フィニッシュ！！', player.x - 28, player.y - 90, '#00e5ff', 22);
        addParticles(boomX, player.y - 40, '#00e5ff', 28, 8);
        addParticles(boomX, player.y - 40, '#ea80fc', 20, 7);
        player.attackHitbox = {
          x: player.facing === 1 ? player.x + 20 : player.x - 155,
          y: player.y - 95,
          w: 165,
          h: 92
        };
      } else {
        player.vx *= 0.86;
        player.attackHitbox = player.stateTimer >= 5
          ? { x: player.facing === 1 ? player.x + 20 : player.x - 155, y: player.y - 95, w: 165, h: 92 }
          : null;
      }

      if (player.stateTimer <= 0) {
        player.state = 'idle';
        player.attackHitbox = null;
      }
    } else if (player.state === 'dodge' || player.state === 'hurt') {
      player.vx *= isBubbled ? 0.94 : 0.9;
      player.stateTimer--;
      if (player.stateTimer <= 0) player.state = 'idle';
    }

    player.vy += GRAVITY;
    player.x += player.vx;
    player.y += player.vy;
    if (player.y >= GROUND_Y) { player.y = GROUND_Y; player.vy = 0; }
    player.x = Math.max(20, Math.min(canvas.width - 50, player.x));

    // 攻撃ヒット処理
    if (player.attackHitbox) {
      const weapon = getCurrentWeapon();
      const sparkColors = { fire: '#ff6d00', water: '#4fc3f7', thunder: '#00e5ff', ice: '#80deea', dragon: '#d500f9', none: '#00e5ff' };
      const hitSparkColor = sparkColors[weapon.element] || '#00e5ff';

      for (const m of activeMonsters) {
        if (m.hp <= 0 || m.hasHitThisSwingByPlayer) continue;
        if (!rectIntersect(player.attackHitbox, getMonsterBody(m))) continue;

        m.hasHitThisSwingByPlayer = true;
        m.flashTimer = 6;
        player.hasHitThisSwing = true;

        let mv = 30;
        let modeMult = 1.0;
        let staggerChance = 0.14;
        let textSize = 21;
        let textColor = '#ffd700';

        if (player.state === 'saAxeSlash') {
          mv = 32;
          staggerChance = 0.16;
          player.saGauge = Math.min(100, player.saGauge + 18); // 斧ヒットでゲージ大幅回収
          addParticles(m.x + 40, m.y - 45, '#ffd54f', 12, 5);
        } else if (player.state === 'saSwordSlash') {
          mv = 24;
          modeMult = 1.25; // 剣モードは強撃ビン補正で高火力！
          staggerChance = 0.14;
          textColor = '#80ffff';
          addParticles(m.x + 40, m.y - 45, hitSparkColor, 13, 6);
        } else if (player.state === 'saMorph') {
          mv = 40;
          modeMult = 1.15;
          staggerChance = 0.22;
          textSize = 24;
          textColor = '#00e5ff';
          ctx.screenShake = Math.max(ctx.screenShake, 5);
          addParticles(m.x + 40, m.y - 45, '#00e5ff', 16, 6);
        } else if (player.state === 'saDischarge') {
          if (player.stateTimer > 10) {
            mv = 14; // 連続突き多段
            modeMult = 1.2;
            staggerChance = 0.05;
            textSize = 18;
            textColor = '#ea80fc';
            addParticles(m.x + 40, m.y - 45, hitSparkColor, 8, 5);
          } else {
            mv = 88; // 属性解放フィニッシュ爆発！
            modeMult = 1.3;
            staggerChance = 0.42;
            textSize = 29;
            textColor = '#00e5ff';
            addParticles(m.x + 40, m.y - 45, hitSparkColor, 26, 8);
          }
        }

        const result = computeWeaponHitDamage(mv, weapon, modeMult, m.species);
        m.hp -= result.dmg;
        addText(result.dmg, m.x + 40 + (Math.random() * 18 - 9), m.y - 60, textColor, textSize);

        if (m.hp <= 0) {
          m.hp = 0;
          m.attackHitbox = null;
          addText('部位破壊・討伐！', m.x + 10, m.y - 95, '#ffd700', 22);
          addParticles(m.x + m.w / 2, m.y - 45, '#ffd700', 24, 7);
          continue;
        }

        if (Math.random() < staggerChance && m.state !== 'stagger') {
          m.state = 'stagger';
          m.stateTimer = 50;
          m.isFlying = false;
          m.isCharged = false;
          m.somersaultAngle = 0;
          m.attackHitbox = null;
          addText('怯み！', m.x + 25, m.y - 100, '#ffaa00', 24);
        }
      }
    }

    return true;
  };

  // 5. 斧モード＆剣モード変形描画フック
  EC.hooks.onDrawPlayerWeapon = function(handX, handY, hookCtx) {
    const { ctx, player, getCurrentWeapon } = hookCtx;
    if (player.weaponType !== 'switchaxe') {
      if (prevOnDrawPlayerWeapon) return prevOnDrawPlayerWeapon(handX, handY, hookCtx);
      return;
    }
    initSwitchAxeState(player);

    const wpn = getCurrentWeapon();
    const elemColors = {
      fire: '#ff6d00',
      thunder: '#00e5ff',
      ice: '#80deea',
      dragon: '#d500f9',
      none: '#90a4ae'
    };
    const bladeCol = elemColors[wpn.element] || '#90a4ae';
    const isAttacking = ['saAxeSlash', 'saSwordSlash', 'saMorph', 'saDischarge'].includes(player.state);

    ctx.save();
    ctx.translate(handX, handY);

    let angle = player.facing === 1 ? -2.2 : -0.94;
    if (player.state === 'saDischarge') {
      angle = player.facing === 1 ? 0 : Math.PI;
    } else if (isAttacking) {
      angle = player.facing === 1 ? 0.12 : Math.PI - 0.12;
    }
    ctx.rotate(angle);

    if (player.saMode === 'sword' || wpn.element !== 'none') {
      ctx.shadowColor = player.saMode === 'sword' ? '#00e5ff' : bladeCol;
      ctx.shadowBlur = player.saMode === 'sword' ? 14 : 9;
    }

    // 柄（シャフト）
    ctx.fillStyle = '#37474f';
    ctx.fillRect(-10, -4, 72, 8);

    if (player.saMode === 'axe') {
      // 斧モード：大きな三日月型の斧刃
      ctx.fillStyle = bladeCol;
      ctx.beginPath();
      ctx.moveTo(46, -6);
      ctx.quadraticCurveTo(72, -30, 88, -14);
      ctx.quadraticCurveTo(94, 4, 82, 22);
      ctx.lineTo(54, 6);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#eceff1';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      // 剣モード：発光する大剣刃
      ctx.fillStyle = bladeCol;
      ctx.beginPath();
      ctx.moveTo(14, -7);
      ctx.lineTo(86, -9);
      ctx.lineTo(102, 0);
      ctx.lineTo(86, 9);
      ctx.lineTo(14, 7);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#e0f7fa';
      ctx.fillRect(18, -2.5, 72, 5);
    }

    ctx.restore();

    // 斬撃軌跡エフェクト
    if (isAttacking && player.state !== 'saDischarge') {
      ctx.save();
      ctx.fillStyle = player.saMode === 'sword' ? 'rgba(0, 229, 255, 0.34)' : 'rgba(255, 213, 79, 0.28)';
      ctx.beginPath();
      ctx.arc(handX, handY, 92, player.facing === 1 ? -1.0 : Math.PI - 0.4, player.facing === 1 ? 0.4 : Math.PI + 1.0);
      ctx.lineTo(handX, handY);
      ctx.fill();
      ctx.restore();
    }

    // 属性解放フィニッシュ爆発エフェクト
    if (player.saExplosionFx > 0) {
      const alpha = player.saExplosionFx / 14;
      const boomX = handX + player.facing * 88;
      ctx.save();
      ctx.fillStyle = `rgba(0, 229, 255, ${alpha * 0.55})`;
      ctx.beginPath();
      ctx.arc(boomX, handY, 68 * (1.3 - alpha * 0.3), 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(234, 128, 252, ${alpha * 0.75})`;
      ctx.beginPath();
      ctx.arc(boomX, handY, 38 * alpha, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };

  // 6. 武器専用UI（スラッシュゲージ＆斧/剣モード表示）
  EC.hooks.onDrawWeaponUI = function(hookCtx) {
    const { ctx, player } = hookCtx;
    if (player.weaponType !== 'switchaxe') {
      if (prevOnDrawWeaponUI) return prevOnDrawWeaponUI(hookCtx);
      return;
    }
    initSwitchAxeState(player);

    ctx.fillStyle = '#222';
    ctx.fillRect(20, 56, 180, 12);

    const isSword = player.saMode === 'sword';
    ctx.fillStyle = isSword ? '#00e5ff' : (player.saGauge >= 30 ? '#ffa726' : '#78909c');
    ctx.fillRect(20, 56, 180 * (player.saGauge / 100), 12);

    // 変形可能ライン（30%位置）の目盛り線
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(20 + 180 * 0.3, 55, 2, 14);

    ctx.strokeStyle = isSword ? '#84ffff' : '#ffe082';
    ctx.lineWidth = isSword ? 2 : 1;
    ctx.strokeRect(20, 56, 180, 12);
    ctx.lineWidth = 1;
  };

  // 7. リセット・武器切替フック
  EC.hooks.onResetGame = function(hookCtx) {
    initSwitchAxeState(hookCtx.player);
    hookCtx.player.saMode = 'axe';
    hookCtx.player.saGauge = 100;
    hookCtx.player.saExplosionFx = 0;
    if (prevOnResetGame) prevOnResetGame(hookCtx);
  };

  EC.hooks.onSwitchWeapon = function(hookCtx) {
    initSwitchAxeState(hookCtx.player);
    if (prevOnSwitchWeapon) prevOnSwitchWeapon(hookCtx);
  };
})();
// ==========================================
// 新武器種：チャージアックス（Charge Blade）追加モジュール
// ==========================================
(function() {
  const EC = window.EXTRA_CONTENT = window.EXTRA_CONTENT || {};
  EC.weaponTypes = EC.weaponTypes || [];
  EC.weapons = EC.weapons || {};
  EC.hooks = EC.hooks || {};

  // 1. 武器種登録
  EC.weaponTypes.push({
    key: 'chargeblade',
    label: 'チャージアックス',
    controlsHtml: '剣/斧斬り: <span class="key">J</span>/<span class="key">Z</span> ｜ 装填/変形: <span class="key">K</span>/<span class="key">X</span> ｜ 属性解放斬り: <span class="key">L</span>/<span class="key">C</span>'
  });

  // 2. チャージアックスラインナップ登録
  EC.weapons.chargeblade = [
    { id: 'iron_cb', type: 'chargeblade', name: '精鋭討伐隊盾斧', element: 'none', elementLabel: '無属性', attack: 95 },
    { id: 'rathalos_cb', type: 'chargeblade', name: '炎斧アクセリオン', element: 'fire', elementLabel: '火属性', attack: 130 },
    { id: 'zinogre_cb', type: 'chargeblade', name: '王牙盾斧【風雷】', element: 'thunder', elementLabel: '雷属性', attack: 135 },
    { id: 'barioth_cb', type: 'chargeblade', name: 'シュネーギッター', element: 'ice', elementLabel: '氷属性', attack: 145 },
    { id: 'gore_cb', type: 'chargeblade', name: 'THEサプレッション', element: 'dragon', elementLabel: '龍属性', attack: 165 }
  ];

  // 既存フックを退避
  const prevOnPlayerAction = EC.hooks.onPlayerAction;
  const prevOnUpdatePlayer = EC.hooks.onUpdatePlayer;
  const prevOnDrawPlayerWeapon = EC.hooks.onDrawPlayerWeapon;
  const prevOnDrawWeaponUI = EC.hooks.onDrawWeaponUI;
  const prevOnResetGame = EC.hooks.onResetGame;
  const prevOnSwitchWeapon = EC.hooks.onSwitchWeapon;

  const MAX_PHIALS = 5;

  function initChargeBladeState(player) {
    if (typeof player.cbMode !== 'string') player.cbMode = 'sword'; // 'sword' or 'axe'
    if (typeof player.cbEnergy !== 'number') player.cbEnergy = 0;    // 0 ~ 100
    if (typeof player.cbPhials !== 'number') player.cbPhials = 0;    // 0 ~ 5
    if (typeof player.cbShockwaveFx !== 'number') player.cbShockwaveFx = 0;
    if (typeof player.cbUltraRelease !== 'boolean') player.cbUltraRelease = false;
  }

  // 3. アクション入力フック
  EC.hooks.onPlayerAction = function(code, ctx) {
    const { player, addText, addParticles, resetMonsterSwingHitFlags } = ctx;
    if (player.weaponType !== 'chargeblade') {
      if (prevOnPlayerAction) return prevOnPlayerAction(code, ctx);
      return;
    }
    initChargeBladeState(player);

    // J / Z : 剣モード斬り or 斧モード叩きつけ
    if ((code === 'KeyJ' || code === 'KeyZ') && ['idle', 'run', 'jump'].includes(player.state)) {
      if (player.cbMode === 'sword') {
        player.state = 'cbSwordSlash';
        player.stateTimer = 15;
        resetMonsterSwingHitFlags();
        player.vx = player.facing * 3.4;
      } else {
        player.state = 'cbAxeSlash';
        player.stateTimer = 21;
        resetMonsterSwingHitFlags();
        player.vx = player.facing * 3.2;
      }
    }

    // K / X : ビンチャージ装填 or モード変形斬り
    if ((code === 'KeyK' || code === 'KeyX') && ['idle', 'run', 'jump', 'cbSwordSlash', 'cbAxeSlash'].includes(player.state)) {
      if (player.cbMode === 'sword' && player.cbEnergy >= 40) {
        // 剣撃エネルギーをビンにチャージ装填！
        const addCount = player.cbEnergy >= 80 ? 5 : 3;
        player.cbPhials = Math.min(MAX_PHIALS, player.cbPhials + addCount);
        player.cbEnergy = 0;
        player.state = 'cbChargePhial';
        player.stateTimer = 16;
        player.attackHitbox = null;
        player.vx = 0;
        addText(`ビン装填！(${player.cbPhials}/5本)`, player.x - 16, player.y - 78, '#ffd54f', 18);
        addParticles(player.x + 15, player.y - 35, '#ffd54f', 15, 4);
      } else if (player.cbMode === 'sword') {
        // 剣 → 斧 変形斬り
        player.cbMode = 'axe';
        player.state = 'cbMorph';
        player.stateTimer = 20;
        resetMonsterSwingHitFlags();
        player.vx = player.facing * 4.6;
        addText('斧モード変形！', player.x - 14, player.y - 76, '#ffab40', 17);
        addParticles(player.x + 15, player.y - 35, '#ffab40', 12, 4);
      } else {
        // 斧 → 剣 変形斬り（ガードポイント付き）
        player.cbMode = 'sword';
        player.state = 'cbMorph';
        player.stateTimer = 18;
        resetMonsterSwingHitFlags();
        player.vx = player.facing * 4.2;
        addText('剣モード変形(GP)！', player.x - 18, player.y - 76, '#80deea', 17);
        addParticles(player.x + 15, player.y - 35, '#80deea', 12, 4);
      }
    }

    // L / C : 属性解放斬り / 超高出力属性解放斬り
    if ((code === 'KeyL' || code === 'KeyC') && ['idle', 'run', 'cbSwordSlash', 'cbAxeSlash', 'cbMorph', 'cbChargePhial'].includes(player.state)) {
      if (player.cbPhials <= 0) {
        addText('ビン未装填！(剣撃→K/Xで装填)', player.x - 32, player.y - 74, '#ff8a80', 15);
        return;
      }
      player.cbMode = 'axe';
      player.cbUltraRelease = (player.cbPhials >= MAX_PHIALS);
      player.state = 'cbAed';
      player.stateTimer = player.cbUltraRelease ? 34 : 26;
      resetMonsterSwingHitFlags();
      player.vx = player.facing * 5.0;
      if (player.cbUltraRelease) {
        addText('超高出力属性解放斬り！！', player.x - 34, player.y - 84, '#ff5252', 20);
      } else {
        addText('高出力属性解放斬り！', player.x - 24, player.y - 80, '#ffd74f', 18);
      }
    }
  };

  // 4. プレイヤー更新フック
  EC.hooks.onUpdatePlayer = function(ctx) {
    const {
      canvas, GROUND_Y, GRAVITY, player, activeMonsters, keys,
      addText, addParticles, rectIntersect, getMonsterBody,
      getCurrentWeapon, computeWeaponHitDamage, resetMonsterSwingHitFlags
    } = ctx;

    if (player.weaponType !== 'chargeblade') {
      if (prevOnUpdatePlayer) return prevOnUpdatePlayer(ctx);
      return false;
    }
    initChargeBladeState(player);

    if (player.cbShockwaveFx > 0) player.cbShockwaveFx--;

    if (player.state !== 'dodge') {
      player.stamina = Math.min(player.maxStamina, player.stamina + 0.36);
    }
    if (player.bubblyBuffTimer > 0) player.bubblyBuffTimer--;
    if (player.burnTimer > 0) {
      player.burnTimer--;
      if (player.burnTimer % 30 === 0) player.hp = Math.max(1, player.hp - 2);
    }
    if (player.thunderBlightTimer > 0) player.thunderBlightTimer--;
    if (player.bubbleTimer > 0) player.bubbleTimer--;
    if (player.poisonTimer > 0) {
      player.poisonTimer--;
      if (player.poisonTimer % 35 === 0) player.hp = Math.max(1, player.hp - 2);
    }
    if (player.invulnTimer > 0) player.invulnTimer--;

    const isBubbled = player.bubbleTimer > 0;

    if (player.paralysisTimer > 0) {
      player.paralysisTimer--;
      player.vx *= 0.7;
      player.attackHitbox = null;
      if (player.state !== 'hurt') player.state = 'idle';
    } else if (['idle', 'run', 'jump'].includes(player.state)) {
      let move = 0;
      if (keys['KeyA'] || keys['ArrowLeft']) move -= 1;
      if (keys['KeyD'] || keys['ArrowRight']) move += 1;
      const maxSpeed = player.cbMode === 'sword' ? 4.9 : 3.8; // 剣は軽快、斧は重厚
      if (move !== 0) {
        player.facing = move;
        player.vx = isBubbled ? Math.max(-maxSpeed * 1.25, Math.min(maxSpeed * 1.25, player.vx + move * 0.42)) : move * maxSpeed;
        if (player.y >= GROUND_Y) player.state = 'run';
      } else {
        player.vx *= isBubbled ? 0.95 : 0.7;
        if (Math.abs(player.vx) < 0.08) player.vx = 0;
        if (player.y >= GROUND_Y) player.state = 'idle';
      }
      if ((keys['KeyW'] || keys['Space'] || keys['ArrowUp']) && player.y >= GROUND_Y) {
        player.vy = -12.3;
        player.state = 'jump';
      }
    } else if (player.state === 'cbSwordSlash') {
      player.vx *= 0.84;
      player.stateTimer--;
      player.attackHitbox = (player.stateTimer >= 4 && player.stateTimer <= 12)
        ? { x: player.facing === 1 ? player.x + 15 : player.x - 84, y: player.y - 70, w: 84, h: 70 }
        : null;
      if (player.stateTimer <= 0) { player.state = 'idle'; player.attackHitbox = null; }
    } else if (player.state === 'cbAxeSlash') {
      player.vx *= 0.82;
      player.stateTimer--;
      player.attackHitbox = (player.stateTimer >= 5 && player.stateTimer <= 16)
        ? { x: player.facing === 1 ? player.x + 15 : player.x - 122, y: player.y - 90, w: 122, h: 90 }
        : null;
      if (player.stateTimer <= 0) { player.state = 'idle'; player.attackHitbox = null; }
    } else if (player.state === 'cbChargePhial') {
      player.vx *= 0.7;
      player.stateTimer--;
      if (player.stateTimer <= 0) player.state = 'idle';
    } else if (player.state === 'cbMorph') {
      player.vx *= 0.84;
      player.stateTimer--;
      player.attackHitbox = (player.stateTimer >= 4 && player.stateTimer <= 15)
        ? { x: player.facing === 1 ? player.x + 15 : player.x - 110, y: player.y - 84, w: 110, h: 84 }
        : null;
      if (player.stateTimer <= 0) { player.state = 'idle'; player.attackHitbox = null; }
    } else if (player.state === 'cbAed') {
      player.vx *= 0.85;
      player.stateTimer--;
      const slamFrame = player.cbUltraRelease ? 14 : 11;

      if (player.stateTimer === slamFrame) {
        // 斧叩きつけ＋ビン爆発衝撃波発生！！
        resetMonsterSwingHitFlags();
        player.cbShockwaveFx = 16;
        const usedPhials = player.cbUltraRelease ? player.cbPhials : 1;
        player.cbPhials = Math.max(0, player.cbPhials - usedPhials);
        ctx.screenShake = player.cbUltraRelease ? 13 : 7;

        const waveX = player.x + 15 + player.facing * 110;
        const waveColor = player.cbUltraRelease ? '#ff5252' : '#ffd54f';
        addParticles(waveX, GROUND_Y - 22, waveColor, player.cbUltraRelease ? 32 : 18, 8);
        addParticles(waveX + player.facing * 55, GROUND_Y - 22, '#00e5ff', player.cbUltraRelease ? 22 : 10, 7);
      }

      if (player.stateTimer <= slamFrame && player.stateTimer >= 4) {
        const reach = player.cbUltraRelease ? 225 : 155;
        player.attackHitbox = {
          x: player.facing === 1 ? player.x + 15 : player.x - reach,
          y: player.y - 96,
          w: reach,
          h: 96
        };
      } else {
        player.attackHitbox = null;
      }

      if (player.stateTimer <= 0) {
        player.state = 'idle';
        player.attackHitbox = null;
        player.cbUltraRelease = false;
      }
    } else if (player.state === 'dodge' || player.state === 'hurt') {
      player.vx *= isBubbled ? 0.94 : 0.9;
      player.stateTimer--;
      if (player.stateTimer <= 0) player.state = 'idle';
    }

    player.vy += GRAVITY;
    player.x += player.vx;
    player.y += player.vy;
    if (player.y >= GROUND_Y) { player.y = GROUND_Y; player.vy = 0; }
    player.x = Math.max(20, Math.min(canvas.width - 50, player.x));

    // 攻撃ヒット処理
    if (player.attackHitbox) {
      const weapon = getCurrentWeapon();
      const sparkColors = { fire: '#ff6d00', water: '#4fc3f7', thunder: '#00e5ff', ice: '#80deea', dragon: '#d500f9', none: '#ffd54f' };
      const hitSparkColor = sparkColors[weapon.element] || '#ffd54f';

      for (const m of activeMonsters) {
        if (m.hp <= 0 || m.hasHitThisSwingByPlayer) continue;
        if (!rectIntersect(player.attackHitbox, getMonsterBody(m))) continue;

        m.hasHitThisSwingByPlayer = true;
        m.flashTimer = 6;
        player.hasHitThisSwing = true;

        let dmg = 0;
        let staggerChance = 0.14;
        let textSize = 21;
        let textColor = '#ffd700';

        if (player.state === 'cbSwordSlash') {
          const res = computeWeaponHitDamage(24, weapon, 1.0, m.species);
          dmg = res.dmg;
          staggerChance = 0.10;
          player.cbEnergy = Math.min(100, player.cbEnergy + 28); // 剣撃ヒットでエネルギー蓄積
          addParticles(m.x + 40, m.y - 45, hitSparkColor, 11, 5);
        } else if (player.state === 'cbAxeSlash') {
          const res = computeWeaponHitDamage(44, weapon, 1.1, m.species);
          dmg = res.dmg;
          staggerChance = 0.22;
          textSize = 24;
          ctx.screenShake = Math.max(ctx.screenShake, 5);
          addParticles(m.x + 40, m.y - 45, hitSparkColor, 15, 6);
        } else if (player.state === 'cbMorph') {
          const res = computeWeaponHitDamage(36, weapon, 1.05, m.species);
          dmg = res.dmg;
          staggerChance = 0.18;
          textSize = 23;
          addParticles(m.x + 40, m.y - 45, hitSparkColor, 13, 5);
        } else if (player.state === 'cbAed') {
          const slamRes = computeWeaponHitDamage(player.cbUltraRelease ? 76 : 52, weapon, 1.2, m.species);
          const phialBonus = player.cbUltraRelease
            ? Math.round((34 + weapon.attack * 0.28) * 5) // 5ビン一斉爆発ダメージ
            : Math.round(36 + weapon.attack * 0.25);
          dmg = slamRes.dmg + phialBonus;
          staggerChance = player.cbUltraRelease ? 0.45 : 0.28;
          textSize = player.cbUltraRelease ? 30 : 25;
          textColor = player.cbUltraRelease ? '#ff5252' : '#ffd54f';
          addParticles(m.x + 40, m.y - 45, hitSparkColor, 26, 8);
          addText(`ビン爆発+${phialBonus}`, m.x + 25, m.y - 84, textColor, 16);
        }

        m.hp -= dmg;
        addText(dmg, m.x + 40 + (Math.random() * 18 - 9), m.y - 60, textColor, textSize);

        if (m.hp <= 0) {
          m.hp = 0;
          m.attackHitbox = null;
          addText('部位破壊・討伐！', m.x + 10, m.y - 95, '#ffd700', 22);
          addParticles(m.x + m.w / 2, m.y - 45, '#ffd700', 24, 7);
          continue;
        }

        if (Math.random() < staggerChance && m.state !== 'stagger') {
          m.state = 'stagger';
          m.stateTimer = 50;
          m.isFlying = false;
          m.isCharged = false;
          m.somersaultAngle = 0;
          m.attackHitbox = null;
          addText('怯み！', m.x + 25, m.y - 100, '#ffaa00', 24);
        }
      }
    }

    return true;
  };

  // 5. 剣盾モード＆巨大回転斧モード描画フック
  EC.hooks.onDrawPlayerWeapon = function(handX, handY, hookCtx) {
    const { ctx, player, getCurrentWeapon } = hookCtx;
    if (player.weaponType !== 'chargeblade') {
      if (prevOnDrawPlayerWeapon) return prevOnDrawPlayerWeapon(handX, handY, hookCtx);
      return;
    }
    initChargeBladeState(player);

    const wpn = getCurrentWeapon();
    const elemColors = {
      fire: '#ff6d00',
      thunder: '#00e5ff',
      ice: '#80deea',
      dragon: '#d500f9',
      none: '#cfd8dc'
    };
    const bladeCol = elemColors[wpn.element] || '#cfd8dc';

    ctx.save();
    if (player.cbMode === 'sword') {
      // 剣モード：剣＋大盾
      const isSlashing = player.state === 'cbSwordSlash';
      ctx.strokeStyle = player.cbEnergy >= 80 ? '#ff5252' : (player.cbEnergy >= 40 ? '#ffd74f' : bladeCol);
      ctx.lineWidth = 4.5;
      if (player.cbEnergy >= 40 || wpn.element !== 'none') {
        ctx.shadowColor = player.cbEnergy >= 80 ? '#ff5252' : bladeCol;
        ctx.shadowBlur = 10;
      }
      ctx.beginPath();
      ctx.moveTo(handX, handY);
      if (isSlashing) {
        ctx.lineTo(handX + player.facing * 68, handY - 6);
      } else {
        ctx.lineTo(handX - player.facing * 38, handY - 34);
      }
      ctx.stroke();

      // チャージ盾
      const shieldX = player.facing === 1 ? handX - 16 : handX + 2;
      const shieldY = handY - 18;
      ctx.fillStyle = player.cbPhials > 0 ? '#ffa000' : '#607d8b';
      ctx.strokeStyle = '#eceff1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(shieldX, shieldY, 16, 32, 4);
      ctx.fill();
      ctx.stroke();
    } else {
      // 斧モード：盾が合体した巨大な回転斧
      const isSwing = ['cbAxeSlash', 'cbMorph', 'cbAed'].includes(player.state);
      ctx.translate(handX, handY);
      let angle = player.facing === 1 ? -2.25 : -0.89;
      if (isSwing) {
        angle = player.facing === 1 ? 0.12 : Math.PI - 0.12;
      }
      ctx.rotate(angle);

      ctx.shadowColor = player.cbUltraRelease ? '#ff5252' : bladeCol;
      ctx.shadowBlur = player.cbUltraRelease ? 16 : 10;

      // 柄
      ctx.fillStyle = '#37474f';
      ctx.fillRect(-10, -4, 78, 8);

      // 巨大な盾斧ヘッド
      ctx.fillStyle = bladeCol;
      ctx.beginPath();
      ctx.arc(76, 0, 26, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ffd54f';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.restore();

    // 高出力／超高出力の衝撃波エフェクト描画
    if (player.cbShockwaveFx > 0) {
      const alpha = player.cbShockwaveFx / 16;
      const waveCount = player.cbUltraRelease ? 4 : 2;
      ctx.save();
      for (let i = 0; i < waveCount; i++) {
        const wx = handX + player.facing * (70 + i * 42);
        const wy = handY + 26;
        ctx.fillStyle = player.cbUltraRelease
          ? `rgba(255, 82, 82, ${alpha * 0.65})`
          : `rgba(255, 213, 79, ${alpha * 0.65})`;
        ctx.beginPath();
        ctx.arc(wx, wy, (28 + i * 6) * alpha, Math.PI, 0);
        ctx.fill();
      }
      ctx.restore();
    }
  };

  // 6. 武器専用UI（剣撃エネルギーバー＋ビン5本アイコン）
  EC.hooks.onDrawWeaponUI = function(hookCtx) {
    const { ctx, player } = hookCtx;
    if (player.weaponType !== 'chargeblade') {
      if (prevOnDrawWeaponUI) return prevOnDrawWeaponUI(hookCtx);
      return;
    }
    initChargeBladeState(player);

    // 剣撃エネルギーゲージ（左側）
    ctx.fillStyle = '#222';
    ctx.fillRect(20, 56, 72, 12);
    const eCol = player.cbEnergy >= 80 ? '#ff5252' : (player.cbEnergy >= 40 ? '#ffd74f' : '#90a4ae');
    ctx.fillStyle = eCol;
    ctx.fillRect(20, 56, 72 * (player.cbEnergy / 100), 12);
    ctx.strokeStyle = eCol;
    ctx.strokeRect(20, 56, 72, 12);

    // ビン5本表示（右側）
    for (let i = 0; i < MAX_PHIALS; i++) {
      const px = 98 + i * 21;
      const filled = i < player.cbPhials;
      ctx.fillStyle = filled ? (player.cbPhials === MAX_PHIALS ? '#ff5252' : '#ffd54f') : '#263238';
      ctx.fillRect(px, 56, 17, 12);
      ctx.strokeStyle = filled ? '#fff59d' : '#546e7a';
      ctx.strokeRect(px, 56, 17, 12);
    }
  };

  // 7. 斧変形(GP)時のダメージ軽減＆リセット・武器切替フック
  EC.hooks.onResetGame = function(hookCtx) {
    initChargeBladeState(hookCtx.player);
    hookCtx.player.cbMode = 'sword';
    hookCtx.player.cbEnergy = 0;
    hookCtx.player.cbPhials = 0;
    hookCtx.player.cbShockwaveFx = 0;
    hookCtx.player.cbUltraRelease = false;
    if (prevOnResetGame) prevOnResetGame(hookCtx);
  };

  EC.hooks.onSwitchWeapon = function(hookCtx) {
    initChargeBladeState(hookCtx.player);
    if (prevOnSwitchWeapon) prevOnSwitchWeapon(hookCtx);
  };

  window.addEventListener('load', function() {
    if (typeof window.damagePlayer === 'function') {
      const origDamagePlayer = window.damagePlayer;
      window.damagePlayer = function(amount, isFire, isPoison, isElectric, isBubble) {
        if (player.weaponType === 'chargeblade' && player.state === 'cbMorph' && player.cbMode === 'sword') {
          const reduced = Math.max(1, Math.floor(amount * 0.25));
          player.hp = Math.max(0, player.hp - reduced);
          player.invulnTimer = 28;
          addText(`-${reduced} (ガードポイント！)`, player.x - 20, player.y - 74, '#80deea', 18);
          return;
        }
        return origDamagePlayer.apply(this, arguments);
      };
    }
  });
})();
// ==========================================
// 新武器種：操虫棍（Insect Glaive）追加モジュール
// ==========================================
(function() {
  const EC = window.EXTRA_CONTENT = window.EXTRA_CONTENT || {};
  EC.weaponTypes = EC.weaponTypes || [];
  EC.weapons = EC.weapons || {};
  EC.hooks = EC.hooks || {};

  // 1. 武器種登録
  EC.weaponTypes.push({
    key: 'glaive',
    label: '操虫棍',
    controlsHtml: '薙ぎ払い/空中斬り: <span class="key">J</span>/<span class="key">Z</span> ｜ 猟虫エキス採取: <span class="key">K</span>/<span class="key">X</span> ｜ 跳躍/急襲突き: <span class="key">L</span>/<span class="key">C</span>'
  });

  // 2. 操虫棍ラインナップ登録
  EC.weapons.glaive = [
    { id: 'iron_ig', type: 'glaive', name: 'アイアンブレード', element: 'none', elementLabel: '無属性', attack: 85 },
    { id: 'rathalos_ig', type: 'glaive', name: '火竜棍【炎舞】', element: 'fire', elementLabel: '火属性', attack: 120 },
    { id: 'zinogre_ig', type: 'glaive', name: '王牙棍【別雷】', element: 'thunder', elementLabel: '雷属性', attack: 125 },
    { id: 'barioth_ig', type: 'glaive', name: '琥珀の鋭矛', element: 'ice', elementLabel: '氷属性', attack: 135 },
    { id: 'gore_ig', type: 'glaive', name: 'THEチェイサー', element: 'dragon', elementLabel: '龍属性', attack: 155 }
  ];

  // 既存フックを退避
  const prevOnPlayerAction = EC.hooks.onPlayerAction;
  const prevOnUpdatePlayer = EC.hooks.onUpdatePlayer;
  const prevOnDrawPlayerWeapon = EC.hooks.onDrawPlayerWeapon;
  const prevOnDrawWeaponUI = EC.hooks.onDrawWeaponUI;
  const prevOnResetGame = EC.hooks.onResetGame;
  const prevOnSwitchWeapon = EC.hooks.onSwitchWeapon;

  function initGlaiveState(player) {
    if (!player.igExtracts) player.igExtracts = { red: false, white: false, orange: false };
    if (typeof player.igExtractTimer !== 'number') player.igExtractTimer = 0;
    if (typeof player.igAirCombo !== 'number') player.igAirCombo = 0;
    if (!player.igKinsect) player.igKinsect = { active: false, x: 0, y: 0, vx: 0, timer: 0, hitDone: false };
  }

  function hasTripleUp(player) {
    const e = player.igExtracts;
    return e && e.red && e.white && e.orange;
  }

  // 3. アクション入力フック
  EC.hooks.onPlayerAction = function(code, ctx) {
    const { GROUND_Y, player, addText, addParticles, resetMonsterSwingHitFlags } = ctx;
    if (player.weaponType !== 'glaive') {
      if (prevOnPlayerAction) return prevOnPlayerAction(code, ctx);
      return;
    }
    initGlaiveState(player);

    const isAirborne = player.y < GROUND_Y - 5;

    // J / Z : 地上連続薙ぎ払い or 空中舞踏斬り
    if ((code === 'KeyJ' || code === 'KeyZ') && ['idle', 'run', 'jump', 'igVault'].includes(player.state)) {
      if (isAirborne) {
        player.state = 'igAirSlash';
        player.stateTimer = 18;
        resetMonsterSwingHitFlags();
        player.vx = player.facing * 5.8;
        player.vy = Math.min(player.vy, -2.5);
      } else {
        player.state = 'igSlash';
        player.stateTimer = player.igExtracts.red ? 20 : 16;
        resetMonsterSwingHitFlags();
        player.vx = player.facing * 3.8;
      }
    }

    // K / X : 猟虫飛ばし（3色エキス採取）
    if ((code === 'KeyK' || code === 'KeyX') && !player.igKinsect.active &&
        ['idle', 'run', 'jump', 'igSlash', 'igAirSlash', 'igVault'].includes(player.state)) {
      player.igKinsect = {
        active: true,
        x: player.x + 15 + player.facing * 20,
        y: player.y - 38,
        vx: player.facing * 14.5,
        timer: 26,
        hitDone: false
      };
      addParticles(player.igKinsect.x, player.igKinsect.y, '#80deea', 8, 3);
    }

    // L / C : 地上なら跳躍（ポールヴォルト）、空中なら急襲突き！
    if ((code === 'KeyL' || code === 'KeyC') && ['idle', 'run', 'jump', 'igSlash', 'igAirSlash', 'igVault'].includes(player.state)) {
      if (!isAirborne && player.stamina >= 15) {
        player.stamina -= 15;
        player.state = 'igVault';
        player.stateTimer = 24;
        player.igAirCombo = 0;
        player.vy = player.igExtracts.white ? -16.2 : -14.2;
        player.vx = player.facing * 5.2;
        addParticles(player.x + 15, GROUND_Y, '#cfd8dc', 12, 4);
      } else if (isAirborne && player.state !== 'igDive') {
        player.state = 'igDive';
        player.stateTimer = 28;
        resetMonsterSwingHitFlags();
        player.vx = player.facing * 4.5;
        player.vy = 14.5;
        addText('急襲突き！', player.x - 10, player.y - 72, '#00e5ff', 17);
      }
    }
  };

  // 4. プレイヤー＆猟虫更新フック
  EC.hooks.onUpdatePlayer = function(ctx) {
    const {
      canvas, GROUND_Y, GRAVITY, player, activeMonsters, keys,
      addText, addParticles, rectIntersect, getMonsterBody,
      getCurrentWeapon, computeWeaponHitDamage, resetMonsterSwingHitFlags
    } = ctx;

    if (player.weaponType !== 'glaive') {
      if (prevOnUpdatePlayer) return prevOnUpdatePlayer(ctx);
      return false;
    }
    initGlaiveState(player);

    // エキス効果タイマー
    if (player.igExtractTimer > 0) {
      player.igExtractTimer--;
      if (player.igExtractTimer <= 0) {
        player.igExtracts = { red: false, white: false, orange: false };
        addText('エキス効果終了', player.x - 16, player.y - 74, '#b0bec5', 15);
      }
    }

    // 猟虫の飛行＆エキス採取判定
    const k = player.igKinsect;
    if (k.active) {
      k.x += k.vx;
      k.timer--;
      if (k.timer % 2 === 0) addParticles(k.x, k.y, '#84ffff', 2, 2);

      if (!k.hitDone) {
        const kBox = { x: k.x - 12, y: k.y - 12, w: 24, h: 24 };
        for (const m of activeMonsters) {
          if (m.hp <= 0) continue;
          if (rectIntersect(kBox, getMonsterBody(m))) {
            k.hitDone = true;
            k.active = false;
            m.flashTimer = 4;
            const weapon = getCurrentWeapon();
            const kDmg = Math.round(14 + weapon.attack * 0.12);
            m.hp = Math.max(0, m.hp - kDmg);

            // 赤 → 白 → 橙 の順で未取得エキスを採取（全取得済みなら時間延長）
            const e = player.igExtracts;
            let gotLabel = '';
            let gotCol = '#ffd700';
            if (!e.red) {
              e.red = true;
              gotLabel = '赤エキス採取(攻撃強化)！';
              gotCol = '#ff5252';
            } else if (!e.white) {
              e.white = true;
              gotLabel = '白エキス採取(機動強化)！';
              gotCol = '#ffffff';
            } else if (!e.orange) {
              e.orange = true;
              gotLabel = '橙エキス採取(防御強化)！';
              gotCol = '#ffa726';
            } else {
              gotLabel = 'エキス時間延長！';
              gotCol = '#00e5ff';
            }

            player.igExtractTimer = hasTripleUp(player) ? 1200 : 900; // トリプルアップで20秒間
            if (hasTripleUp(player) && gotLabel.includes('橙エキス')) {
              gotLabel = 'トリプルアップ発動！！';
              gotCol = '#00e5ff';
              addParticles(player.x + 15, player.y - 35, '#00e5ff', 24, 6);
            }

            addText(kDmg, k.x, k.y - 24, '#80ffff', 18);
            addText(gotLabel, player.x - 24, player.y - 82, gotCol, 18);
            addParticles(k.x, k.y, gotCol, 14, 5);
            break;
          }
        }
      }
      if (k.timer <= 0 || k.x < 10 || k.x > canvas.width - 10) {
        k.active = false;
      }
    }

    if (player.state !== 'dodge') {
      player.stamina = Math.min(player.maxStamina, player.stamina + 0.4);
    }
    if (player.bubblyBuffTimer > 0) player.bubblyBuffTimer--;
    if (player.burnTimer > 0) {
      player.burnTimer--;
      if (player.burnTimer % 30 === 0) player.hp = Math.max(1, player.hp - 2);
    }
    if (player.thunderBlightTimer > 0) player.thunderBlightTimer--;
    if (player.bubbleTimer > 0) player.bubbleTimer--;
    if (player.poisonTimer > 0) {
      player.poisonTimer--;
      if (player.poisonTimer % 35 === 0) player.hp = Math.max(1, player.hp - 2);
    }
    if (player.invulnTimer > 0) player.invulnTimer--;

    const isBubbled = player.bubbleTimer > 0;

    if (player.paralysisTimer > 0) {
      player.paralysisTimer--;
      player.vx *= 0.7;
      player.attackHitbox = null;
      if (player.state !== 'hurt') player.state = 'idle';
    } else if (['idle', 'run', 'jump', 'igVault'].includes(player.state)) {
      let move = 0;
      if (keys['KeyA'] || keys['ArrowLeft']) move -= 1;
      if (keys['KeyD'] || keys['ArrowRight']) move += 1;
      const maxSpeed = player.igExtracts.white ? 5.8 : 4.9;
      if (move !== 0) {
        player.facing = move;
        player.vx = isBubbled ? Math.max(-maxSpeed * 1.25, Math.min(maxSpeed * 1.25, player.vx + move * 0.45)) : move * maxSpeed;
        if (player.y >= GROUND_Y) player.state = 'run';
      } else {
        player.vx *= isBubbled ? 0.95 : 0.7;
        if (Math.abs(player.vx) < 0.08) player.vx = 0;
        if (player.y >= GROUND_Y) player.state = 'idle';
      }
      if ((keys['KeyW'] || keys['Space'] || keys['ArrowUp']) && player.y >= GROUND_Y) {
        player.vy = player.igExtracts.white ? -13.6 : -12.4;
        player.state = 'jump';
      }
      if (player.state === 'igVault') {
        player.stateTimer--;
        if (player.stateTimer <= 0) player.state = player.y < GROUND_Y ? 'jump' : 'idle';
      }
    } else if (player.state === 'igSlash') {
      player.vx *= 0.84;
      player.stateTimer--;
      // 赤エキス時は途中でヒットリセットして多段強化連撃！
      if (player.igExtracts.red && player.stateTimer === 10) resetMonsterSwingHitFlags();
      player.attackHitbox = (player.stateTimer >= 3 && player.stateTimer <= 15)
        ? { x: player.facing === 1 ? player.x + 12 : player.x - 96, y: player.y - 76, w: 96, h: 76 }
        : null;
      if (player.stateTimer <= 0) { player.state = 'idle'; player.attackHitbox = null; }
    } else if (player.state === 'igAirSlash') {
      player.stateTimer--;
      player.attackHitbox = (player.stateTimer >= 3 && player.stateTimer <= 15)
        ? { x: player.facing === 1 ? player.x - 10 : player.x - 78, y: player.y - 82, w: 118, h: 82 }
        : null;
      if (player.stateTimer <= 0) {
        player.state = player.y < GROUND_Y ? 'jump' : 'idle';
        player.attackHitbox = null;
      }
    } else if (player.state === 'igDive') {
      player.stateTimer--;
      player.attackHitbox = {
        x: player.facing === 1 ? player.x + 6 : player.x - 58,
        y: player.y - 60,
        w: 82,
        h: 72
      };
      if (player.y >= GROUND_Y || player.stateTimer <= 0) {
        player.state = 'idle';
        player.attackHitbox = null;
        ctx.screenShake = Math.max(ctx.screenShake, 5);
        addParticles(player.x + 15, GROUND_Y, '#00e5ff', 14, 5);
      }
    } else if (player.state === 'dodge' || player.state === 'hurt') {
      player.vx *= isBubbled ? 0.94 : 0.9;
      player.stateTimer--;
      if (player.stateTimer <= 0) player.state = 'idle';
    }

    player.vy += (player.state === 'igAirSlash' ? GRAVITY * 0.45 : GRAVITY);
    player.x += player.vx;
    player.y += player.vy;
    if (player.y >= GROUND_Y) {
      player.y = GROUND_Y;
      player.vy = 0;
      player.igAirCombo = 0;
      if (player.state === 'jump' || player.state === 'igVault') player.state = 'idle';
    }
    player.x = Math.max(20, Math.min(canvas.width - 50, player.x));

    // 攻撃ヒット処理
    if (player.attackHitbox) {
      const weapon = getCurrentWeapon();
      const sparkColors = { fire: '#ff6d00', water: '#4fc3f7', thunder: '#00e5ff', ice: '#80deea', dragon: '#d500f9', none: '#84ffff' };
      const hitSparkColor = sparkColors[weapon.element] || '#84ffff';
      const triple = hasTripleUp(player);
      const extractMult = triple ? 1.32 : (player.igExtracts.red ? 1.18 : 1.0);

      for (const m of activeMonsters) {
        if (m.hp <= 0 || m.hasHitThisSwingByPlayer) continue;
        if (!rectIntersect(player.attackHitbox, getMonsterBody(m))) continue;

        m.hasHitThisSwingByPlayer = true;
        m.flashTimer = 6;
        player.hasHitThisSwing = true;

        let mv = 24;
        let staggerChance = 0.12;
        let textSize = 21;

        if (player.state === 'igSlash') {
          mv = player.igExtracts.red ? 21 : 26;
          staggerChance = 0.13;
          addParticles(m.x + 40, m.y - 45, hitSparkColor, 11, 5);
        } else if (player.state === 'igAirSlash') {
          mv = 28 + player.igAirCombo * 6;
          staggerChance = 0.16;
          textSize = 22;
          // 空中舞踏斬りヒットで再跳躍（最大3回まで舞踏コンボ継続！）
          if (player.igAirCombo < 3) {
            player.igAirCombo++;
            player.vy = -11.5;
            addText(`舞踏跳躍 ${player.igAirCombo}連！`, player.x - 16, player.y - 78, '#84ffff', 17);
          }
          addParticles(m.x + 40, m.y - 45, '#00e5ff', 14, 6);
        } else if (player.state === 'igDive') {
          mv = 54 + player.igAirCombo * 10; // 空中コンボを重ねるほど急襲突きが超火力化！
          staggerChance = 0.28;
          textSize = 26;
          ctx.screenShake = Math.max(ctx.screenShake, 7);
          addParticles(m.x + 40, m.y - 45, hitSparkColor, 20, 7);
        }

        const result = computeWeaponHitDamage(mv, weapon, extractMult, m.species);
        m.hp -= result.dmg;

        const dmgColor = triple ? '#00e5ff' : (player.igExtracts.red ? '#ff8a80' : '#ffd700');
        addText(result.dmg, m.x + 40 + (Math.random() * 18 - 9), m.y - 60, dmgColor, textSize);

        if (m.hp <= 0) {
          m.hp = 0;
          m.attackHitbox = null;
          addText('部位破壊・討伐！', m.x + 10, m.y - 95, '#ffd700', 22);
          addParticles(m.x + m.w / 2, m.y - 45, '#ffd700', 24, 7);
          continue;
        }

        if (Math.random() < staggerChance && m.state !== 'stagger') {
          m.state = 'stagger';
          m.stateTimer = 50;
          m.isFlying = false;
          m.isCharged = false;
          m.somersaultAngle = 0;
          m.attackHitbox = null;
          addText('怯み！', m.x + 25, m.y - 100, '#ffaa00', 24);
        }
      }
    }

    return true;
  };

  // 5. 両刃長棍＆猟虫の描画フック
  EC.hooks.onDrawPlayerWeapon = function(handX, handY, hookCtx) {
    const { ctx, player, getCurrentWeapon } = hookCtx;
    if (player.weaponType !== 'glaive') {
      if (prevOnDrawPlayerWeapon) return prevOnDrawPlayerWeapon(handX, handY, hookCtx);
      return;
    }
    initGlaiveState(player);

    const wpn = getCurrentWeapon();
    const elemColors = {
      fire: '#ff6d00',
      thunder: '#00e5ff',
      ice: '#80deea',
      dragon: '#d500f9',
      none: '#cfd8dc'
    };
    const bladeCol = elemColors[wpn.element] || '#cfd8dc';
    const triple = hasTripleUp(player);

    ctx.save();
    ctx.translate(handX, handY);

    let angle = player.facing === 1 ? -0.65 : Math.PI + 0.65;
    if (player.state === 'igAirSlash') {
      angle = (Date.now() * 0.03) * player.facing; // 空中回転！
    } else if (player.state === 'igDive') {
      angle = Math.PI / 2; // 真下突き！
    } else if (player.state === 'igSlash') {
      angle = player.facing === 1 ? 0.1 : Math.PI - 0.1;
    }
    ctx.rotate(angle);

    if (triple || player.igExtracts.red || wpn.element !== 'none') {
      ctx.shadowColor = triple ? '#00e5ff' : (player.igExtracts.red ? '#ff5252' : bladeCol);
      ctx.shadowBlur = triple ? 15 : 10;
    }

    // 長棍の柄
    ctx.fillStyle = '#455a64';
    ctx.fillRect(-52, -3, 104, 6);

    // 両端の薙刀刃
    ctx.fillStyle = bladeCol;
    ctx.beginPath();
    ctx.moveTo(46, -5); ctx.lineTo(74, 0); ctx.lineTo(46, 5);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-46, -5); ctx.lineTo(-70, 0); ctx.lineTo(-46, 5);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // 空中回転斬りの風圧リング
    if (player.state === 'igAirSlash') {
      ctx.save();
      ctx.strokeStyle = triple ? 'rgba(0, 229, 255, 0.7)' : 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(handX, handY, 54, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 飛行中の猟虫（キンセクト）描画
    const k = player.igKinsect;
    if (k.active) {
      ctx.save();
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#84ffff';
      ctx.beginPath();
      ctx.ellipse(k.x, k.y, 10, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // 羽ばたき表現
      const wingY = Math.sin(Date.now() * 0.08) * 6;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(k.x, k.y);
      ctx.lineTo(k.x - 4, k.y - 8 + wingY);
      ctx.moveTo(k.x, k.y);
      ctx.lineTo(k.x + 4, k.y - 8 - wingY);
      ctx.stroke();
      ctx.restore();
    }
  };

  // 6. 武器専用UI（赤・白・橙の3色エキスアイコン＆効果時間バー）
  EC.hooks.onDrawWeaponUI = function(hookCtx) {
    const { ctx, player } = hookCtx;
    if (player.weaponType !== 'glaive') {
      if (prevOnDrawWeaponUI) return prevOnDrawWeaponUI(hookCtx);
      return;
    }
    initGlaiveState(player);

    const e = player.igExtracts;
    const slots = [
      { active: e.red, color: '#ff5252', label: '赤' },
      { active: e.white, color: '#ffffff', label: '白' },
      { active: e.orange, color: '#ffa726', label: '橙' }
    ];

    slots.forEach((s, idx) => {
      const sx = 20 + idx * 24;
      ctx.fillStyle = s.active ? s.color : '#263238';
      ctx.fillRect(sx, 56, 20, 12);
      ctx.strokeStyle = s.active ? '#00e5ff' : '#546e7a';
      ctx.strokeRect(sx, 56, 20, 12);
    });

    // エキス持続時間バー（右隣）
    const maxT = hasTripleUp(player) ? 1200 : 900;
    const ratio = player.igExtractTimer > 0 ? Math.min(1, player.igExtractTimer / maxT) : 0;
    ctx.fillStyle = '#222';
    ctx.fillRect(96, 56, 104, 12);
    ctx.fillStyle = hasTripleUp(player) ? '#00e5ff' : '#80deea';
    ctx.fillRect(96, 56, 104 * ratio, 12);
    ctx.strokeStyle = hasTripleUp(player) ? '#84ffff' : '#607d8b';
    ctx.strokeRect(96, 56, 104, 12);
  };

  // 7. 橙エキス防御強化・リセット・武器切替フック
  EC.hooks.onResetGame = function(hookCtx) {
    initGlaiveState(hookCtx.player);
    hookCtx.player.igExtracts = { red: false, white: false, orange: false };
    hookCtx.player.igExtractTimer = 0;
    hookCtx.player.igAirCombo = 0;
    hookCtx.player.igKinsect.active = false;
    if (prevOnResetGame) prevOnResetGame(hookCtx);
  };

  EC.hooks.onSwitchWeapon = function(hookCtx) {
    initGlaiveState(hookCtx.player);
    if (prevOnSwitchWeapon) prevOnSwitchWeapon(hookCtx);
  };

  // 橙エキス取得中は被ダメージ25%軽減
  window.addEventListener('load', function() {
    if (typeof window.damagePlayer === 'function') {
      const origDamagePlayer = window.damagePlayer;
      window.damagePlayer = function(amount, isFire, isPoison, isElectric, isBubble) {
        if (player.weaponType === 'glaive' && player.igExtracts && player.igExtracts.orange) {
          const reduced = Math.max(1, Math.floor(amount * 0.75));
          return origDamagePlayer.call(this, reduced, isFire, isPoison, isElectric, isBubble);
        }
        return origDamagePlayer.apply(this, arguments);
      };
    }
  });
})();
// ==========================================
// 新武器種：狩猟笛（Hunting Horn）追加モジュール
// ==========================================
(function() {
  const EC = window.EXTRA_CONTENT = window.EXTRA_CONTENT || {};
  EC.weaponTypes = EC.weaponTypes || [];
  EC.weapons = EC.weapons || {};
  EC.hooks = EC.hooks || {};

  // 1. 武器種登録
  EC.weaponTypes.push({
    key: 'horn',
    label: '狩猟笛',
    controlsHtml: 'ぶん回し(白♪): <span class="key">J</span>/<span class="key">Z</span> ｜ 連音打撃(赤♪): <span class="key">K</span>/<span class="key">X</span> ｜ 演奏＆音波: <span class="key">L</span>/<span class="key">C</span>'
  });

  // 2. 狩猟笛ラインナップ登録
  EC.weapons.horn = [
    { id: 'iron_hh', type: 'horn', name: 'アイアンホルン', element: 'none', elementLabel: '無属性', attack: 95 },
    { id: 'rathalos_hh', type: 'horn', name: '火竜笛【銀鈴】', element: 'fire', elementLabel: '火属性', attack: 130 },
    { id: 'zinogre_hh', type: 'horn', name: '王牙琴【鳴雷】', element: 'thunder', elementLabel: '雷属性', attack: 135 },
    { id: 'barioth_hh', type: 'horn', name: '氷結のグラース', element: 'ice', elementLabel: '氷属性', attack: 145 },
    { id: 'gore_hh', type: 'horn', name: 'THEレクイエム', element: 'dragon', elementLabel: '龍属性', attack: 165 }
  ];

  // 既存フックを退避
  const prevOnPlayerAction = EC.hooks.onPlayerAction;
  const prevOnUpdatePlayer = EC.hooks.onUpdatePlayer;
  const prevOnDrawPlayerWeapon = EC.hooks.onDrawPlayerWeapon;
  const prevOnDrawWeaponUI = EC.hooks.onDrawWeaponUI;
  const prevOnResetGame = EC.hooks.onResetGame;
  const prevOnSwitchWeapon = EC.hooks.onSwitchWeapon;

  function initHornState(player) {
    if (!Array.isArray(player.hhNotes)) player.hhNotes = []; // 最大3音 ('white' | 'red')
    if (typeof player.hhSelfBuffTimer !== 'number') player.hhSelfBuffTimer = 0; // 自分強化(移動UP)
    if (typeof player.hhAtkBuffTimer !== 'number') player.hhAtkBuffTimer = 0;   // 攻撃力UP【大】
    if (typeof player.hhRegenTimer !== 'number') player.hhRegenTimer = 0;       // 体力継続回復
    if (typeof player.hhSoundWaveFx !== 'number') player.hhSoundWaveFx = 0;
  }

  function pushNote(player, noteColor) {
    player.hhNotes.push(noteColor);
    if (player.hhNotes.length > 3) {
      player.hhNotes.shift();
    }
  }

  // 3. アクション入力フック
  EC.hooks.onPlayerAction = function(code, ctx) {
    const { player, addText, addParticles, resetMonsterSwingHitFlags } = ctx;
    if (player.weaponType !== 'horn') {
      if (prevOnPlayerAction) return prevOnPlayerAction(code, ctx);
      return;
    }
    initHornState(player);

    // J / Z : 前方ぶん回し（白音色♪）
    if ((code === 'KeyJ' || code === 'KeyZ') && ['idle', 'run', 'jump'].includes(player.state)) {
      player.state = 'hhSwing';
      player.stateTimer = 18;
      pushNote(player, 'white');
      resetMonsterSwingHitFlags();
      player.vx = player.facing * 3.4;
      addParticles(player.x + 15, player.y - 68, '#ffffff', 6, 2.5);
    }

    // K / X : 後方連音打撃（赤音色♪・2連ヒット）
    if ((code === 'KeyK' || code === 'KeyX') && ['idle', 'run', 'jump', 'hhSwing'].includes(player.state)) {
      player.state = 'hhDoubleBeat';
      player.stateTimer = 21;
      pushNote(player, 'red');
      resetMonsterSwingHitFlags();
      player.vx = player.facing * 2.8;
      addParticles(player.x + 15, player.y - 68, '#ff5252', 7, 2.8);
    }

    // L / C : 演奏攻撃（音波衝撃波＋旋律バフ発動！）
    if ((code === 'KeyL' || code === 'KeyC') && ['idle', 'run', 'hhSwing', 'hhDoubleBeat'].includes(player.state)) {
      player.state = 'hhPerform';
      player.stateTimer = 26;
      player.hhSoundWaveFx = 22;
      resetMonsterSwingHitFlags();
      player.vx = 0;
      ctx.screenShake = 6;

      const notes = player.hhNotes;
      const hasWhite = notes.includes('white');
      const hasRed = notes.includes('red');
      const isTrio = notes.length >= 3;

      if (notes.length > 0) {
        const buffDuration = 1200; // 20秒
        let labels = [];
        if (hasWhite) {
          player.hhSelfBuffTimer = buffDuration;
          labels.push('自分強化');
        }
        if (hasRed) {
          player.hhAtkBuffTimer = buffDuration;
          labels.push('攻撃力UP【大】');
        }
        if (isTrio) {
          player.hhRegenTimer = 600; // 10秒継続回復
          player.hp = Math.min(player.maxHp, player.hp + 20);
          labels.push('体力回復＆継続回復');
        }
        const title = isTrio ? `三音演奏！【${labels.join('・')}】` : `旋律発動！【${labels.join('・')}】`;
        addText(title, player.x - 36, player.y - 88, isTrio ? '#00e5ff' : '#ffd54f', 19);
        addParticles(player.x + 15, player.y - 40, isTrio ? '#00e5ff' : '#ffd54f', 24, 6);
        player.hhNotes = [];
      } else {
        addText('響音演奏！', player.x - 10, player.y - 80, '#b39ddb', 18);
        addParticles(player.x + 15, player.y - 40, '#b39ddb', 16, 5);
      }
    }
  };

  // 4. プレイヤー更新フック
  EC.hooks.onUpdatePlayer = function(ctx) {
    const {
      canvas, GROUND_Y, GRAVITY, player, activeMonsters, keys,
      addText, addParticles, rectIntersect, getMonsterBody,
      getCurrentWeapon, computeWeaponHitDamage, resetMonsterSwingHitFlags
    } = ctx;

    if (player.weaponType !== 'horn') {
      if (prevOnUpdatePlayer) return prevOnUpdatePlayer(ctx);
      return false;
    }
    initHornState(player);

    if (player.hhSelfBuffTimer > 0) player.hhSelfBuffTimer--;
    if (player.hhAtkBuffTimer > 0) player.hhAtkBuffTimer--;
    if (player.hhSoundWaveFx > 0) player.hhSoundWaveFx--;
    if (player.hhRegenTimer > 0) {
      player.hhRegenTimer--;
      if (player.hhRegenTimer % 45 === 0 && player.hp < player.maxHp) {
        player.hp = Math.min(player.maxHp, player.hp + 3);
        addParticles(player.x + 15, player.y - 35, '#69f0ae', 4, 2);
      }
    }

    if (player.state !== 'dodge') {
      player.stamina = Math.min(player.maxStamina, player.stamina + 0.38);
    }
    if (player.bubblyBuffTimer > 0) player.bubblyBuffTimer--;
    if (player.burnTimer > 0) {
      player.burnTimer--;
      if (player.burnTimer % 30 === 0) player.hp = Math.max(1, player.hp - 2);
    }
    if (player.thunderBlightTimer > 0) player.thunderBlightTimer--;
    if (player.bubbleTimer > 0) player.bubbleTimer--;
    if (player.poisonTimer > 0) {
      player.poisonTimer--;
      if (player.poisonTimer % 35 === 0) player.hp = Math.max(1, player.hp - 2);
    }
    if (player.invulnTimer > 0) player.invulnTimer--;

    const isBubbled = player.bubbleTimer > 0;

    if (player.paralysisTimer > 0) {
      player.paralysisTimer--;
      player.vx *= 0.7;
      player.attackHitbox = null;
      if (player.state !== 'hurt') player.state = 'idle';
    } else if (['idle', 'run', 'jump'].includes(player.state)) {
      let move = 0;
      if (keys['KeyA'] || keys['ArrowLeft']) move -= 1;
      if (keys['KeyD'] || keys['ArrowRight']) move += 1;
      const maxSpeed = player.hhSelfBuffTimer > 0 ? 5.7 : 4.4; // 自分強化中は軽快移動！
      if (move !== 0) {
        player.facing = move;
        player.vx = isBubbled ? Math.max(-maxSpeed * 1.25, Math.min(maxSpeed * 1.25, player.vx + move * 0.42)) : move * maxSpeed;
        if (player.y >= GROUND_Y) player.state = 'run';
      } else {
        player.vx *= isBubbled ? 0.95 : 0.7;
        if (Math.abs(player.vx) < 0.08) player.vx = 0;
        if (player.y >= GROUND_Y) player.state = 'idle';
      }
      if ((keys['KeyW'] || keys['Space'] || keys['ArrowUp']) && player.y >= GROUND_Y) {
        player.vy = -12.3;
        player.state = 'jump';
      }
    } else if (player.state === 'hhSwing') {
      player.vx *= 0.84;
      player.stateTimer--;
      player.attackHitbox = (player.stateTimer >= 4 && player.stateTimer <= 14)
        ? { x: player.facing === 1 ? player.x + 15 : player.x - 108, y: player.y - 84, w: 108, h: 84 }
        : null;
      if (player.stateTimer <= 0) { player.state = 'idle'; player.attackHitbox = null; }
    } else if (player.state === 'hhDoubleBeat') {
      player.vx *= 0.84;
      player.stateTimer--;
      if (player.stateTimer === 10) resetMonsterSwingHitFlags(); // 2打目ヒットリセット
      player.attackHitbox = (player.stateTimer >= 3 && player.stateTimer <= 17)
        ? { x: player.facing === 1 ? player.x + 15 : player.x - 104, y: player.y - 86, w: 104, h: 86 }
        : null;
      if (player.stateTimer <= 0) { player.state = 'idle'; player.attackHitbox = null; }
    } else if (player.state === 'hhPerform') {
      player.vx = 0;
      player.stateTimer--;
      // 前方＆周囲に広がる広範囲の音波衝撃波判定
      if (player.stateTimer === 12) resetMonsterSwingHitFlags(); // 演奏2段音波
      player.attackHitbox = (player.stateTimer >= 4 && player.stateTimer <= 22)
        ? { x: player.facing === 1 ? player.x - 20 : player.x - 145, y: player.y - 105, w: 195, h: 105 }
        : null;
      if (player.stateTimer <= 0) { player.state = 'idle'; player.attackHitbox = null; }
    } else if (player.state === 'dodge' || player.state === 'hurt') {
      player.vx *= isBubbled ? 0.94 : 0.9;
      player.stateTimer--;
      if (player.stateTimer <= 0) player.state = 'idle';
    }

    player.vy += GRAVITY;
    player.x += player.vx;
    player.y += player.vy;
    if (player.y >= GROUND_Y) { player.y = GROUND_Y; player.vy = 0; }
    player.x = Math.max(20, Math.min(canvas.width - 50, player.x));

    // 攻撃ヒット処理（打撃属性＋高い気絶怯み値）
    if (player.attackHitbox) {
      const weapon = getCurrentWeapon();
      const sparkColors = { fire: '#ff6d00', water: '#4fc3f7', thunder: '#00e5ff', ice: '#80deea', dragon: '#d500f9', none: '#ffd54f' };
      const hitSparkColor = sparkColors[weapon.element] || '#ffd54f';
      const atkBuffMult = player.hhAtkBuffTimer > 0 ? 1.25 : 1.0;

      for (const m of activeMonsters) {
        if (m.hp <= 0 || m.hasHitThisSwingByPlayer) continue;
        if (!rectIntersect(player.attackHitbox, getMonsterBody(m))) continue;

        m.hasHitThisSwingByPlayer = true;
        m.flashTimer = 6;
        player.hasHitThisSwing = true;

        let dmg = 0;
        let staggerChance = 0.22; // 打撃武器なので怯み率高め
        let textSize = 21;
        let textColor = player.hhAtkBuffTimer > 0 ? '#ff8a80' : '#ffd700';

        if (player.state === 'hhSwing') {
          const res = computeWeaponHitDamage(31, weapon, atkBuffMult, m.species);
          dmg = res.dmg;
          staggerChance = 0.24;
          addParticles(m.x + 40, m.y - 45, hitSparkColor, 12, 5);
        } else if (player.state === 'hhDoubleBeat') {
          const res = computeWeaponHitDamage(24, weapon, atkBuffMult, m.species);
          dmg = res.dmg;
          staggerChance = 0.22;
          addParticles(m.x + 40, m.y - 45, '#ff5252', 12, 5);
        } else if (player.state === 'hhPerform') {
          // 音波ダメージ（肉質無視の衝撃波ダメージ＋攻撃バフ補正）
          dmg = Math.round((34 + weapon.attack * 0.24) * atkBuffMult);
          staggerChance = 0.26;
          textSize = 24;
          textColor = '#b39ddb';
          addParticles(m.x + 40, m.y - 45, '#b39ddb', 16, 6);
        }

        m.hp -= dmg;
        addText(dmg, m.x + 40 + (Math.random() * 18 - 9), m.y - 60, textColor, textSize);

        if (m.hp <= 0) {
          m.hp = 0;
          m.attackHitbox = null;
          addText('部位破壊・討伐！', m.x + 10, m.y - 95, '#ffd700', 22);
          addParticles(m.x + m.w / 2, m.y - 45, '#ffd700', 24, 7);
          continue;
        }

        if (Math.random() < staggerChance && m.state !== 'stagger') {
          m.state = 'stagger';
          m.stateTimer = 55;
          m.isFlying = false;
          m.isCharged = false;
          m.somersaultAngle = 0;
          m.attackHitbox = null;
          addText('打撃スタン怯み！', m.x + 12, m.y - 100, '#ffaa00', 24);
        }
      }
    }

    return true;
  };

  // 5. 狩猟笛＆演奏音波リング描画フック
  EC.hooks.onDrawPlayerWeapon = function(handX, handY, hookCtx) {
    const { ctx, player, getCurrentWeapon } = hookCtx;
    if (player.weaponType !== 'horn') {
      if (prevOnDrawPlayerWeapon) return prevOnDrawPlayerWeapon(handX, handY, hookCtx);
      return;
    }
    initHornState(player);

    const wpn = getCurrentWeapon();
    const elemColors = {
      fire: '#ff6d00',
      thunder: '#00e5ff',
      ice: '#80deea',
      dragon: '#d500f9',
      none: '#bcaaa4'
    };
    const hornCol = elemColors[wpn.element] || '#bcaaa4';

    ctx.save();
    ctx.translate(handX, handY);

    let angle = player.facing === 1 ? -2.2 : -0.94;
    if (player.state === 'hhPerform') {
      angle = player.facing === 1 ? -0.45 : Math.PI + 0.45; // 笛を掲げて演奏ポーズ
    } else if (player.state === 'hhSwing' || player.state === 'hhDoubleBeat') {
      angle = player.facing === 1 ? 0.14 : Math.PI - 0.14;
    }
    ctx.rotate(angle);

    if (player.hhAtkBuffTimer > 0 || wpn.element !== 'none') {
      ctx.shadowColor = player.hhAtkBuffTimer > 0 ? '#ff5252' : hornCol;
      ctx.shadowBlur = 12;
    }

    // 笛の長い管（柄）
    ctx.fillStyle = '#4e342e';
    ctx.fillRect(-12, -4, 70, 8);

    // 巨大な共鳴ベル（ラッパ部）
    ctx.fillStyle = hornCol;
    ctx.beginPath();
    ctx.moveTo(52, -7);
    ctx.lineTo(86, -22);
    ctx.lineTo(86, 22);
    ctx.lineTo(52, 7);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#ffd54f';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.restore();

    // 演奏時の同心円音波リングエフェクト
    if (player.hhSoundWaveFx > 0) {
      const progress = 1 - player.hhSoundWaveFx / 22;
      const alpha = 1 - progress;
      ctx.save();
      for (let r = 0; r < 2; r++) {
        const radius = 35 + progress * 125 + r * 24;
        ctx.strokeStyle = `rgba(179, 157, 219, ${alpha * 0.85})`;
        ctx.lineWidth = 4 - r * 1.5;
        ctx.beginPath();
        ctx.arc(handX + player.facing * 20, handY - 10, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  };

  // 6. 武器専用UI（音色譜面3スロット＋旋律バフ状態表示）
  EC.hooks.onDrawWeaponUI = function(hookCtx) {
    const { ctx, player } = hookCtx;
    if (player.weaponType !== 'horn') {
      if (prevOnDrawWeaponUI) return prevOnDrawWeaponUI(hookCtx);
      return;
    }
    initHornState(player);

    // 音色譜面 3スロット（左側）
    for (let i = 0; i < 3; i++) {
      const nx = 20 + i * 24;
      const note = player.hhNotes[i];
      ctx.fillStyle = note === 'red' ? '#ff5252' : (note === 'white' ? '#ffffff' : '#263238');
      ctx.fillRect(nx, 56, 20, 12);
      ctx.strokeStyle = note ? '#ffd54f' : '#546e7a';
      ctx.strokeRect(nx, 56, 20, 12);
    }

    // 旋律バフ残時間バー（右側）
    const activeTimer = Math.max(player.hhSelfBuffTimer, player.hhAtkBuffTimer);
    const ratio = activeTimer > 0 ? Math.min(1, activeTimer / 1200) : 0;
    ctx.fillStyle = '#222';
    ctx.fillRect(96, 56, 104, 12);
    ctx.fillStyle = player.hhAtkBuffTimer > 0 ? '#ff5252' : (player.hhSelfBuffTimer > 0 ? '#69f0ae' : '#546e7a');
    ctx.fillRect(96, 56, 104 * ratio, 12);
    ctx.strokeStyle = activeTimer > 0 ? '#ffd54f' : '#607d8b';
    ctx.strokeRect(96, 56, 104, 12);
  };

  // 7. リセット・武器切替フック
  EC.hooks.onResetGame = function(hookCtx) {
    initHornState(hookCtx.player);
    hookCtx.player.hhNotes = [];
    hookCtx.player.hhSelfBuffTimer = 0;
    hookCtx.player.hhAtkBuffTimer = 0;
    hookCtx.player.hhRegenTimer = 0;
    hookCtx.player.hhSoundWaveFx = 0;
    if (prevOnResetGame) prevOnResetGame(hookCtx);
  };

  EC.hooks.onSwitchWeapon = function(hookCtx) {
    initHornState(hookCtx.player);
    if (prevOnSwitchWeapon) prevOnSwitchWeapon(hookCtx);
  };
})();
// ==========================================
// 新武器種：ヘビィボウガン（Heavy Bowgun）追加モジュール
// ==========================================
(function() {
  const EC = window.EXTRA_CONTENT = window.EXTRA_CONTENT || {};
  EC.weaponTypes = EC.weaponTypes || [];
  EC.weapons = EC.weapons || {};
  EC.hooks = EC.hooks || {};

  // 1. 武器種登録
  EC.weaponTypes.push({
    key: 'heavybowgun',
    label: 'ヘビィボウガン',
    controlsHtml: '貫通弾/装填: <span class="key">J</span>/<span class="key">Z</span> ｜ 拡散榴弾: <span class="key">K</span>/<span class="key">X</span> ｜ 機関竜弾: <span class="key">L</span>/<span class="key">C</span>'
  });

  // 2. ヘビィボウガンラインナップ登録
  EC.weapons.heavybowgun = [
    { id: 'iron_hbg', type: 'heavybowgun', name: 'アイアンアサルト', element: 'none', elementLabel: '無属性', attack: 100 },
    { id: 'rathalos_hbg', type: 'heavybowgun', name: '火竜砲【銀炎】', element: 'fire', elementLabel: '火属性', attack: 135 },
    { id: 'zinogre_hbg', type: 'heavybowgun', name: '王牙砲【山雷】', element: 'thunder', elementLabel: '雷属性', attack: 140 },
    { id: 'barioth_hbg', type: 'heavybowgun', name: '氷牙重弩', element: 'ice', elementLabel: '氷属性', attack: 150 },
    { id: 'gore_hbg', type: 'heavybowgun', name: 'THEデリュージュ', element: 'dragon', elementLabel: '龍属性', attack: 170 }
  ];

  // 既存フックを退避
  const prevOnPlayerAction = EC.hooks.onPlayerAction;
  const prevOnUpdatePlayer = EC.hooks.onUpdatePlayer;
  const prevOnDrawPlayerWeapon = EC.hooks.onDrawPlayerWeapon;
  const prevOnDrawWeaponUI = EC.hooks.onDrawWeaponUI;
  const prevOnResetGame = EC.hooks.onResetGame;
  const prevOnSwitchWeapon = EC.hooks.onSwitchWeapon;

  const MAX_AMMO = 6;
  const WYVERNHEART_MAX = 100;

  function initHbgState(player) {
    if (typeof player.hbgAmmo !== 'number') player.hbgAmmo = MAX_AMMO;
    if (typeof player.hbgSpecialGauge !== 'number') player.hbgSpecialGauge = WYVERNHEART_MAX;
    if (typeof player.hbgWyvernHeartTimer !== 'number') player.hbgWyvernHeartTimer = 0;
    if (!Array.isArray(player.hbgBullets)) player.hbgBullets = [];
    if (typeof player.hbgMuzzleFx !== 'number') player.hbgMuzzleFx = 0;
  }

  function spawnHbgBullet(player, type, muzzleX, muzzleY) {
    player.hbgBullets.push({
      type: type, // 'pierce' | 'cluster' | 'heart'
      x: muzzleX,
      y: muzzleY,
      vx: player.facing * (type === 'cluster' ? 13.5 : (type === 'heart' ? 19.0 : 17.5)),
      life: 48,
      hitsLeft: type === 'pierce' ? 3 : 1,
      hitCooldown: 0
    });
  }

  // 3. アクション入力フック
  EC.hooks.onPlayerAction = function(code, ctx) {
    const { player, addText, addParticles } = ctx;
    if (player.weaponType !== 'heavybowgun') {
      if (prevOnPlayerAction) return prevOnPlayerAction(code, ctx);
      return;
    }
    initHbgState(player);

    const muzzleX = player.x + 15 + player.facing * 56;
    const muzzleY = player.y - 34;

    // J / Z : 貫通弾発射（残弾0ならリロード）
    if ((code === 'KeyJ' || code === 'KeyZ') && ['idle', 'run', 'jump'].includes(player.state)) {
      if (player.hbgWyvernHeartTimer > 0) return; // 機関竜弾中は自動連射
      if (player.hbgAmmo > 0) {
        player.hbgAmmo--;
        player.state = 'hbgShoot';
        player.stateTimer = 13;
        player.hbgMuzzleFx = 7;
        player.vx = -player.facing * 2.4;
        spawnHbgBullet(player, 'pierce', muzzleX, muzzleY);
        addParticles(muzzleX, muzzleY, '#ffe082', 8, 4);
      } else {
        player.state = 'hbgReload';
        player.stateTimer = 26;
        player.hbgAmmo = MAX_AMMO;
        player.vx = 0;
        addText('重弩リロード完了！(6発)', player.x - 22, player.y - 76, '#ffd54f', 17);
        addParticles(player.x + 15, player.y - 35, '#ffd54f', 12, 3);
      }
    }

    // K / X : 拡散榴弾（2発消費・着弾大爆発）
    if ((code === 'KeyK' || code === 'KeyX') && ['idle', 'run', 'jump'].includes(player.state)) {
      if (player.hbgWyvernHeartTimer > 0) return;
      if (player.hbgAmmo >= 2) {
        player.hbgAmmo -= 2;
        player.state = 'hbgShoot';
        player.stateTimer = 18;
        player.hbgMuzzleFx = 10;
        player.vx = -player.facing * 4.8;
        spawnHbgBullet(player, 'cluster', muzzleX, muzzleY);
        ctx.screenShake = Math.max(ctx.screenShake, 4);
        addParticles(muzzleX, muzzleY, '#ff6d00', 14, 5);
      } else if (player.hbgAmmo === 0) {
        player.state = 'hbgReload';
        player.stateTimer = 26;
        player.hbgAmmo = MAX_AMMO;
        player.vx = 0;
        addText('重弩リロード完了！(6発)', player.x - 22, player.y - 76, '#ffd54f', 17);
      } else {
        addText('弾不足(拡散榴弾は2発必要)', player.x - 26, player.y - 74, '#ff8a80', 15);
      }
    }

    // L / C : 機関竜弾モード発動（特殊ゲージ100で連続掃射）
    if ((code === 'KeyL' || code === 'KeyC') && ['idle', 'run', 'hbgShoot'].includes(player.state)) {
      if (player.hbgWyvernHeartTimer > 0) {
        player.hbgWyvernHeartTimer = 0;
        addText('機関竜弾 解除', player.x - 14, player.y - 74, '#cfd8dc', 16);
        return;
      }
      if (player.hbgSpecialGauge >= WYVERNHEART_MAX) {
        player.hbgSpecialGauge = 0;
        player.hbgWyvernHeartTimer = 240; // 4秒間の機関竜弾連射モード！
        player.state = 'idle';
        addText('機関竜弾 装填・連射開始！！', player.x - 32, player.y - 84, '#ff5252', 20);
        addParticles(player.x + 15, player.y - 35, '#ff5252', 20, 6);
      } else {
        addText(`特殊弾チャージ中(${Math.floor(player.hbgSpecialGauge)}%)`, player.x - 28, player.y - 74, '#ffab40', 15);
      }
    }
  };

  // 4. プレイヤー＆弾丸更新フック
  EC.hooks.onUpdatePlayer = function(ctx) {
    const {
      canvas, GROUND_Y, GRAVITY, player, activeMonsters, keys,
      addText, addParticles, rectIntersect, getMonsterBody,
      getCurrentWeapon, computeWeaponHitDamage
    } = ctx;

    if (player.weaponType !== 'heavybowgun') {
      if (prevOnUpdatePlayer) return prevOnUpdatePlayer(ctx);
      return false;
    }
    initHbgState(player);

    if (player.hbgMuzzleFx > 0) player.hbgMuzzleFx--;

    // 機関竜弾モード中の自動高速連射
    if (player.hbgWyvernHeartTimer > 0) {
      player.hbgWyvernHeartTimer--;
      if (player.hbgWyvernHeartTimer % 5 === 0) {
        const muzzleX = player.x + 15 + player.facing * 58;
        const muzzleY = player.y - 34 + (Math.random() * 8 - 4);
        player.hbgMuzzleFx = 4;
        spawnHbgBullet(player, 'heart', muzzleX, muzzleY);
        addParticles(muzzleX, muzzleY, '#ff9100', 4, 3);
        ctx.screenShake = Math.max(ctx.screenShake, 2);
      }
      if (player.hbgWyvernHeartTimer <= 0) {
        addText('機関竜弾 終了', player.x - 16, player.y - 74, '#b0bec5', 16);
      }
    } else {
      player.hbgSpecialGauge = Math.min(WYVERNHEART_MAX, player.hbgSpecialGauge + 0.14);
    }

    if (player.state !== 'dodge') {
      player.stamina = Math.min(player.maxStamina, player.stamina + 0.36);
    }
    if (player.bubblyBuffTimer > 0) player.bubblyBuffTimer--;
    if (player.burnTimer > 0) {
      player.burnTimer--;
      if (player.burnTimer % 30 === 0) player.hp = Math.max(1, player.hp - 2);
    }
    if (player.thunderBlightTimer > 0) player.thunderBlightTimer--;
    if (player.bubbleTimer > 0) player.bubbleTimer--;
    if (player.poisonTimer > 0) {
      player.poisonTimer--;
      if (player.poisonTimer % 35 === 0) player.hp = Math.max(1, player.hp - 2);
    }
    if (player.invulnTimer > 0) player.invulnTimer--;

    const isBubbled = player.bubbleTimer > 0;

    if (player.paralysisTimer > 0) {
      player.paralysisTimer--;
      player.vx *= 0.7;
      if (player.state !== 'hurt') player.state = 'idle';
    } else if (['idle', 'run', 'jump'].includes(player.state)) {
      let move = 0;
      if (keys['KeyA'] || keys['ArrowLeft']) move -= 1;
      if (keys['KeyD'] || keys['ArrowRight']) move += 1;
      const maxSpeed = player.hbgWyvernHeartTimer > 0 ? 2.2 : 3.4; // 重弩は移動が重厚
      if (move !== 0) {
        player.facing = move;
        player.vx = isBubbled ? Math.max(-maxSpeed * 1.25, Math.min(maxSpeed * 1.25, player.vx + move * 0.4)) : move * maxSpeed;
        if (player.y >= GROUND_Y) player.state = 'run';
      } else {
        player.vx *= isBubbled ? 0.95 : 0.7;
        if (Math.abs(player.vx) < 0.08) player.vx = 0;
        if (player.y >= GROUND_Y) player.state = 'idle';
      }
      if ((keys['KeyW'] || keys['Space'] || keys['ArrowUp']) && player.y >= GROUND_Y && player.hbgWyvernHeartTimer <= 0) {
        player.vy = -11.5;
        player.state = 'jump';
      }
    } else if (player.state === 'hbgShoot' || player.state === 'hbgReload') {
      player.vx *= 0.8;
      player.stateTimer--;
      if (player.stateTimer <= 0) player.state = 'idle';
    } else if (player.state === 'dodge' || player.state === 'hurt') {
      player.vx *= isBubbled ? 0.94 : 0.9;
      player.stateTimer--;
      if (player.stateTimer <= 0) player.state = 'idle';
    }

    player.vy += GRAVITY;
    player.x += player.vx;
    player.y += player.vy;
    if (player.y >= GROUND_Y) { player.y = GROUND_Y; player.vy = 0; }
    player.x = Math.max(20, Math.min(canvas.width - 50, player.x));

    // 発射された弾丸の更新＆命中処理
    const weapon = getCurrentWeapon();
    const sparkColors = { fire: '#ff6d00', water: '#4fc3f7', thunder: '#00e5ff', ice: '#80deea', dragon: '#d500f9', none: '#ffd54f' };
    const hitSparkColor = sparkColors[weapon.element] || '#ffd54f';

    for (let i = player.hbgBullets.length - 1; i >= 0; i--) {
      const b = player.hbgBullets[i];
      b.x += b.vx;
      b.life--;
      if (b.hitCooldown > 0) b.hitCooldown--;

      const bBox = b.type === 'cluster'
        ? { x: b.x - 14, y: b.y - 14, w: 28, h: 28 }
        : { x: b.x - 10, y: b.y - 7, w: 20, h: 14 };

      let removeBullet = false;
      for (const m of activeMonsters) {
        if (m.hp <= 0) continue;
        if (b.hitCooldown > 0) continue;
        if (!rectIntersect(bBox, getMonsterBody(m))) continue;

        m.flashTimer = 4;
        let dmg = 0;
        let staggerChance = 0.08;
        let textColor = '#ffd700';
        let textSize = 19;

        if (b.type === 'pierce') {
          const res = computeWeaponHitDamage(21, weapon, 1.0, m.species);
          dmg = res.dmg;
          b.hitsLeft--;
          b.hitCooldown = 4;
          player.hbgSpecialGauge = Math.min(WYVERNHEART_MAX, player.hbgSpecialGauge + 5);
          addParticles(b.x, b.y, hitSparkColor, 8, 4);
          if (b.hitsLeft <= 0) removeBullet = true;
        } else if (b.type === 'cluster') {
          // 拡散榴弾：肉質無視の大爆発ダメージ！
          dmg = Math.round(78 + weapon.attack * 0.45);
          staggerChance = 0.34;
          textColor = '#ff6d00';
          textSize = 26;
          ctx.screenShake = Math.max(ctx.screenShake, 8);
          addParticles(b.x, b.y, '#ff3d00', 26, 8);
          addParticles(b.x, b.y, '#ffee58', 16, 6);
          player.hbgSpecialGauge = Math.min(WYVERNHEART_MAX, player.hbgSpecialGauge + 12);
          removeBullet = true;
        } else if (b.type === 'heart') {
          // 機関竜弾：高速連射ヒット
          const res = computeWeaponHitDamage(14, weapon, 1.05, m.species);
          dmg = res.dmg;
          staggerChance = 0.05;
          textColor = '#ff8a80';
          textSize = 17;
          addParticles(b.x, b.y, '#ff9100', 6, 4);
          removeBullet = true;
        }

        m.hp -= dmg;
        addText(dmg, b.x + (Math.random() * 14 - 7), b.y - 16, textColor, textSize);

        if (m.hp <= 0) {
          m.hp = 0;
          m.attackHitbox = null;
          addText('部位破壊・討伐！', m.x + 10, m.y - 95, '#ffd700', 22);
          addParticles(m.x + m.w / 2, m.y - 45, '#ffd700', 24, 7);
        } else if (Math.random() < staggerChance && m.state !== 'stagger') {
          m.state = 'stagger';
          m.stateTimer = 50;
          m.isFlying = false;
          m.isCharged = false;
          m.somersaultAngle = 0;
          m.attackHitbox = null;
          addText('怯み！', m.x + 25, m.y - 100, '#ffaa00', 24);
        }

        if (removeBullet) break;
      }

      if (removeBullet || b.life <= 0 || b.x < 0 || b.x > canvas.width) {
        player.hbgBullets.splice(i, 1);
      }
    }

    return true;
  };

  // 5. 重量級ヘビィボウガン＋ヘビィシールド＋弾丸描画フック
  EC.hooks.onDrawPlayerWeapon = function(handX, handY, hookCtx) {
    const { ctx, player, getCurrentWeapon } = hookCtx;
    if (player.weaponType !== 'heavybowgun') {
      if (prevOnDrawPlayerWeapon) return prevOnDrawPlayerWeapon(handX, handY, hookCtx);
      return;
    }
    initHbgState(player);

    const wpn = getCurrentWeapon();
    const elemColors = {
      fire: '#ff6d00',
      thunder: '#00e5ff',
      ice: '#80deea',
      dragon: '#d500f9',
      none: '#78909c'
    };
    const gunCol = elemColors[wpn.element] || '#78909c';

    ctx.save();
    ctx.translate(handX, handY);
    if (player.facing === -1) ctx.scale(-1, 1);

    if (player.hbgWyvernHeartTimer > 0 || wpn.element !== 'none') {
      ctx.shadowColor = player.hbgWyvernHeartTimer > 0 ? '#ff5252' : gunCol;
      ctx.shadowBlur = player.hbgWyvernHeartTimer > 0 ? 14 : 9;
    }

    // 重厚な銃身（ヘビィバレル）
    ctx.fillStyle = '#263238';
    ctx.fillRect(-14, -8, 62, 16);

    ctx.fillStyle = gunCol;
    ctx.fillRect(4, -10, 38, 6);
    ctx.fillRect(44, -6, 12, 12);

    // 銃身装着型ヘビィシールド
    ctx.fillStyle = '#455a64';
    ctx.strokeStyle = '#cfd8dc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(22, -16, 10, 30, 3);
    ctx.fill();
    ctx.stroke();

    // マズルフラッシュ（発射閃光）
    if (player.hbgMuzzleFx > 0) {
      ctx.fillStyle = player.hbgWyvernHeartTimer > 0 ? 'rgba(255, 82, 82, 0.85)' : 'rgba(255, 238, 88, 0.85)';
      ctx.beginPath();
      ctx.arc(60, 0, 12 + player.hbgMuzzleFx, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // 飛翔中の弾丸描画
    ctx.save();
    for (const b of player.hbgBullets) {
      if (b.type === 'pierce') {
        ctx.fillStyle = '#80ffff';
        ctx.fillRect(b.x - 12, b.y - 2.5, 24, 5);
      } else if (b.type === 'cluster') {
        ctx.fillStyle = '#ff6d00';
        ctx.beginPath();
        ctx.arc(b.x, b.y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffee58';
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#ff5252';
        ctx.fillRect(b.x - 9, b.y - 2, 18, 4);
      }
    }
    ctx.restore();
  };

  // 6. 武器専用UI（残弾6発＋機関竜弾ゲージ）
  EC.hooks.onDrawWeaponUI = function(hookCtx) {
    const { ctx, player } = hookCtx;
    if (player.weaponType !== 'heavybowgun') {
      if (prevOnDrawWeaponUI) return prevOnDrawWeaponUI(hookCtx);
      return;
    }
    initHbgState(player);

    // 残弾6発アイコン（左側）
    for (let i = 0; i < MAX_AMMO; i++) {
      const bx = 20 + i * 17;
      ctx.fillStyle = i < player.hbgAmmo ? '#ffd54f' : '#263238';
      ctx.fillRect(bx, 56, 13, 12);
      ctx.strokeStyle = i < player.hbgAmmo ? '#fff59d' : '#546e7a';
      ctx.strokeRect(bx, 56, 13, 12);
    }

    // 機関竜弾ゲージ（右側）
    const active = player.hbgWyvernHeartTimer > 0;
    const ratio = active
      ? (player.hbgWyvernHeartTimer / 240)
      : (player.hbgSpecialGauge / WYVERNHEART_MAX);
    ctx.fillStyle = '#222';
    ctx.fillRect(126, 56, 74, 12);
    ctx.fillStyle = active ? '#ff5252' : (player.hbgSpecialGauge >= WYVERNHEART_MAX ? '#ff9100' : '#78909c');
    ctx.fillRect(126, 56, 74 * ratio, 12);
    ctx.strokeStyle = (active || player.hbgSpecialGauge >= WYVERNHEART_MAX) ? '#ffab91' : '#607d8b';
    ctx.strokeRect(126, 56, 74, 12);
  };

  // 7. オートシールド軽減・リセット・武器切替フック
  EC.hooks.onResetGame = function(hookCtx) {
    initHbgState(hookCtx.player);
    hookCtx.player.hbgAmmo = MAX_AMMO;
    hookCtx.player.hbgSpecialGauge = WYVERNHEART_MAX;
    hookCtx.player.hbgWyvernHeartTimer = 0;
    hookCtx.player.hbgBullets = [];
    hookCtx.player.hbgMuzzleFx = 0;
    if (prevOnResetGame) prevOnResetGame(hookCtx);
  };

  EC.hooks.onSwitchWeapon = function(hookCtx) {
    initHbgState(hookCtx.player);
    hookCtx.player.hbgBullets = [];
    if (prevOnSwitchWeapon) prevOnSwitchWeapon(hookCtx);
  };

  // ヘビィボウガン非射撃・非リロード時のオートシールド（ダメージ50%軽減）
  window.addEventListener('load', function() {
    if (typeof window.damagePlayer === 'function') {
      const origDamagePlayer = window.damagePlayer;
      window.damagePlayer = function(amount, isFire, isPoison, isElectric, isBubble) {
        if (player.weaponType === 'heavybowgun' && ['idle', 'run', 'jump'].includes(player.state)) {
          const reduced = Math.max(1, Math.floor(amount * 0.5));
          return origDamagePlayer.call(this, reduced, isFire, isPoison, isElectric, isBubble);
        }
        return origDamagePlayer.apply(this, arguments);
      };
    }
  });
})();
// ==========================================
// 新武器種：ライトボウガン（Light Bowgun）追加モジュール
// ==========================================
(function() {
  const EC = window.EXTRA_CONTENT = window.EXTRA_CONTENT || {};
  EC.weaponTypes = EC.weaponTypes || [];
  EC.weapons = EC.weapons || {};
  EC.hooks = EC.hooks || {};

  // 1. 武器種登録
  EC.weaponTypes.push({
    key: 'lightbowgun',
    label: 'ライトボウガン',
    controlsHtml: '速射(3連)/装填: <span class="key">J</span>/<span class="key">Z</span> ｜ 散弾ショット: <span class="key">K</span>/<span class="key">X</span> ｜ 起爆竜弾設置: <span class="key">L</span>/<span class="key">C</span>'
  });

  // 2. ライトボウガンラインナップ登録
  EC.weapons.lightbowgun = [
    { id: 'iron_lbg', type: 'lightbowgun', name: 'アイアンバレル', element: 'none', elementLabel: '無属性', attack: 85 },
    { id: 'rathalos_lbg', type: 'lightbowgun', name: '火竜弩【銀火】', element: 'fire', elementLabel: '火属性', attack: 120 },
    { id: 'zinogre_lbg', type: 'lightbowgun', name: '王牙弩【野雷】', element: 'thunder', elementLabel: '雷属性', attack: 125 },
    { id: 'barioth_lbg', type: 'lightbowgun', name: '氷牙軽弩', element: 'ice', elementLabel: '氷属性', attack: 135 },
    { id: 'gore_lbg', type: 'lightbowgun', name: 'THEパニッシャー', element: 'dragon', elementLabel: '龍属性', attack: 155 }
  ];

  // 既存フックを退避
  const prevOnPlayerAction = EC.hooks.onPlayerAction;
  const prevOnUpdatePlayer = EC.hooks.onUpdatePlayer;
  const prevOnDrawPlayerWeapon = EC.hooks.onDrawPlayerWeapon;
  const prevOnDrawWeaponUI = EC.hooks.onDrawWeaponUI;
  const prevOnResetGame = EC.hooks.onResetGame;
  const prevOnSwitchWeapon = EC.hooks.onSwitchWeapon;

  const MAX_LBG_AMMO = 8;
  const MAX_WYVERNBLAST = 3;
  const BLAST_RECOVER_FRAMES = 420; // 7秒ごとに1発回復

  function initLbgState(player) {
    if (typeof player.lbgAmmo !== 'number') player.lbgAmmo = MAX_LBG_AMMO;
    if (typeof player.lbgRapidBurst !== 'number') player.lbgRapidBurst = 0; // 残り速射連射数
    if (typeof player.lbgRapidTimer !== 'number') player.lbgRapidTimer = 0;
    if (typeof player.lbgBlastStock !== 'number') player.lbgBlastStock = MAX_WYVERNBLAST;
    if (typeof player.lbgBlastRecover !== 'number') player.lbgBlastRecover = 0;
    if (!Array.isArray(player.lbgBullets)) player.lbgBullets = [];
    if (!Array.isArray(player.lbgMines)) player.lbgMines = [];
    if (typeof player.lbgMuzzleFx !== 'number') player.lbgMuzzleFx = 0;
  }

  function spawnLbgBullet(player, type, x, y, vx, vy) {
    player.lbgBullets.push({
      type: type, // 'rapid' | 'spread'
      x: x,
      y: y,
      vx: vx,
      vy: vy || 0,
      life: type === 'spread' ? 20 : 42
    });
  }

  // 3. アクション入力フック
  EC.hooks.onPlayerAction = function(code, ctx) {
    const { GROUND_Y, player, addText, addParticles } = ctx;
    if (player.weaponType !== 'lightbowgun') {
      if (prevOnPlayerAction) return prevOnPlayerAction(code, ctx);
      return;
    }
    initLbgState(player);

    const muzzleX = player.x + 15 + player.facing * 44;
    const muzzleY = player.y - 34;

    // J / Z : 速射3連発（残弾0ならクイックリロード）
    if ((code === 'KeyJ' || code === 'KeyZ') && ['idle', 'run', 'jump'].includes(player.state)) {
      if (player.lbgAmmo > 0) {
        player.lbgAmmo--;
        player.state = 'lbgShoot';
        player.stateTimer = 14;
        player.lbgRapidBurst = 2; // 初弾＋追加2発＝計3連射
        player.lbgRapidTimer = 4;
        player.lbgMuzzleFx = 6;
        spawnLbgBullet(player, 'rapid', muzzleX, muzzleY, player.facing * 18.5, 0);
        addParticles(muzzleX, muzzleY, '#80ffff', 6, 3.5);
      } else {
        player.state = 'lbgReload';
        player.stateTimer = 16; // 軽弩はリロードが速い
        player.lbgAmmo = MAX_LBG_AMMO;
        player.vx = player.facing * 2.5;
        addText('クイックリロード！(8発)', player.x - 22, player.y - 74, '#80deea', 16);
        addParticles(player.x + 15, player.y - 35, '#80deea', 10, 3);
      }
    }

    // K / X : 5way散弾ショット（2発消費）
    if ((code === 'KeyK' || code === 'KeyX') && ['idle', 'run', 'jump'].includes(player.state)) {
      if (player.lbgAmmo >= 2) {
        player.lbgAmmo -= 2;
        player.state = 'lbgShoot';
        player.stateTimer = 14;
        player.lbgMuzzleFx = 8;
        player.vx = -player.facing * 3.2;
        const angles = [-0.22, -0.11, 0, 0.11, 0.22];
        angles.forEach(ang => {
          const speed = 16.5;
          spawnLbgBullet(
            player,
            'spread',
            muzzleX,
            muzzleY,
            player.facing * Math.cos(ang) * speed,
            Math.sin(ang) * speed
          );
        });
        addParticles(muzzleX, muzzleY, '#ffd54f', 12, 5);
      } else if (player.lbgAmmo === 0) {
        player.state = 'lbgReload';
        player.stateTimer = 16;
        player.lbgAmmo = MAX_LBG_AMMO;
        addText('クイックリロード！(8発)', player.x - 22, player.y - 74, '#80deea', 16);
      } else {
        addText('弾不足(散弾は2発必要)', player.x - 24, player.y - 74, '#ff8a80', 15);
      }
    }

    // L / C : 起爆竜弾設置＆スライディングステップ
    if ((code === 'KeyL' || code === 'KeyC') && ['idle', 'run', 'jump', 'lbgShoot'].includes(player.state)) {
      if (player.lbgBlastStock <= 0) {
        addText('起爆竜弾 装填待ち中...', player.x - 22, player.y - 74, '#ffab40', 15);
        return;
      }
      player.lbgBlastStock--;
      player.state = 'lbgSlide';
      player.stateTimer = 16;
      player.invulnTimer = Math.max(player.invulnTimer, 14);
      player.vx = player.facing * 9.5;
      player.lbgMines.push({
        x: player.x + 15,
        y: GROUND_Y - 8,
        timer: 720, // 12秒間フィールドに残存
        charges: 2 // 1つの起爆竜弾につき2回まで誘爆可能！
      });
      addText('起爆竜弾 設置！', player.x - 16, player.y - 78, '#ff9100', 17);
      addParticles(player.x + 15, GROUND_Y - 8, '#ff9100', 14, 4.5);
    }
  };

  // 4. プレイヤー・弾丸・起爆竜弾更新フック
  EC.hooks.onUpdatePlayer = function(ctx) {
    const {
      canvas, GROUND_Y, GRAVITY, player, activeMonsters, keys,
      addText, addParticles, rectIntersect, getMonsterBody,
      getCurrentWeapon, computeWeaponHitDamage
    } = ctx;

    if (player.weaponType !== 'lightbowgun') {
      if (prevOnUpdatePlayer) return prevOnUpdatePlayer(ctx);
      return false;
    }
    initLbgState(player);

    if (player.lbgMuzzleFx > 0) player.lbgMuzzleFx--;

    // 起爆竜弾ストックの自然回復
    if (player.lbgBlastStock < MAX_WYVERNBLAST) {
      player.lbgBlastRecover++;
      if (player.lbgBlastRecover >= BLAST_RECOVER_FRAMES) {
        player.lbgBlastRecover = 0;
        player.lbgBlastStock++;
        addText('起爆竜弾 +1', player.x - 10, player.y - 72, '#ffab40', 14);
      }
    } else {
      player.lbgBlastRecover = 0;
    }

    // 速射2発目・3発目の自動連射処理
    if (player.lbgRapidBurst > 0) {
      player.lbgRapidTimer--;
      if (player.lbgRapidTimer <= 0) {
        const muzzleX = player.x + 15 + player.facing * 44;
        const muzzleY = player.y - 34;
        player.lbgMuzzleFx = 5;
        spawnLbgBullet(player, 'rapid', muzzleX, muzzleY, player.facing * 18.5, 0);
        addParticles(muzzleX, muzzleY, '#80ffff', 5, 3);
        player.lbgRapidBurst--;
        player.lbgRapidTimer = 4;
      }
    }

    if (player.state !== 'dodge' && player.state !== 'lbgSlide') {
      player.stamina = Math.min(player.maxStamina, player.stamina + 0.42);
    }
    if (player.bubblyBuffTimer > 0) player.bubblyBuffTimer--;
    if (player.burnTimer > 0) {
      player.burnTimer--;
      if (player.burnTimer % 30 === 0) player.hp = Math.max(1, player.hp - 2);
    }
    if (player.thunderBlightTimer > 0) player.thunderBlightTimer--;
    if (player.bubbleTimer > 0) player.bubbleTimer--;
    if (player.poisonTimer > 0) {
      player.poisonTimer--;
      if (player.poisonTimer % 35 === 0) player.hp = Math.max(1, player.hp - 2);
    }
    if (player.invulnTimer > 0) player.invulnTimer--;

    const isBubbled = player.bubbleTimer > 0;

    if (player.paralysisTimer > 0) {
      player.paralysisTimer--;
      player.vx *= 0.7;
      if (player.state !== 'hurt') player.state = 'idle';
    } else if (['idle', 'run', 'jump'].includes(player.state)) {
      let move = 0;
      if (keys['KeyA'] || keys['ArrowLeft']) move -= 1;
      if (keys['KeyD'] || keys['ArrowRight']) move += 1;
      const maxSpeed = 5.3; // 軽弩は高い機動力
      if (move !== 0) {
        player.facing = move;
        player.vx = isBubbled ? Math.max(-maxSpeed * 1.25, Math.min(maxSpeed * 1.25, player.vx + move * 0.45)) : move * maxSpeed;
        if (player.y >= GROUND_Y) player.state = 'run';
      } else {
        player.vx *= isBubbled ? 0.95 : 0.7;
        if (Math.abs(player.vx) < 0.08) player.vx = 0;
        if (player.y >= GROUND_Y) player.state = 'idle';
      }
      if ((keys['KeyW'] || keys['Space'] || keys['ArrowUp']) && player.y >= GROUND_Y) {
        player.vy = -12.6;
        player.state = 'jump';
      }
    } else if (player.state === 'lbgShoot' || player.state === 'lbgReload' || player.state === 'lbgSlide') {
      player.vx *= 0.85;
      player.stateTimer--;
      if (player.stateTimer <= 0) player.state = 'idle';
    } else if (player.state === 'dodge' || player.state === 'hurt') {
      player.vx *= isBubbled ? 0.94 : 0.9;
      player.stateTimer--;
      if (player.stateTimer <= 0) player.state = 'idle';
    }

    player.vy += GRAVITY;
    player.x += player.vx;
    player.y += player.vy;
    if (player.y >= GROUND_Y) { player.y = GROUND_Y; player.vy = 0; }
    player.x = Math.max(20, Math.min(canvas.width - 50, player.x));

    const weapon = getCurrentWeapon();
    const sparkColors = { fire: '#ff6d00', water: '#4fc3f7', thunder: '#00e5ff', ice: '#80deea', dragon: '#d500f9', none: '#80ffff' };
    const hitSparkColor = sparkColors[weapon.element] || '#80ffff';

    // 起爆竜弾（設置マイン）の更新＆モンスター接触誘爆
    for (let mi = player.lbgMines.length - 1; mi >= 0; mi--) {
      const mine = player.lbgMines[mi];
      mine.timer--;
      if (mine.cooldown > 0) mine.cooldown--;

      const mineBox = { x: mine.x - 24, y: mine.y - 34, w: 48, h: 42 };
      if (!mine.cooldown) {
        for (const m of activeMonsters) {
          if (m.hp <= 0) continue;
          if (rectIntersect(mineBox, getMonsterBody(m))) {
            // 起爆竜弾 大爆発！！
            mine.charges--;
            mine.cooldown = 24;
            m.flashTimer = 6;
            const blastDmg = Math.round(64 + weapon.attack * 0.42);
            m.hp -= blastDmg;
            ctx.screenShake = Math.max(ctx.screenShake, 7);
            addText(`起爆竜弾！ ${blastDmg}`, mine.x - 20, mine.y - 54, '#ff9100', 22);
            addParticles(mine.x, mine.y - 14, '#ff6d00', 24, 8);
            addParticles(mine.x, mine.y - 14, '#ffee58', 14, 6);

            if (m.hp <= 0) {
              m.hp = 0;
              m.attackHitbox = null;
              addText('部位破壊・討伐！', m.x + 10, m.y - 95, '#ffd700', 22);
              addParticles(m.x + m.w / 2, m.y - 45, '#ffd700', 24, 7);
            } else if (Math.random() < 0.25 && m.state !== 'stagger') {
              m.state = 'stagger';
              m.stateTimer = 50;
              m.isFlying = false;
              m.isCharged = false;
              m.somersaultAngle = 0;
              m.attackHitbox = null;
              addText('怯み！', m.x + 25, m.y - 100, '#ffaa00', 24);
            }
            break;
          }
        }
      }

      if (mine.charges <= 0 || mine.timer <= 0) {
        player.lbgMines.splice(mi, 1);
      }
    }

    // 飛翔中の弾丸の更新＆命中処理
    for (let i = player.lbgBullets.length - 1; i >= 0; i--) {
      const b = player.lbgBullets[i];
      b.x += b.vx;
      b.y += b.vy;
      b.life--;

      const bBox = { x: b.x - 8, y: b.y - 6, w: 16, h: 12 };
      let hit = false;

      for (const m of activeMonsters) {
        if (m.hp <= 0) continue;
        if (!rectIntersect(bBox, getMonsterBody(m))) continue;

        hit = true;
        m.flashTimer = 4;
        const mv = b.type === 'spread' ? 14 : 16;
        const res = computeWeaponHitDamage(mv, weapon, 1.0, m.species);
        m.hp -= res.dmg;

        const dmgCol = res.elemMult >= 1.25 ? '#80ffff' : '#ffd700';
        addText(res.dmg, b.x + (Math.random() * 14 - 7), b.y - 14, dmgCol, 18);
        addParticles(b.x, b.y, hitSparkColor, 7, 4);

        if (m.hp <= 0) {
          m.hp = 0;
          m.attackHitbox = null;
          addText('部位破壊・討伐！', m.x + 10, m.y - 95, '#ffd700', 22);
          addParticles(m.x + m.w / 2, m.y - 45, '#ffd700', 24, 7);
        } else if (Math.random() < 0.06 && m.state !== 'stagger') {
          m.state = 'stagger';
          m.stateTimer = 50;
          m.isFlying = false;
          m.isCharged = false;
          m.somersaultAngle = 0;
          m.attackHitbox = null;
          addText('怯み！', m.x + 25, m.y - 100, '#ffaa00', 24);
        }
        break;
      }

      if (hit || b.life <= 0 || b.x < 0 || b.x > canvas.width) {
        player.lbgBullets.splice(i, 1);
      }
    }

    return true;
  };

  // 5. 軽量ライトボウガン＋起爆竜弾マイン＋弾丸描画フック
  EC.hooks.onDrawPlayerWeapon = function(handX, handY, hookCtx) {
    const { ctx, player, getCurrentWeapon } = hookCtx;
    if (player.weaponType !== 'lightbowgun') {
      if (prevOnDrawPlayerWeapon) return prevOnDrawPlayerWeapon(handX, handY, hookCtx);
      return;
    }
    initLbgState(player);

    const wpn = getCurrentWeapon();
    const elemColors = {
      fire: '#ff6d00',
      thunder: '#00e5ff',
      ice: '#80deea',
      dragon: '#d500f9',
      none: '#90a4ae'
    };
    const gunCol = elemColors[wpn.element] || '#90a4ae';

    ctx.save();
    ctx.translate(handX, handY);
    if (player.facing === -1) ctx.scale(-1, 1);

    if (wpn.element !== 'none') {
      ctx.shadowColor = gunCol;
      ctx.shadowBlur = 9;
    }

    // コンパクトな軽弩フレーム
    ctx.fillStyle = '#37474f';
    ctx.fillRect(-10, -5, 44, 10);

    ctx.fillStyle = gunCol;
    ctx.fillRect(6, -7, 28, 5);
    ctx.fillRect(34, -4, 10, 8);

    // マズルフラッシュ
    if (player.lbgMuzzleFx > 0) {
      ctx.fillStyle = 'rgba(128, 255, 255, 0.85)';
      ctx.beginPath();
      ctx.arc(48, 0, 8 + player.lbgMuzzleFx, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // フィールドに設置された起爆竜弾（マイン）描画
    ctx.save();
    for (const mine of player.lbgMines) {
      const pulse = 0.75 + Math.sin(Date.now() * 0.015) * 0.25;
      ctx.fillStyle = '#37474f';
      ctx.fillRect(mine.x - 10, mine.y - 6, 20, 12);

      ctx.fillStyle = `rgba(255, 145, 0, ${pulse})`;
      ctx.beginPath();
      ctx.arc(mine.x, mine.y - 8, 7, 0, Math.PI * 2);
      ctx.fill();

      // 誘爆検知リング
      ctx.strokeStyle = `rgba(255, 171, 64, ${pulse * 0.6})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(mine.x, mine.y - 4, 22, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 飛翔中の弾丸描画
    for (const b of player.lbgBullets) {
      ctx.fillStyle = b.type === 'spread' ? '#ffd54f' : gunCol;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.type === 'spread' ? 4 : 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  // 6. 武器専用UI（速射弾倉8発＋起爆竜弾ストック3発）
  EC.hooks.onDrawWeaponUI = function(hookCtx) {
    const { ctx, player } = hookCtx;
    if (player.weaponType !== 'lightbowgun') {
      if (prevOnDrawWeaponUI) return prevOnDrawWeaponUI(hookCtx);
      return;
    }
    initLbgState(player);

    // 速射弾倉 8発（左側）
    for (let i = 0; i < MAX_LBG_AMMO; i++) {
      const bx = 20 + i * 13;
      ctx.fillStyle = i < player.lbgAmmo ? '#80ffff' : '#263238';
      ctx.fillRect(bx, 56, 10, 12);
      ctx.strokeStyle = i < player.lbgAmmo ? '#e0f7fa' : '#546e7a';
      ctx.strokeRect(bx, 56, 10, 12);
    }

    // 起爆竜弾ストック 3発（右側）
    for (let j = 0; j < MAX_WYVERNBLAST; j++) {
      const mx = 132 + j * 23;
      const ready = j < player.lbgBlastStock;
      ctx.fillStyle = ready ? '#ff9100' : '#263238';
      ctx.fillRect(mx, 56, 19, 12);
      ctx.strokeStyle = ready ? '#ffe082' : '#546e7a';
      ctx.strokeRect(mx, 56, 19, 12);
    }
  };

  // 7. リセット・武器切替フック
  EC.hooks.onResetGame = function(hookCtx) {
    initLbgState(hookCtx.player);
    hookCtx.player.lbgAmmo = MAX_LBG_AMMO;
    hookCtx.player.lbgRapidBurst = 0;
    hookCtx.player.lbgBlastStock = MAX_WYVERNBLAST;
    hookCtx.player.lbgBlastRecover = 0;
    hookCtx.player.lbgBullets = [];
    hookCtx.player.lbgMines = [];
    hookCtx.player.lbgMuzzleFx = 0;
    if (prevOnResetGame) prevOnResetGame(hookCtx);
  };

  EC.hooks.onSwitchWeapon = function(hookCtx) {
    initLbgState(hookCtx.player);
    hookCtx.player.lbgBullets = [];
    if (prevOnSwitchWeapon) prevOnSwitchWeapon(hookCtx);
  };
})();
// ==========================================
// 新武器種：弓（Bow）追加モジュール（全14武器種コンプリート）
// ==========================================
(function() {
  const EC = window.EXTRA_CONTENT = window.EXTRA_CONTENT || {};
  EC.weaponTypes = EC.weaponTypes || [];
  EC.weapons = EC.weapons || {};
  EC.hooks = EC.hooks || {};

  // 1. 武器種登録
  EC.weaponTypes.push({
    key: 'bow',
    label: '弓',
    controlsHtml: '連射矢: <span class="key">J</span>/<span class="key">Z</span> ｜ 剛射: <span class="key">K</span>/<span class="key">X</span> ｜ 移動+C:ステップ / 停止+C:竜の一矢'
  });

  // 2. 弓ラインナップ登録
  EC.weapons.bow = [
    { id: 'iron_bow', type: 'bow', name: 'ハンターボウ', element: 'none', elementLabel: '無属性', attack: 85 },
    { id: 'rathalos_bow', type: 'bow', name: 'プロミネンスボウ', element: 'fire', elementLabel: '火属性', attack: 120 },
    { id: 'zinogre_bow', type: 'bow', name: '王牙弓【稚雷】', element: 'thunder', elementLabel: '雷属性', attack: 125 },
    { id: 'barioth_bow', type: 'bow', name: '琥珀の鋭弓', element: 'ice', elementLabel: '氷属性', attack: 135 },
    { id: 'gore_bow', type: 'bow', name: 'THEキャプター', element: 'dragon', elementLabel: '龍属性', attack: 155 }
  ];

  // 既存フックを退避
  const prevOnPlayerAction = EC.hooks.onPlayerAction;
  const prevOnUpdatePlayer = EC.hooks.onUpdatePlayer;
  const prevOnDrawPlayerWeapon = EC.hooks.onDrawPlayerWeapon;
  const prevOnDrawWeaponUI = EC.hooks.onDrawWeaponUI;
  const prevOnResetGame = EC.hooks.onResetGame;
  const prevOnSwitchWeapon = EC.hooks.onSwitchWeapon;

  function initBowState(player) {
    if (typeof player.bowChargeLv !== 'number') player.bowChargeLv = 1; // 1 ~ 3
    if (typeof player.bowChargeTimer !== 'number') player.bowChargeTimer = 0;
    if (!Array.isArray(player.bowArrows)) player.bowArrows = [];
    if (typeof player.bowDrawFx !== 'number') player.bowDrawFx = 0;
  }

  function spawnBowArrow(player, type, x, y, vx, vy) {
    player.bowArrows.push({
      type: type, // 'rapid' | 'power' | 'dragonPiercer'
      x: x,
      y: y,
      vx: vx,
      vy: vy || 0,
      life: type === 'dragonPiercer' ? 56 : (type === 'power' ? 28 : 44),
      hitsLeft: type === 'dragonPiercer' ? 5 : 1,
      hitCooldown: 0
    });
  }

  // 3. アクション入力フック
  EC.hooks.onPlayerAction = function(code, ctx) {
    const { player, keys, addText, addParticles } = ctx;
    if (player.weaponType !== 'bow') {
      if (prevOnPlayerAction) return prevOnPlayerAction(code, ctx);
      return;
    }
    initBowState(player);

    const bowX = player.x + 15 + player.facing * 26;
    const bowY = player.y - 34;

    // J / Z : 連射矢（溜めLvに応じて2〜4本連射＋溜め段階上昇）
    if ((code === 'KeyJ' || code === 'KeyZ') && ['idle', 'run', 'jump', 'bowStep'].includes(player.state)) {
      if (player.stamina < 8) {
        addText('スタミナ不足！', player.x - 10, player.y - 72, '#ff8a80', 15);
        return;
      }
      player.stamina -= 8;
      player.state = 'bowShoot';
      player.stateTimer = 13;
      player.bowDrawFx = 8;

      const count = player.bowChargeLv + 1; // Lv1:2本, Lv2:3本, Lv3:4本
      for (let i = 0; i < count; i++) {
        const offsetY = (i - (count - 1) / 2) * 5;
        spawnBowArrow(player, 'rapid', bowX + i * player.facing * 6, bowY + offsetY, player.facing * 19.5, 0);
      }
      addParticles(bowX, bowY, '#80ffff', 6 + count * 2, 3.5);

      // 撃つたびに溜め段階UP（Lv3で維持）
      player.bowChargeLv = Math.min(3, player.bowChargeLv + 1);
      player.bowChargeTimer = 150; // 2.5秒間溜め段階をキープ
    }

    // K / X : 剛射（扇状拡散ショット・最大5本同時発射）
    if ((code === 'KeyK' || code === 'KeyX') && ['idle', 'run', 'jump', 'bowShoot', 'bowStep'].includes(player.state)) {
      if (player.stamina < 14) {
        addText('スタミナ不足！', player.x - 10, player.y - 72, '#ff8a80', 15);
        return;
      }
      player.stamina -= 14;
      player.state = 'bowShoot';
      player.stateTimer = 15;
      player.bowDrawFx = 10;
      player.vx = -player.facing * 2.5;

      const spreadAngles = player.bowChargeLv >= 3
        ? [-0.24, -0.12, 0, 0.12, 0.24]
        : (player.bowChargeLv === 2 ? [-0.18, -0.06, 0.06, 0.18] : [-0.14, 0, 0.14]);

      spreadAngles.forEach(ang => {
        const spd = 18.0;
        spawnBowArrow(
          player,
          'power',
          bowX,
          bowY,
          player.facing * Math.cos(ang) * spd,
          Math.sin(ang) * spd
        );
      });
      addParticles(bowX, bowY, '#ffd54f', 12, 4.5);

      player.bowChargeLv = Math.min(3, player.bowChargeLv + 1);
      player.bowChargeTimer = 150;
    }

    // L / C : 移動入力中なら「チャージステップ」、停止中なら必殺「竜の一矢」
    if ((code === 'KeyL' || code === 'KeyC') && ['idle', 'run', 'jump', 'bowShoot'].includes(player.state)) {
      const moveDir = (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) - (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0);
      if (moveDir !== 0) {
        // チャージステップ（高速回避＋溜め段階UP）
        if (player.stamina < 15) {
          addText('スタミナ不足！', player.x - 10, player.y - 72, '#ff8a80', 15);
          return;
        }
        player.stamina -= 15;
        player.facing = moveDir;
        player.state = 'bowStep';
        player.stateTimer = 14;
        player.invulnTimer = Math.max(player.invulnTimer, 13);
        player.vx = moveDir * 10.5;
        player.bowChargeLv = Math.min(3, player.bowChargeLv + 1);
        player.bowChargeTimer = 165;
        addText(`チャージステップ(Lv.${player.bowChargeLv})`, player.x - 24, player.y - 76, '#84ffff', 16);
        addParticles(player.x + 15, player.y - 30, '#84ffff', 12, 4);
      } else {
        // 竜の一矢（溜め構え → 超貫通矢発射）
        if (player.stamina < 20) {
          addText('スタミナ不足！', player.x - 10, player.y - 72, '#ff8a80', 15);
          return;
        }
        player.stamina -= 20;
        player.state = 'bowPiercerCharge';
        player.stateTimer = 26;
        player.vx = 0;
        addText('竜の一矢 引き絞り！', player.x - 20, player.y - 80, '#ff9100', 18);
      }
    }
  };

  // 4. プレイヤー＆矢の更新フック
  EC.hooks.onUpdatePlayer = function(ctx) {
    const {
      canvas, GROUND_Y, GRAVITY, player, activeMonsters, keys,
      addText, addParticles, rectIntersect, getMonsterBody,
      getCurrentWeapon, computeWeaponHitDamage
    } = ctx;

    if (player.weaponType !== 'bow') {
      if (prevOnUpdatePlayer) return prevOnUpdatePlayer(ctx);
      return false;
    }
    initBowState(player);

    if (player.bowDrawFx > 0) player.bowDrawFx--;

    // 溜め段階の維持タイマー
    if (player.bowChargeTimer > 0) {
      player.bowChargeTimer--;
      if (player.bowChargeTimer <= 0 && player.bowChargeLv > 1) {
        player.bowChargeLv = 1;
      }
    }

    if (player.state !== 'dodge' && player.state !== 'bowStep') {
      player.stamina = Math.min(player.maxStamina, player.stamina + 0.44); // 弓はスタミナ回復早め
    }
    if (player.bubblyBuffTimer > 0) player.bubblyBuffTimer--;
    if (player.burnTimer > 0) {
      player.burnTimer--;
      if (player.burnTimer % 30 === 0) player.hp = Math.max(1, player.hp - 2);
    }
    if (player.thunderBlightTimer > 0) player.thunderBlightTimer--;
    if (player.bubbleTimer > 0) player.bubbleTimer--;
    if (player.poisonTimer > 0) {
      player.poisonTimer--;
      if (player.poisonTimer % 35 === 0) player.hp = Math.max(1, player.hp - 2);
    }
    if (player.invulnTimer > 0) player.invulnTimer--;

    const isBubbled = player.bubbleTimer > 0;

    if (player.paralysisTimer > 0) {
      player.paralysisTimer--;
      player.vx *= 0.7;
      if (player.state !== 'hurt') player.state = 'idle';
    } else if (['idle', 'run', 'jump'].includes(player.state)) {
      let move = 0;
      if (keys['KeyA'] || keys['ArrowLeft']) move -= 1;
      if (keys['KeyD'] || keys['ArrowRight']) move += 1;
      const maxSpeed = 5.4; // 弓は軽快なフットワーク
      if (move !== 0) {
        player.facing = move;
        player.vx = isBubbled ? Math.max(-maxSpeed * 1.25, Math.min(maxSpeed * 1.25, player.vx + move * 0.45)) : move * maxSpeed;
        if (player.y >= GROUND_Y) player.state = 'run';
      } else {
        player.vx *= isBubbled ? 0.95 : 0.7;
        if (Math.abs(player.vx) < 0.08) player.vx = 0;
        if (player.y >= GROUND_Y) player.state = 'idle';
      }
      if ((keys['KeyW'] || keys['Space'] || keys['ArrowUp']) && player.y >= GROUND_Y) {
        player.vy = -12.7;
        player.state = 'jump';
      }
    } else if (player.state === 'bowShoot' || player.state === 'bowStep') {
      player.vx *= 0.84;
      player.stateTimer--;
      if (player.stateTimer <= 0) player.state = 'idle';
    } else if (player.state === 'bowPiercerCharge') {
      player.vx = 0;
      player.stateTimer--;
      if (player.stateTimer % 4 === 0) {
        addParticles(player.x + 15 + player.facing * 24, player.y - 34, '#ff9100', 4, 3);
      }
      if (player.stateTimer <= 0) {
        // 竜の一矢 発射！！
        const bowX = player.x + 15 + player.facing * 28;
        const bowY = player.y - 34;
        spawnBowArrow(player, 'dragonPiercer', bowX, bowY, player.facing * 22.0, 0);
        player.state = 'bowShoot';
        player.stateTimer = 16;
        player.bowDrawFx = 14;
        player.vx = -player.facing * 6.5;
        ctx.screenShake = 9;
        addText('竜の一矢！！', player.x - 14, player.y - 84, '#ff5252', 22);
        addParticles(bowX, bowY, '#ff3d00', 22, 7);
        player.bowChargeLv = 1;
        player.bowChargeTimer = 0;
      }
    } else if (player.state === 'dodge' || player.state === 'hurt') {
      player.vx *= isBubbled ? 0.94 : 0.9;
      player.stateTimer--;
      if (player.stateTimer <= 0) player.state = 'idle';
    }

    player.vy += GRAVITY;
    player.x += player.vx;
    player.y += player.vy;
    if (player.y >= GROUND_Y) { player.y = GROUND_Y; player.vy = 0; }
    player.x = Math.max(20, Math.min(canvas.width - 50, player.x));

    // 飛翔中の矢の更新＆命中処理
    const weapon = getCurrentWeapon();
    const sparkColors = { fire: '#ff6d00', water: '#4fc3f7', thunder: '#00e5ff', ice: '#80deea', dragon: '#d500f9', none: '#ffd54f' };
    const hitSparkColor = sparkColors[weapon.element] || '#ffd54f';

    for (let i = player.bowArrows.length - 1; i >= 0; i--) {
      const a = player.bowArrows[i];
      a.x += a.vx;
      a.y += a.vy;
      a.life--;
      if (a.hitCooldown > 0) a.hitCooldown--;

      const aBox = a.type === 'dragonPiercer'
        ? { x: a.x - 18, y: a.y - 10, w: 36, h: 20 }
        : { x: a.x - 12, y: a.y - 5, w: 24, h: 10 };

      let removeArrow = false;

      for (const m of activeMonsters) {
        if (m.hp <= 0) continue;
        if (a.hitCooldown > 0) continue;
        if (!rectIntersect(aBox, getMonsterBody(m))) continue;

        m.flashTimer = 4;
        let mv = 14;
        let staggerChance = 0.06;
        let textColor = '#ffd700';
        let textSize = 18;

        if (a.type === 'rapid') {
          mv = 14;
          staggerChance = 0.06;
          addParticles(a.x, a.y, hitSparkColor, 6, 4);
          removeArrow = true;
        } else if (a.type === 'power') {
          mv = 16;
          staggerChance = 0.08;
          textColor = '#ffd54f';
          addParticles(a.x, a.y, hitSparkColor, 8, 4);
          removeArrow = true;
        } else if (a.type === 'dragonPiercer') {
          // 竜の一矢：最大5回多段貫通ヒット！
          mv = 28;
          staggerChance = 0.16;
          textColor = '#ff5252';
          textSize = 23;
          a.hitsLeft--;
          a.hitCooldown = 3;
          ctx.screenShake = Math.max(ctx.screenShake, 5);
          addParticles(a.x, a.y, '#ff5252', 14, 6);
          if (a.hitsLeft <= 0) removeArrow = true;
        }

        const res = computeWeaponHitDamage(mv, weapon, 1.05, m.species);
        m.hp -= res.dmg;
        if (res.elemMult >= 1.25 && a.type !== 'dragonPiercer') textColor = '#80ffff';
        addText(res.dmg, a.x + (Math.random() * 14 - 7), a.y - 14, textColor, textSize);

        if (m.hp <= 0) {
          m.hp = 0;
          m.attackHitbox = null;
          addText('部位破壊・討伐！', m.x + 10, m.y - 95, '#ffd700', 22);
          addParticles(m.x + m.w / 2, m.y - 45, '#ffd700', 24, 7);
        } else if (Math.random() < staggerChance && m.state !== 'stagger') {
          m.state = 'stagger';
          m.stateTimer = 50;
          m.isFlying = false;
          m.isCharged = false;
          m.somersaultAngle = 0;
          m.attackHitbox = null;
          addText('怯み！', m.x + 25, m.y - 100, '#ffaa00', 24);
        }

        if (removeArrow) break;
      }

      if (removeArrow || a.life <= 0 || a.x < 0 || a.x > canvas.width) {
        player.bowArrows.splice(i, 1);
      }
    }

    return true;
  };

  // 5. 大弓＆飛翔する矢の描画フック
  EC.hooks.onDrawPlayerWeapon = function(handX, handY, hookCtx) {
    const { ctx, player, getCurrentWeapon } = hookCtx;
    if (player.weaponType !== 'bow') {
      if (prevOnDrawPlayerWeapon) return prevOnDrawPlayerWeapon(handX, handY, hookCtx);
      return;
    }
    initBowState(player);

    const wpn = getCurrentWeapon();
    const elemColors = {
      fire: '#ff6d00',
      thunder: '#00e5ff',
      ice: '#80deea',
      dragon: '#d500f9',
      none: '#d7ccc8'
    };
    const bowCol = elemColors[wpn.element] || '#d7ccc8';

    ctx.save();
    ctx.translate(handX, handY);
    if (player.facing === -1) ctx.scale(-1, 1);

    if (player.bowChargeLv >= 3 || player.state === 'bowPiercerCharge' || wpn.element !== 'none') {
      ctx.shadowColor = player.state === 'bowPiercerCharge' ? '#ff5252' : bowCol;
      ctx.shadowBlur = player.bowChargeLv >= 3 ? 13 : 8;
    }

    // アーチ状の弓本体（リム）
    ctx.strokeStyle = bowCol;
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.arc(4, 0, 26, -Math.PI * 0.45, Math.PI * 0.45);
    ctx.stroke();

    // 弓の弦（引き絞り演出付き）
    const pullBack = player.state === 'bowPiercerCharge' ? -14 : (player.bowDrawFx > 0 ? -8 : 0);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(8, -25);
    ctx.lineTo(8 + pullBack, 0);
    ctx.lineTo(8, 25);
    ctx.stroke();

    // 竜の一矢チャージ中の光の矢じり
    if (player.state === 'bowPiercerCharge') {
      ctx.fillStyle = '#ff5252';
      ctx.beginPath();
      ctx.moveTo(36, 0);
      ctx.lineTo(24, -6);
      ctx.lineTo(24, 6);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();

    // 飛翔中の矢の描画
    ctx.save();
    for (const a of player.bowArrows) {
      const ang = Math.atan2(a.vy, a.vx);
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(ang);

      if (a.type === 'dragonPiercer') {
        // 竜の一矢（赤く輝く大型貫通矢）
        ctx.shadowColor = '#ff3d00';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#ff5252';
        ctx.fillRect(-20, -3, 36, 6);
        ctx.fillStyle = '#ffee58';
        ctx.beginPath();
        ctx.moveTo(22, 0);
        ctx.lineTo(10, -7);
        ctx.lineTo(10, 7);
        ctx.closePath();
        ctx.fill();
      } else {
        // 通常の連射矢・剛射矢
        ctx.fillStyle = a.type === 'power' ? '#ffd54f' : bowCol;
        ctx.fillRect(-12, -1.5, 22, 3);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(13, 0);
        ctx.lineTo(7, -3.5);
        ctx.lineTo(7, 3.5);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  };

  // 6. 武器専用UI（溜め段階 Lv.1〜Lv.3 ブロック＋維持時間バー）
  EC.hooks.onDrawWeaponUI = function(hookCtx) {
    const { ctx, player } = hookCtx;
    if (player.weaponType !== 'bow') {
      if (prevOnDrawWeaponUI) return prevOnDrawWeaponUI(hookCtx);
      return;
    }
    initBowState(player);

    // 溜め段階 3ブロック（左側）
    const lvColors = ['#80deea', '#ffd54f', '#ff5252'];
    for (let i = 0; i < 3; i++) {
      const bx = 20 + i * 24;
      const active = i < player.bowChargeLv;
      ctx.fillStyle = active ? lvColors[i] : '#263238';
      ctx.fillRect(bx, 56, 20, 12);
      ctx.strokeStyle = active ? '#ffffff' : '#546e7a';
      ctx.strokeRect(bx, 56, 20, 12);
    }

    // 溜め維持タイマーバー（右側）
    const ratio = player.bowChargeTimer > 0 ? Math.min(1, player.bowChargeTimer / 165) : 0;
    ctx.fillStyle = '#222';
    ctx.fillRect(96, 56, 104, 12);
    ctx.fillStyle = player.bowChargeLv >= 3 ? '#ff5252' : '#84ffff';
    ctx.fillRect(96, 56, 104 * ratio, 12);
    ctx.strokeStyle = player.bowChargeLv >= 3 ? '#ffab91' : '#607d8b';
    ctx.strokeRect(96, 56, 104, 12);
  };

  // 7. リセット・武器切替フック
  EC.hooks.onResetGame = function(hookCtx) {
    initBowState(hookCtx.player);
    hookCtx.player.bowChargeLv = 1;
    hookCtx.player.bowChargeTimer = 0;
    hookCtx.player.bowArrows = [];
    hookCtx.player.bowDrawFx = 0;
    if (prevOnResetGame) prevOnResetGame(hookCtx);
  };

  EC.hooks.onSwitchWeapon = function(hookCtx) {
    initBowState(hookCtx.player);
    hookCtx.player.bowArrows = [];
    if (prevOnSwitchWeapon) prevOnSwitchWeapon(hookCtx);
  };
})();
// ==========================================
// 機能拡張：武器種選択ボード（Enterで一覧表示＆クリック選択・修正版）
// ==========================================
window.addEventListener('load', function() {
  let isWeaponTypeBoardOpen = false;
  let hoveredWeaponTypeIdx = -1;
  let hoveredWtPageBtn = -1; // 0: 前へ, 1: 次へ
  let wtPage = 0;
  const WT_PER_PAGE = 9; // 3列×3行

  const WT_META = {
    longsword:  { color: '#ef5350', border: '#ffcdd2', tag: '気刃斬り・見切りカウンター' },
    greatsword: { color: '#ff7043', border: '#ffccbc', tag: '高火力溜め斬り・タックル耐え' },
    dualblades: { color: '#ec407a', border: '#f8bbd0', tag: '鬼人化・超高速2〜3連撃' },
    hammer:     { color: '#ffa726', border: '#ffe0b2', tag: '溜め打撃・高確率スタン怯み' },
    sns:        { color: '#66bb6a', border: '#c8e6c9', tag: '抜刀アイテム・ジャストガード' },
    lance:      { color: '#29b6f6', border: '#b3e5fc', tag: '三段突き・鉄壁カウンター盾' }
  };

  function getWtCardRect(slotIdxOnPage) {
    const cols = 3;
    const cardW = 250;
    const cardH = 88;
    const gapX = 16;
    const gapY = 14;
    const startX = (canvas.width - (cardW * cols + gapX * (cols - 1))) / 2;
    const startY = 122;
    const col = slotIdxOnPage % cols;
    const row = Math.floor(slotIdxOnPage / cols);
    return {
      x: startX + col * (cardW + gapX),
      y: startY + row * (cardH + gapY),
      w: cardW,
      h: cardH
    };
  }

  function getWtPageBtnRects() {
    return [
      { x: 640, y: 80, w: 84, h: 26 },
      { x: 774, y: 80, w: 84, h: 26 }
    ];
  }

  function selectWeaponTypeByIndex(idx) {
    if (idx < 0 || idx >= WEAPON_TYPES.length) return;
    const selected = WEAPON_TYPES[idx];
    player.weaponType = selected.key;
    player.state = 'idle';
    player.attackHitbox = null;
    player.chargeFrames = 0;
    player.chargeLevel = 0;
    player.demonMode = false;
    if (typeof EXTRA_HOOKS.onSwitchWeapon === 'function') {
      EXTRA_HOOKS.onSwitchWeapon(getHookContext());
    }
    updateControlsInfo();
    isWeaponTypeBoardOpen = false;
    hoveredWeaponTypeIdx = -1;
    canvas.style.cursor = 'default';
  }

  function updateHoveredWeaponType(mx, my) {
    if (!isWeaponTypeBoardOpen) {
      hoveredWeaponTypeIdx = -1;
      hoveredWtPageBtn = -1;
      return;
    }

    let foundBtn = -1;
    const btnRects = getWtPageBtnRects();
    for (let b = 0; b < btnRects.length; b++) {
      const br = btnRects[b];
      if (mx >= br.x && mx <= br.x + br.w && my >= br.y && my <= br.y + br.h) {
        foundBtn = b;
        break;
      }
    }
    hoveredWtPageBtn = foundBtn;

    let foundCard = -1;
    const pageStart = wtPage * WT_PER_PAGE;
    const pageEnd = Math.min(WEAPON_TYPES.length, pageStart + WT_PER_PAGE);
    for (let i = pageStart; i < pageEnd; i++) {
      const r = getWtCardRect(i - pageStart);
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
        foundCard = i;
        break;
      }
    }
    hoveredWeaponTypeIdx = foundCard;
    canvas.style.cursor = (foundCard >= 0 || foundBtn >= 0) ? 'pointer' : 'default';
  }

  // マウス移動（キャプチャ段階）
  canvas.addEventListener('mousemove', function(e) {
    if (!isWeaponTypeBoardOpen) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);
    updateHoveredWeaponType(mx, my);
  }, true);

  // マウスクリック（キャプチャ段階）
  canvas.addEventListener('click', function(e) {
    if (!isWeaponTypeBoardOpen) return;
    e.stopImmediatePropagation();

    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);
    updateHoveredWeaponType(mx, my);

    const totalPages = Math.max(1, Math.ceil(WEAPON_TYPES.length / WT_PER_PAGE));
    if (hoveredWtPageBtn === 0) {
      wtPage = (wtPage + totalPages - 1) % totalPages;
      updateHoveredWeaponType(mx, my);
      return;
    }
    if (hoveredWtPageBtn === 1) {
      wtPage = (wtPage + 1) % totalPages;
      updateHoveredWeaponType(mx, my);
      return;
    }

    if (hoveredWeaponTypeIdx >= 0) {
      selectWeaponTypeByIndex(hoveredWeaponTypeIdx);
    }
  }, true);

  // キー操作（キャプチャ段階で本体のkeydownより先に処理）
  window.addEventListener('keydown', function(e) {
    const code = e.code;

    if (isWeaponTypeBoardOpen) {
      e.preventDefault();
      e.stopImmediatePropagation();

      const totalPages = Math.max(1, Math.ceil(WEAPON_TYPES.length / WT_PER_PAGE));
      const pageStart = wtPage * WT_PER_PAGE;
      const pageEnd = Math.min(WEAPON_TYPES.length, pageStart + WT_PER_PAGE);

      if (code === 'Escape' || code === 'ControlLeft' || code === 'ControlRight') {
        isWeaponTypeBoardOpen = false;
        hoveredWeaponTypeIdx = -1;
        canvas.style.cursor = 'default';
        return;
      }
      if (code === 'KeyQ' || code === 'PageUp') {
        wtPage = (wtPage + totalPages - 1) % totalPages;
        hoveredWeaponTypeIdx = wtPage * WT_PER_PAGE;
        return;
      }
      if (code === 'KeyE' || code === 'PageDown') {
        wtPage = (wtPage + 1) % totalPages;
        hoveredWeaponTypeIdx = wtPage * WT_PER_PAGE;
        return;
      }
      if (code === 'ArrowRight' || code === 'KeyD') {
        if (hoveredWeaponTypeIdx < pageStart || hoveredWeaponTypeIdx >= pageEnd) {
          hoveredWeaponTypeIdx = pageStart;
        } else if (hoveredWeaponTypeIdx + 1 < pageEnd) {
          hoveredWeaponTypeIdx++;
        } else {
          wtPage = (wtPage + 1) % totalPages;
          hoveredWeaponTypeIdx = wtPage * WT_PER_PAGE;
        }
        return;
      }
      if (code === 'ArrowLeft' || code === 'KeyA') {
        if (hoveredWeaponTypeIdx < pageStart || hoveredWeaponTypeIdx >= pageEnd) {
          hoveredWeaponTypeIdx = pageStart;
        } else if (hoveredWeaponTypeIdx - 1 >= pageStart) {
          hoveredWeaponTypeIdx--;
        } else {
          wtPage = (wtPage + totalPages - 1) % totalPages;
          hoveredWeaponTypeIdx = Math.min(WEAPON_TYPES.length - 1, wtPage * WT_PER_PAGE + WT_PER_PAGE - 1);
        }
        return;
      }
      if (code === 'ArrowDown' || code === 'KeyS') {
        if (hoveredWeaponTypeIdx < pageStart || hoveredWeaponTypeIdx >= pageEnd) {
          hoveredWeaponTypeIdx = pageStart;
        } else if (hoveredWeaponTypeIdx + 3 < pageEnd) {
          hoveredWeaponTypeIdx += 3;
        }
        return;
      }
      if (code === 'ArrowUp' || code === 'KeyW') {
        if (hoveredWeaponTypeIdx < pageStart || hoveredWeaponTypeIdx >= pageEnd) {
          hoveredWeaponTypeIdx = pageStart;
        } else if (hoveredWeaponTypeIdx - 3 >= pageStart) {
          hoveredWeaponTypeIdx -= 3;
        }
        return;
      }
      if (code === 'Enter' || code === 'Space') {
        if (hoveredWeaponTypeIdx >= 0) {
          selectWeaponTypeByIndex(hoveredWeaponTypeIdx);
        } else {
          isWeaponTypeBoardOpen = false;
        }
        return;
      }
      return;
    }

    // 装備メニューの「武器」欄でEnterを押した瞬間にボードを開く
    if (isEquipMenuOpen && !isWeaknessGuideOpen && equipCursor === 0 && (code === 'Enter' || code === 'NumpadEnter')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      isWeaponTypeBoardOpen = true;
      const curIdx = Math.max(0, WEAPON_TYPES.findIndex(t => t.key === player.weaponType));
      wtPage = Math.floor(curIdx / WT_PER_PAGE);
      hoveredWeaponTypeIdx = curIdx;
      return;
    }
  }, true);

  function drawWeaponTypeSelectBoard() {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const boxW = 830;
    const boxH = 445;
    const boxX = (canvas.width - boxW) / 2;
    const boxY = (canvas.height - boxH) / 2;

    const bg = ctx.createLinearGradient(0, boxY, 0, boxY + boxH);
    bg.addColorStop(0, '#221b14');
    bg.addColorStop(1, '#14100c');
    ctx.fillStyle = bg;
    ctx.fillRect(boxX, boxY, boxW, boxH);

    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 3;
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('【 武器種選択ボード 】', boxX + 24, boxY + 40);

    const curWpn = getCurrentWeapon();
    const curLabel = getWeaponTypeLabel();
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffd54f';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(`現在選択中: [${curLabel}] ${curWpn.name}`, boxX + boxW - 24, boxY + 38);
    ctx.textAlign = 'left';

    ctx.fillStyle = '#ccc';
    ctx.font = '13px sans-serif';
    ctx.fillText('使いたい武器種をクリックして選択！（←→↑↓＋Enterでも選択可 / Escで戻る）', boxX + 26, boxY + 68);

    const totalPages = Math.max(1, Math.ceil(WEAPON_TYPES.length / WT_PER_PAGE));
    if (totalPages > 1) {
      const btnRects = getWtPageBtnRects();
      const btnLabels = ['◀ 前へ', '次へ ▶'];
      btnRects.forEach((br, bi) => {
        const isBtnHover = hoveredWtPageBtn === bi;
        ctx.fillStyle = isBtnHover ? '#4a3b28' : '#2a2219';
        ctx.fillRect(br.x, br.y, br.w, br.h);
        ctx.strokeStyle = isBtnHover ? '#ffd700' : '#8a6d3b';
        ctx.lineWidth = isBtnHover ? 2 : 1.5;
        ctx.strokeRect(br.x, br.y, br.w, br.h);

        ctx.fillStyle = isBtnHover ? '#ffd700' : '#eee';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(btnLabels[bi], br.x + br.w / 2, br.y + 17);
        ctx.textAlign = 'left';
      });

      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${wtPage + 1} / ${totalPages}`, 749, 98);
      ctx.textAlign = 'left';
    }

    const pageStart = wtPage * WT_PER_PAGE;
    const pageEnd = Math.min(WEAPON_TYPES.length, pageStart + WT_PER_PAGE);

    for (let idx = pageStart; idx < pageEnd; idx++) {
      const wt = WEAPON_TYPES[idx];
      const slotIdx = idx - pageStart;
      const r = getWtCardRect(slotIdx);
      const isHover = idx === hoveredWeaponTypeIdx;
      const isEquipped = wt.key === player.weaponType;
      const meta = WT_META[wt.key] || { color: '#ffb74d', border: '#ffe082', tag: '追加武器種・特殊アクション' };
      const wpnCount = (WEAPON_DB[wt.key] || []).length;

      ctx.fillStyle = isHover ? '#33281d' : (isEquipped ? '#292218' : '#1f1913');
      ctx.fillRect(r.x, r.y, r.w, r.h);

      ctx.fillStyle = meta.color;
      ctx.fillRect(r.x, r.y, 9, r.h);

      ctx.strokeStyle = isHover ? '#ffd700' : (isEquipped ? '#81c784' : '#5c4934');
      ctx.lineWidth = isHover ? 3 : (isEquipped ? 2 : 1.5);
      ctx.strokeRect(r.x, r.y, r.w, r.h);

      ctx.fillStyle = isHover ? '#ffd700' : '#ffffff';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(wt.label, r.x + 20, r.y + 33);

      ctx.textAlign = 'right';
      if (isEquipped) {
        ctx.fillStyle = '#81c784';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText('【装備中】', r.x + r.w - 12, r.y + 28);
      } else {
        ctx.fillStyle = meta.border;
        ctx.font = '12px sans-serif';
        ctx.fillText(`全${wpnCount}種`, r.x + r.w - 12, r.y + 28);
      }
      ctx.textAlign = 'left';

      ctx.fillStyle = '#bbb';
      ctx.font = '12px sans-serif';
      ctx.fillText(meta.tag, r.x + 20, r.y + 56);

      if (isHover) {
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText('▶ クリックで装備！', r.x + 20, r.y + 77);
      }
    }

    ctx.fillStyle = '#999';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('武器種を選んだあと、装備画面の ◀ ▶ キーで属性や武器モデルを切り替えられます', canvas.width / 2, boxY + boxH - 16);
    ctx.textAlign = 'left';

    ctx.restore();
  }

  // 本体の draw() 関数の直後に必ず武器種選択ボードを重ねて描画する
  const origDraw = window.draw;
  window.draw = function() {
    origDraw();
    if (isEquipMenuOpen && isWeaponTypeBoardOpen) {
      drawWeaponTypeSelectBoard();
    } else if (!isEquipMenuOpen) {
      isWeaponTypeBoardOpen = false;
    }
  };
});