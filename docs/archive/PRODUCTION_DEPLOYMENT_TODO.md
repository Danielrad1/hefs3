# Production Deployment Checklist

## Before Submitting to App Store

### 1. Disable RevenueCat Entitlement Fallback ⚠️
**File**: `.env.production`

```bash
# Change this from true to false before production
ENABLE_RC_ENTITLEMENT_FALLBACK=false
```

**Why**: In production, the webhook should be the primary authority for premium status. The entitlement fallback is only for testing with StoreKit Configuration files (simulator).

**Current Status**:
- ✅ Development: `ENABLE_RC_ENTITLEMENT_FALLBACK=true` (for testing)
- ⚠️ Production: Must be `false` before App Store submission

---

### 2. Create Subscription Product in App Store Connect
**Status**: ⚠️ NOT DONE

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Select your app
3. Navigate to **Features** → **In-App Purchases**
4. Click **+** to add a new subscription
5. Configure:
   - **Product ID**: `com.enqode.app.pro.sub.monthly`
   - **Reference Name**: Pro Monthly
   - **Subscription Duration**: 1 month
   - **Price**: $9.99 USD
6. Submit for review

**Without this**: Users cannot make purchases in production (only simulator works)

---

### 3. Configure RevenueCat Webhook
**Status**: ✅ DONE

- **URL**: `https://us-central1-enqode-6b13f.cloudfunctions.net/api/iap/revenuecat/webhook`
- **Auth**: Bearer token (set via Firebase secret)
- **Events**: All subscription lifecycle events

---

### 4. Test Real Purchases with Sandbox Apple ID
**Status**: ⚠️ TODO

1. Create test Apple ID in App Store Connect
2. Sign out of regular Apple ID on test device
3. Sign in with sandbox Apple ID
4. Make a test purchase
5. Verify:
   - [ ] Webhook fires and updates Firebase claims
   - [ ] Premium features unlock immediately
   - [ ] Subscription persists after app restart
   - [ ] Restore purchases works on second device

---

### 5. Verify Apple Sign In Setup
**Status**: ⚠️ TODO

1. Open Xcode: `cd ios && open enqode.xcworkspace`
2. Select **enqode** target
3. Go to **Signing & Capabilities**
4. Verify **Sign in with Apple** capability is added
5. Select your team under Signing
6. Check "Automatically manage signing"

---

### 6. Update StoreKit Configuration for Xcode Scheme
**Status**: ✅ DONE (for testing)

Before production build, **remove** StoreKit Configuration from scheme:
1. Edit Scheme → Run → Options
2. Set StoreKit Configuration to **None**

---

## Environment Variables Summary

### Development (`.env.development`)
```bash
ENABLE_RC_ENTITLEMENT_FALLBACK=true  # ✅ Keep for testing
```

### Production (`.env.production`)
```bash
ENABLE_RC_ENTITLEMENT_FALLBACK=false  # ⚠️ Must be false
```

---

## Quick Command to Check Before Deployment

```bash
# Verify production env has fallback disabled
grep ENABLE_RC_ENTITLEMENT_FALLBACK .env.production
# Should output: ENABLE_RC_ENTITLEMENT_FALLBACK=false
```

---

## Testing Flow

### Simulator (Current)
1. ✅ StoreKit Configuration file active
2. ✅ Purchases work locally
3. ✅ Entitlement fallback enabled
4. ❌ Webhook doesn't fire (expected)

### Production
1. ✅ Real App Store transactions
2. ✅ Webhook fires on every event
3. ✅ Firebase claims updated
4. ✅ Premium unlocked via claims
5. ❌ Entitlement fallback disabled (webhook is authority)

---

## Notes

- Sandbox purchases renew every 5 minutes (compressed schedule)
- Real production subscriptions renew monthly
- Always test restore purchases on a second device
- Monitor Firebase Function logs for webhook events
- Check RevenueCat dashboard for successful transactions
