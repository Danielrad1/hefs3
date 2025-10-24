# StoreKit Testing Setup

## Why You Need This

Your subscription product (`com.enqode.app.pro.sub.monthly`) isn't in App Store Connect yet, so you can't test purchases. A StoreKit Configuration file creates a **local test environment** in the simulator.

## Steps (5 minutes)

### 1. Open Xcode Project

```bash
cd ios
open enqode.xcworkspace
```

### 2. Create StoreKit Configuration File

1. In Xcode, go to **File** → **New** → **File...**
2. Search for **"StoreKit"**
3. Select **"StoreKit Configuration File"**
4. Click **Next**
5. Name it: **`Configuration.storekit`**
6. Save it in the `ios/` directory (same level as `enqode.xcworkspace`)

### 3. Add Your Subscription Product

In the newly created `Configuration.storekit` file:

1. Click the **+** button at the bottom left
2. Select **"Add Subscription Group"**
3. Click on "Subscription Group" and set:
   - **Reference Name**: `Pro Subscription`

4. Click the **+** inside the group
5. Select **"Add Auto-Renewable Subscription"**
6. Configure the subscription:
   - **Product ID**: `com.enqode.app.pro.sub.monthly`
   - **Reference Name**: `Pro Monthly`
   - **Subscription Duration**: `1 Month`
   - **Price**: `9.99`
   - **Locale**: `English (U.S.)` → `USD`

7. Click **Review Changes in Editor** at the bottom

### 4. Enable StoreKit Configuration in Scheme

1. In Xcode, click the scheme selector (top left, says "enqode")
2. Select **"Edit Scheme..."**
3. Select **"Run"** on the left sidebar
4. Go to **"Options"** tab
5. Under **StoreKit Configuration**, select `Configuration.storekit`
6. Click **Close**

### 5. Rebuild and Test

```bash
npx expo run:ios
```

Now when the app loads:
- RevenueCat will fetch the product from the local StoreKit file
- The paywall will show `$9.99/month`
- You can test the purchase flow (sandbox - no real charges)

## Testing Purchases

### Make a Test Purchase

1. Tap "Subscribe Now" in the paywall
2. Simulator will show a **confirmation dialog**
3. Click **Subscribe**
4. Purchase completes instantly (sandbox)

### Test Scenarios

**Successful Purchase:**
- Subscribe → Should see success
- App should unlock premium features
- Check logs for: `[Premium] Customer info updated`

**Restore Purchases:**
- Settings → Restore Purchases
- Should restore your test subscription

**Sandbox Renewal:**
- Sandbox subscriptions renew every **5 minutes** (compressed schedule)
- Real production subscriptions renew monthly

## Verification

After setup, you should see in logs:

```
✅ [RevenueCat] Offerings loaded successfully
✅ [Premium] Monthly package found
✅ Paywall displays: "$9.99/month"
```

## Production Checklist

Before going live, you must:

1. **Create the product in App Store Connect:**
   - Go to [App Store Connect](https://appstoreconnect.apple.com)
   - Select your app
   - Go to **Features** → **In-App Purchases**
   - Click **+** to add a subscription
   - Match the Product ID: `com.enqode.app.pro.sub.monthly`
   - Set price: $9.99
   - Set duration: 1 month
   - Submit for review

2. **Remove StoreKit Configuration from scheme:**
   - Edit Scheme → Run → Options
   - Set StoreKit Configuration to **None**

3. **Test with real sandbox Apple ID:**
   - Create test account in App Store Connect
   - Sign in on device with test account
   - Test real sandbox purchases

## Troubleshooting

### "Product not found" even with StoreKit file

- Make sure Product ID matches exactly: `com.enqode.app.pro.sub.monthly`
- Verify scheme has StoreKit Configuration selected
- Rebuild the app (not just reload)

### Paywall still shows spinner

- Check console for offering errors
- Verify StoreKit file is in the scheme
- Make sure you rebuilt (not just Metro reload)

### Purchase doesn't complete

- Sandbox environment requires an internet connection
- Check RevenueCat dashboard for the test purchase
- Verify webhook is receiving events

## Current Status

- ✅ RevenueCat SDK integrated
- ✅ Product created in RevenueCat dashboard
- ⚠️ Product NOT in App Store Connect (blocks production)
- ✅ Can test with StoreKit Configuration file (development only)
