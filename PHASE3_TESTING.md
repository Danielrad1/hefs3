# Phase 3: Cloud Backup Testing Guide

## What Was Implemented

### Backend
- ✅ `StorageService` - Generates signed URLs for Firebase Storage
- ✅ `/backup/url` endpoint - Returns signed URLs for upload/download
- ✅ `/backup/metadata` endpoint - Gets backup info
- ✅ `/backup` DELETE endpoint - Deletes backup
- ✅ Storage emulator configured
- ✅ Storage security rules

### Client
- ✅ `CloudBackupService` - Upload/download database
- ✅ `BackupSection` UI - Backup/Restore buttons with metadata
- ✅ Environment flag support
- ✅ Error handling and loading states

---

## Prerequisites

1. **Firebase Emulator Running**
   ```bash
   cd /Users/danielrad/Desktop/repos/hefs2/memorize-app/firebase/functions
   npm run serve
   ```

   This now starts:
   - Functions emulator: `http://10.0.0.90:5001`
   - Storage emulator: `http://10.0.0.90:9199`
   - UI: `http://localhost:4000`

2. **Cloud Backup Enabled**
   `.env.development` has `ENABLE_CLOUD_BACKUP=true` ✅

3. **Expo Running**
   ```bash
   npx expo start
   ```

---

## Testing Steps

### Test 1: First Backup Upload

1. **Open Settings** → Scroll to "DATA & STORAGE"

2. **Check Initial State**
   - Should see: "Backup to Cloud"
   - Subtitle: "No backup found"

3. **Tap "Backup to Cloud"**
   
   **Expected behavior:**
   - Loading spinner appears
   - Console logs show:
     ```
     [CloudBackup] Starting backup upload...
     [CloudBackup] Database size: XXXXX bytes
     [CloudBackup] Got signed URL, expires at: ...
     [CloudBackup] Upload successful!
     ```
   - Alert appears: "Database backup uploaded successfully!"
   - Subtitle updates to: "Last backup: Just now"

4. **Verify in Firebase Console**
   - Open: http://localhost:4000
   - Go to Storage tab
   - Should see: `backups/{your-uid}/latest.db`

---

### Test 2: Subsequent Backups

1. **Make Changes to Your Database**
   - Study some cards
   - Add a new deck
   - Import an .apkg file

2. **Tap "Backup to Cloud" Again**
   
   **Expected behavior:**
   - New backup overwrites old one
   - Subtitle shows: "Last backup: Just now"

---

### Test 3: Restore from Backup

1. **Create Some Test Data**
   - Study a few cards
   - Note how many cards you have

2. **Backup to Cloud**
   - Tap "Backup to Cloud"
   - Wait for success

3. **Change Local Data**
   - Delete a deck (or clear all data)
   - App should show fewer cards

4. **Restore from Cloud**
   - Tap "Restore from Cloud"
   - Dialog appears: "This will replace your local database..."
   - Tap "Restore"

   **Expected behavior:**
   - Loading spinner
   - Console logs show:
     ```
     [CloudBackup] Starting backup download...
     [CloudBackup] Got signed URL for download
     [CloudBackup] Downloaded backup, size: XXXXX bytes
     [CloudBackup] Created local backup
     [CloudBackup] Restore successful!
     ```
   - App reloads with restored data
   - All your previous data is back!

---

### Test 4: View Backup Metadata

1. **Check Developer Tools**
   - Settings → Developer Tools
   - Tap "Show API URL"
   - Should show: `http://10.0.0.90:5001/hefs-b3e45/us-central1/api`

2. **Manually Test Metadata Endpoint**
   ```bash
   # Get your token from Developer Tools → Show Auth Token
   curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://10.0.0.90:5001/hefs-b3e45/us-central1/api/backup/metadata
   ```

   **Expected response:**
   ```json
   {
     "success": true,
     "data": {
       "exists": true,
       "timestamp": 1759955000000,
       "size": 123456,
       "contentType": "application/json"
     }
   }
   ```

---

### Test 5: Error Handling

**Test when not authenticated:**
1. Sign out
2. Sign back in
3. Try backup - should work

**Test network error:**
1. Stop Firebase emulator
2. Try backup
3. Should show error: "Failed to upload backup"

**Test with no existing backup:**
1. Check Settings - should only show "Backup to Cloud"
2. No "Restore from Cloud" button until backup exists

---

## What to Look For

### ✅ Success Indicators

- **Backup Button:**
  - Shows "No backup found" initially
  - Shows "Last backup: Xm ago" after upload
  - Loading spinner during operation

- **Restore Button:**
  - Only appears when backup exists
  - Confirmation dialog before restoring
  - App reloads with restored data

- **Console Logs:**
  - No errors in logs
  - All CloudBackup operations log clearly
  - Signed URL generation succeeds

- **Firebase Console:**
  - Storage tab shows backup file
  - File size matches database
  - Timestamp updates on new backup

### ❌ Common Issues

**"Network request failed"**
- Firebase emulator not running
- Wrong IP in .env.development
- Emulator not bound to 0.0.0.0

**"Failed to generate signed URL"**
- Storage emulator not running
- Check `firebase.json` has storage config
- Check storage.rules exists

**"Backup is empty"**
- Database file path incorrect
- PersistenceService.save() failed
- File permissions issue

**Restore button not appearing**
- Metadata endpoint failing
- Token expired (sign out/in)
- Backup actually doesn't exist

---

## Expected File Structure

After successful backup, Firebase Storage should have:

```
backups/
└── {your-user-id}/
    └── latest.db (JSON file with database)
```

The file contains your entire database in JSON format:
- All decks
- All notes and cards
- All review history
- All media references

---

## Next Steps After Testing

Once backup/restore works:

1. **Deploy to Production**
   ```bash
   cd firebase
   firebase deploy --only functions,storage
   ```

2. **Update Production Config**
   - Edit `.env.production`
   - Set production API URL

3. **Test on Real Device**
   - Build production app
   - Test backup/restore with real Firebase Storage

4. **Optional Enhancements**
   - Add backup history (multiple backups)
   - Add encryption for backups
   - Add automatic scheduled backups
   - Add backup size indicator

---

## Troubleshooting

### Check Emulator Status
```bash
# Should show both functions and storage
curl http://10.0.0.90:5001/hefs-b3e45/us-central1/api/health
curl http://10.0.0.90:9199  # Storage emulator
```

### Check Logs
```bash
# Firebase emulator logs
cd firebase/functions
npm run logs

# Mobile app logs
# Already visible in Metro bundler
```

### Reset Everything
```bash
# Stop emulators
# Clear emulator data
rm -rf ~/.config/firebase/emulators

# Restart
cd firebase/functions
npm run serve
```

---

## Success! 🎉

If all tests pass, you now have:
- ✅ Working cloud backup
- ✅ Working restore
- ✅ Metadata tracking
- ✅ Secure signed URLs
- ✅ User-specific storage

**Phase 3 Complete!** Ready for Phase 4 (Discover) or Phase 5 (AI Features).
