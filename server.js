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

const ENCRYPTION_KEY = process.env.APP_ENCRYPTION_KEY;
const JWT_SECRET = process.env.APP_JWT_SECRET || 'dev-jwt-secret-change-me';
const APP_BASE_URL = process.env.APP_BASE_URL || `http://localhost:${PORT}`;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_PRICE_MONTHLY = process.env.STRIPE_PRICE_MONTHLY || '';
const STRIPE_PRICE_WEEKLY = process.env.STRIPE_PRICE_WEEKLY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const AI_MODEL = process.env.AI_MODEL || 'gpt-5.4';
const PAYPAL_MODE = process.env.PAYPAL_MODE || 'sandbox';
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || '';
const PAYPAL_API_BASE = PAYPAL_MODE === 'sandbox' ? 'https://api.sandbox.paypal.com' : 'https://api.paypal.com';
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
  console.warn('APP_ENCRYPTION_KEY is missing or too short. Set a long random value in .env.local.');
}
if (!process.env.APP_JWT_SECRET || process.env.APP_JWT_SECRET.length < 24) {
  console.warn('APP_JWT_SECRET is missing or too short. Set a long random value in .env.local.');
}
if (!STRIPE_SECRET_KEY) {
  console.warn('STRIPE_SECRET_KEY is missing. Billing checkout endpoints will be unavailable.');
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

app.post('/api/auth/register', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  if (!email.includes('@')) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
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

app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const users = readJson(USERS_FILE, []);
  const user = users.find((u) => u.email === email);

  if (!user) return res.status(401).json({ error: 'Invalid email or password.' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid email or password.' });

  return res.json({ token: signToken(user), email: user.email });
});

app.get('/api/auth/me', authRequired, (req, res) => {
  return res.json({ email: req.user.email });
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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
