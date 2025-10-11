# 🎨 Deck Customization System

## Overview
A comprehensive deck customization system that gives users total control over the visual appearance of their decks with icons, colors, and folder organization.

## ✨ Features

### 1. **Custom Icons**
- **48+ Professional Icons**: Book, language, medical, code, music, sports, and more
- **Emoji Support**: Use any emoji (📚, 🎓, 💻, etc.)
- **Visual Icon Container**: Colored circles with white icons

### 2. **Custom Colors**
- **18 Beautiful Colors**: From red to pink, covering the full spectrum
- **Automatic Tinting**: Background, borders, and stats all use the custom color
- **Color Previews**: See your changes before saving

### 3. **Folder Organization**
- **Hierarchical Structure**: Organize decks like "Languages/Spanish" or "Work/Projects"
- **Folder Path Display**: Shows folder above deck name
- **Easy Management**: Type any folder path

### 4. **Visual Enhancements**
- **Colored Backgrounds**: Subtle tinted backgrounds (color + 15% opacity)
- **Colored Borders**: 4px left border in custom color
- **Colored Stats**: "Due" count uses the custom color
- **Icon Containers**: 40x40 rounded squares with custom color background

## 📱 How to Use

### Access Customization
1. **Long press** any deck card
2. Select **"Customize"** from the action sheet
3. Or tap the **"⋯"** menu → **"Customize"**

### Customize Your Deck

#### **Icons**
- Toggle between **Icons** and **Emoji**
- **Icons Tab**: Tap any icon to select (48+ options)
- **Emoji Tab**: Type or paste any emoji (e.g., 📚, 🎓)

#### **Colors**
- Tap any color circle to select
- Selected color shows a checkmark
- 18 colors available

#### **Folders**
- Type folder path (e.g., "Languages/Spanish")
- Use `/` to create hierarchy
- Leave blank for no folder

### Preview & Save
- **Preview section** shows your changes in real-time
- **Clear All**: Remove all customizations
- **Save**: Apply changes to your deck

## 🎯 Use Cases

### Language Learning
```
📚 Spanish (Blue) → Folder: "Languages"
🇫🇷 French (Red) → Folder: "Languages"
🇩🇪 German (Yellow) → Folder: "Languages"
```

### Academic Subjects
```
🧬 Biology (Green) → Folder: "Science"
⚛️ Chemistry (Purple) → Folder: "Science"
🔬 Physics (Blue) → Folder: "Science"
```

### Professional
```
💻 JavaScript (Orange) → Folder: "Programming/Frontend"
🐍 Python (Blue) → Folder: "Programming/Backend"
🗄️ SQL (Teal) → Folder: "Programming/Database"
```

### Medical
```
🫀 Cardiology (Red) → Folder: "Medicine/Systems"
🧠 Neurology (Purple) → Folder: "Medicine/Systems"
💊 Pharmacology (Green) → Folder: "Medicine/Treatment"
```

## 🏗️ Architecture

### Files Created
1. **DeckMetadataService.ts** - Manages metadata storage
2. **DeckCustomizationModal.tsx** - Beautiful customization UI
3. **DeckCard.tsx** (updated) - Shows customizations

### Data Storage
- **AsyncStorage**: Persists metadata across app restarts
- **Singleton Service**: `deckMetadataService`
- **Key**: `@deck_metadata`

### Data Structure
```typescript
interface DeckMetadata {
  deckId: string;
  icon?: string;      // Emoji or Ionicons name
  color?: string;     // Hex color (#EF4444)
  folder?: string;    // Path ("Languages/Spanish")
}
```

## 🎨 Design Principles

### Color System
- **18 Colors**: Curated palette from Tailwind CSS
- **Tinted Backgrounds**: 15% opacity for subtle effect
- **Colored Accents**: Borders, stats, and icons
- **High Contrast**: White icons on colored backgrounds

### Icon System
- **48 Icons**: Carefully selected for common categories
- **Emoji Support**: Unlimited customization
- **40x40 Container**: Consistent sizing
- **Rounded Corners**: 8px border radius

### UX Features
- **Real-time Preview**: See changes before saving
- **Toggle UI**: Easy switch between icons and emojis
- **Grid Layout**: 6 columns for easy browsing
- **Visual Feedback**: Selected states and checkmarks
- **Pull-up Modal**: Smooth slide-up animation

## 🚀 Future Enhancements

### Possible Additions
- [ ] Folder collapsible sections in deck list
- [ ] Deck templates (pre-configured icon+color sets)
- [ ] Import/export customizations
- [ ] Custom gradient backgrounds
- [ ] Icon search/filter
- [ ] Recently used colors
- [ ] Folder auto-complete
- [ ] Bulk customization for multiple decks

## 💡 Tips

### Best Practices
- **Use consistent colors** for related decks
- **Folders organize better** than long names
- **Emojis are memorable** and fun
- **Preview before saving** to avoid mistakes

### Color Psychology
- **Red**: Energy, urgency, action
- **Blue**: Trust, calm, focus
- **Green**: Growth, health, nature
- **Purple**: Creativity, wisdom
- **Orange**: Enthusiasm, confidence
- **Yellow**: Optimism, clarity

## 🎉 Result
Your deck screen is now a beautiful, organized, and personalized learning hub with total visual control!
