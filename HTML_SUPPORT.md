# 📝 HTML Support in Hints & Tips

## ✅ Fully Supported HTML Tags

Our `RenderHtml` component supports all these tags with proper styling:

### **Text Formatting**
```html
<strong>Bold text</strong>           → Blue/Pink bold text
<em>Italic text</em>                 → Gray italic text
<u>Underlined text</u>               → Underlined text
<mark>Highlighted text</mark>        → Blue/Pink background highlight
<code>inline code</code>             → Monospace with colored background
```

### **Mathematical Notation**
```html
H<sub>2</sub>O                       → H₂O (subscript)
E = mc<sup>2</sup>                   → E = mc² (superscript)
x<sub>1</sub> + x<sub>2</sub>        → x₁ + x₂
```

### **Structural**
```html
<div>Block content</div>             → Block-level container
<span>Inline content</span>          → Inline container
<br>                                 → Line break
<p>Paragraph</p>                     → Paragraph with spacing
```

### **Lists** (if needed)
```html
<ul>
  <li>Item 1</li>
  <li>Item 2</li>
</ul>
```

---

## 🎨 Color Coding

### **Hints (Blue: #3B82F6)**
- `<strong>` → Blue bold
- `<code>` → Blue text with light blue background
- `<mark>` → Blue text with light blue highlight

### **Tips (Pink: #EC4899)**
- `<strong>` → Pink bold
- `<code>` → Pink text with light pink background
- `<mark>` → Pink text with light pink highlight

---

## 📐 Examples from AI Prompts

### **Physics/Chemistry:**
```html
Uses 1/λ with (1/n<sub>1</sub><sup>2</sup> − 1/n<sub>2</sub><sup>2</sup>)
→ Uses 1/λ with (1/n₁² − 1/n₂²)

ρ = m/V
→ ρ = m/V (works as-is)

H<sub>2</sub>O
→ H₂O
```

### **Emphasis:**
```html
NOT <strong>mass alone</strong>; relates mass to space occupied
→ NOT mass alone (in blue); relates mass to space occupied

The discriminator is <strong>per-volume</strong>
→ The discriminator is per-volume (in blue/pink)
```

### **Code/Formulas:**
```html
<code>f_beats = |f₁ − f₂|</code>
→ Monospace with colored background
```

---

## ⚠️ What's NOT Supported

These tags won't render properly:
- ❌ `<img>` - Images (not in hints/tips)
- ❌ `<table>` - Tables
- ❌ `<a>` - Links (no interaction in modals)
- ❌ Complex CSS styling

---

## 🎯 Best Practices for AI

### **DO:**
✅ Use `<strong>` for emphasis  
✅ Use `<sub>` and `<sup>` for math  
✅ Use `<code>` for formulas  
✅ Use `<mark>` for highlighting key terms  
✅ Use `<br>` for line breaks  

### **DON'T:**
❌ Use `<img>` tags  
❌ Use inline `style` attributes  
❌ Use complex nested structures  
❌ Use `<a>` links  

---

## 📊 Current Styling

### **Both Hints & Tips:**
- Font size: 17px
- Line height: 26px
- Subscript/Superscript: 12px
- Code padding: 4px
- Code border radius: 6px

### **Consistent Design:**
- Same header layout
- Same padding (xl)
- Same content spacing
- Same icon badge size (48x48)

---

## ✅ Summary

**Fully supported for scientific content:**
- ✅ Bold (`<strong>`)
- ✅ Italic (`<em>`)
- ✅ Subscript (`<sub>`)
- ✅ Superscript (`<sup>`)
- ✅ Code (`<code>`)
- ✅ Highlight (`<mark>`)
- ✅ Underline (`<u>`)

**Perfect for:**
- Chemical formulas (H₂O, CO₂)
- Math equations (x², E = mc²)
- Physics notation (1/λ, ρ = m/V)
- Emphasis and highlighting
- Inline code snippets

Your AI can confidently use all these tags! 🎉
