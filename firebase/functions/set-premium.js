const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp();

async function setPremium(email) {
  try {
    // Get user by email
    const user = await admin.auth().getUserByEmail(email);
    
    console.log(`Found user: ${user.uid} (${user.email})`);
    console.log('Current custom claims:', user.customClaims);
    
    // Set premium custom claim
    await admin.auth().setCustomUserClaims(user.uid, { premium: true });
    
    console.log('\n✅ Premium status set successfully!');
    console.log('The user needs to sign out and sign back in for the change to take effect.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Get email from command line argument
const email = process.argv[2];

if (!email) {
  console.error('Usage: node set-premium.js <email>');
  process.exit(1);
}

setPremium(email);
