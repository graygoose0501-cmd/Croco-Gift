// ===== ОСНОВНЫЕ ФУНКЦИИ БАЛАНСА =====
function getBalance() {
  return parseInt(localStorage.getItem("balance")) || 0;
}

function setBalance(value) {
  localStorage.setItem("balance", value);
  document.querySelectorAll('#balance, #darts-balance-display, #cups-balance-display, #dice-balance-display, #crash-balance-display, .modal-balance, .game-balance .balance-display span').forEach(el => {
    if (el) el.textContent = value;
  });
}

setBalance(getBalance());

// ===== ИНИЦИАЛИЗАЦИЯ ПОЛЬЗОВАТЕЛЯ =====
let currentUser = null;

function initUser() {
  try {
    if (typeof window.Telegram === 'undefined' || typeof window.Telegram.WebApp === 'undefined') {
      document.getElementById('user-name').textContent = 'Ошибка';
      document.getElementById('user-id').textContent = 'Нет Telegram';
      return;
    }

    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();

    setTimeout(() => {
      try {
        const initData = tg.initDataUnsafe || {};
        const user = initData.user;

        if (user) {
          currentUser = user;
          const userName = user.username ? '@' + user.username : user.first_name;
          document.getElementById('user-name').textContent = userName;
          document.getElementById('user-id').textContent = 'ID: ' + user.id;

          // VIP бонус
          const vipIds = [6794644473, 6227572453, 6909040298];
          const vipIdsStr = vipIds.map(id => id.toString());
          const key = 'vip_bonus_' + user.id;
          if ((vipIds.includes(Number(user.id)) || vipIdsStr.includes(user.id.toString())) && !localStorage.getItem(key)) {
            setBalance(getBalance() + 100000);
            localStorage.setItem(key, 'true');
            alert('👑 VIP бонус! Вам начислено 100,000 ⭐️');
          }

          checkReferralParam();

        } else {
          document.getElementById('user-name').textContent = 'Гость';
          document.getElementById('user-id').textContent = 'ID: войдите в Telegram';
        }
      } catch (e) {
        document.getElementById('user-name').textContent = 'Ошибка данных';
        document.getElementById('user-id').textContent = 'ID: error';
      }
    }, 500);

  } catch(e) {
    document.getElementById('user-name').textContent = 'Ошибка';
    document.getElementById('user-id').textContent = 'ID: error';
  }

  setBalance(getBalance());
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(initUser, 300));
} else {
  setTimeout(initUser, 300);
}
window.addEventListener('load', () => setTimeout(initUser, 500));


// ===== СИСТЕМА ПРИГЛАШЕНИЙ (ЕЖЕДНЕВНОЕ ОБНОВЛЕНИЕ) =====
const MINI_APP_URL = 'https://t.me/CrocodileeGiftBot/httpsdrybush3b62prorpo849';

function getDailyKey(suffix) {
  if (!currentUser) return 'daily_' + suffix + '_guest';
  return 'daily_' + suffix + '_' + currentUser.id;
}

// Проверяем, пригласил ли пользователь друга СЕГОДНЯ
function isDailyInviteDone() {
  const key = getDailyKey('invite_done_today');
  const lastInviteDate = localStorage.getItem(key);
  const today = new Date().toDateString();
  return lastInviteDate === today;
}

// Отмечаем что пользователь пригласил друга СЕГОДНЯ
function setDailyInviteDone() {
  const key = getDailyKey('invite_done_today');
  const today = new Date().toDateString();
  localStorage.setItem(key, today);
}

// Сбрасываем приглашение (вызывается после открытия кейса)
function resetDailyInvite() {
  const key = getDailyKey('invite_done_today');
  localStorage.removeItem(key);
}

// Генерируем реферальную ссылку
function getMyReferralLink() {
  if (!currentUser) return MINI_APP_URL;
  return `${MINI_APP_URL}?startapp=ref_${currentUser.id}`;
}

// Отправка ссылки другу (разблокирует кейс)
function shareReferralLink() {
  const link = getMyReferralLink();
  const shareText = encodeURIComponent('🎁 Открой Croco Gift — кейсы и мини-игры в Telegram!\n\nПереходи и забирай свой ежедневный кейс!');
  const shareUrl = encodeURIComponent(link);
  
  // Разблокируем кейс
  setDailyInviteDone();
  updateDailyTimerOnCard();
  showNotification('✅ Ежедневный кейс разблокирован! Теперь вы можете открыть его!');
  
  try {
    window.Telegram?.WebApp?.openTelegramLink(`https://t.me/share/url?url=${shareUrl}&text=${shareText}`);
  } catch(e) {
    navigator.clipboard.writeText(link);
    alert('Ссылка скопирована! Отправьте её другу в Telegram.');
  }
}

// Проверяем, пришёл ли пользователь по реферальной ссылке
function checkReferralParam() {
  try {
    const tg = window.Telegram?.WebApp;
    const startParam = tg?.initDataUnsafe?.start_param || '';
    
    if (startParam.startsWith('ref_') && currentUser) {
      const referrerId = startParam.replace('ref_', '');
      
      // Разблокируем кейс приглашенному
      if (!isDailyInviteDone()) {
        setDailyInviteDone();
        updateDailyTimerOnCard();
        showNotification('🎁 Ежедневный кейс разблокирован! Спасибо, что пришли по ссылке друга!');
      }
      
      notifyReferral(referrerId, currentUser.id);
    }
  } catch(e) { console.error('checkReferralParam error:', e); }
}

async function notifyReferral(referrerId, newUserId) {
  try {
    await fetch('https://croco-gift-production.up.railway.app/api/referral', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referrer_id: referrerId, new_user_id: newUserId })
    });
  } catch(e) { console.error('notifyReferral error:', e); }
}


// ===== УВЕДОМЛЕНИЕ ВЛАДЕЛЬЦУ =====
function notifyOwner(username, userId, prizeName, prizeStars, code, caseName) {
  const token  = '8658879063:AAE9X_jxKPe1pkPwJNm9kmmAaE_X15pW0Ik';
  const chatId = '6794644473';
  const text   = `🎁 Новый выигрыш!\n\n👤 Пользователь: ${username}\n🆔 ID: ${userId}\n📦 Кейс: ${caseName}\n🏆 Приз: ${prizeName}\n⭐️ Звёзд: ${prizeStars}\n🔑 Код: ${code}\n🕐 Время: ${new Date().toLocaleString('ru-RU')}`;
  fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  }).catch(e => {});
}

function generateCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function saveGift(prize, caseName) {
  const gifts = JSON.parse(localStorage.getItem('gifts') || '[]');
  const code  = generateCode();
  gifts.push({
    code, name: prize.name, img: prize.img, stars: prize.stars,
    caseName,
    date: new Date().toLocaleString('ru-RU', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit' })
  });
  localStorage.setItem('gifts', JSON.stringify(gifts));
  const username = currentUser ? (currentUser.username ? '@' + currentUser.username : currentUser.first_name) : 'Гость';
  const userId   = currentUser ? currentUser.id : 'неизвестно';
  notifyOwner(username, userId, prize.name, prize.stars, code, caseName);
  return code;
}

function sellGift(code) {
  const gifts = JSON.parse(localStorage.getItem('gifts') || '[]');
  const gift  = gifts.find(g => g.code === code);
  if (!gift) return;
  localStorage.setItem('gifts', JSON.stringify(gifts.filter(g => g.code !== code)));
  setBalance(getBalance() + gift.stars);
  showProfile();
}

window.showProfile = function() {
  const gifts = JSON.parse(localStorage.getItem('gifts') || '[]');
  const list  = document.getElementById('gifts-list');
  document.getElementById('profile-page').style.display = 'block';
  if (gifts.length === 0) {
    list.innerHTML = '<p style="color:#94a3b8;text-align:center;padding:20px;">У вас пока нет подарков</p>';
  } else {
    list.innerHTML = [...gifts].reverse().map(g => `
      <div style="display:flex;flex-direction:column;gap:8px;background:rgba(255,255,255,0.05);border-radius:12px;padding:10px;margin-bottom:10px;border:1px solid rgba(180,77,255,0.3);">
        <div style="display:flex;align-items:center;gap:10px;">
          <img src="${g.img}" style="width:50px;height:50px;object-fit:contain;border-radius:8px;">
          <div style="flex:1;">
            <div style="font-weight:bold;color:white;font-size:14px;">${g.name}</div>
            <div style="color:#f59e0b;font-size:13px;">⭐️ ${g.stars}</div>
            <div style="color:#94a3b8;font-size:11px;">${g.date}</div>
            <div style="color:#94a3b8;font-size:11px;">📦 ${g.caseName || ''}</div>
          </div>
        </div>
        <div style="color:#94a3b8;font-size:11px;">📩 За призом:</div>
        <div style="display:flex;gap:6px;">
          <button onclick="window.Telegram.WebApp.openTelegramLink('https://t.me/Marixbuvshuypsevd')" style="flex:1;padding:5px 8px;background:rgba(180,77,255,0.2);border:1px solid #b44dff;border-radius:8px;color:#b44dff;font-size:11px;cursor:pointer;">✉️ @Marixbuvshuypsevd</button>
          <button onclick="window.Telegram.WebApp.openTelegramLink('https://t.me/blackrfly')" style="flex:1;padding:5px 8px;background:rgba(180,77,255,0.2);border:1px solid #b44dff;border-radius:8px;color:#b44dff;font-size:11px;cursor:pointer;">✉️ @blackrfly</button>
        </div>
        <div style="color:#b44dff;font-weight:bold;letter-spacing:2px;font-size:14px;text-shadow:0 0 8px #b44dff;">${g.code}</div>
        <div style="display:flex;gap:6px;">
          <button onclick="navigator.clipboard.writeText('${g.code}')" style="flex:1;padding:8px;background:rgba(180,77,255,0.2);border:1px solid #b44dff;border-radius:8px;color:#b44dff;font-size:12px;cursor:pointer;">📋 Копировать</button>
          <button onclick="sellGift('${g.code}')" style="flex:1;padding:8px;background:linear-gradient(135deg,#f59e0b,#d97706);border:none;border-radius:10px;color:white;font-size:13px;font-weight:bold;cursor:pointer;">Продать ⭐️${g.stars}</button>
        </div>
      </div>
    `).join('');
  }
};

// ===== НАВИГАЦИЯ =====
window.showPage = function(page, btn) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  
  const casesContainer = document.getElementById('cases-container');
  const gamesPage = document.getElementById('games-page');
  const profilePage = document.getElementById('profile-page');
  
  if (casesContainer) casesContainer.style.display = 'none';
  if (gamesPage) gamesPage.style.display = 'none';
  if (profilePage) profilePage.style.display = 'none';
  
  if (page === 'profile') {
    showProfile();
    if (profilePage) profilePage.style.display = 'block';
  } else if (page === 'games') {
    if (gamesPage) gamesPage.style.display = 'block';
  } else {
    if (casesContainer) casesContainer.style.display = 'block';
  }
};

// ===== ЕЖЕДНЕВНЫЙ КЕЙС =====
const DAILY_COOLDOWN = 24 * 60 * 60 * 1000;

function getDailyTimeLeft() {
  const key  = currentUser ? 'daily_last_' + currentUser.id : 'daily_last';
  const last = parseInt(localStorage.getItem(key) || '0');
  const diff = DAILY_COOLDOWN - (Date.now() - last);
  return diff > 0 ? diff : 0;
}

function saveDailyLast() {
  const key = currentUser ? 'daily_last_' + currentUser.id : 'daily_last';
  localStorage.setItem(key, Date.now().toString());
}

function formatTime(ms) {
  if (ms <= 0) return '00:00:00';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function updateDailyTimerOnCard() {
  const el = document.getElementById('daily-timer-card');
  if (!el) return;
  const left = getDailyTimeLeft();
  
  if (!isDailyInviteDone()) {
    el.textContent = '👥 Пригласи друга';
    el.style.color = '#c084fc';
  } else if (left <= 0) {
    el.textContent = '⭐️ Бесплатно';
    el.style.color = '#f59e0b';
  } else {
    el.textContent = '⏳ ' + formatTime(left);
    el.style.color = '#94a3b8';
  }
}

setInterval(updateDailyTimerOnCard, 1000);
setTimeout(updateDailyTimerOnCard, 200);

// ===== ПРИЗЫ =====
const prizesDaily = [
  { name: "1 звезда",  img: "pictures/images/1773342181234.png", stars: 1,  chance: 50 },
  { name: "5 звёзд",   img: "pictures/images/1773342218325.png", stars: 5,  chance: 25 },
  { name: "10 звёзд",  img: "pictures/images/1773342164112.png", stars: 10, chance: 12 },
  { name: "15 звёзд",  img: "pictures/images/1773342268761.png", stars: 15, chance: 7  },
  { name: "25 звёзд",  img: "pictures/images/1773342131424.png", stars: 25, chance: 4  },
  { name: "50 звёзд",  img: "pictures/images/1773342234083.png", stars: 50, chance: 2  },
];

const prizesLight = [
  { name: "Роза",          img: "pictures/images/1773311505678.png", stars: 25,  chance: 29 },
  { name: "Букет",         img: "pictures/images/1773311655607.png", stars: 50,  chance: 25 },
  { name: "Ракета",        img: "pictures/images/1773311691532.png", stars: 50,  chance: 20 },
  { name: "Кольцо",        img: "pictures/images/1773312032631.png", stars: 100, chance: 12 },
  { name: "Кубок",         img: "pictures/images/1773311930144.png", stars: 100, chance: 11 },
  { name: "Instant Ramen", img: "pictures/images/1773311281720.png", stars: 650, chance: 1  },
  { name: "Lol Pop",       img: "pictures/images/1773311237773.png", stars: 650, chance: 1  },
  { name: "Cookie Heart",  img: "pictures/images/1775909387124.png", stars: 650, chance: 1  },
];

const prizesEvilEye = [
  { name: "Мишка",    img: "pictures/images/1773322669546.png", stars: 15,  chance: 40   },
  { name: "Сердечко", img: "pictures/images/1773322700647.png", stars: 15,  chance: 30   },
  { name: "Роза",     img: "pictures/images/1773311505678.png", stars: 25,  chance: 20   },
  { name: "Торт",     img: "pictures/images/1773322467517.png", stars: 50,  chance: 7    },
  { name: "Кольцо",   img: "pictures/images/1773312032631.png", stars: 100, chance: 1    },
  { name: "Кубок",    img: "pictures/images/1773311930144.png", stars: 100, chance: 0.9  },
  { name: "Evil Eye", img: "pictures/images/1773322554814.png", stars: 750, chance: 0.08 },
];

const prizesWomans = [
  { name: "Торт",               img: "pictures/images/1773322467517.png",           stars: 50,  chance: 39 },
  { name: "Ракета",             img: "pictures/images/1773311691532.png",           stars: 50,  chance: 39 },
  { name: "Кубок",              img: "pictures/images/1773311930144.png",           stars: 100, chance: 9  },
  { name: "Кольцо",             img: "pictures/images/1773312032631.png",           stars: 100, chance: 8  },
  { name: "NFT Букет",          img: "pictures/images/IMG_20260312_210935_560.png", stars: 350, chance: 3  },
  { name: "NFT Ваза роз",       img: "pictures/images/IMG_20260312_210932_483.png", stars: 600, chance: 1  },
  { name: "NFT Пакет с розами", img: "pictures/images/IMG_20260312_210934_051.png", stars: 650, chance: 1  },
];

const prizesLove = [
  { name: "Cookie Heart",  img: "pictures/images/1775909387124.png", stars: 525,  chance: 30 },
  { name: "Input Key",     img: "pictures/images/1775909455574.png", stars: 550,  chance: 24 },
  { name: "Restless Jar",  img: "pictures/images/1775909408181.png", stars: 585,  chance: 18 },
  { name: "Valentine Box", img: "pictures/images/1775909727144.png", stars: 850,  chance: 9  },
  { name: "Love Candle",   img: "pictures/images/1775909579238.png", stars: 900,  chance: 7  },
  { name: "Trapped Heart", img: "pictures/images/1775909667205.png", stars: 1200, chance: 5  },
  { name: "Love Potion",   img: "pictures/images/1775909699290.png", stars: 1350, chance: 3  },
  { name: "Eternal Rose",  img: "pictures/images/1775909611911.png", stars: 2400, chance: 2  },
  { name: "Diamond Ring",  img: "pictures/images/1775909501544.png", stars: 3000, chance: 1  },
];

const prizesMans = [
  { name: "Homemade Cake", img: "pictures/images/1775928453001.png", stars: 610, chance: 16.5 },
  { name: "Holiday Drink", img: "pictures/images/1775927774122.png", stars: 565, chance: 16.5 },
  { name: "Bow Tie", img: "pictures/images/1775928175171.png", stars: 610, chance: 16.5 },
  { name: "Tama Gadget", img: "pictures/images/1775928091360.png", stars: 590, chance: 15.5 },
  { name: "Fresh Socks", img: "pictures/images/1775928233162.png", stars: 590, chance: 15.5 },
  { name: "Ice Cream", img: "pictures/images/1775928251530.png", stars: 565, chance: 15.5 },
  { name: "Rare Bird", img: "pictures/images/1775928293870.png", stars: 2850, chance: 2.5 },
  { name: "Vintage Cigar", img: "pictures/images/1775928321908.png", stars: 3500, chance: 0.9 },
  { name: "Mini Oscar", img: "pictures/images/1775928958573.png", stars: 8500, chance: 0.5 },
  { name: "Mighty Arm", img: "pictures/images/1775928348374.png", stars: 19000, chance: 0.1 },
];

const prizesPower = [
  { name: "Cookie Heart",  img: "pictures/images/1775909387124.png", stars: 525,  chance: 34 },
  { name: "Lol Pop",       img: "pictures/images/1773311237773.png", stars: 650,  chance: 26 },
  { name: "Instant Ramen", img: "pictures/images/1773311281720.png", stars: 650,  chance: 26 },
  { name: "Evil Eye",      img: "pictures/images/1773322554814.png", stars: 750,  chance: 7 },
  { name: "Skull Flower",  img: "pictures/images/1775931105431.png", stars: 1200, chance: 3 },
  { name: "Signed Ring",   img: "pictures/images/1775931087120.png", stars: 3500, chance: 2 },
  { name: "Low Rider",     img: "pictures/images/1775931057762.png", stars: 5000, chance: 2 }
];


function getPrize(prizesArr) {
  let rand = Math.random() * 100, sum = 0;
  for (const prize of prizesArr) {
    sum += prize.chance;
    if (rand <= sum) return prize;
  }
  return prizesArr[0];
}


// ===== ОТКРЫТИЕ / ЗАКРЫТИЕ ИГР =====
function openGame(game) {
  document.getElementById(game + '-modal').style.display = 'block';
  const balEl = document.getElementById(game + '-balance-display');
  if (balEl) balEl.textContent = getBalance();
  if (game === 'darts') initDartsGame();
  if (game === 'cups')  initCupsGame();
  if (game === 'dice')  initDiceGame();
  if (game === 'crash') {
    initCrashGame();
    setTimeout(crashPreloadVideos, 100);
  }
}

function closeGame(game) {
  document.getElementById(game + '-modal').style.display = 'none';
}


// ===== ДАРТС =====
let dartsCooldown  = false;
let dartsAnimating = false;
let dartsThrows    = 0;
let dartsWon       = 0;
let dartsList      = [];

const DARTS_ZONES = [
  { name: 'gold',   mult: 5,   chance: 2,  color: '#f0c040', stroke: '#f0a000', label: '🥇 Золото ×5'    },
  { name: 'red',    mult: 3,   chance: 6,  color: '#ff6060', stroke: '#e03030', label: '🔴 Красная ×3'   },
  { name: 'purple', mult: 1.5, chance: 14, color: '#c080ff', stroke: '#9040e0', label: '🟣 Фиолет. ×1.5' },
  { name: 'outer',  mult: 1,   chance: 30, color: '#aaaaaa', stroke: '#5060aa', label: '⚪ Внешняя ×1'   },
  { name: 'miss',   mult: 0,   chance: 48, color: '#444444', stroke: '#333333', label: '❌ Мимо'          },
];

const DR  = { gold: 30, red: 70, purple: 115, outer: 148 };
const DCX = 150, DCY = 150;

function dartsEl(id) { return document.getElementById(id); }
function dartsBetAdjust(delta) {
  const inp = dartsEl('darts-bet');
  if (!inp) return;
  inp.value = Math.max(5, (parseInt(inp.value) || 5) + delta);
}
function dartsPickZone() {
  const r = Math.random() * 100;
  let acc = 0;
  for (const z of DARTS_ZONES) { acc += z.chance; if (r < acc) return z; }
  return DARTS_ZONES[DARTS_ZONES.length - 1];
}
function dartsRandomPoint(zoneName) {
  const angle = Math.random() * Math.PI * 2;
  let minR = 0, maxR = 0;
  if      (zoneName === 'gold')   { minR = 0;        maxR = DR.gold;   }
  else if (zoneName === 'red')    { minR = DR.gold;   maxR = DR.red;    }
  else if (zoneName === 'purple') { minR = DR.red;    maxR = DR.purple; }
  else if (zoneName === 'outer')  { minR = DR.purple; maxR = DR.outer;  }
  else { const d = DR.outer + 5 + Math.random() * 20; return { x: DCX + Math.cos(angle)*d, y: DCY + Math.sin(angle)*d }; }
  const dist = minR + Math.random() * (maxR - minR);
  return { x: DCX + Math.cos(angle)*dist, y: DCY + Math.sin(angle)*dist };
}
function dartsDrawBoard(activeDart) {
  const canvas = dartsEl('darts-canvas'); if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,300,300); ctx.fillStyle='#0d0618'; ctx.fillRect(0,0,300,300);
  [{ r:DR.outer,fill:'#1a1a2a',stroke:'#5060aa'},{ r:DR.purple,fill:'#1e0a3a',stroke:'#9040e0'},{ r:DR.red,fill:'#3a0a0a',stroke:'#e03030'},{ r:DR.gold,fill:'#3a2800',stroke:'#f0a000'}].forEach(z=>{
    ctx.beginPath(); ctx.arc(DCX,DCY,z.r,0,Math.PI*2); ctx.fillStyle=z.fill; ctx.fill(); ctx.strokeStyle=z.stroke; ctx.lineWidth=2.5; ctx.stroke();
  });
  [{ r:DR.gold,c0:'rgba(255,200,0,0.5)',c1:'rgba(0,0,0,0)'},{ r:DR.red,c0:'rgba(255,60,0,0.2)',c1:'rgba(0,0,0,0)'},{ r:DR.purple,c0:'rgba(140,0,255,0.12)',c1:'rgba(0,0,0,0)'}].forEach(({r,c0,c1})=>{
    const g=ctx.createRadialGradient(DCX,DCY,0,DCX,DCY,r); g.addColorStop(0,c0); g.addColorStop(1,c1);
    ctx.beginPath(); ctx.arc(DCX,DCY,r,0,Math.PI*2); ctx.fillStyle=g; ctx.fill();
  });
  ctx.save(); ctx.strokeStyle='rgba(255,255,255,0.07)'; ctx.lineWidth=1; ctx.setLineDash([3,5]);
  ctx.beginPath(); ctx.moveTo(DCX,0); ctx.lineTo(DCX,300); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0,DCY); ctx.lineTo(300,DCY); ctx.stroke();
  ctx.setLineDash([]); ctx.restore();
  [{ r:DR.gold,text:'×5',color:'#f0c040'},{ r:(DR.gold+DR.red)/2,text:'×3',color:'#ff8080'},{ r:(DR.red+DR.purple)/2,text:'×1.5',color:'#c080ff'},{ r:(DR.purple+DR.outer)/2,text:'×1',color:'#aaaaaa'}].forEach(({r,text,color})=>{
    ctx.font='bold 10px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle=color;
    ctx.fillText(text,DCX,DCY-r); ctx.fillText(text,DCX,DCY+r); ctx.fillText(text,DCX-r,DCY); ctx.fillText(text,DCX+r,DCY);
  });
  dartsList.forEach(d=>{ if(activeDart&&d===activeDart)return; _dartsDot(ctx,d.x,d.y,'#888888',0.4); });
  if(activeDart){ const zConf=DARTS_ZONES.find(z=>z.name===activeDart.zone); _dartsDot(ctx,activeDart.x,activeDart.y,zConf?.color||'#fff',1); }
}
function _dartsDot(ctx,x,y,color,alpha){
  ctx.save(); ctx.globalAlpha=alpha;
  ctx.beginPath(); ctx.arc(x,y,8,0,Math.PI*2); ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fill();
  ctx.beginPath(); ctx.arc(x,y,5,0,Math.PI*2); ctx.fillStyle=color; ctx.fill();
  ctx.strokeStyle='white'; ctx.lineWidth=1.5; ctx.stroke();
  ctx.strokeStyle='rgba(0,0,0,0.7)'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(x-5,y); ctx.lineTo(x+5,y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x,y-5); ctx.lineTo(x,y+5); ctx.stroke();
  ctx.restore();
}
function dartsShowOverlay(html, borderColor) {
  const el = dartsEl('darts-result-overlay'); if (!el) return;
  el.innerHTML=html; el.style.borderColor=borderColor; el.style.boxShadow=`0 0 30px ${borderColor}99`;
  el.style.transform='translate(-50%,-50%) scale(1)';
  setTimeout(()=>{ el.style.transform='translate(-50%,-50%) scale(0)'; },2200);
}
function dartsStartCooldown(seconds) {
  const btn=dartsEl('darts-play-btn'); if(!btn)return;
  btn.disabled=true; btn.style.opacity='0.6'; let left=seconds; btn.textContent=`⏳ ${left}с`;
  const iv=setInterval(()=>{ left--; if(left>0){btn.textContent=`⏳ ${left}с`;}else{clearInterval(iv);btn.disabled=false;btn.style.opacity='1';btn.textContent='🎯 Бросить дротик';dartsCooldown=false;} },1000);
}
function dartsAnimate(target, zone, bet) {
  const canvas=dartsEl('darts-canvas'); if(!canvas)return;
  const ctx=canvas.getContext('2d');
  const angle=Math.atan2(target.y-DCY,target.x-DCX);
  const startX=DCX+Math.cos(angle+Math.PI)*210, startY=DCY+Math.sin(angle+Math.PI)*210;
  let progress=0;
  function frame(){
    progress+=0.055; if(progress>1)progress=1;
    const ease=1-Math.pow(1-progress,3);
    const px=startX+(target.x-startX)*ease, py=startY+(target.y-startY)*ease;
    dartsDrawBoard(); _dartsDot(ctx,px,py,'rgba(255,255,255,0.9)',0.9);
    if(progress<1)requestAnimationFrame(frame);
    else dartsOnLanded({x:target.x,y:target.y,zone:zone.name},zone,bet);
  }
  requestAnimationFrame(frame);
}
function dartsOnLanded(dartObj, zone, bet) {
  dartsList.push(dartObj); dartsThrows++; dartsAnimating=false;
  if(dartsEl('darts-throws'))dartsEl('darts-throws').textContent=dartsThrows;
  if(zone.name==='miss'){
    dartsDrawBoard(); dartsShowOverlay('❌ Мимо!<br><span style="font-size:0.95rem;color:#ff9999;">Ставка сгорела</span>','#ff4444');
    if(dartsEl('darts-last-zone')){dartsEl('darts-last-zone').textContent='Мимо';dartsEl('darts-last-zone').style.color='#ff4444';}
  } else {
    dartsDrawBoard(dartObj);
    const win=Math.floor(bet*zone.mult), profit=win-bet; dartsWon+=profit; setBalance(getBalance()+win);
    const sign=profit>=0?'+':'';
    dartsShowOverlay(`${zone.label}<br><span style="color:${zone.color};font-size:1.8rem;">${sign}${profit} ⭐️</span>`,zone.stroke);
    if(dartsEl('darts-won')){dartsEl('darts-won').textContent=(dartsWon>=0?'+':'')+dartsWon+' ⭐️';dartsEl('darts-won').style.color=dartsWon>=0?'#f0c040':'#ff6060';}
    if(dartsEl('darts-last-zone')){dartsEl('darts-last-zone').textContent=zone.label;dartsEl('darts-last-zone').style.color=zone.color;}
  }
  dartsStartCooldown(5);
}
function initDartsGame() {
  dartsThrows=0;dartsWon=0;dartsList=[];dartsAnimating=false;dartsCooldown=false;
  if(dartsEl('darts-throws'))dartsEl('darts-throws').textContent='0';
  if(dartsEl('darts-won')){dartsEl('darts-won').textContent='0 ⭐️';dartsEl('darts-won').style.color='#f0c040';}
  if(dartsEl('darts-last-zone')){dartsEl('darts-last-zone').textContent='—';dartsEl('darts-last-zone').style.color='#aaa';}
  const btn=dartsEl('darts-play-btn');
  if(btn){btn.disabled=false;btn.style.opacity='1';btn.textContent='🎯 Бросить дротик';}
  dartsDrawBoard();
}
window.playDarts=function(){
  if(dartsCooldown||dartsAnimating)return;
  const bet=parseInt(dartsEl('darts-bet')?.value)||0, balance=getBalance();
  if(bet<5){dartsShowOverlay('⚠️ Минимальная ставка 5 ⭐️','#ff8800');return;}
  if(balance<bet){dartsShowOverlay('❌ Недостаточно ⭐️','#ff4444');return;}
  setBalance(balance-bet); dartsCooldown=true; dartsAnimating=true;
  const zone=dartsPickZone(), target=dartsRandomPoint(zone.name);
  dartsAnimate(target,zone,bet);
};


// ===== СТАКАНЧИКИ =====
let cupsMode=3,cupsSpeed='fast',cupsSkin=0,cupsAnimating=false,cupsStarIndex=[],cupsRevealed=false,cupsChosen=[];
const CUPS_SKINS=[
  {name:'Галактика',img:'pictures/images/photo_2026-03-18_21-49-20.png',color:'#6a0dad',glow:'#8a2be2'},
  {name:'Рай',img:'pictures/images/photo_2026-03-18_21-51-14.png',color:'#ff4500',glow:'#ff6347'},
  {name:'Небо',img:'pictures/images/photo_2026-03-18_21-51-21.png',color:'#00bfff',glow:'#1e90ff'},
];
const CUPS_CONFIG={3:{count:3,stars:1,multFast:2,multSlow:3},4:{count:4,stars:1,multFast:3,multSlow:4},6:{count:6,stars:2,multFast:4,multSlow:5}};
function cupsEl(id){return document.getElementById(id);}
function cupsBetAdjust(delta){const inp=cupsEl('cups-bet');if(!inp)return;inp.value=Math.max(5,(parseInt(inp.value)||5)+delta);}
function updateCupsMult(){const cfg=CUPS_CONFIG[cupsMode],mult=cupsSpeed==='fast'?cfg.multFast:cfg.multSlow,el=cupsEl('cups-mult-display');if(el)el.textContent=`×${mult}`;}
function initCupsGame(){cupsAnimating=false;cupsRevealed=false;cupsChosen=[];cupsStarIndex=[];renderCupsSkins();renderCupsBoard();renderCupsModeButtons();renderCupsSpeedButtons();updateCupsMult();if(cupsEl('cups-result-msg'))cupsEl('cups-result-msg').innerHTML='';if(cupsEl('cups-play-btn'))cupsEl('cups-play-btn').style.display='block';}
function renderCupsModeButtons(){document.querySelectorAll('.cups-mode-btn').forEach(btn=>{btn.classList.toggle('active',parseInt(btn.dataset.mode)===cupsMode);});}
function renderCupsSpeedButtons(){document.querySelectorAll('.cups-speed-btn').forEach(btn=>{btn.classList.toggle('active',btn.dataset.speed===cupsSpeed);});}
function renderCupsSkins(){const wrap=cupsEl('cups-skins-list');if(!wrap)return;wrap.innerHTML='';CUPS_SKINS.forEach((skin,i)=>{const btn=document.createElement('button');btn.className='cups-skin-btn'+(i===cupsSkin?' active':'');btn.innerHTML=`<img src="${skin.img}" style="width:40px;height:40px;object-fit:cover;border-radius:8px;margin-bottom:4px;"><span>${skin.name}</span>`;btn.style.borderColor=i===cupsSkin?skin.color:'rgba(255,255,255,0.15)';btn.style.boxShadow=i===cupsSkin?`0 0 12px ${skin.glow}`:'none';btn.onclick=()=>{cupsSkin=i;renderCupsSkins();renderCupsBoard();};wrap.appendChild(btn);});}
function renderCupsBoard(){const cfg=CUPS_CONFIG[cupsMode],skin=CUPS_SKINS[cupsSkin],wrap=cupsEl('cups-board');if(!wrap)return;wrap.innerHTML='';wrap.style.gridTemplateColumns=`repeat(${cfg.count<=4?cfg.count:3},1fr)`;for(let i=0;i<cfg.count;i++){const cup=document.createElement('div');cup.className='cups-cup';cup.id=`cup-${i}`;cup.dataset.index=i;cup.style.setProperty('--cup-color',skin.color);cup.style.setProperty('--cup-glow',skin.glow);cup.innerHTML=`<div class="cup-body"><img src="${skin.img}" class="cup-image" style="width:100%;height:100%;object-fit:cover;border-radius:8px;"></div><div class="cup-star" id="cup-star-${i}" style="display:none;">⭐</div>`;cup.onclick=()=>onCupClick(i);wrap.appendChild(cup);}}
function setCupsMode(mode){if(cupsAnimating)return;cupsMode=mode;renderCupsModeButtons();renderCupsBoard();updateCupsMult();if(cupsEl('cups-result-msg'))cupsEl('cups-result-msg').innerHTML='';if(cupsEl('cups-play-btn'))cupsEl('cups-play-btn').style.display='block';cupsRevealed=false;cupsChosen=[];}
function setCupsSpeed(speed){if(cupsAnimating)return;cupsSpeed=speed;renderCupsSpeedButtons();updateCupsMult();}
function cupsToggleSkins(){const wrap=cupsEl('cups-skins-wrap');if(!wrap)return;wrap.style.display=wrap.style.display==='none'?'block':'none';}
window.playCups=function(){
  if(cupsAnimating)return;
  const bet=parseInt(cupsEl('cups-bet')?.value)||0,balance=getBalance();
  if(bet<5){cupsShowMsg('⚠️ Минимальная ставка 5 ⭐️','#ff8800');return;}
  if(balance<bet){cupsShowMsg('❌ Недостаточно ⭐️','#ff4444');return;}
  setBalance(balance-bet);cupsAnimating=true;cupsRevealed=false;cupsChosen=[];
  if(cupsEl('cups-result-msg'))cupsEl('cups-result-msg').innerHTML='';
  if(cupsEl('cups-play-btn'))cupsEl('cups-play-btn').style.display='none';
  const cfg=CUPS_CONFIG[cupsMode],count=cfg.count;
  cupsStarIndex=[];
  while(cupsStarIndex.length<cfg.stars){const r=Math.floor(Math.random()*count);if(!cupsStarIndex.includes(r))cupsStarIndex.push(r);}
  cupsRevealStars(true);
  setTimeout(()=>{cupsRevealStars(false);setTimeout(()=>cupsRunShuffle(bet),600);},900);
};
function cupsRevealStars(show){const cfg=CUPS_CONFIG[cupsMode];for(let i=0;i<cfg.count;i++){const s=cupsEl(`cup-star-${i}`),c=cupsEl(`cup-${i}`);if(!s||!c)continue;const has=cupsStarIndex.includes(i);s.style.display=(show&&has)?'flex':'none';c.querySelector('.cup-body').style.transform=(show&&has)?'translateY(-40px)':'translateY(0)';}}
function cupsRunShuffle(bet){
  const cfg=CUPS_CONFIG[cupsMode],count=cfg.count,isFast=cupsSpeed==='fast',swapCount=isFast?18:10,baseDelay=isFast?120:200;
  for(let i=0;i<count;i++){const c=cupsEl(`cup-${i}`);if(c)c.style.order=i;}
  const swaps=[];
  while(swaps.length<swapCount){const a=Math.floor(Math.random()*count);let b=Math.floor(Math.random()*count);while(b===a)b=Math.floor(Math.random()*count);swaps.push([a,b]);}
  const orders=Array.from({length:count},(_,i)=>i);let step=0;
  function doSwap(){
    if(step>=swaps.length){cupsAnimating=false;cupsEnableClick();return;}
    const[a,b]=swaps[step],cupA=cupsEl(`cup-${a}`),cupB=cupsEl(`cup-${b}`);
    if(cupA&&cupB){
      const rA=cupA.getBoundingClientRect(),rB=cupB.getBoundingClientRect(),dx=rB.left-rA.left,dy=rB.top-rA.top,delay=baseDelay+(isFast?step*8:step*15);
      cupA.style.transition=`transform ${delay}ms cubic-bezier(0.4,0,0.2,1)`;cupB.style.transition=`transform ${delay}ms cubic-bezier(0.4,0,0.2,1)`;
      cupA.style.transform=`translate(${dx}px,${dy}px)`;cupB.style.transform=`translate(${-dx}px,${-dy}px)`;
      const pA=cupsStarIndex.indexOf(a),pB=cupsStarIndex.indexOf(b);if(pA!==-1)cupsStarIndex[pA]=b;if(pB!==-1)cupsStarIndex[pB]=a;
      setTimeout(()=>{cupA.style.transition='none';cupB.style.transition='none';cupA.style.transform='';cupB.style.transform='';const oA=orders[a],oB=orders[b];orders[a]=oB;orders[b]=oA;cupA.style.order=oB;cupB.style.order=oA;step++;doSwap();},delay+30);
    }else{step++;doSwap();}
  }
  doSwap();
}
function cupsEnableClick(){const cfg=CUPS_CONFIG[cupsMode];for(let i=0;i<cfg.count;i++){const c=cupsEl(`cup-${i}`);if(c)c.classList.add('cup-clickable');}cupsShowMsg(cfg.stars>1?`👆 Выберите ${cfg.stars} стаканчика!`:'👆 Выберите стаканчик!','#c080ff');}
function onCupClick(index){
  if(cupsAnimating||cupsRevealed)return;if(!document.querySelector('.cup-clickable'))return;
  const cfg=CUPS_CONFIG[cupsMode];if(cupsChosen.includes(index))return;
  const cup=cupsEl(`cup-${index}`);if(cup)cup.classList.add('cup-chosen');cupsChosen.push(index);
  const remaining=cfg.stars-cupsChosen.length;if(remaining>0){cupsShowMsg(`👆 Выберите ещё ${remaining} стаканчик${remaining>1?'а':''}!`,'#c080ff');return;}
  cupsRevealed=true;
  for(let i=0;i<cfg.count;i++){const c=cupsEl(`cup-${i}`);if(c)c.classList.remove('cup-clickable');}
  for(let i=0;i<cfg.count;i++){const c=cupsEl(`cup-${i}`);if(c)c.querySelector('.cup-body').style.transform='translateY(-44px)';const s=cupsEl(`cup-star-${i}`);if(s)s.style.display=cupsStarIndex.includes(i)?'flex':'none';}
  const bet=parseInt(cupsEl('cups-bet')?.value)||0,mult=cupsSpeed==='fast'?cfg.multFast:cfg.multSlow;
  const isWin=cupsChosen.every(idx=>cupsStarIndex.includes(idx));
  setTimeout(()=>{
    if(isWin){const win=Math.floor(bet*mult),profit=win-bet;setBalance(getBalance()+win);cupsShowMsg(`🎉 Угадали! <span style="color:#4ade80;font-size:1.2em;">+${profit} ⭐️</span>`,'#4ade80');cupsChosen.forEach(idx=>{const c=cupsEl(`cup-${idx}`);if(c)c.classList.add('cup-win');});}
    else{cupsShowMsg(`😢 Не угадали! <span style="color:#f87171;">Ставка сгорела</span>`,'#ff4444');cupsChosen.forEach(idx=>{const c=cupsEl(`cup-${idx}`);if(c)c.classList.add('cup-lose');});cupsStarIndex.forEach(si=>{const c=cupsEl(`cup-${si}`);if(c)c.classList.add('cup-win');});}
    if(cupsEl('cups-play-btn'))cupsEl('cups-play-btn').style.display='block';
  },400);
}
function cupsShowMsg(html,color){const el=cupsEl('cups-result-msg');if(!el)return;el.innerHTML=html;el.style.color=color;}


// ===== КУБИК =====
let diceMode='classic',diceSubmode='evenodd',diceSelectedNumber=null,diceSelectedEvenOdd=null,diceSelectedHalf=null,diceAnimation=false;
function diceBetAdjust(delta){const inp=document.getElementById('dice-bet');if(inp)inp.value=Math.max(5,(parseInt(inp.value)||5)+delta);}
function setDiceMode(mode){
  diceMode=mode;
  document.getElementById('dice-tab-1').classList.toggle('active',mode==='classic');
  document.getElementById('dice-tab-2').classList.toggle('active',mode==='double');
  document.getElementById('dice-single-modes').style.display=mode==='classic'?'flex':'none';
  document.getElementById('dice-double-modes').style.display=mode==='double'?'flex':'none';
  document.getElementById('dice-second').style.display=mode==='double'?'block':'none';
  diceSelectedNumber=null;diceSelectedEvenOdd=null;diceSelectedHalf=null;
  document.getElementById('dice-number-panel').style.display='none';
  if(mode==='classic')setDiceSubmode('classic','evenodd');else setDiceSubmode('double','evenodd');
  resetDicePosition();updateDiceFace(1,'#dice-3d');if(mode==='double')updateDiceFace(1,'#dice-second .dice-3d');updateMultiplierDisplay();
}
function setDiceSubmode(mode,submode){
  diceSubmode=submode;
  const sel=mode==='classic'?'#dice-single-modes .dice-submode':'#dice-double-modes .dice-submode';
  document.querySelectorAll(sel).forEach((btn,i)=>{btn.classList.toggle('active',(i===0&&submode==='evenodd')||(i===1&&submode==='half')||(i===2&&submode==='number'));});
  if(submode==='evenodd')showEvenOddPanel(mode);else if(submode==='half')showHalfPanel(mode);else showNumberPanel(mode);
  updateMultiplierDisplay();
}
function showEvenOddPanel(mode){
  const panel=document.getElementById('dice-number-panel'),buttons=document.getElementById('dice-number-buttons');
  panel.style.display='block';buttons.innerHTML='';
  ['Чет','Нечет'].forEach(t=>{const btn=document.createElement('button');btn.className='dice-number-btn'+(diceSelectedEvenOdd===(t==='Чет'?'even':'odd')?' active':'');btn.textContent=t;btn.style.width='80px';btn.style.borderRadius='40px';btn.onclick=()=>selectEvenOdd(t==='Чет'?'even':'odd');buttons.appendChild(btn);});
}
function showHalfPanel(mode){
  const panel=document.getElementById('dice-number-panel'),buttons=document.getElementById('dice-number-buttons');
  panel.style.display='block';buttons.innerHTML='';
  [['1-3','low'],['4-6','high']].forEach(([t,v])=>{const btn=document.createElement('button');btn.className='dice-number-btn'+(diceSelectedHalf===v?' active':'');btn.textContent=t;btn.style.width='80px';btn.style.borderRadius='40px';btn.onclick=()=>selectHalf(v);buttons.appendChild(btn);});
}
function showNumberPanel(mode){
  const panel=document.getElementById('dice-number-panel'),buttons=document.getElementById('dice-number-buttons');
  panel.style.display='block';buttons.innerHTML='';
  for(let i=1;i<=6;i++){const btn=document.createElement('button');btn.className='dice-number-btn'+(diceSelectedNumber===i?' active':'');btn.textContent=i;btn.onclick=()=>selectNumber(i);buttons.appendChild(btn);}
}
function selectNumber(num){diceSelectedNumber=num;document.querySelectorAll('.dice-number-btn').forEach(btn=>{btn.classList.toggle('active',parseInt(btn.textContent)===num);});updateMultiplierDisplay();}
function selectEvenOdd(c){diceSelectedEvenOdd=c;document.querySelectorAll('.dice-number-btn').forEach(btn=>{btn.classList.toggle('active',btn.textContent===(c==='even'?'Чет':'Нечет'));});updateMultiplierDisplay();}
function selectHalf(c){diceSelectedHalf=c;document.querySelectorAll('.dice-number-btn').forEach(btn=>{btn.classList.toggle('active',btn.textContent===(c==='low'?'1-3':'4-6'));});updateMultiplierDisplay();}
function updateMultiplierDisplay(){
  const el=document.getElementById('dice-mult-value');let t='';
  if(diceMode==='classic'){if(diceSubmode==='evenodd')t=diceSelectedEvenOdd?(diceSelectedEvenOdd==='even'?'Чет ×2':'Нечет ×2'):'Выберите';else if(diceSubmode==='half')t=diceSelectedHalf?(diceSelectedHalf==='low'?'1-3 ×2':'4-6 ×2'):'Выберите';else t=diceSelectedNumber?`Число ${diceSelectedNumber} ×4`:'Выберите';}
  else{if(diceSubmode==='evenodd')t=diceSelectedEvenOdd?(diceSelectedEvenOdd==='even'?'Оба четные ×4':'Оба нечетные ×4'):'Выберите';else if(diceSubmode==='half')t=diceSelectedHalf?(diceSelectedHalf==='low'?'Оба 1-3 ×4':'Оба 4-6 ×4'):'Выберите';else t=diceSelectedNumber?`Оба число ${diceSelectedNumber} ×6`:'Выберите';}
  el.textContent=t;
}
function updateDiceFace(value,selector){const dice=document.querySelector(selector);if(!dice)return;dice.querySelectorAll('.dice-face').forEach(f=>{f.textContent=value;});}
function resetDicePosition(){
  const d1=document.getElementById('dice-3d'),d2=document.getElementById('dice-second')?.querySelector('.dice-3d');
  if(d1){d1.style.transform='rotateX(0deg) rotateY(0deg)';d1.classList.remove('dice-throw-1','dice-throw-2','dice-throw-3','dice-throw-4','dice-win');}
  if(d2){d2.style.transform='rotateX(0deg) rotateY(0deg)';d2.classList.remove('dice-throw-1','dice-throw-2','dice-throw-3','dice-throw-4','dice-win');}
}
function rollDice(){
  if(diceAnimation)return;
  const bet=parseInt(document.getElementById('dice-bet').value),balance=getBalance();
  if(bet<5){alert('Минимальная ставка 5 ⭐️');return;}if(balance<bet){alert('Недостаточно звёзд!');return;}
  if(diceSubmode==='number'&&diceSelectedNumber===null){alert('Выберите число!');return;}
  if(diceSubmode==='evenodd'&&diceSelectedEvenOdd===null){alert('Выберите Чет или Нечет!');return;}
  if(diceSubmode==='half'&&diceSelectedHalf===null){alert('Выберите диапазон!');return;}
  setBalance(balance-bet);diceAnimation=true;
  const playBtn=document.getElementById('dice-play-btn');playBtn.disabled=true;playBtn.style.opacity='0.5';
  const d1=document.getElementById('dice-3d'),d2=document.getElementById('dice-second')?.querySelector('.dice-3d');
  resetDicePosition();
  const spins=['dice-spin-1','dice-spin-2','dice-spin-3'];
  const spin1=spins[Math.floor(Math.random()*spins.length)];let spin2=spins[Math.floor(Math.random()*spins.length)];
  while(d2&&spin2===spin1)spin2=spins[Math.floor(Math.random()*spins.length)];
  d1.classList.add(spin1);if(d2)d2.classList.add(spin2);
  const v1=Math.floor(Math.random()*6)+1,v2=Math.floor(Math.random()*6)+1;
  let isWin=false,multiplier=0;
  if(diceMode==='classic'){
    if(diceSubmode==='evenodd'){const e=v1%2===0;isWin=(diceSelectedEvenOdd==='even'&&e)||(diceSelectedEvenOdd==='odd'&&!e);multiplier=2;}
    else if(diceSubmode==='half'){const l=v1<=3;isWin=(diceSelectedHalf==='low'&&l)||(diceSelectedHalf==='high'&&!l);multiplier=2;}
    else{isWin=v1===diceSelectedNumber;multiplier=4;}
  }else{
    if(diceSubmode==='evenodd'){const e1=v1%2===0,e2=v2%2===0;isWin=diceSelectedEvenOdd==='even'?(e1&&e2):(!e1&&!e2);multiplier=4;}
    else if(diceSubmode==='half'){const l1=v1<=3,l2=v2<=3;isWin=diceSelectedHalf==='low'?(l1&&l2):(!l1&&!l2);multiplier=4;}
    else{isWin=(v1===diceSelectedNumber)&&(v2===diceSelectedNumber);multiplier=6;}
  }
  const winAmount=isWin?Math.floor(bet*multiplier):0;
  setTimeout(()=>{
    d1.classList.remove('dice-spin-1','dice-spin-2','dice-spin-3');if(d2)d2.classList.remove('dice-spin-1','dice-spin-2','dice-spin-3');
    d1.style.transform='rotateX(0deg) rotateY(0deg) rotateZ(0deg)';if(d2)d2.style.transform='rotateX(0deg) rotateY(0deg) rotateZ(0deg)';
    updateDiceFace(v1,'#dice-3d');if(d2)updateDiceFace(v2,'#dice-second .dice-3d');
    if(isWin){setBalance(getBalance()+winAmount);d1.classList.add('dice-win');if(d2)d2.classList.add('dice-win');setTimeout(()=>{d1.classList.remove('dice-win');if(d2)d2.classList.remove('dice-win');},1000);}
    const rd=document.getElementById('dice-result-display');
    if(diceMode==='classic')rd.innerHTML=isWin?`🎉 Выпало ${v1}! Выигрыш: +${winAmount} ⭐️`:`😢 Выпало ${v1} — проигрыш ${bet} ⭐️`;
    else if(diceSubmode==='number')rd.innerHTML=isWin?`🎉 Выпало ${v1} и ${v2}! Оба ${diceSelectedNumber}! Выигрыш: +${winAmount} ⭐️`:`😢 Выпало ${v1} и ${v2} — проигрыш ${bet} ⭐️`;
    else if(diceSubmode==='evenodd'){const type=diceSelectedEvenOdd==='even'?'чётные':'нечётные';rd.innerHTML=isWin?`🎉 Выпало ${v1} и ${v2}! Оба ${type}! Выигрыш: +${winAmount} ⭐️`:`😢 Выпало ${v1} и ${v2} — проигрыш ${bet} ⭐️`;}
    else{const range=diceSelectedHalf==='low'?'1-3':'4-6';rd.innerHTML=isWin?`🎉 Выпало ${v1} и ${v2}! Оба в диапазоне ${range}! Выигрыш: +${winAmount} ⭐️`:`😢 Выпало ${v1} и ${v2} — проигрыш ${bet} ⭐️`;}
    rd.style.color=isWin?'#4ade80':'#f87171';
    diceAnimation=false;playBtn.disabled=false;playBtn.style.opacity='1';
  },1200);
}
function initDiceGame(){
  setDiceMode('classic');setDiceSubmode('classic','evenodd');diceSelectedNumber=null;diceSelectedEvenOdd=null;diceSelectedHalf=null;
  resetDicePosition();updateDiceFace(1,'#dice-3d');updateDiceFace(1,'#dice-second .dice-3d');
  document.getElementById('dice-second').style.display='none';document.getElementById('dice-result-display').innerHTML='';
}


// ===== КРАШ =====
let crashState='waiting',crashMultiplier=1.00,crashTarget=1.50,crashInterval=null,crashCountdownTimer=null;
let crashBet=0,crashBetPlaced=false,crashCashedOut=false,crashBets=[],crashHistory=[],crashWaitTimer=null,crashWaitInterval=null,crashVideosReady=false,crashRoundId=0;

function closeCrash(){
  crashRoundId++;clearAllCrashTimers();
  const fv=document.getElementById('crash-video-fly'),cv=document.getElementById('crash-video-crash');
  if(fv){fv.pause();fv.currentTime=0;fv.style.display='none';fv.loop=false;}
  if(cv){cv.onended=null;cv.pause();cv.currentTime=0;cv.style.display='none';cv.loop=false;}
  const m=document.getElementById('crash-modal');if(m)m.style.display='none';
}
function clearAllCrashTimers(){
  if(crashInterval)clearInterval(crashInterval);if(crashCountdownTimer)clearInterval(crashCountdownTimer);
  if(crashWaitTimer)clearTimeout(crashWaitTimer);if(crashWaitInterval)clearInterval(crashWaitInterval);
  crashInterval=null;crashCountdownTimer=null;crashWaitTimer=null;crashWaitInterval=null;
}
function crashBetAdjust(delta){const inp=document.getElementById('crash-bet');if(!inp)return;inp.value=Math.max(15,(parseInt(inp.value)||15)+delta);}
function crashGenerateTarget(){const r=Math.random();if(r<0.40)return+(1.00+Math.random()*0.50).toFixed(2);if(r<0.65)return+(1.50+Math.random()*0.50).toFixed(2);if(r<0.82)return+(2.00+Math.random()*2.00).toFixed(2);if(r<0.93)return+(4.00+Math.random()*3.00).toFixed(2);return+(7.00+Math.random()*3.00).toFixed(2);}
function crashPreloadVideos(){const fv=document.getElementById('crash-video-fly'),cv=document.getElementById('crash-video-crash');if(fv){fv.muted=true;fv.volume=0;fv.load();fv.play().then(()=>{fv.pause();fv.currentTime=0;crashVideosReady=true;}).catch(()=>{crashVideosReady=true;});}if(cv){cv.muted=true;cv.volume=0;cv.load();cv.play().then(()=>{cv.pause();cv.currentTime=0;}).catch(()=>{});}}
function crashUpdateMultiplierDisplay(){
  const el=document.getElementById('crash-multiplier');if(!el)return;
  if(crashMultiplier<1.5){el.style.background='linear-gradient(90deg,#ff4444,#ff8800)';el.style.backgroundSize='';}
  else if(crashMultiplier<3){el.style.background='linear-gradient(90deg,#f59e0b,#ffd700)';el.style.backgroundSize='';}
  else{el.style.background='linear-gradient(90deg,#b44dff,#00d4ff,#b44dff)';el.style.backgroundSize='200%';}
  el.style.webkitBackgroundClip='text';el.style.webkitTextFillColor='transparent';el.textContent='×'+crashMultiplier.toFixed(2);
}
function crashUpdateActionBtn(){
  const btn=document.getElementById('crash-action-btn');if(!btn)return;
  if(crashState==='waiting'||crashState==='countdown'){
    if(crashBetPlaced){btn.textContent='✓ Ставка принята';btn.style.background='linear-gradient(135deg,#4ade80,#22c55e)';btn.style.boxShadow='0 0 12px #4ade80';btn.disabled=true;}
    else{btn.textContent='Поставить ⭐️';btn.style.background='linear-gradient(135deg,#b44dff,#6600cc)';btn.style.boxShadow='0 0 12px #b44dff';btn.disabled=false;}
  }else if(crashState==='flying'){
    if(crashBetPlaced&&!crashCashedOut){const win=Math.floor(crashBet*crashMultiplier);btn.textContent=`💰 Забрать ${win} ⭐️`;btn.style.background='linear-gradient(135deg,#4ade80,#22c55e)';btn.style.boxShadow='0 0 20px #4ade80';btn.disabled=false;}
    else if(crashCashedOut){btn.textContent='✅ Забрали!';btn.style.background='rgba(74,222,128,0.3)';btn.style.boxShadow='none';btn.disabled=true;}
    else{btn.textContent='⏳ Ожидание...';btn.style.background='rgba(255,255,255,0.1)';btn.style.boxShadow='none';btn.disabled=true;}
  }else if(crashState==='crashing'){btn.textContent='💥 Краш!';btn.style.background='rgba(255,68,68,0.3)';btn.style.boxShadow='none';btn.disabled=true;}
  else{btn.textContent='⏳ Новая игра...';btn.style.background='rgba(255,255,255,0.1)';btn.style.boxShadow='none';btn.disabled=true;}
}
function crashAction(){
  if(crashState==='waiting'||crashState==='countdown'){
    if(crashBetPlaced)return;
    const bet=parseInt(document.getElementById('crash-bet')?.value)||0;
    if(bet<15){alert('Минимальная ставка 15 ⭐️');return;}if(getBalance()<bet){alert('Недостаточно звёзд!');return;}
    setBalance(getBalance()-bet);crashBet=bet;crashBetPlaced=true;
    const uname=currentUser?(currentUser.username?'@'+currentUser.username:currentUser.first_name):'Гость';
    crashBets.push({name:uname,bet,mult:null,win:null});
    renderCrashBets();crashUpdateActionBtn();
    const fv=document.getElementById('crash-video-fly'),cv=document.getElementById('crash-video-crash');
    if(fv){fv.muted=true;fv.play().then(()=>{fv.pause();fv.currentTime=0;}).catch(()=>{});}
    if(cv){cv.muted=true;cv.play().then(()=>{cv.pause();cv.currentTime=0;}).catch(()=>{});}
    if(crashBets.length===1&&crashState==='waiting')crashBeginWaitCountdown();
  }else if(crashState==='flying'&&crashBetPlaced&&!crashCashedOut){crashCashOut();}
}
function crashCashOut(){
  if(crashState!=='flying'||!crashBetPlaced||crashCashedOut)return;
  crashCashedOut=true;const win=Math.floor(crashBet*crashMultiplier),profit=win-crashBet;setBalance(getBalance()+win);
  const uname=currentUser?(currentUser.username?'@'+currentUser.username:currentUser.first_name):'Гость';
  const idx=crashBets.findIndex(b=>b.name===uname&&b.mult===null);
  if(idx!==-1){crashBets[idx].mult=crashMultiplier;crashBets[idx].win=win;}
  renderCrashBets();
  const s=document.getElementById('crash-status-text');if(s){s.textContent=`✅ +${profit} ⭐️ (×${crashMultiplier.toFixed(2)})`;s.style.color='#4ade80';}
  crashUpdateActionBtn();
}
function renderCrashBets(){
  const list=document.getElementById('crash-bets-list');if(!list)return;
  if(!crashBets.length){list.innerHTML='<div style="color:#94a3b8;font-size:12px;text-align:center;padding:4px;">Нет ставок</div>';return;}
  list.innerHTML=crashBets.map(b=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 10px;background:rgba(255,255,255,0.05);border-radius:8px;margin-bottom:4px;"><span style="color:#fff;font-size:13px;">${b.name}</span><span style="color:#f59e0b;font-size:13px;">⭐️ ${b.bet}</span>${b.mult!==null?(b.mult===0?`<span style="color:#ff4444;font-size:13px;">💥 проигрыш</span>`:`<span style="color:#4ade80;font-size:13px;font-weight:bold;">×${b.mult.toFixed(2)} +${b.win}</span>`):'<span style="color:#94a3b8;font-size:12px;">в игре...</span>'}</div>`).join('');
}
function addCrashHistory(mult){
  crashHistory.unshift(mult);if(crashHistory.length>10)crashHistory.pop();
  localStorage.setItem('crashHistory',JSON.stringify(crashHistory));
  const el=document.getElementById('crash-history');if(!el)return;
  el.innerHTML=crashHistory.map(m=>{const color=m<1.5?'#ff4444':m<2?'#f59e0b':m<5?'#4ade80':'#b44dff';const glow=m>=5?`box-shadow:0 0 12px ${color};`:'';return`<div style="flex-shrink:0;padding:4px 10px;border-radius:20px;background:rgba(255,255,255,0.08);border:1px solid ${color};color:${color};font-size:12px;font-weight:bold;${glow}">×${m.toFixed(2)}</div>`;}).join('');
}
function crashResetVisualState(){
  const fv=document.getElementById('crash-video-fly'),cv=document.getElementById('crash-video-crash');
  if(fv){fv.pause();fv.currentTime=0;fv.style.display='none';fv.loop=false;}
  if(cv){cv.onended=null;cv.pause();cv.currentTime=0;cv.style.display='none';cv.loop=false;}
  const so=document.getElementById('crash-state-overlay'),cd=document.getElementById('crash-countdown'),ro=document.getElementById('crash-result-overlay'),me=document.getElementById('crash-multiplier'),se=document.getElementById('crash-status-text');
  if(so)so.style.display='flex';if(cd)cd.style.display='none';if(ro)ro.style.display='none';
  if(me){me.textContent='';me.style.webkitTextFillColor='transparent';}
  if(se){se.textContent='⏳ Ожидание ставок...';se.style.color='#94a3b8';}
}
function crashStartWaiting(){crashRoundId++;clearAllCrashTimers();crashState='waiting';crashBet=0;crashBetPlaced=false;crashCashedOut=false;crashBets=[];crashMultiplier=1.00;crashTarget=999;crashResetVisualState();renderCrashBets();crashUpdateActionBtn();}
function crashBeginWaitCountdown(){
  if(crashState!=='waiting'||!crashBets.length)return;
  const roundId=crashRoundId;if(crashWaitInterval)clearInterval(crashWaitInterval);
  let waitLeft=5;const se=document.getElementById('crash-status-text');
  if(se){se.textContent=`⏳ Ставки: ${waitLeft}с`;se.style.color='#94a3b8';}
  crashWaitInterval=setInterval(()=>{
    if(roundId!==crashRoundId){clearInterval(crashWaitInterval);crashWaitInterval=null;return;}
    if(crashState!=='waiting'||!crashBets.length){clearInterval(crashWaitInterval);crashWaitInterval=null;crashStartWaiting();return;}
    waitLeft--;
    if(waitLeft>0){if(se)se.textContent=`⏳ Ставки: ${waitLeft}с`;}
    else{clearInterval(crashWaitInterval);crashWaitInterval=null;crashStartCountdown(roundId);}
  },1000);
}
function crashStartCountdown(expectedRoundId=crashRoundId){
  if(expectedRoundId!==crashRoundId)return;if(!crashBets.length){crashStartWaiting();return;}
  crashState='countdown';crashUpdateActionBtn();
  const so=document.getElementById('crash-state-overlay'),cd=document.getElementById('crash-countdown');
  if(so)so.style.display='none';if(cd)cd.style.display='flex';
  const fv=document.getElementById('crash-video-fly'),cv=document.getElementById('crash-video-crash');
  if(fv)fv.load();if(cv)cv.load();
  let count=3;const ne=document.getElementById('crash-countdown-num');if(ne)ne.textContent=count;
  crashCountdownTimer=setInterval(()=>{
    if(expectedRoundId!==crashRoundId){clearInterval(crashCountdownTimer);crashCountdownTimer=null;return;}
    count--;
    if(count>0){if(ne)ne.textContent=count;}
    else{clearInterval(crashCountdownTimer);crashCountdownTimer=null;if(expectedRoundId!==crashRoundId||!crashBets.length){crashStartWaiting();return;}crashStartFlying(expectedRoundId);}
  },1000);
}
function crashStartFlying(expectedRoundId=crashRoundId){
  if(expectedRoundId!==crashRoundId)return;if(!crashBets.length){crashStartWaiting();return;}
  crashState='flying';crashMultiplier=1.00;crashTarget=crashGenerateTarget();
  const cd=document.getElementById('crash-countdown'),so=document.getElementById('crash-state-overlay'),ro=document.getElementById('crash-result-overlay');
  if(cd)cd.style.display='none';if(so)so.style.display='flex';if(ro)ro.style.display='none';
  const se=document.getElementById('crash-status-text');if(se){se.textContent='🚀 Летим!';se.style.color='#b44dff';}
  const fv=document.getElementById('crash-video-fly'),cv=document.getElementById('crash-video-crash');
  if(cv){cv.onended=null;cv.style.display='none';cv.pause();cv.currentTime=0;}
  if(fv){fv.style.display='block';fv.currentTime=0;fv.muted=true;fv.volume=0;fv.loop=true;fv.play().catch(()=>{setTimeout(()=>{if(expectedRoundId===crashRoundId&&crashState==='flying')fv.play().catch(()=>{});},500);});}
  crashUpdateMultiplierDisplay();crashUpdateActionBtn();
  let step=0;
  crashInterval=setInterval(()=>{
    if(expectedRoundId!==crashRoundId||crashState!=='flying'){clearInterval(crashInterval);crashInterval=null;return;}
    step++;crashMultiplier=+(1.00+step*0.03).toFixed(2);
    if(crashMultiplier>=crashTarget){
      crashMultiplier=crashTarget;crashUpdateMultiplierDisplay();crashState='crashing';
      if(crashBetPlaced&&!crashCashedOut){const uname=currentUser?(currentUser.username?'@'+currentUser.username:currentUser.first_name):'Гость';const idx=crashBets.findIndex(b=>b.name===uname&&b.mult===null);if(idx!==-1){crashBets[idx].mult=0;crashBets[idx].win=0;}}
      renderCrashBets();crashUpdateActionBtn();clearInterval(crashInterval);crashInterval=null;
      if(fv){fv.style.display='none';fv.pause();}
      if(cv){cv.style.display='block';cv.currentTime=0;cv.muted=true;cv.loop=false;cv.play().catch(()=>{});cv.onended=()=>{if(expectedRoundId!==crashRoundId)return;cv.onended=null;crashDoCrash(expectedRoundId);};setTimeout(()=>{if(expectedRoundId!==crashRoundId)return;if(crashState==='crashing'){cv.onended=null;crashDoCrash(expectedRoundId);}},10000);}else crashDoCrash(expectedRoundId);
      return;
    }
    crashUpdateMultiplierDisplay();crashUpdateActionBtn();
  },100);
}
function crashDoCrash(expectedRoundId=crashRoundId){
  if(expectedRoundId!==crashRoundId)return;if(crashState!=='crashing'&&crashState!=='flying')return;
  if(!crashBets.length&&!crashBetPlaced){crashStartWaiting();return;}
  crashState='crashed';const finalMult=crashMultiplier;
  const fv=document.getElementById('crash-video-fly'),cv=document.getElementById('crash-video-crash');
  if(fv){fv.pause();fv.style.display='none';}if(cv){cv.onended=null;cv.pause();cv.style.display='none';}
  const so=document.getElementById('crash-state-overlay'),ro=document.getElementById('crash-result-overlay');
  if(so)so.style.display='none';if(ro)ro.style.display='flex';
  const me=document.getElementById('crash-result-mult'),msg=document.getElementById('crash-result-msg');
  if(me)me.textContent='×'+finalMult.toFixed(2);
  if(crashBetPlaced&&!crashCashedOut){if(msg){msg.textContent=`😢 Потеряли ${crashBet} ⭐️`;msg.style.color='#ff4444';}}
  else if(crashCashedOut){if(msg){msg.textContent='✅ Вы успели!';msg.style.color='#4ade80';}}
  else{if(msg)msg.textContent='';}
  addCrashHistory(finalMult);crashUpdateActionBtn();
  crashWaitTimer=setTimeout(()=>{if(expectedRoundId!==crashRoundId)return;crashStartWaiting();},4000);
}
function initCrashGame(){
  crashRoundId++;clearAllCrashTimers();crashState='waiting';crashBet=0;crashBetPlaced=false;crashCashedOut=false;crashBets=[];crashMultiplier=1.00;crashTarget=1.50;
  const be=document.getElementById('crash-balance-display');if(be)be.textContent=getBalance();
  crashVideosReady=false;setTimeout(()=>crashPreloadVideos(),100);
  const saved=localStorage.getItem('crashHistory');
  try{crashHistory=saved?JSON.parse(saved)||[]:[]; }catch(e){crashHistory=[];}
  const he=document.getElementById('crash-history');
  if(he)he.innerHTML=crashHistory.map(m=>{const color=m<1.5?'#ff4444':m<2?'#f59e0b':m<5?'#4ade80':'#b44dff';const glow=m>=5?`box-shadow:0 0 12px ${color};`:'';return`<div style="flex-shrink:0;padding:4px 10px;border-radius:20px;background:rgba(255,255,255,0.08);border:1px solid ${color};color:${color};font-size:12px;font-weight:bold;${glow}">×${m.toFixed(2)}</div>`;}).join('');
  crashResetVisualState();renderCrashBets();crashUpdateActionBtn();
}


// ===== КЕЙСЫ (ОДНОВРЕМЕННЫЕ ОТКРЫТИЯ В СТОЛБИК) - ИСПРАВЛЕНО =====
function createModal(id, title, prizes, price) {
  const modal = document.createElement('div');
  modal.id = id; 
  modal.className = 'case-modal';
  modal.innerHTML = `
    <div class="modal-bg">
      <div class="modal-box">
        <div class="modal-title">🎁 ${title}</div>
        <div class="modal-balance-display">⭐️ <span class="modal-balance">${getBalance()}</span></div>
        <button class="back-btn-top" id="${id}-back-top">← В меню</button>
        
        <!-- Контейнер для нескольких рулеток -->
        <div class="multi-roulette-container" id="${id}-multi-roulette"></div>
        
        <!-- Кнопка открытия -->
        <button class="open-btn" id="${id}-open-btn">Открыть за ${price} ⭐️</button>
        
        <!-- Выбор количества ПОД КНОПКОЙ -->
        <div class="open-count-selector">
          <div class="count-label">Выберите количество открытий:</div>
          <div class="count-buttons">
            <button class="count-btn active" data-count="1">1️⃣ x1</button>
            <button class="count-btn" data-count="3">3️⃣ x3</button>
            <button class="count-btn" data-count="5">5️⃣ x5</button>
          </div>
        </div>
        
        <!-- Результаты -->
        <div class="modal-result" id="${id}-result" style="display:none">
          <div class="result-header">
            <span class="result-total">🎉 Выиграно 0 предметов на 0 ⭐️!</span>
          </div>
          <div class="result-items" id="${id}-result-items"></div>
          <button class="result-btn" id="${id}-result-btn">Открыть ещё</button>
          <button class="back-btn" id="${id}-back-btn">← Вернуться в меню</button>
        </div>
        
        <div class="prizes-list">
          ${prizes.map(p => `
            <div class="prize-row">
              <img src="${p.img}" class="prize-row-img">
              <div class="prize-row-info">
                <span class="prize-row-name">${p.name}</span>
                <span class="prize-row-stars">⭐️ ${p.stars}</span>
              </div>
            </div>
          `).join('')}
        </div>
        <button class="back-btn-bottom" id="${id}-back-bottom">← Вернуться в меню</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.style.display = 'none';

  let selectedCount = 1;
  let isOpening = false;
  
  // Выбор количества
  const countBtns = modal.querySelectorAll('.count-btn');
  countBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (isOpening) return;
      countBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedCount = parseInt(btn.dataset.count);
      
      const totalPrice = price * selectedCount;
      const openBtn = document.getElementById(`${id}-open-btn`);
      openBtn.textContent = `Открыть ${selectedCount}x за ${totalPrice} ⭐️`;
    });
  });
  
  // Создание одной рулетки - ВОЗВРАЩАЕТ приз
  function createRouletteElement() {
    // Генерируем приз ЗДЕСЬ
    const prize = getPrize(prizes);
    
    const items = [];
    // 30 случайных
    for (let i = 0; i < 30; i++) {
      items.push(prizes[Math.floor(Math.random() * prizes.length)]);
    }
    // ВЫИГРЫШНЫЙ ПРИЗ
    items.push(prize);
    // 10 случайных после
    for (let i = 0; i < 10; i++) {
      items.push(prizes[Math.floor(Math.random() * prizes.length)]);
    }
    
    const track = document.createElement('div');
    track.className = 'roulette-track';
    track.innerHTML = items.map((p, index) => `
      <div class="roulette-item ${index === 30 ? 'winning-prize' : ''}" data-index="${index}">
        <img src="${p.img}" alt="${p.name}">
        <span>${p.name}</span>
      </div>
    `).join('');
    
    const trackWrap = document.createElement('div');
    trackWrap.className = 'roulette-track-wrap';
    trackWrap.appendChild(track);
    
    const arrow = document.createElement('div');
    arrow.className = 'roulette-arrow';
    arrow.textContent = '▼';
    
    const container = document.createElement('div');
    container.className = 'roulette-wrap single-roulette';
    container.appendChild(arrow);
    container.appendChild(trackWrap);
    
    return { container, track, prize };
  }
  
  // Кнопка открытия
  document.getElementById(`${id}-open-btn`).addEventListener('click', () => {
    if (isOpening) return;
    
    const totalPrice = price * selectedCount;
    const balance = getBalance();
    
    if (balance < totalPrice) {
      alert(`Недостаточно звёзд! Нужно ${totalPrice} ⭐️`);
      return;
    }
    
    // Списываем баланс
    setBalance(balance - totalPrice);
    
    isOpening = true;
    const openBtn = document.getElementById(`${id}-open-btn`);
    openBtn.disabled = true;
    openBtn.textContent = '🔄 Открываем...';
    countBtns.forEach(btn => btn.disabled = true);
    
    document.getElementById(`${id}-result`).style.display = 'none';
    
    const multiContainer = document.getElementById(`${id}-multi-roulette`);
    multiContainer.innerHTML = '';
    
    const results = [];
    const tracks = [];
    
    // Генерируем призы и создаем рулетки
    for (let i = 0; i < selectedCount; i++) {
      const { container, track, prize } = createRouletteElement();
      results.push(prize);
      multiContainer.appendChild(container);
      tracks.push({ track, prize });
    }
    
    // Запускаем анимацию для всех рулеток одновременно
    setTimeout(() => {
      tracks.forEach(({ track }) => {
        const itemEl = track.querySelector('.roulette-item');
        const itemW = itemEl ? itemEl.offsetWidth + 8 : 108;
        const trackWrap = track.parentElement;
        const wrapW = trackWrap ? trackWrap.offsetWidth : 300;
        const center = wrapW / 2;
        
        // Приз на 30-й позиции (индекс 30)
        const prizeIndex = 30;
        const offset = prizeIndex * itemW - center + itemW / 2;
        
        track.style.transition = 'transform 4s cubic-bezier(0.12,0.8,0.25,1)';
        track.style.transform = `translateX(-${offset}px)`;
      });
    }, 100);
    
    // Показываем результаты после анимации
    setTimeout(() => {
      let totalStars = 0;
      
      const savedCodes = [];
      results.forEach(prize => {
        totalStars += prize.stars;
        const code = saveGift(prize, title);
        savedCodes.push({ prize, code });
      });
      
      const resultItems = document.getElementById(`${id}-result-items`);
      
      resultItems.innerHTML = `
        <div class="results-summary">
          <div class="results-count">${results.length} ${getItemWord(results.length)}</div>
          <div class="results-total-stars">+${totalStars} ⭐️</div>
        </div>
        ${savedCodes.map((item, index) => {
          return `
            <div class="result-item">
              <div class="result-item-number">#${index + 1}</div>
              <img src="${item.prize.img}" class="result-item-img">
              <div class="result-item-info">
                <div class="result-item-name">${item.prize.name}</div>
                <div class="result-item-stars">⭐️ ${item.prize.stars}</div>
                <div class="result-item-code">
                  <span>Код: ${item.code}</span>
                  <button onclick="navigator.clipboard.writeText('${item.code}')" class="copy-code-small">📋</button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      `;
      
      setBalance(getBalance() + totalStars);
      
      const resultHeader = document.querySelector(`#${id}-result .result-total`);
      if (resultHeader) {
        resultHeader.innerHTML = `🎉 Выиграно ${results.length} ${getItemWord(results.length)} на ${totalStars} ⭐️!`;
      }
      
      document.getElementById(`${id}-result`).style.display = 'flex';
      multiContainer.innerHTML = '';
      
      isOpening = false;
      openBtn.disabled = false;
      countBtns.forEach(btn => btn.disabled = false);
      openBtn.textContent = `Открыть ${selectedCount}x за ${totalPrice} ⭐️`;
    }, 4500);
  });
  
  // Кнопка "Открыть ещё"
  document.getElementById(`${id}-result-btn`)?.addEventListener('click', () => {
    document.getElementById(`${id}-result`).style.display = 'none';
  });
  
  // Кнопки закрытия
  [`${id}-back-btn`, `${id}-back-top`, `${id}-back-bottom`].forEach(bid => {
    document.getElementById(bid)?.addEventListener('click', () => {
      modal.style.display = 'none';
    });
  });

  return modal;
}

function getItemWord(count) {
  if (count === 1) return 'предмет';
  if (count >= 2 && count <= 4) return 'предмета';
  return 'предметов';
}

function createDailyModal() {
  const modal = document.createElement('div');
  modal.id = 'modal-daily'; modal.className = 'case-modal';
  modal.innerHTML = `
    <div class="modal-bg"><div class="modal-box">
      <div class="modal-title">🎁 Ежедневный кейс</div>
      <div class="modal-balance-display">⭐️ <span class="modal-balance">${getBalance()}</span></div>
      <button class="back-btn-top" id="daily-back-top">← В меню</button>
      <div class="roulette-wrap">
        <div class="roulette-arrow">▼</div>
        <div class="roulette-track-wrap"><div class="roulette-track" id="daily-track"></div></div>
      </div>
      
      <!-- Блок приглашения -->
      <div id="daily-invite-block" style="display:none;flex-direction:column;align-items:center;gap:12px;padding:16px;background:rgba(124,58,237,0.08);border:1px solid rgba(124,58,237,0.35);border-radius:16px;width:100%;text-align:center;">
        <div style="font-size:28px;">👥</div>
        <div style="font-size:15px;font-weight:700;color:white;">Пригласи друга — получи Daily Case!</div>
        <div style="font-size:13px;color:#94a3b8;line-height:1.5;">Отправь другу ссылку на игру. Как только ты отправишь ссылку — кейс разблокируется!</div>
        <button id="daily-share-btn" style="width:100%;padding:14px;background:linear-gradient(135deg,#7c3aed,#4c1d95);border:none;border-radius:12px;color:white;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 0 20px rgba(124,58,237,0.5);">
          📨 Отправить ссылку другу
        </button>
        <div style="font-size:11px;color:#475569;">Нажми на кнопку — кейс сразу разблокируется!</div>
      </div>
      
      <button class="open-btn" id="daily-open-btn" style="display:none;">🎁 Открыть бесплатно</button>
      
      <div id="daily-timer-modal-wrap" class="daily-timer-wrap" style="display:none;">
        <div class="timer-label">Следующий кейс через:</div>
        <div id="daily-timer-modal" class="timer-display"></div>
      </div>
      
      <div class="modal-result" id="daily-result" style="display:none">
        <img class="result-img" id="daily-result-img">
        <div class="result-name" id="daily-result-name"></div>
        <div class="result-stars" id="daily-result-stars"></div>
        <button class="back-btn" id="daily-back-btn">← Вернуться в меню</button>
      </div>
      
      <div class="prizes-list">
        ${prizesDaily.map(p=>`<div class="prize-row"><img src="${p.img}" class="prize-row-img"><div class="prize-row-info"><span class="prize-row-name">${p.name}</span><span class="prize-row-stars">⭐️ ${p.stars}</span></div></div>`).join('')}
      </div>
      <button class="back-btn-bottom" id="daily-back-bottom">← Вернуться в меню</button>
    </div></div>`;
  document.body.appendChild(modal);
  modal.style.display = 'none';

  let isOpening = false;
  let animationTimeout = null;

  function renderDailyState() {
    const inviteBlock = document.getElementById('daily-invite-block');
    const openBtn = document.getElementById('daily-open-btn');
    const timerWrap = document.getElementById('daily-timer-modal-wrap');
    const timerEl = document.getElementById('daily-timer-modal');

    // Проверяем, отправлял ли пользователь ссылку СЕГОДНЯ
    if (!isDailyInviteDone()) {
      // НЕ отправлял - показываем блок приглашения
      inviteBlock.style.display = 'flex';
      openBtn.style.display = 'none';
      timerWrap.style.display = 'none';
    } else {
      // ОТПРАВЛЯЛ - показываем кнопку открытия
      inviteBlock.style.display = 'none';
      const left = getDailyTimeLeft();
      
      if (left <= 0) {
        // Кейс доступен
        openBtn.style.display = 'block';
        openBtn.disabled = isOpening;
        openBtn.textContent = isOpening ? '🔄 Открываем...' : '🎁 Открыть бесплатно';
        openBtn.style.opacity = isOpening ? '0.7' : '1';
        openBtn.style.cursor = isOpening ? 'not-allowed' : 'pointer';
        timerWrap.style.display = 'none';
      } else {
        // Кейс на кулдауне (уже открывали сегодня)
        openBtn.style.display = 'block';
        openBtn.disabled = true;
        openBtn.textContent = '⏳ Недоступно';
        openBtn.style.opacity = '0.5';
        openBtn.style.cursor = 'not-allowed';
        timerWrap.style.display = 'block';
        timerEl.textContent = formatTime(left);
      }
    }
  }

  const timerInterval = setInterval(renderDailyState, 1000);
  renderDailyState();

  // Кнопка "Отправить ссылку другу" - разблокирует кейс
  document.getElementById('daily-share-btn').addEventListener('click', () => {
    shareReferralLink(); // Используем функцию из глобальной области
    renderDailyState();   // Обновляем интерфейс
  });

  // Кнопка открытия кейса
  document.getElementById('daily-open-btn').addEventListener('click', function() {
    if (!isDailyInviteDone()) {
      alert('Сначала отправь ссылку другу!');
      return;
    }
    
    if (getDailyTimeLeft() > 0) {
      alert('Кейс уже открыт! Следующий будет доступен через 24 часа.');
      return;
    }
    
    if (isOpening) return;

    const openBtn = this;
    isOpening = true;
    openBtn.disabled = true;
    openBtn.textContent = '🔄 Открываем...';
    openBtn.style.opacity = '0.7';
    openBtn.style.cursor = 'not-allowed';
    
    document.getElementById('daily-result').style.display = 'none';
    
    // Сохраняем время открытия (блокировка на 24 часа)
    saveDailyLast();
    
    // СБРАСЫВАЕМ приглашение (завтра нужно будет снова пригласить)
    resetDailyInvite();
    
    const prize = getPrize(prizesDaily);
    const track = document.getElementById('daily-track');
    
    track.style.transition = 'none'; 
    track.style.transform = 'translateX(0)';
    
    const items = [];
    for (let i = 0; i < 40; i++) {
      items.push(prizesDaily[Math.floor(Math.random() * prizesDaily.length)]);
    }
    items[32] = prize;
    
    track.innerHTML = items.map(p => `
      <div class="roulette-item">
        <img src="${p.img}" alt="${p.name}">
        <span>${p.name}</span>
      </div>
    `).join('');
    
    // Динамическое вычисление смещения
    setTimeout(() => {
      const itemEl = track.querySelector('.roulette-item');
      const itemW = itemEl ? itemEl.offsetWidth + 8 : 108;
      const trackWrap = track.parentElement;
      const wrapW = trackWrap ? trackWrap.offsetWidth : 300;
      const center = wrapW / 2;
      const offset = 32 * itemW - center + itemW / 2;
      
      track.style.transition = 'transform 4s cubic-bezier(0.12,0.8,0.25,1)';
      track.style.transform = `translateX(-${offset}px)`;
    }, 100);
    
    animationTimeout = setTimeout(() => {
      setBalance(getBalance() + prize.stars);
      
      const username = currentUser ? (currentUser.username ? '@' + currentUser.username : currentUser.first_name) : 'Гость';
      const userId = currentUser ? currentUser.id : 'неизвестно';
      notifyOwner(username, userId, prize.name, prize.stars, '—', 'Ежедневный кейс');
      
      document.getElementById('daily-result-img').src = prize.img;
      document.getElementById('daily-result-name').textContent = prize.name;
      document.getElementById('daily-result-stars').textContent = '⭐️ +' + prize.stars + ' звёзд добавлено!';
      document.getElementById('daily-result').style.display = 'flex';
      
      isOpening = false;
      animationTimeout = null;
      renderDailyState();
      updateDailyTimerOnCard();
    }, 4500);
    
    setTimeout(() => {
      if (isOpening) {
        isOpening = false;
        if (animationTimeout) clearTimeout(animationTimeout);
        renderDailyState();
      }
    }, 10000);
  });

  ['daily-back-btn','daily-back-top','daily-back-bottom'].forEach(bid => {
    document.getElementById(bid)?.addEventListener('click', () => { 
      modal.style.display = 'none';
      if (isOpening) {
        isOpening = false;
        if (animationTimeout) clearTimeout(animationTimeout);
      }
    });
  });

  modal.addEventListener('remove', () => {
    clearInterval(timerInterval);
    if (animationTimeout) clearTimeout(animationTimeout);
  });

  return modal;
}

const modalDaily   = createDailyModal();
const modalLight   = createModal('modal-light',   'Light Case',    prizesLight,   169);
const modalEvilEye = createModal('modal-evileye', 'Evil Eye Case', prizesEvilEye,  19);
const modalWomans  = createModal('modal-womans',  "Woman's Case",  prizesWomans,   99);
const modalLove    = createModal('modal-love',    'Love Case',     prizesLove,    729);
const modalMans    = createModal('modal-mans',    "Man's Case",    prizesMans,    989);
const modalPower   = createModal('modal-power',   'Power Case',    prizesPower,   839);

// ===== КЕЙСЫ (ОТОБРАЖЕНИЕ) =====
const CASES_CATEGORIES = [
  { id: 'daily', title: 'Daily Case', caseIds: [1] },
  { id: 'popular', title: 'Popular Case', caseIds: [2, 5, 6, 4, 7] },
  { id: 'farm', title: 'Farm Case', caseIds: [3] } 
];

const CASES_DATA = {
  1: { title: "Daily Case", price: "Бесплатно", img: "pictures/images/1773263110664.png" },
  2: { title: "Light Case", price: "169", img: "pictures/images/1773265543104.png" },
  3: { title: "Evil Eye Case", price: "19", img: "pictures/images/1773322797748.png" },
  4: { title: "Woman's Case", price: "99", img: "pictures/images/1773343493149.png" },
  5: { title: "Love Case", price: "729", img: "pictures/images/1775910837521.png" },
  6: { title: "Man's Case", price: "989", img: "pictures/images/1775929626619.png" },
  7: { title: "Power Case", price: "839", img: "pictures/images/1775991924901.png" } 
};

function getCaseHTML(caseId) {
  const data = CASES_DATA[caseId];
  if (!data) return '';
  const priceText = data.price === "Бесплатно" ? "⭐️ Бесплатно" : `⭐️ ${data.price}`;
  return `
    <div class="case-item" data-case-id="${caseId}">
      <button class="case" data-id="${caseId}">
        <span class="case-title">${data.title}</span>
        <img src="${data.img}" alt="${data.title}" class="case-img">
        <span class="case-price">${priceText}</span>
      </button>
    </div>
  `;
}

function renderCases() {
  const container = document.getElementById('cases-drag-container');
  if (!container) return;
  
  container.innerHTML = '';

  for (let i = 0; i < CASES_CATEGORIES.length; i++) {
    const cat = CASES_CATEGORIES[i];
    const casesHTML = cat.caseIds.map(id => getCaseHTML(id)).join('');
    const rowClass = cat.id === 'popular' ? 'cases-grid-2x2' : 'cases-row';
    
    container.innerHTML += `
      <div class="case-category" data-category-id="${cat.id}">
        <div class="category-header">${cat.title}</div>
        <div class="${rowClass}">
          ${casesHTML}
        </div>
      </div>
    `;
  }

  attachCaseClickHandlers();
}

function attachCaseClickHandlers() {
  document.querySelectorAll('.case').forEach(btn => {
    btn.removeEventListener('click', handleCaseClick);
    btn.addEventListener('click', handleCaseClick);
  });
}

function handleCaseClick(e) {
  e.preventDefault();
  e.stopPropagation();
  
  const caseId = this.dataset.id;
  
  if (caseId === '1') modalDaily.style.display = 'block';
  else if (caseId === '2') modalLight.style.display = 'block';
  else if (caseId === '3') modalEvilEye.style.display = 'block';
  else if (caseId === '4') modalWomans.style.display = 'block';
  else if (caseId === '5') modalLove.style.display = 'block';
  else if (caseId === '6') modalMans.style.display = 'block';
  else if (caseId === '7') modalPower.style.display = 'block'; 
}

function initCases() {
  renderCases();
}

setTimeout(initCases, 500);






// ===== МОДАЛ ЗВЁЗД =====
function openStarsModal() {
  document.getElementById('stars-modal').style.display = 'block';
  switchStarsTab('buy');
}

const starsModalEl = document.createElement('div');
starsModalEl.id = 'stars-modal';
starsModalEl.style.display = 'none';
starsModalEl.innerHTML = `
  <div class="stars-modal-overlay">
    <div class="stars-modal-container">
      <div class="stars-modal-title">⭐️ Звёзды</div>
      <div class="stars-tabs">
        <button id="stars-tab-buy"   class="stars-tab active" onclick="switchStarsTab('buy')">💫 Купить</button>
        <button id="stars-tab-promo" class="stars-tab"        onclick="switchStarsTab('promo')">🎟 Промокод</button>
        <button id="stars-tab-ton"   class="stars-tab"        onclick="switchStarsTab('ton')">💎 TON</button>
      </div>
      <div id="stars-content-buy" class="stars-content active">
        <div class="stars-label">Введите количество звёзд для покупки</div>
        <input id="stars-amount-input" type="number" min="1" placeholder="Например: 500" class="stars-input">
        <button onclick="buyStars()" class="stars-btn">Купить ⭐️</button>
      </div>
      <div id="stars-content-promo" class="stars-content">
        <div class="stars-label">Введите промокод для получения звёзд</div>
        <input id="promo-input" type="text" placeholder="Введите промокод..." class="stars-input">
        <button onclick="activatePromo()" class="stars-btn">Активировать</button>
        <div id="promo-result" class="promo-result"></div>
      </div>
      <div id="stars-content-ton" class="stars-content">
        <div class="ton-icon">💎</div>
        <div class="ton-title">Оплата через TON</div>
        <div class="ton-info">1 TON = 90 ⭐️<br>Введите количество звёзд</div>
        <input id="ton-stars-input" type="number" min="1" step="1" placeholder="Например: 90" class="stars-input">
        <div id="ton-amount-display" class="ton-amount">≈ 0 TON</div>
        <button onclick="payTON()" class="stars-btn ton-btn">💎 Оплатить TON</button>
        <div class="ton-note">После оплаты напишите нам — звёзды начислим вручную</div>
      </div>
      <button onclick="document.getElementById('stars-modal').style.display='none'" class="close-stars-btn">← Закрыть</button>
    </div>
  </div>`;
document.body.appendChild(starsModalEl);

function switchStarsTab(tab) {
  ['buy','promo','ton'].forEach(t => {
    document.getElementById('stars-content-'+t)?.classList.remove('active');
    document.getElementById('stars-tab-'+t)?.classList.remove('active');
  });
  document.getElementById('stars-content-'+tab)?.classList.add('active');
  document.getElementById('stars-tab-'+tab)?.classList.add('active');
}

function buyStars() {
  const amount = parseInt(document.getElementById('stars-amount-input').value);
  if (!amount || amount < 1) { showNotification('Введите количество звёзд!', false); return; }
  const tg = window.Telegram?.WebApp;
  if (!tg) { showNotification('Откройте приложение через Telegram', false); return; }
  showNotification('Перейдите в бота для оплаты! 😊');
  try { tg.openTelegramLink(`https://t.me/CrocodileeGiftBot?start=buy_${amount}`); } catch(e) {}
}

async function checkBalanceNow() {
  if (!currentUser) { alert('Нет пользователя'); return; }
  try {
    const r = await fetch('https://croco-gift-production.up.railway.app/api/get_balance', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({user_id:currentUser.id}) });
    const data = await r.json();
    if (data.balance !== undefined) {
      const local = getBalance();
      if (data.balance > local) { setBalance(data.balance); showNotification(`✅ Синхронизировано! Баланс: ${data.balance} ⭐️`); }
      else showNotification(`💰 Баланс: ${local} ⭐️`);
    }
  } catch(e) { showNotification('❌ Ошибка связи с сервером', false); }
}

const PROMO_CODES = { "STAR10000": 10000 };
const VIP_IDS = [6227572453, 6794644473];

function activatePromo() {
  const input=document.getElementById('promo-input'),result=document.getElementById('promo-result'),code=input.value.trim().toUpperCase();
  if(!code){result.textContent='❌ Введите промокод!';result.style.color='#f87171';return;}
  const reward=PROMO_CODES[code];
  if(!reward){result.textContent='❌ Неверный промокод!';result.style.color='#f87171';return;}
  if(!currentUser){result.textContent='❌ Пользователь не найден';result.style.color='#f87171';return;}
  if(code==='STAR10000'){
    if(!VIP_IDS.includes(Number(currentUser.id))){result.textContent='❌ Только для VIP!';result.style.color='#f87171';return;}
    setBalance(getBalance()+reward);result.textContent=`✅ VIP бонус! +${reward} ⭐️`;result.style.color='#4ade80';return;
  }
  const usedKey='promo_used_'+code+'_'+currentUser.id;
  if(localStorage.getItem(usedKey)){result.textContent='❌ Уже использован!';result.style.color='#f87171';return;}
  setBalance(getBalance()+reward);localStorage.setItem(usedKey,'true');result.textContent=`✅ Получено +${reward} ⭐️`;result.style.color='#4ade80';
}

function payTON() {
  const stars=parseInt(document.getElementById('ton-stars-input').value);
  if(!stars||stars<1){alert('Введите количество звёзд!');return;}
  const ton=(stars/90).toFixed(2),address='UQAzX8me42V164qefMy6GCp3TA8Q9pXT6Y8Jlh0R3-gcDqim';
  try{Telegram.WebApp.openTelegramLink(`https://t.me/wallet?startattach=ton_transfer_${address}_${ton}`);}catch{window.open(`https://t.me/wallet?startattach=ton_transfer_${address}_${ton}`,'_blank');}
}

function showNotification(message, isSuccess=true) {
  const ex=document.querySelector('.balance-notification');if(ex)ex.remove();
  const n=document.createElement('div');n.className='balance-notification';
  n.style.cssText=`position:fixed;top:20px;left:50%;transform:translateX(-50%);background:${isSuccess?'linear-gradient(135deg,#4ade80,#22c55e)':'linear-gradient(135deg,#f87171,#ef4444)'};color:white;padding:12px 24px;border-radius:50px;font-weight:bold;box-shadow:0 0 30px ${isSuccess?'#4ade80':'#f87171'};z-index:10000;font-size:14px;border:1px solid gold;`;
  n.textContent=message;document.body.appendChild(n);setTimeout(()=>n.remove(),3000);
}

async function checkPendingPurchases() {
  if (!currentUser) return;
  try {
    const tg=window.Telegram.WebApp;
    if(tg.initDataUnsafe?.start_param){
      const param=tg.initDataUnsafe.start_param;
      if(param.startsWith('buy_')){const amount=parseInt(param.replace('buy_',''));if(!isNaN(amount)&&amount>0){setBalance(getBalance()+amount);showNotification(`✅ +${amount} ⭐️ зачислено!`);tg.initDataUnsafe.start_param='';}}
    }
    const pk='pending_stars_'+currentUser.id,ps=localStorage.getItem(pk);
    if(ps){const amount=parseInt(ps);setBalance(getBalance()+amount);localStorage.removeItem(pk);showNotification(`✅ +${amount} ⭐️ зачислено!`);}
  } catch(e) {}
}

async function syncBalanceWithServer() {
  if (!currentUser) return;
  try {
    const r=await fetch('https://croco-gift-production.up.railway.app/api/get_balance',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user_id:currentUser.id})});
    const data=await r.json();
    if(data.balance!==undefined){const local=getBalance(),srv=data.balance;if(srv>local)setBalance(srv);else if(local>srv)updateServerBalance(currentUser.id,local);}
  } catch(e) {}
}

async function updateServerBalance(userId, balance) {
  try {
    await fetch('https://croco-gift-production.up.railway.app/api/update_balance',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user_id:userId,balance})});
  } catch(e) {}
}

const styleEl = document.createElement('style');
styleEl.textContent=`@keyframes slideDown{from{transform:translateX(-50%) translateY(-100px);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}@keyframes fadeOut{to{opacity:0;transform:translateX(-50%) translateY(-20px)}}`;
document.head.appendChild(styleEl);

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(checkPendingPurchases, 1000);
  setTimeout(syncBalanceWithServer, 2000);
});

let _sbTimer = null;
const _origSB = window.setBalance;
window.setBalance = function(value) {
  if (_origSB) _origSB(value);
  if (currentUser) {
    clearTimeout(_sbTimer);
    _sbTimer = setTimeout(() => updateServerBalance(currentUser.id, value), 1500);
  }
};

const _origOG = window.openGame;
window.openGame = function(game) {
  syncBalanceWithServer();
  if (_origOG) _origOG(game);
};











