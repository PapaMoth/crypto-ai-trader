# Referral System Implementation

## System Overview

The Nexus AI Trading referral system allows users to earn passive income by referring others. Users share a unique referral code with friends and family, and earn 30% of their first purchase whenever someone uses their code.

## Features Implemented

### 1. Referral Code Generation
- Each user receives a unique 8-character referral code (e.g., `REF12AB34CD`)
- Code is generated during user registration
- Code is stored securely in the user database
- Cannot be changed or regenerated

### 2. Referral Dashboard UI
The dashboard displays:

#### Referral Code Section
- Copy-to-clipboard functionality for easy sharing
- Referral code displayed in secure input field

#### Earnings Summary
- **Total Referrals**: Count of all users referred
- **Pending Earnings**: Money ready for payout (minimum $100)
- **Total Earned**: Lifetime referral earnings

#### PayPal Integration
- PayPal email configuration with validation
- One-click payout request (minimum $10 balance)
- Real-time feedback on payout status

#### Referral List
- Display of all referred users
- Email addresses of referrals
- Subscription status of each referral
- Activation dates

### 3. Earnings Structure
```
Weekly Subscription: $25.00
  → Referrer Earns: $7.50 (30%)

Monthly Subscription: $89.00
  → Referrer Earns: $26.70 (30%)
```

### 4. Backend Referral Endpoints

#### GET `/api/referral/code`
Returns user's referral code and earnings.

Response:
```json
{
  "referralCode": "REF12AB34CD",
  "referralLink": "http://localhost:3000/?ref=REF12AB34CD",
  "earnings": {
    "total": 26.70,
    "pending": 7.50,
    "paid": 19.20
  }
}
```

#### GET `/api/referral/dashboard`
Returns full referral dashboard data.

Response:
```json
{
  "referralCode": "REF12AB34CD",
  "earnings": {
    "total": 26.70,
    "pending": 7.50,
    "paid": 19.20
  },
  "referralCount": 5,
  "activeReferrals": 3,
  "paypalEmail": "user@example.com",
  "referrals": [
    {
      "email": "friend@example.com",
      "plan": "monthly",
      "subscriptionActive": true,
      "activatedAt": "2026-04-10T12:00:00Z"
    }
  ]
}
```

#### POST `/api/referral/set-paypal-email`
Stores user's PayPal email for payouts.

Request:
```json
{
  "paypalEmail": "user@example.com"
}
```

#### POST `/api/referral/track-signup`
Validates referral code during signup (called when user signs up with ref parameter).

Request:
```json
{
  "referralCode": "REF12AB34CD"
}
```

Response:
```json
{
  "ok": true,
  "referrerId": "user-uuid-here"
}
```

#### POST `/api/referral/award-earnings`
Awards earnings when a referral makes their first purchase.

Request:
```json
{
  "referrerId": "referrer-uuid",
  "plan": "monthly"
}
```

Response:
```json
{
  "ok": true,
  "message": "Awarded $26.70 referral earnings.",
  "earnings": {
    "total": 26.70,
    "pending": 26.70,
    "paid": 0
  }
}
```

#### POST `/api/referral/request-payout`
Initiates a payout to the user's PayPal account (minimum $10 pending).

Response:
```json
{
  "ok": true,
  "message": "Payout of $26.70 processed and sent to user@example.com",
  "earnings": {
    "total": 26.70,
    "pending": 0,
    "paid": 26.70
  },
  "transactionId": "batch-uuid-here"
}
```

### 5. PayPal Integration

#### Token Management
- Automatic OAuth token generation using Client ID and Secret
- Token caching with 1-hour expiration
- Automatic refresh on expiration

#### Payout Processing
- Batch payouts via PayPal Payouts REST API
- Support for both Sandbox (testing) and Production
- Fallback logging if PayPal unavailable
- Transaction ID tracking for audit trail

#### Configuration
Add to `.env.local`:
```
PAYPAL_MODE=sandbox
PAYPAL_CLIENT_ID=your_client_id
PAYPAL_CLIENT_SECRET=your_client_secret
```

## User Data Structure

Each user now includes:
```javascript
{
  id: "uuid",
  email: "user@example.com",
  passwordHash: "hashed",
  subscription: {
    active: true,
    plan: "monthly",
    activatedAt: "2026-04-10T12:00:00Z"
  },
  referralCode: "REF12AB34CD",
  referrerId: "referrer-uuid or null",
  referralEarnings: {
    total: 26.70,      // All earnings in lifetime
    pending: 7.50,     // Ready for payout (min $10)
    paid: 19.20        // Already paid out
  },
  paypalEmail: "user-paypal@example.com",
  lastPayoutDate: "2026-04-12T10:30:00Z",
  lastPayoutTransactionId: "batch-uuid"
}
```

## User Flow

### 1. Referral Signup
1. Existing user shares code with friend
2. Friend visits `/?ref=REF12AB34CD`
3. Friend creates account (ref code linked to their profile)
4. Friend is recorded as referral of original user

### 2. Earning Commission
1. Referred user purchases subscription (monthly or weekly)
2. System calls `/api/referral/award-earnings`
3. 30% amount added to referrer's pending earnings
4. Referrer sees updated dashboard

### 3. Requesting Payout
1. User navigates to Referral Program section
2. Adds/updates their PayPal email
3. Clicks "Request Payout" when balance ≥ $100
4. System initiates PayPal transfer
5. Funds sent to PayPal email within 24-48 hours
6. Earnings moved from "Pending" to "Paid"

## Security Features

### Data Protection
- Referral codes are unique and immutable
- PayPal emails validated before saving
- API keys required for all endpoints
- JWT token authentication on sensitive endpoints

### Payout Safety
- Minimum $10 threshold prevents fraud
- PayPal email validation required
- Transaction IDs logged for audits
- Failed payouts are retried with logging

## Frontend Components

### Files Modified
1. **index.html**
   - Added Referral Program section with:
     - Referral code display with copy button
     - Earnings summary cards
     - PayPal email input
     - Payout request button
     - Referral list display

2. **app.js**
   - Added `loadReferralDashboard()` - Fetches and displays referral data
   - Added `setReferralStatus()` - Updates PayPal email status messages
   - Added `setPayoutStatus()` - Updates payout status messages
   - Added `setupReferralSystem()` - Initializes all event listeners
   - Integrated referral loading with auth flow

### Event Listeners
- **Copy Code Button**: Copies referral code to clipboard
- **Save PayPal Email**: Validates and stores PayPal email
- **Request Payout**: Initiates payout to PayPal account
- **Auto-refresh**: Dashboard refreshes on successful auth

## Testing the System

### Manual Testing Steps

1. **Create Account**
   ```
   Register: user1@test.com / password123
   Get Referral Code: REF... (auto-generated)
   ```

2. **Share Code**
   ```
   Copy referral code
   Share link: http://localhost:3000/?ref=REF...
   ```

3. **Sign Up with Referral**
   ```
   Register: user2@test.com / password456
   (ref code from URL auto-linked)
   ```

4. **Make Purchase**
   ```
   Login as user2
   Buy Monthly subscription ($89)
   ```

5. **Check Referral Earnings**
   ```
   Login as user1
   View Referral Program section
   Should see: $26.70 pending earnings
   user2@test.com in referral list
   (Note: Need at least $100 to request payout)
   ```

6. **Request Payout**
   ```
   Add PayPal email: testpaypal@example.com
   (Accumulate at least $100 in pending earnings first)
   Click "Request Payout"
   Verify: Earnings moved to "Paid" section
   ```

## Error Handling

### Common Error Messages

| Scenario | Message |
|----------|---------|
| PayPal email not set | "PayPal email not configured. Please add it first." |
| Balance < $100 | "Minimum payout amount is $100. Current pending: $..." |
| Invalid email | "Valid PayPal email is required." |
| Not signed in | "Sign in to view referral details." |
| PayPal API error | "Failed to process payout: [error details]" |

## Future Enhancements

1. **Tiered Rewards**: Different commission rates for different subscription levels
2. **Lifetime Commissions**: Earn recurring percentages on renewals
3. **Bonus Programs**: Extra bonuses for reaching referral milestones
4. **Fraud Detection**: Automated detection of suspicious referral patterns
5. **Webhook Notifications**: Real-time alerts for new referrals and payouts
6. **Leaderboard**: Display top referrers and their earnings
7. **Affiliate Links**: Custom URLs instead of just codes
8. **Payment Methods**: Support for bank transfers, wire transfers, etc.

## Maintenance & Monitoring

### Regular Tasks
- Monitor failed payouts in server logs
- Verify PayPal account balance
- Review suspicious referral patterns
- Update commission rates as needed
- Backup user earnings data

### Logging
- Successful payouts: `[PAYOUT SUCCESS]`
- Failed payouts: `[PAYOUT] [FALLBACK]` in logs
- API errors: Detailed error messages with timestamps

## Configuration Checklist

Before launching referrals in production:

- [ ] Set `PAYPAL_CLIENT_ID` in .env.local
- [ ] Set `PAYPAL_CLIENT_SECRET` in .env.local  
- [ ] Set `PAYPAL_MODE=sandbox` for testing
- [ ] Create test PayPal accounts for sandbox
- [ ] Test complete referral flow end-to-end
- [ ] Verify payout emails are received
- [ ] Switch to production credentials
- [ ] Enable email notifications for payouts
- [ ] Set up monitoring and alerts
- [ ] Document referral program for users

---

**Status**: ✓ Complete
**Version**: 1.0
**Last Updated**: April 2026
