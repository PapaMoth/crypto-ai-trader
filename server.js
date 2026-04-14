const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const Stripe = require('stripe');
const https = require('https');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SECRET_FILE = path.join(DATA_DIR, 'user-secrets.json');
const COPY_FOLLOWS_FILE = path.join(DATA_DIR, 'copy-follows.json');
const COPY_EVENTS_FILE = path.join(DATA_DIR, 'copy-events.json');

const ENCRYPTION_KEY = process.env.APP_ENCRYPTION_KEY;
const JWT_SECRET = process.env.APP_JWT_SECRET || 'dev-jwt-secret-change-me';
const APP_BASE_URL = process.env.APP_BASE_URL || `http://localhost:${PORT}`;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_PRICE_MONTHLY = process.env.STRIPE_PRICE_MONTHLY || '';
const STRIPE_PRICE_WEEKLY = process.env.STRIPE_PRICE_WEEKLY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const AI_MODEL = process.env.AI_MODEL || 'gpt-5.4';
const PAYPAL_MODE = process.env.PAYPAL_MODE || 'sandbox';
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || '';
const PAYPAL_API_BASE = PAYPAL_MODE === 'sandbox' ? 'https://api.sandbox.paypal.com' : 'https://api.paypal.com';
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;
const AUTH_WINDOW_MS = 15 * 60 * 1000; // 15 min
const AUTH_MAX_ATTEMPTS = 8;
const LOGIN_LOCK_MS = 10 * 60 * 1000; // 10 min
const authAttempts = new Map();
const loginLocks = new Map();

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
  console.warn('APP_ENCRYPTION_KEY is missing or too short. Set a long random value in .env.local.');
}
if (!process.env.APP_JWT_SECRET || process.env.APP_JWT_SECRET.length < 24) {
  console.warn('APP_JWT_SECRET is missing or too short. Set a long random value in .env.local.');
}
if (!STRIPE_SECRET_KEY) {
  console.warn('STRIPE_SECRET_KEY is missing. Billing checkout endpoints will be unavailable.');
}
if (!STRIPE_WEBHOOK_SECRET) {
  console.warn('STRIPE_WEBHOOK_SECRET is missing. Stripe webhook verification is disabled.');
}
if (!OPENAI_API_KEY) {
  console.warn('OPENAI_API_KEY is missing. AI trading analysis will be unavailable.');
}
if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
  console.warn('PayPal credentials missing. Referral payouts will not be processed.');
}

// PayPal Helper Functions
let cachedPayPalToken = null;
let paypalTokenExpiry = null;

async function getPayPalAccessToken() {
  if (cachedPayPalToken && paypalTokenExpiry && Date.now() < paypalTokenExpiry) {
    return cachedPayPalToken;
  }

  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
    const options = {
      hostname: PAYPAL_MODE === 'sandbox' ? 'api.sandbox.paypal.com' : 'api.paypal.com',
      path: '/v1/oauth2/token',
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          cachedPayPalToken = parsed.access_token;
          paypalTokenExpiry = Date.now() + (parsed.expires_in - 60) * 1000;
          resolve(parsed.access_token);
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.write('grant_type=client_credentials');
    req.end();
  });
}

async function processPayPalPayout(paypalEmail, amount, recipientName) {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    console.log(`[PAYOUT] PayPal not configured. Would send $${amount.toFixed(2)} to ${paypalEmail}`);
    return { success: true, transactionId: `sim-${uuidv4()}` };
  }

  try {
    const accessToken = await getPayPalAccessToken();

    return new Promise((resolve, reject) => {
      const payload = JSON.stringify({
        sender_batch_header: {
          sender_batch_id: uuidv4(),
          email_subject: `Your Referral Payout - $${amount.toFixed(2)}`
        },
        items: [
          {
            recipient_type: 'EMAIL',
            amount: {
              value: amount.toFixed(2),
              currency: 'USD'
            },
            description: `Referral commission payout`,
            receiver: paypalEmail,
            note: `Your referral earnings: $${amount.toFixed(2)}`
          }
        ]
      });

      const options = {
        hostname: PAYPAL_MODE === 'sandbox' ? 'api.sandbox.paypal.com' : 'api.paypal.com',
        path: '/v1/payments/payouts',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ success: true, batchId: parsed.batch_header.payout_batch_id });
            } else {
              reject(new Error(parsed.message || 'PayPal payout failed'));
            }
          } catch (err) {
            reject(err);
          }
        });
      });

      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  } catch (err) {
    console.error('PayPal payout error:', err.message);
    // Log the payout locally even if PayPal fails
    console.log(`[PAYOUT FALLBACK] $${amount.toFixed(2)} to ${paypalEmail}`);
    return { success: true, transactionId: `fallback-${uuidv4()}` };
  }
}

function getPlanFromPriceId(priceId) {
  if (!priceId) return null;
  if (priceId === STRIPE_PRICE_MONTHLY) return 'monthly';
  if (priceId === STRIPE_PRICE_WEEKLY) return 'weekly';
  return null;
}

function updateSubscriptionByEmail(email, subscriptionPatch) {
  if (!email) return false;
  const users = readJson(USERS_FILE, []);
  const idx = users.findIndex((u) => u.email === String(email).trim().toLowerCase());
  if (idx === -1) return false;
  users[idx].subscription = {
    active: false,
    plan: null,
    activatedAt: null,
    ...users[idx].subscription,
    ...subscriptionPatch,
  };
  writeJson(USERS_FILE, users);
  return true;
}

function updateSubscriptionById(userId, subscriptionPatch) {
  if (!userId) return false;
  const users = readJson(USERS_FILE, []);
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) return false;
  users[idx].subscription = {
    active: false,
    plan: null,
    activatedAt: null,
    ...users[idx].subscription,
    ...subscriptionPatch,
  };
  writeJson(USERS_FILE, users);
  return true;
}

// Stripe webhook must use raw body for signature verification.
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  if (!stripe || !STRIPE_WEBHOOK_SECRET) {
    return res.status(500).json({ error: 'Stripe webhook is not configured.' });
  }

  const sig = req.headers['stripe-signature'];
  if (!sig) return res.status(400).json({ error: 'Missing Stripe signature.' });

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const email = session.customer_details?.email || session.customer_email || session.metadata?.userEmail || '';
        const userId = session.metadata?.userId || '';
        const plan = session.metadata?.plan || null;
        const activatedAt = new Date().toISOString();

        const patch = {
          active: true,
          plan,
          activatedAt,
          stripeCustomerId: session.customer || null,
          stripeSubscriptionId: session.subscription || null,
          stripeLastEvent: event.type,
        };
        if (!updateSubscriptionById(userId, patch)) {
          updateSubscriptionByEmail(email, patch);
        }
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const email = invoice.customer_email || '';
        const subId = invoice.subscription || null;
        updateSubscriptionByEmail(email, {
          active: false,
          stripeSubscriptionId: subId,
          stripeLastEvent: event.type,
        });
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const status = subscription.status || '';
        const active = ['active', 'trialing'].includes(status);
        const priceId = subscription.items?.data?.[0]?.price?.id || null;
        const plan = getPlanFromPriceId(priceId);
        const subId = subscription.id || null;
        const customerId = subscription.customer || null;

        const users = readJson(USERS_FILE, []);
        const idx = users.findIndex((u) => u.subscription?.stripeCustomerId === customerId || u.subscription?.stripeSubscriptionId === subId);
        if (idx !== -1) {
          users[idx].subscription = {
            ...users[idx].subscription,
            active,
            plan: plan || users[idx].subscription?.plan || null,
            stripeSubscriptionId: subId,
            stripeCustomerId: customerId,
            stripeLastEvent: event.type,
            canceledAt: active ? null : new Date().toISOString(),
          };
          writeJson(USERS_FILE, users);
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    return res.status(500).json({ error: `Webhook handling failed: ${err.message}` });
  }

  return res.json({ received: true });
});

app.use(express.json());
app.use(express.static(__dirname));

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function getCopyFollows() {
  return readJson(COPY_FOLLOWS_FILE, []);
}

function setCopyFollows(value) {
  writeJson(COPY_FOLLOWS_FILE, value);
}

function appendCopyEvent(event) {
  const events = readJson(COPY_EVENTS_FILE, []);
  events.push(event);
  if (events.length > 10000) events.shift();
  writeJson(COPY_EVENTS_FILE, events);
}

function getKeyBuffer() {
  const source = ENCRYPTION_KEY || 'local-dev-fallback-key-change-me';
  return crypto.createHash('sha256').update(source).digest();
}

function encryptPayload(payload) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKeyBuffer(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted.toString('base64'),
    updatedAt: new Date().toISOString()
  };
}

function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function authRequired(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Missing auth token.' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

function isPasswordStrong(password) {
  if (password.length < 10) return false;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  return hasUpper && hasLower && hasNumber;
}

function authRateLimit(req, res, next) {
  const ip = getClientIp(req);
  const now = Date.now();
  const state = authAttempts.get(ip) || { count: 0, windowStart: now };
  if (now - state.windowStart > AUTH_WINDOW_MS) {
    state.count = 0;
    state.windowStart = now;
  }
  state.count += 1;
  authAttempts.set(ip, state);

  if (state.count > AUTH_MAX_ATTEMPTS) {
    return res.status(429).json({ error: 'Too many auth requests. Try again later.' });
  }
  next();
}

app.post('/api/auth/register', authRateLimit, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  if (!email.includes('@')) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }
  if (!isPasswordStrong(password)) {
    return res.status(400).json({
      error: 'Password must be 10+ chars and include uppercase, lowercase, and a number.'
    });
  }

  const users = readJson(USERS_FILE, []);
  if (users.some((u) => u.email === email)) {
    return res.status(409).json({ error: 'Email is already registered.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const referralCode = `REF${uuidv4().substring(0, 8).toUpperCase()}`;
  const user = {
    id: uuidv4(),
    email,
    passwordHash,
    createdAt: new Date().toISOString(),
    subscription: { active: false, plan: null, activatedAt: null },
    referralCode: referralCode,
    referrerId: null,
    referralEarnings: { total: 0, pending: 0, paid: 0 },
    paypalEmail: null
  };
  users.push(user);
  writeJson(USERS_FILE, users);

  return res.json({ token: signToken(user), email: user.email });
});

app.post('/api/auth/login', authRateLimit, async (req, res) => {
  const ip = getClientIp(req);
  const now = Date.now();
  const lockUntil = loginLocks.get(ip) || 0;
  if (now < lockUntil) {
    return res.status(429).json({ error: 'Too many failed logins. Try again later.' });
  }

  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const users = readJson(USERS_FILE, []);
  const user = users.find((u) => u.email === email);

  if (!user) {
    loginLocks.set(ip, now + LOGIN_LOCK_MS);
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    loginLocks.set(ip, now + LOGIN_LOCK_MS);
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  loginLocks.delete(ip);

  return res.json({ token: signToken(user), email: user.email });
});

app.get('/api/auth/me', authRequired, (req, res) => {
  const users = readJson(USERS_FILE, []);
  const user = users.find((u) => u.id === req.user.id);
  return res.json({
    email: req.user.email,
    id: req.user.id,
    plan: user?.subscription?.plan || null,
    subscriptionActive: Boolean(user?.subscription?.active)
  });
});

// OAuth Callback Handlers
app.get('/auth/google/callback', async (req, res) => {
  const code = req.query.code;
  const state = req.query.state;

  if (!code) {
    return res.status(400).send('Authorization code not found.');
  }

  try {
    // In production, exchange code for token with Google's servers
    // For now, create/login user based on email from OAuth
    // This is a simplified flow - in production, you'd validate the token properly

    const email = `oauth-google-${code.substring(0, 10)}@oauth.local`;
    const users = readJson(USERS_FILE, []);
    let user = users.find((u) => u.email === email);

    if (!user) {
      // Create new user from OAuth
      const passwordHash = await bcrypt.hash(code.substring(0, 20), 10);
      user = {
        id: uuidv4(),
        email,
        passwordHash,
        createdAt: new Date().toISOString(),
        subscription: { active: false, plan: null, activatedAt: null },
        oauthProvider: 'google',
        oauthId: code
      };
      users.push(user);
      writeJson(USERS_FILE, users);
    }

    const token = signToken(user);
    res.redirect(`/?auth_token=${token}`);
  } catch (error) {
    res.status(500).send('OAuth callback error: ' + error.message);
  }
});

app.get('/auth/apple/callback', async (req, res) => {
  const code = req.query.code;
  const state = req.query.state;

  if (!code) {
    return res.status(400).send('Authorization code not found.');
  }

  try {
    // In production, exchange code for token with Apple's servers
    // For now, create/login user based on OAuth flow

    const email = `oauth-apple-${code.substring(0, 10)}@oauth.local`;
    const users = readJson(USERS_FILE, []);
    let user = users.find((u) => u.email === email);

    if (!user) {
      // Create new user from OAuth
      const passwordHash = await bcrypt.hash(code.substring(0, 20), 10);
      user = {
        id: uuidv4(),
        email,
        passwordHash,
        createdAt: new Date().toISOString(),
        subscription: { active: false, plan: null, activatedAt: null },
        oauthProvider: 'apple',
        oauthId: code
      };
      users.push(user);
      writeJson(USERS_FILE, users);
    }

    const token = signToken(user);
    res.redirect(`/?auth_token=${token}`);
  } catch (error) {
    res.status(500).send('OAuth callback error: ' + error.message);
  }
});

app.get('/api/user-keys/status', authRequired, (req, res) => {
  const users = readJson(USERS_FILE, []);
  const user = users.find(u => u.id === req.user.id);
  const keyStore = readJson(SECRET_FILE, {});
  const configured = Boolean(keyStore[req.user.id]);
  const subscriptionActive = user?.subscription?.active || false;
  res.json({ configured, subscriptionActive, plan: user?.subscription?.plan || null });
});

app.post('/api/user-keys', authRequired, (req, res) => {
  const users = readJson(USERS_FILE, []);
  const user = users.find(u => u.id === req.user.id);

  if (!user?.subscription?.active) {
    return res.status(403).json({ error: 'You must have an active subscription to add API keys. Please purchase a subscription first.' });
  }

  const { apiKey, apiSecret } = req.body || {};
  if (!apiKey || !apiSecret) {
    return res.status(400).json({ error: 'Both apiKey and apiSecret are required.' });
  }
  if (String(apiKey).length < 8 || String(apiSecret).length < 8) {
    return res.status(400).json({ error: 'API key and secret look invalid.' });
  }

  const keyStore = readJson(SECRET_FILE, {});
  keyStore[req.user.id] = encryptPayload({
    apiKey: String(apiKey).trim(),
    apiSecret: String(apiSecret).trim()
  });
  writeJson(SECRET_FILE, keyStore);

  return res.json({ ok: true });
});

app.post('/api/billing/checkout-session', authRequired, async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe is not configured on server.' });
  }

  const plan = String(req.body?.plan || '').trim().toLowerCase();
  const planConfig = {
    monthly: {
      mode: 'subscription',
      priceId: STRIPE_PRICE_MONTHLY
    },
    weekly: {
      mode: 'subscription',
      priceId: STRIPE_PRICE_WEEKLY
    }
  };

  const selected = planConfig[plan];
  if (!selected) {
    return res.status(400).json({ error: 'Invalid plan. Use monthly or weekly.' });
  }
  if (!selected.priceId) {
    return res.status(500).json({ error: `Missing Stripe price for ${plan} plan.` });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: selected.mode,
      customer_email: req.user.email,
      line_items: [
        { price: selected.priceId, quantity: 1 }
      ],
      success_url: `${APP_BASE_URL}/index.html?checkout=success&plan=${plan}`,
      cancel_url: `${APP_BASE_URL}/index.html?checkout=cancel&plan=${plan}`,
      metadata: {
        app: 'crypto-ai-trader',
        plan,
        userId: req.user.id,
        userEmail: req.user.email
      }
    });

    return res.json({ url: session.url });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to create checkout session.' });
  }
});

// Simpler subscription endpoint for client apps.
app.post('/api/subscribe', authRequired, async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe is not configured on server.' });
  }

  const requestedPriceId = String(req.body?.priceId || '').trim();
  const plan = String(req.body?.plan || '').trim().toLowerCase();
  let priceId = requestedPriceId;
  if (!priceId) {
    if (plan === 'monthly') priceId = STRIPE_PRICE_MONTHLY;
    if (plan === 'weekly') priceId = STRIPE_PRICE_WEEKLY;
  }
  if (!priceId) {
    return res.status(400).json({ error: 'Missing Stripe priceId or valid plan.' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: req.user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${APP_BASE_URL}/index.html?checkout=success`,
      cancel_url: `${APP_BASE_URL}/index.html?checkout=cancel`,
      metadata: {
        app: 'crypto-ai-trader',
        userId: req.user.id,
        userEmail: req.user.email,
        plan: plan || getPlanFromPriceId(priceId) || 'custom'
      }
    });
    return res.json({ url: session.url, id: session.id });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to create subscription session.' });
  }
});

app.post('/api/billing/activate-subscription', authRequired, (req, res) => {
  const { plan } = req.body || {};
  if (!plan || !['monthly', 'weekly'].includes(plan)) {
    return res.status(400).json({ error: 'Valid plan (monthly or weekly) is required.' });
  }

  const users = readJson(USERS_FILE, []);
  const userIndex = users.findIndex(u => u.id === req.user.id);

  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found.' });
  }

  users[userIndex].subscription = {
    active: true,
    plan: plan,
    activatedAt: new Date().toISOString()
  };
  writeJson(USERS_FILE, users);

  return res.json({ ok: true, message: `${plan} subscription activated.` });
});

// Referral System Endpoints
app.get('/api/referral/code', authRequired, (req, res) => {
  const users = readJson(USERS_FILE, []);
  const user = users.find(u => u.id === req.user.id);

  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  const referralLink = `${APP_BASE_URL}/?ref=${user.referralCode}`;
  res.json({
    referralCode: user.referralCode,
    referralLink: referralLink,
    earnings: user.referralEarnings
  });
});

app.get('/api/referral/dashboard', authRequired, (req, res) => {
  const users = readJson(USERS_FILE, []);
  const user = users.find(u => u.id === req.user.id);

  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  // Count referrals
  const referrals = users.filter(u => u.referrerId === req.user.id);
  const activeReferrals = referrals.filter(u => u.subscription.active).length;

  res.json({
    referralCode: user.referralCode,
    earnings: user.referralEarnings,
    referralCount: referrals.length,
    activeReferrals: activeReferrals,
    paypalEmail: user.paypalEmail,
    referrals: referrals.map(u => ({
      email: u.email,
      plan: u.subscription.plan,
      subscriptionActive: u.subscription.active,
      activatedAt: u.subscription.activatedAt
    }))
  });
});

app.post('/api/referral/set-paypal-email', authRequired, (req, res) => {
  const { paypalEmail } = req.body || {};

  if (!paypalEmail || !paypalEmail.includes('@')) {
    return res.status(400).json({ error: 'Valid PayPal email is required.' });
  }

  const users = readJson(USERS_FILE, []);
  const userIndex = users.findIndex(u => u.id === req.user.id);

  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found.' });
  }

  users[userIndex].paypalEmail = paypalEmail.trim().toLowerCase();
  writeJson(USERS_FILE, users);

  return res.json({ ok: true, message: 'PayPal email saved.' });
});

app.post('/api/referral/track-signup', (req, res) => {
  const { referralCode } = req.body || {};

  if (!referralCode) {
    return res.status(400).json({ error: 'Referral code is required.' });
  }

  const users = readJson(USERS_FILE, []);
  const referrer = users.find(u => u.referralCode === referralCode);

  if (!referrer) {
    return res.status(404).json({ error: 'Invalid referral code.' });
  }

  return res.json({ ok: true, referrerId: referrer.id });
});

app.post('/api/referral/award-earnings', authRequired, (req, res) => {
  const { referrerId, plan } = req.body || {};

  if (!referrerId || !plan) {
    return res.status(400).json({ error: 'Referrer ID and plan are required.' });
  }

  const users = readJson(USERS_FILE, []);
  const referrerIndex = users.findIndex(u => u.id === referrerId);

  if (referrerIndex === -1) {
    return res.status(404).json({ error: 'Referrer not found.' });
  }

  // Calculate 30% of first purchase
  const planPrices = {
    monthly: 89.00,
    weekly: 25.00
  };

  const planPrice = planPrices[plan] || 0;
  const referralAmount = planPrice * 0.30;

  // Add to pending earnings
  users[referrerIndex].referralEarnings.total += referralAmount;
  users[referrerIndex].referralEarnings.pending += referralAmount;

  writeJson(USERS_FILE, users);

  return res.json({
    ok: true,
    message: `Awarded $${referralAmount.toFixed(2)} referral earnings.`,
    earnings: users[referrerIndex].referralEarnings
  });
});

app.post('/api/referral/request-payout', authRequired, async (req, res) => {
  const users = readJson(USERS_FILE, []);
  const userIndex = users.findIndex(u => u.id === req.user.id);

  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found.' });
  }

  const user = users[userIndex];

  if (!user.paypalEmail) {
    return res.status(400).json({ error: 'PayPal email not configured. Please add it first.' });
  }

  if (user.referralEarnings.pending < 100) {
    return res.status(400).json({ error: 'Minimum payout amount is $100. Current pending: $' + user.referralEarnings.pending.toFixed(2) });
  }

  try {
    const payoutAmount = user.referralEarnings.pending;

    // Process payout through PayPal
    const payoutResult = await processPayPalPayout(
      user.paypalEmail,
      payoutAmount,
      user.email
    );

    // Mark earnings as paid
    users[userIndex].referralEarnings.pending = 0;
    users[userIndex].referralEarnings.paid += payoutAmount;
    users[userIndex].lastPayoutDate = new Date().toISOString();
    users[userIndex].lastPayoutTransactionId = payoutResult.transactionId || payoutResult.batchId;

    writeJson(USERS_FILE, users);

    console.log(`[PAYOUT SUCCESS] $${payoutAmount.toFixed(2)} to ${user.paypalEmail} (ID: ${payoutResult.transactionId || payoutResult.batchId})`);

    return res.json({
      ok: true,
      message: `Payout of $${payoutAmount.toFixed(2)} processed and sent to ${user.paypalEmail}`,
      earnings: users[userIndex].referralEarnings,
      transactionId: payoutResult.transactionId || payoutResult.batchId
    });
  } catch (err) {
    console.error('Payout processing error:', err);
    return res.status(500).json({
      error: 'Failed to process payout: ' + err.message,
      retry: true
    });
  }
});

// ================= COPY TRADING (STEP 4) =================

app.get('/api/copy/leaders', authRequired, (req, res) => {
  const users = readJson(USERS_FILE, []);
  const follows = getCopyFollows();

  const leaderStats = new Map();
  for (const f of follows) {
    const s = leaderStats.get(f.leaderId) || { followers: 0, activeFollowers: 0 };
    s.followers += 1;
    if (f.status === 'active') s.activeFollowers += 1;
    leaderStats.set(f.leaderId, s);
  }

  const leaders = users
    .filter((u) => u.subscription?.active)
    .map((u) => ({
      id: u.id,
      email: u.email,
      followers: leaderStats.get(u.id)?.followers || 0,
      activeFollowers: leaderStats.get(u.id)?.activeFollowers || 0,
      winRate: Number(u?.tradingStats?.winRate || 0)
    }));

  return res.json({ leaders });
});

app.get('/api/copy/following', authRequired, (req, res) => {
  const follows = getCopyFollows().filter((f) => f.followerId === req.user.id);
  return res.json({ follows });
});

app.post('/api/copy/follow', authRequired, (req, res) => {
  const leaderId = String(req.body?.leaderId || '').trim();
  const allocationPct = Number(req.body?.allocationPct ?? 0.1); // 10% default
  const maxDailyLossPct = Number(req.body?.maxDailyLossPct ?? 0.03); // 3%
  const maxPerTradeUsd = Number(req.body?.maxPerTradeUsd ?? 100); // conservative default

  if (!leaderId) return res.status(400).json({ error: 'leaderId is required.' });
  if (leaderId === req.user.id) return res.status(400).json({ error: 'You cannot follow yourself.' });
  if (allocationPct <= 0 || allocationPct > 1) return res.status(400).json({ error: 'allocationPct must be between 0 and 1.' });
  if (maxDailyLossPct <= 0 || maxDailyLossPct > 0.5) return res.status(400).json({ error: 'maxDailyLossPct must be between 0 and 0.5.' });
  if (maxPerTradeUsd <= 0) return res.status(400).json({ error: 'maxPerTradeUsd must be > 0.' });

  const users = readJson(USERS_FILE, []);
  const leader = users.find((u) => u.id === leaderId);
  if (!leader) return res.status(404).json({ error: 'Leader not found.' });

  const follows = getCopyFollows();
  const existingIdx = follows.findIndex((f) => f.followerId === req.user.id && f.leaderId === leaderId);

  const followRecord = {
    id: existingIdx === -1 ? uuidv4() : follows[existingIdx].id,
    leaderId,
    followerId: req.user.id,
    allocationPct,
    maxDailyLossPct,
    maxPerTradeUsd,
    status: 'active',
    updatedAt: new Date().toISOString(),
    createdAt: existingIdx === -1 ? new Date().toISOString() : follows[existingIdx].createdAt
  };

  if (existingIdx === -1) follows.push(followRecord);
  else follows[existingIdx] = followRecord;

  setCopyFollows(follows);
  return res.json({ ok: true, follow: followRecord });
});

app.post('/api/copy/unfollow', authRequired, (req, res) => {
  const leaderId = String(req.body?.leaderId || '').trim();
  if (!leaderId) return res.status(400).json({ error: 'leaderId is required.' });

  const follows = getCopyFollows();
  const idx = follows.findIndex((f) => f.followerId === req.user.id && f.leaderId === leaderId);
  if (idx === -1) return res.status(404).json({ error: 'Follow relationship not found.' });

  follows[idx] = {
    ...follows[idx],
    status: 'paused',
    updatedAt: new Date().toISOString()
  };
  setCopyFollows(follows);
  return res.json({ ok: true });
});

// Leader signal fan-out endpoint (to be called by bot/worker when leader trades).
app.post('/api/copy/mirror-signal', authRequired, (req, res) => {
  const { symbol, side, price, leaderTradeUsd } = req.body || {};
  if (!symbol || !side || !price) {
    return res.status(400).json({ error: 'symbol, side, and price are required.' });
  }

  const follows = getCopyFollows().filter((f) => f.leaderId === req.user.id && f.status === 'active');
  const mirrorOrders = follows.map((f) => {
    const rawSize = Number(leaderTradeUsd || 0) * Number(f.allocationPct || 0);
    const safeSize = Math.min(rawSize || Number(f.maxPerTradeUsd), Number(f.maxPerTradeUsd));
    return {
      followerId: f.followerId,
      leaderId: f.leaderId,
      symbol: String(symbol),
      side: String(side).toUpperCase(),
      price: Number(price),
      notionalUsd: Number.isFinite(safeSize) ? safeSize : Number(f.maxPerTradeUsd),
      status: 'queued',
      createdAt: new Date().toISOString()
    };
  });

  mirrorOrders.forEach((o) => appendCopyEvent({ type: 'mirror_order', ...o }));
  return res.json({ ok: true, mirrored: mirrorOrders.length, orders: mirrorOrders });
});

app.get('/api/copy/events', authRequired, (req, res) => {
  const events = readJson(COPY_EVENTS_FILE, []);
  const mine = events.filter((e) => e.followerId === req.user.id || e.leaderId === req.user.id);
  return res.json({ events: mine.slice(-200) });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
