/**
 * Free instant alerts to the owner's phone via a Telegram bot.
 *
 * Env (Vercel): TELEGRAM_BOT_TOKEN (from @BotFather) and TELEGRAM_CHAT_ID
 * (the owner's chat with the bot). If either is missing, alerts are
 * silently skipped — an alert must never break a sign-up.
 */
export async function notifyOwner(text, deps = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;
  const doFetch = deps.fetch || fetch;
  try {
    const res = await doFetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(4000),
    });
    return res.ok;
  } catch (err) {
    console.error('notifyOwner failed:', err?.message);
    return false;
  }
}
