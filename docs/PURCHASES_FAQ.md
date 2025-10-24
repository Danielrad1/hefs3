# Purchases FAQ

## General

### What do I get with Premium?

Premium unlocks:
- **Unlimited AI Deck Generation** - Create as many study decks as you need
- **Unlimited AI Hints** - Get smart hints on every difficult card
- **Advanced Statistics** - Detailed analytics and insights
- **All Color Themes** - Access to all premium visual themes
- **Priority Support** - Get help faster when you need it
- **Early Access** - Be first to try new features

### How much does Premium cost?

Premium is **$9.99/month** with no free trial. You can cancel anytime.

### Where can I manage my subscription?

iOS subscriptions are managed through your Apple ID:
1. Open **Settings** on your iPhone
2. Tap your **name** at the top
3. Tap **Subscriptions**
4. Find **Enqode** and manage from there

### How do I cancel?

1. Go to iPhone **Settings** → Your Name → **Subscriptions**
2. Select **Enqode**
3. Tap **Cancel Subscription**

Your premium access continues until the end of your billing period.

## Restoring Purchases

### How do I restore my subscription on a new device?

1. Open the app on your new device
2. Sign in with the **same Apple ID** you used to purchase
3. Go to **Settings** → **Account** → **Restore Purchases**

Your premium status will be restored immediately.

### The restore button isn't working

Make sure:
- You're signed in with the same Apple ID used for purchase
- You have an active internet connection
- Your subscription hasn't expired

If issues persist, contact support.

## Sandbox Testing (For Developers)

### How fast do sandbox renewals happen?

Sandbox uses a compressed renewal schedule:
- **1 week subscription** → renews every 3 minutes
- **1 month subscription** → renews every 5 minutes
- **1 year subscription** → renews every hour

### When does a cancelled subscription expire in sandbox?

After cancellation, the subscription remains active until its natural expiration. The app receives:
1. `CANCELLATION` event (premium stays active)
2. `EXPIRATION` event when period ends (premium revoked)

### How do I test the restore flow?

1. Purchase on Device A using sandbox Apple ID
2. On Device B, sign in with the **same Apple ID**
3. Tap **Settings** → **Restore Purchases**
4. Premium should activate immediately

## Troubleshooting

### I purchased but don't have premium

1. **Wait 1-2 minutes** - The webhook needs time to process
2. **Force quit and reopen** the app to refresh your token
3. Check **Settings** to confirm premium status
4. If still not working, tap **Restore Purchases**

### My premium expired but I'm still subscribed

This can happen if:
- The webhook failed (rare) - tap **Restore Purchases**
- Your payment method was declined - check your Apple ID payment settings
- There was a billing issue - resolve in App Store settings

### I want a refund

Refunds are handled by Apple, not Enqode:
1. Go to [reportaproblem.apple.com](https://reportaproblem.apple.com)
2. Sign in with your Apple ID
3. Find your Enqode subscription purchase
4. Request a refund

Apple typically processes refund requests within 48 hours.

## Technical Details

### How does the subscription sync work?

1. **Purchase Made** → RevenueCat processes through Apple
2. **Webhook Fired** → Our server receives the event
3. **Claims Updated** → Firebase custom claim set to `premium: true`
4. **App Refreshes** → Token refreshed, premium unlocked

### What happens if I'm offline?

Purchases require an internet connection. If offline:
- You cannot start a new subscription
- Existing premium status is checked from your local auth token
- Once online, the app syncs with the server

### Does premium sync across devices?

Yes! Premium is tied to your account (Firebase UID), not your device. Sign in on any device to access premium features.

### What data does RevenueCat collect?

RevenueCat collects:
- Anonymous app user ID (your Firebase UID)
- Purchase transactions
- Subscription status

RevenueCat does NOT collect:
- Your email address
- Personal information
- Usage data

See [RevenueCat's Privacy Policy](https://www.revenuecat.com/privacy) for full details.
