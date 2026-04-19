# RankifyAI — Setup Guide

## Project Structure
```
etsy-ai-extension/
├── extension/        ← Load this in Chrome
└── backend/          ← Deploy this to Railway
```

---

## 1. Supabase (Database)
1. Go to supabase.com → New project
2. Open SQL Editor → paste contents of `backend/supabase-schema.sql` → Run
3. Copy your **Project URL** and **service_role key** (Settings → API)

---

## 2. Stripe (Payments)
1. Go to dashboard.stripe.com → Create a product ($15/month subscription)
2. Copy your **Secret key** (Developers → API keys)
3. Create a **Payment Link** for your product — this is what users click to subscribe
4. Set up a **Webhook** pointing to `https://your-app.railway.app/api/webhook`
   - Events to listen for: `checkout.session.completed`, `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.deleted`
5. Copy the **Webhook signing secret**

---

## 3. Backend (Railway)
1. Go to railway.app → New project → Deploy from GitHub
2. Push the `backend/` folder to a GitHub repo
3. Add environment variables (from `.env.example`) in Railway dashboard
4. Railway gives you a URL like `https://your-app.railway.app` — copy it

---

## 4. Extension — Update URLs
In `extension/popup.js`, replace:
```js
const BACKEND_URL = 'https://your-app.railway.app';
```
with your actual Railway URL.

Also replace the payment link:
```js
chrome.tabs.create({ url: 'https://your-payment-link.com' });
```
with your Stripe Payment Link URL.

---

## 5. Load Extension in Chrome
1. Go to `chrome://extensions`
2. Enable **Developer Mode** (top right)
3. Click **Load unpacked** → select the `extension/` folder
4. The extension icon appears in your toolbar

---

## 6. Email Keys to Users (Optional but recommended)
After payment, `webhook.js` logs the key to console. To email it automatically:
1. Sign up at resend.com (free tier: 100 emails/day)
2. Add `RESEND_API_KEY` to your `.env`
3. Uncomment the email section in `backend/routes/webhook.js`

---

## Cost Summary
| Item | Cost |
|------|------|
| Railway hosting | Free (starter) or $5/month |
| Supabase | Free tier |
| Stripe | 2.9% + $0.30 per transaction |
| Anthropic API | ~$0.001-0.002 per listing |
| **Per $15 subscriber** | **~$13.26 profit** |
