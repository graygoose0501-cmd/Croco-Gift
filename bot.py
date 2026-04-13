import os
import json
import logging
import asyncio
import time
import random
from aiohttp import web
import aiohttp
import asyncpg
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command
from aiogram.types import LabeledPrice, InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo

# ─── CONFIG ──────────────────────────────────────────────
BOT_TOKEN    = os.environ.get("BOT_TOKEN", "8658879063:AAE9X_jxKPe1pkPwJNm9kmmAaE_X15pW0Ik")
OWNER_ID     = 6794644473
DATABASE_URL = os.environ.get("DATABASE_URL", "")
MINI_APP_URL = "https://t.me/CrocodileeGiftBot/httpsdrybush3b62prorpo849"

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("crocogift")

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}

# ─── DATABASE ────────────────────────────────────────────
db_pool = None

async def init_db():
    global db_pool
    db_pool = await asyncpg.create_pool(DATABASE_URL)
    async with db_pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                user_id    BIGINT PRIMARY KEY,
                balance    INTEGER DEFAULT 0,
                username   TEXT,
                first_name TEXT,
                avatar_url TEXT
            )
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS payments (
                payment_id          TEXT PRIMARY KEY,
                telegram_payment_id TEXT UNIQUE,
                user_id             BIGINT,
                amount              INTEGER,
                timestamp           BIGINT
            )
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS crash_rounds (
                id         SERIAL PRIMARY KEY,
                multiplier REAL NOT NULL,
                timestamp  BIGINT NOT NULL
            )
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS referrals (
                id          SERIAL PRIMARY KEY,
                referrer_id BIGINT,
                new_user_id BIGINT UNIQUE,
                timestamp   BIGINT
            )
        """)
    log.info("✅ База данных готова")


async def db_get_balance(user_id: int) -> int:
    async with db_pool.acquire() as c:
        r = await c.fetchrow("SELECT balance FROM users WHERE user_id=$1", user_id)
        return r["balance"] if r else 0

async def db_set_balance(user_id: int, balance: int):
    async with db_pool.acquire() as c:
        await c.execute("""
            INSERT INTO users(user_id, balance) VALUES($1,$2)
            ON CONFLICT(user_id) DO UPDATE SET balance=$2
        """, user_id, balance)

async def db_add_stars(user_id: int, stars: int):
    async with db_pool.acquire() as c:
        await c.execute("""
            INSERT INTO users(user_id, balance) VALUES($1,$2)
            ON CONFLICT(user_id) DO UPDATE SET balance = users.balance + $2
        """, user_id, stars)

async def db_upsert_user(user_id, username=None, first_name=None, avatar_url=None):
    async with db_pool.acquire() as c:
        await c.execute("""
            INSERT INTO users(user_id, username, first_name, avatar_url)
            VALUES($1,$2,$3,$4)
            ON CONFLICT(user_id) DO UPDATE
              SET username   = COALESCE($2, users.username),
                  first_name = COALESCE($3, users.first_name),
                  avatar_url = COALESCE($4, users.avatar_url)
        """, user_id, username, first_name, avatar_url)

async def db_save_round(mult: float):
    async with db_pool.acquire() as c:
        await c.execute(
            "INSERT INTO crash_rounds(multiplier,timestamp) VALUES($1,$2)",
            mult, int(time.time())
        )

async def db_get_history(limit=20):
    async with db_pool.acquire() as c:
        rows = await c.fetch(
            "SELECT multiplier FROM crash_rounds ORDER BY id DESC LIMIT $1", limit
        )
        return [r["multiplier"] for r in rows]

async def db_payment_exists(pid):
    async with db_pool.acquire() as c:
        return await c.fetchrow("SELECT 1 FROM payments WHERE payment_id=$1", pid) is not None

async def db_save_payment(pid, tgid, uid, amount):
    async with db_pool.acquire() as c:
        await c.execute(
            "INSERT INTO payments VALUES($1,$2,$3,$4,$5)",
            pid, tgid, uid, amount, int(time.time())
        )

async def db_save_referral(referrer_id: int, new_user_id: int):
    async with db_pool.acquire() as c:
        try:
            await c.execute(
                "INSERT INTO referrals(referrer_id, new_user_id, timestamp) VALUES($1,$2,$3)",
                referrer_id, new_user_id, int(time.time())
            )
        except asyncpg.UniqueViolationError:
            pass


# ─── CRASH GAME ENGINE ───────────────────────────────────
class CrashGame:
    WAIT_SECS      = 8
    COUNTDOWN_SECS = 3
    TICK_MS        = 100

    def __init__(self):
        self.state      = "waiting"
        self.multiplier = 1.00
        self.target     = 2.00
        self.round_id   = 0
        self.bets: dict[int, dict] = {}
        self.history: list[float] = []
        self.clients: set[web.WebSocketResponse] = set()

    async def register(self, ws: web.WebSocketResponse):
        self.clients.add(ws)
        await self._send(ws, self._state_snapshot())
        await self._send(ws, {"type": "history", "history": self.history[:20]})

    def unregister(self, ws):
        self.clients.discard(ws)

    async def _send(self, ws, data):
        try:
            if not ws.closed:
                await ws.send_str(json.dumps(data))
        except Exception:
            pass

    async def broadcast(self, data):
        msg  = json.dumps(data)
        dead = set()
        for ws in list(self.clients):
            try:
                if ws.closed:
                    dead.add(ws)
                else:
                    await ws.send_str(msg)
            except Exception:
                dead.add(ws)
        self.clients -= dead

    def _bets_list(self):
        out = []
        for uid, b in self.bets.items():
            out.append({
                "user_id":    uid,
                "name":       b["name"],
                "avatar":     b.get("avatar", ""),
                "bet":        b["bet"],
                "cashed_out": b["cashed_out"],
                "mult":       round(b["mult"], 2) if b["cashed_out"] else None,
                "win":        b.get("win"),
                "lost":       b.get("lost", False),
            })
        return out

    def _state_snapshot(self):
        return {
            "type":       "state",
            "state":      self.state,
            "multiplier": round(self.multiplier, 2),
            "round_id":   self.round_id,
            "bets":       self._bets_list(),
        }

    @staticmethod
    def _gen_target() -> float:
        r = random.random()
        if r < 0.40: return round(1.00 + random.random() * 0.50, 2)
        if r < 0.65: return round(1.50 + random.random() * 0.50, 2)
        if r < 0.82: return round(2.00 + random.random() * 2.00, 2)
        if r < 0.93: return round(4.00 + random.random() * 3.00, 2)
        return round(7.00 + random.random() * 13.00, 2)

    async def place_bet(self, user_id: int, bet: int, name: str, avatar: str) -> dict:
        if self.state not in ("waiting", "countdown"):
            return {"ok": False, "error": "Ставки закрыты"}
        if user_id in self.bets:
            return {"ok": False, "error": "Ставка уже сделана"}
        if bet < 10:
            return {"ok": False, "error": "Минимум 10 ⭐️"}
        bal = await db_get_balance(user_id)
        if bal < bet:
            return {"ok": False, "error": "Недостаточно ⭐️"}
        await db_set_balance(user_id, bal - bet)
        self.bets[user_id] = {
            "bet": bet, "name": name, "avatar": avatar,
            "cashed_out": False, "mult": 0, "win": None, "lost": False,
        }
        new_bal = bal - bet
        await self.broadcast({
            "type": "bet_placed",
            "bets": self._bets_list(),
            "user_id": user_id,
            "balance": new_bal,
        })
        return {"ok": True, "balance": new_bal}

    async def cash_out(self, user_id: int) -> dict:
        if self.state != "flying":
            return {"ok": False, "error": "Игра не идёт"}
        b = self.bets.get(user_id)
        if not b:
            return {"ok": False, "error": "Нет ставки в этом раунде"}
        if b["cashed_out"]:
            return {"ok": False, "error": "Уже забрано"}
        mult = round(self.multiplier, 2)
        win  = int(b["bet"] * mult)
        b.update(cashed_out=True, mult=mult, win=win)
        bal = await db_get_balance(user_id)
        await db_set_balance(user_id, bal + win)
        new_bal = bal + win
        await self.broadcast({
            "type":    "cashed_out",
            "bets":    self._bets_list(),
            "user_id": user_id,
            "mult":    mult,
            "win":     win,
            "balance": new_bal,
        })
        return {"ok": True, "mult": mult, "win": win, "balance": new_bal}

    async def run(self):
        while True:
            await self._round()

    async def _round(self):
        self.round_id  += 1
        self.state      = "waiting"
        self.multiplier = 1.00
        self.target     = self._gen_target()
        self.bets       = {}

        await self.broadcast({
            "type":      "waiting",
            "round_id":  self.round_id,
            "wait_secs": self.WAIT_SECS,
        })

        for s in range(self.WAIT_SECS, 0, -1):
            await self.broadcast({"type": "ticker", "phase": "waiting", "secs": s})
            await asyncio.sleep(1)

        self.state = "countdown"
        await self.broadcast({"type": "countdown", "secs": self.COUNTDOWN_SECS})
        for s in range(self.COUNTDOWN_SECS, 0, -1):
            await self.broadcast({"type": "ticker", "phase": "countdown", "secs": s})
            await asyncio.sleep(1)

        self.state = "flying"
        await self.broadcast({"type": "flying", "bets": self._bets_list()})

        step = 0
        while True:
            await asyncio.sleep(self.TICK_MS / 1000)
            step += 1
            self.multiplier = round(1.00 + step * 0.03, 2)

            if step % 2 == 0:
                await self.broadcast({
                    "type":       "tick",
                    "multiplier": round(self.multiplier, 2),
                    "bets":       self._bets_list(),
                })

            if self.multiplier >= self.target:
                self.multiplier = self.target
                break

        for b in self.bets.values():
            if not b["cashed_out"]:
                b["lost"] = True

        self.state = "crashed"
        final = round(self.multiplier, 2)
        self.history.insert(0, final)
        if len(self.history) > 20:
            self.history.pop()

        await db_save_round(final)
        await self.broadcast({
            "type":       "crashed",
            "multiplier": final,
            "bets":       self._bets_list(),
        })
        await asyncio.sleep(5)


game = CrashGame()


# ─── WEBSOCKET HANDLER ───────────────────────────────────
async def ws_handler(request):
    ws = web.WebSocketResponse(heartbeat=30)
    await ws.prepare(request)
    await game.register(ws)

    try:
        async for msg in ws:
            if msg.type == aiohttp.WSMsgType.TEXT:
                try:
                    data   = json.loads(msg.data)
                    action = data.get("action")

                    if action == "bet":
                        res = await game.place_bet(
                            int(data["user_id"]), int(data["bet"]),
                            data.get("name", "Гость"), data.get("avatar", "")
                        )
                        await ws.send_str(json.dumps({"type": "bet_result", **res}))

                    elif action == "cashout":
                        res = await game.cash_out(int(data["user_id"]))
                        await ws.send_str(json.dumps({"type": "cashout_result", **res}))

                    elif action == "get_balance":
                        bal = await db_get_balance(int(data["user_id"]))
                        await ws.send_str(json.dumps({"type": "balance", "balance": bal}))

                except Exception as e:
                    log.error(f"WS error: {e}")

            elif msg.type in (aiohttp.WSMsgType.ERROR, aiohttp.WSMsgType.CLOSE):
                break
    finally:
        game.unregister(ws)

    return ws


# ─── HTTP API HANDLERS ───────────────────────────────────
async def api_get_balance(request):
    if request.method == "OPTIONS":
        return web.Response(headers=CORS)
    try:
        data = await request.json()
        uid  = data.get("user_id")
        if not uid:
            return web.json_response({"error": "no user_id"}, headers=CORS, status=400)
        bal = await db_get_balance(int(uid))
        return web.json_response({"balance": bal}, headers=CORS)
    except Exception as e:
        return web.json_response({"error": str(e)}, headers=CORS, status=500)

async def api_update_balance(request):
    if request.method == "OPTIONS":
        return web.Response(headers=CORS)
    try:
        data = await request.json()
        uid, bal = data.get("user_id"), data.get("balance")
        if not uid or bal is None:
            return web.json_response({"error": "missing"}, headers=CORS, status=400)
        await db_set_balance(int(uid), int(bal))
        return web.json_response({"ok": True}, headers=CORS)
    except Exception as e:
        return web.json_response({"error": str(e)}, headers=CORS, status=500)

async def api_update_user(request):
    if request.method == "OPTIONS":
        return web.Response(headers=CORS)
    try:
        data = await request.json()
        await db_upsert_user(
            int(data["user_id"]),
            username=data.get("username"),
            first_name=data.get("first_name"),
            avatar_url=data.get("avatar_url"),
        )
        return web.json_response({"ok": True}, headers=CORS)
    except Exception as e:
        return web.json_response({"error": str(e)}, headers=CORS, status=500)

async def api_history(request):
    if request.method == "OPTIONS":
        return web.Response(headers=CORS)
    rounds = await db_get_history(20)
    return web.json_response({"history": rounds}, headers=CORS)

async def api_referral(request):
    if request.method == "OPTIONS":
        return web.Response(headers=CORS)
    try:
        data = await request.json()
        referrer_id = data.get("referrer_id")
        new_user_id = data.get("new_user_id")
        if referrer_id and new_user_id:
            await db_save_referral(int(referrer_id), int(new_user_id))
        return web.json_response({"ok": True}, headers=CORS)
    except Exception as e:
        return web.json_response({"error": str(e)}, headers=CORS, status=500)


# ─── TELEGRAM BOT ────────────────────────────────────────
bot  = Bot(token=BOT_TOKEN)
dp   = Dispatcher()

@dp.message(Command("start"))
async def tg_start(message: types.Message):
    args = message.text.split()
    uid  = message.from_user.id
    u    = message.from_user
    
    # Сохраняем пользователя
    await db_upsert_user(
        uid,
        username=u.username,
        first_name=u.first_name
    )
    
    # Проверяем реферальный параметр
    if len(args) > 1 and args[1].startswith("ref_"):
        referrer_id = int(args[1].replace("ref_", ""))
        if referrer_id != uid:
            await db_save_referral(referrer_id, uid)
    
    # Если это покупка
    if len(args) > 1 and args[1].startswith("buy_"):
        try:
            await _send_invoice(uid, int(args[1].replace("buy_", "")))
        except Exception as e:
            await message.answer(f"Ошибка: {e}")
        return
    
    # Приветственное сообщение
    bal = await db_get_balance(uid)
    kb  = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🐊 ОТКРЫТЬ CROCO GIFT", web_app=WebAppInfo(url=MINI_APP_URL))],
        [InlineKeyboardButton(text="⭐ Пополнить баланс", callback_data="show_buy_menu")],
    ])
    
    welcome_text = f"""
🎁 <b>Добро пожаловать в Croco Gift!</b>

🐊 Лучшее место для открытия кейсов и мини-игр!

┌─────────────────────┐
│  🎮 <b>Что тебя ждёт:</b>   │
│  • Daily Case — бесплатно │
│  • 7+ уникальных кейсов   │
│  • Дартс, Кубик, Краш    │
│  • Стаканчики и многое   │
│    другое!               │
└─────────────────────┘

💰 <b>Твой баланс:</b> {bal} ⭐️
👥 <b>Приглашай друзей</b> и получай бонусы!

✨ <i>Нажми кнопку ниже чтобы начать!</i>
"""
    await message.answer(welcome_text, parse_mode="HTML", reply_markup=kb)

@dp.callback_query(F.data == "show_buy_menu")
async def show_buy_menu(cb: types.CallbackQuery):
    await cb.answer()
    bal = await db_get_balance(cb.from_user.id)
    kb  = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="⭐ 50", callback_data="buy_50"),
         InlineKeyboardButton(text="⭐ 100", callback_data="buy_100")],
        [InlineKeyboardButton(text="⭐ 250", callback_data="buy_250"),
         InlineKeyboardButton(text="⭐ 500", callback_data="buy_500")],
        [InlineKeyboardButton(text="⭐ 1000", callback_data="buy_1000"),
         InlineKeyboardButton(text="✏️ Другая сумма", callback_data="buy_custom")],
        [InlineKeyboardButton(text="🐊 ОТКРЫТЬ CROCO GIFT", web_app=WebAppInfo(url=MINI_APP_URL))],
    ])
    await cb.message.edit_text(
        f"💰 Баланс: {bal} ⭐️\n\nВыберите сумму для пополнения:",
        reply_markup=kb
    )

@dp.callback_query(F.data.startswith("buy_"))
async def tg_buy(cb: types.CallbackQuery):
    await cb.answer()
    if cb.data == "buy_custom":
        await cb.message.answer("✏️ Введите количество звёзд (1-2500):")
        return
    await _send_invoice(cb.from_user.id, int(cb.data.replace("buy_", "")))

@dp.message(F.text.regexp(r"^\d+$"))
async def tg_custom_amount(message: types.Message):
    n = int(message.text)
    if not (1 <= n <= 2500):
        await message.answer("❌ От 1 до 2500")
        return
    await _send_invoice(message.from_user.id, n)

async def _send_invoice(chat_id: int, amount: int):
    await bot.send_invoice(
        chat_id=chat_id,
        title=f"⭐️ {amount} звёзд Croco Gift",
        description=f"Покупка {amount} звёзд для Croco Gift",
        payload=f"buy_{amount}_{chat_id}",
        provider_token="",
        currency="XTR",
        prices=[LabeledPrice(label=f"{amount} звёзд", amount=amount)],
    )

@dp.pre_checkout_query()
async def tg_precheckout(q: types.PreCheckoutQuery):
    await q.answer(ok=True)

@dp.message(F.successful_payment)
async def tg_payment_success(message: types.Message):
    try:
        sp   = message.successful_payment
        payload = sp.invoice_payload
        
        if payload.startswith("buy_"):
            parts = payload.split('_')
            amount = int(parts[1])
            uid = int(parts[2])
            tgid = sp.telegram_payment_charge_id
            
            await db_save_payment(payload, tgid, uid, amount)
            await db_add_stars(uid, amount)
            bal = await db_get_balance(uid)
            
            await bot.send_message(
                OWNER_ID,
                f"✅ ОПЛАТА!\n👤 @{message.from_user.username or message.from_user.first_name}\n🆔 {uid}\n⭐️ +{amount}\n💰 {bal}"
            )
            
            kb = InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="🐊 ОТКРЫТЬ CROCO GIFT", web_app=WebAppInfo(url=MINI_APP_URL))]
            ])
            await message.answer(
                f"✅ +{amount} ⭐️ зачислено!\n💰 Баланс: {bal} ⭐️\n\nНажмите кнопку чтобы играть! 🎁",
                reply_markup=kb
            )
    except Exception as e:
        log.error(f"Payment error: {e}")

async def tg_webhook_handler(request):
    try:
        data   = await request.json()
        update = types.Update(**data)
        await dp.feed_update(bot, update)
        return web.Response(text="ok")
    except Exception as e:
        log.error(f"Webhook error: {e}")
        return web.Response(text="error", status=500)


# ─── APP STARTUP ─────────────────────────────────────────
async def on_startup(app):
    await init_db()
    game.history = await db_get_history(20)
    asyncio.create_task(game.run())
    
    webhook_url = os.environ.get("WEBHOOK_URL", "")
    if webhook_url:
        await bot.delete_webhook(drop_pending_updates=True)
        await bot.set_webhook(f"{webhook_url}/webhook")
        log.info(f"🔄 Webhook: {webhook_url}/webhook")
    else:
        asyncio.create_task(dp.start_polling(bot))
        log.info("🔄 Polling mode")


async def main():
    app = web.Application()
    app.on_startup.append(on_startup)

    app.router.add_get("/ws", ws_handler)
    app.router.add_route("*", "/api/get_balance",    api_get_balance)
    app.router.add_route("*", "/api/update_balance", api_update_balance)
    app.router.add_route("*", "/api/update_user",    api_update_user)
    app.router.add_route("*", "/api/history",        api_history)
    app.router.add_route("*", "/api/referral",       api_referral)
    app.router.add_post("/webhook", tg_webhook_handler)
    app.router.add_get("/", lambda r: web.Response(text="🐊 Croco Gift OK", headers=CORS))

    port = int(os.environ.get("PORT", 8080))
    runner = web.AppRunner(app)
    await runner.setup()
    await web.TCPSite(runner, "0.0.0.0", port).start()
    log.info(f"🚀 Сервер на порту {port}")
    await asyncio.Event().wait()


if __name__ == "__main__":
    asyncio.run(main())
