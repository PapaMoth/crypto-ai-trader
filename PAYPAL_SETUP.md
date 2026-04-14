# PayPal Integration Setup Guide

This guide explains how to set up PayPal integration for the referral payout system in Nexus AI Trading.

## Overview

The referral system allows users to earn 30% of their referrals' first purchase. When they request a payout with a minimum balance of $10, funds are automatically transferred to their PayPal email address via PayPal's REST API.

## Prerequisites

1. A PayPal Business Account (https://www.paypal.com/us/business)
2. Access to PayPal's Developer Portal (https://developer.paypal.com)

## Step 1: Create a PayPal App

1. Go to https://developer.paypal.com/dashboard/
2. Sign in with your PayPal account
3. In the left sidebar, click **Apps & Credentials**
4. Make sure you're on the **Sandbox** tab (for testing) or **Production** tab (for live)
5. Click **Create App** under the REST API section
6. Name your app (e.g., "Nexus AI Referrals")
7. Click **Create App**

## Step 2: Get Your Credentials

After creating the app, you'll see:

- **Client ID**: The public identifier for your app
- **Secret**: The private key (keep this secure!)

You'll see these under the app name in the Apps & Credentials page.

## Step 3: Configure Environment Variables

Open `.env.local` in the project directory and update these fields:

```
PAYPAL_MODE=sandbox
PAYPAL_CLIENT_ID=YOUR_CLIENT_ID_HERE
PAYPAL_CLIENT_SECRET=YOUR_CLIENT_SECRET_HERE
PAYPAL_SIGNATURE=YOUR_SIGNATURE_HERE
```

### For Testing (Sandbox)
- Keep `PAYPAL_MODE=sandbox`
- Use the credentials from the Sandbox tab
- Create sandbox test accounts to test the flow

### For Production (Live)
- Change `PAYPAL_MODE=production`
- Use the credentials from the Production tab
- Enable **Payouts** in your app capabilities
- Ensure your PayPal Business account is fully verified

## Step 4: Enable Payouts Capability

1. In the PayPal Developer Portal, go to your app
2. Look for **App Settings** or **Permissions**
3. Ensure these permissions are enabled:
   - **PayPal Payouts** (to transfer funds)
   - **Access Merchant Account** (to manage payouts)

## How It Works

### User Flow
1. User shares their referral code with others
2. When someone uses the code to sign up and makes a purchase, they become a referral
3. The referrer earns 30% of that purchase:
   - Monthly subscription ($89) → $26.70 referral
   - Weekly subscription ($25) → $7.50 referral
4. Earnings accumulate in their "Pending Earnings"
5. When they request a payout and have ≥ $10 pending:
   - System validates their PayPal email
   - Transfers funds via PayPal API
   - Updates their earnings to "Paid"

### API Integration

The server implements:
- **Token Generation**: Authenticates with PayPal using your credentials
- **Batch Payouts**: Sends funds to multiple PayPal email addresses
- **Fallback Mode**: If PayPal is unavailable, logs the payout locally
- **Error Handling**: Gracefully handles failed transfers and retries

## Testing the Integration

### Sandbox Testing

1. Create a Business Account:
   - Go to https://developer.paypal.com/dashboard/
   - Create a **Business** sandbox account
   - Note the email and password

2. Create a Personal Account:
   - Create a **Personal** sandbox account
   - This will receive the test payouts

3. Test the Payout Flow:
   - Sign up with the Business account
   - Add a referral code from another user (accumulate at least $100 in pending earnings)
   - Request a payout to a Personal account email
   - Check the PayPal sandbox for the transfer

### Live Testing

Once ready for production:
1. Switch `PAYPAL_MODE=production`
2. Use live credentials from the Production tab
3. Ensure your PayPal account is verified
4. Test with small amounts first

## Troubleshooting

### "PayPal credentials missing" Warning
- Ensure `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` are set in `.env.local`
- Verify there are no typos in the environment variable names

### "Failed to process payout" Error
- Check that your PayPal credentials are correct
- Verify the PayPal email address is valid
- Ensure you have enough balance in your PayPal account
- Check that Payouts capability is enabled in your app

### Token Expiration
- The system automatically caches and refreshes tokens
- If issues persist, restart the server

## Security Best Practices

1. **Never commit .env.local** to version control
2. **Use different credentials** for sandbox and production
3. **Keep secrets private** - don't share your Client Secret
4. **Monitor payouts** regularly for suspicious activity
5. **Validate PayPal emails** before processing payouts

## Production Deployment

Before going live:
1. Complete full PayPal account verification
2. Enable 2FA on your PayPal account
3. Set up webhooks for payout notifications (optional)
4. Test end-to-end with small amounts
5. Implement logging and monitoring
6. Set up alerts for failed payouts

## Additional Resources

- PayPal API Documentation: https://developer.paypal.com/docs/
- Payouts API Reference: https://developer.paypal.com/docs/api/payouts/v1/
- PayPal Sandbox: https://sandbox.paypal.com/

## Support

For PayPal API issues:
- Visit https://developer.paypal.com/docs/
- Check the API status page
- Contact PayPal Developer Support

For application issues:
- Check server logs for detailed error messages
- Verify all environment variables are set correctly
- Restart the server after updating credentials
