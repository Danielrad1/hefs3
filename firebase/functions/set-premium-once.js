const admin = require('firebase-admin');

admin.initializeApp();

async function setPremium() {
  try {
    const userId = 'VuauNWwUaTaZLImgP4MZ0fYDTcA2';
    
    console.log(`Setting premium claim for user: ${userId}`);
    
    await admin.auth().setCustomUserClaims(userId, { premium: true });
    
    console.log('✅ Premium claim set successfully!');
    console.log('');
    console.log('IMPORTANT: User needs to sign out and sign back in for changes to take effect.');
    
    // Verify it was set
    const user = await admin.auth().getUser(userId);
    console.log('Verified custom claims:', user.customClaims);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

setPremium();
