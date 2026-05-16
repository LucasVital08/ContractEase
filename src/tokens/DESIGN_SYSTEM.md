# ContractEase Design System

## Overview

The ContractEase design system is built on a comprehensive token library that ensures visual consistency, maintainability, and scalability across the application.

**Token Location**: `src/tokens/`

---

## Token Categories

### 1. **Colors** (`colors.ts`)

The color system is organized into semantic groups:

#### Neutral Palette
- `neutral.950` - Main background (#0a0a0a)
- `neutral.900` - Panels and secondary backgrounds (#171717)
- `neutral.400` - Secondary text (#a3a3a3)
- `neutral.100` - Light text/borders (#f5f5f5)

#### Semantic Colors
- **Success/Primary**: Emerald (#10b981)
  - Used for: Active status, CTA buttons, positive actions
- **Warning/Secondary**: Amber (#f59e0b)
  - Used for: Pending status, alerts, warnings
- **Error/Tertiary**: Red (#ef4444)
  - Used for: Failed status, destructive actions, errors
- **Info**: Blue (#3b82f6)
  - Used for: Information, secondary CTAs, hints

#### Status Badges
Pre-configured color combinations for contract status indicators:

```typescript
colors.status.active    // Success state (emerald)
colors.status.pending   // Warning state (amber)
colors.status.failed    // Error state (red)
colors.status.completed // Completion state (green)
```

#### Glass Effect
Frosted glass style used for modals and overlays:

```typescript
colors.glass.bg     // rgba(23, 23, 23, 0.7)
colors.glass.border // rgba(255, 255, 255, 0.05)
```

**Usage in React**:
```tsx
import { colors } from '@/tokens';

// In component
<div style={{ backgroundColor: colors.neutral[900] }}>
  <p style={{ color: colors.text.primary }}>Text</p>
</div>

// In Tailwind
<div className="bg-neutral-900 text-white">
  <p className="text-neutral-400">Secondary text</p>
</div>
```

---

### 2. **Typography** (`typography.ts`)

Organized for different content types:

#### Font Families
- **Sans**: Inter (body text, UI labels)
- **Display**: Bricolage Grotesque (headings, stats)
- **Mono**: Fira Code (code blocks, IDs, technical text)

#### Font Sizes
Following Tailwind scale (xs to 8xl):
- `text-sm` (14px) - Small labels, captions
- `text-base` (16px) - Body text
- `text-2xl` (24px) - Section headings
- `text-3xl` (30px) - Page titles
- `text-8xl` (96px) - Large display numbers

#### Predefined Text Styles
Use semantic style objects for consistent typography:

```typescript
typography.styles.h1      // Page titles
typography.styles.h2      // Section headings
typography.styles.h3      // Subsection headings
typography.styles.body    // Body paragraphs
typography.styles.label   // Form labels
typography.styles.caption // Small helper text
typography.styles.code    // Code blocks
typography.styles.stat    // Large statistics
```

**Usage in React**:
```tsx
import { typography } from '@/tokens';

// Using Tailwind classes
<h2 className="text-2xl font-bold font-bricolage">Section Title</h2>
<p className="text-sm text-neutral-400">Helper text</p>

// Using predefined styles
<div style={typography.styles.h1}>Page Title</div>
```

---

### 3. **Spacing** (`spacing.ts`)

Consistent spacing scale following Tailwind:

#### Common Values
- `p-4` (16px) - Standard padding
- `p-6` (24px) - Large padding
- `p-8` (32px) - Extra large padding
- `gap-6` (24px) - Grid/flex gaps
- `mb-4` (16px) - Margins

#### Semantic Spacing
- `containerPadding` - Mobile/tablet padding
- `containerPaddingLg` - Desktop padding
- `gapMd` - Standard gap between elements
- `paddingMd` - Standard component padding

**Usage**:
```tsx
// In Tailwind
<div className="p-6 gap-4">
  <div className="mb-4">Content</div>
</div>

// With tokens
import { spacing } from '@/tokens';
<div style={{ padding: spacing[6], marginBottom: spacing[4] }}>
```

---

### 4. **Shadows** (`shadows.ts`)

Depth and elevation effects:

#### Standard Shadows
- `shadow-md` - Subtle elevation (cards)
- `shadow-lg` - Medium elevation (dialogs)
- `shadow-xl` - Large elevation (floating elements)
- `shadow-2xl` - Strong elevation

#### Custom Shadows
- `premium-shadow` - Premium effect for important elements
- `subtle` - Very subtle shadow
- `elevated` - For floating UI elements
- `focus` - Focus ring indicator

#### Focus States
```tsx
// Focus ring for interactive elements
className="focus:shadow-[0_0_0_3px_rgba(16,185,129,0.3)]"

// Or use token
className="focus-ring"
```

**Usage**:
```tsx
<div className="shadow-lg rounded-2xl p-6">
  Card with elevation
</div>

// Premium effects for important sections
<div className="shadow-premium">Important section</div>
```

---

### 5. **Animations** (`animations.ts`)

Motion library presets for consistent interactions:

#### Animation Durations
- `fast` (150ms) - Quick feedback
- `base` (300ms) - Standard animation
- `slow` (500ms) - Emphasis animations
- `slower` (700ms) - Page transitions

#### Predefined Variants (Framer Motion)
```typescript
animations.variants.fadeIn         // Opacity animation
animations.variants.slideInFromTop // Slide + fade
animations.variants.scaleIn        // Scale + fade
animations.variants.zoomIn         // Larger scale
animations.variants.modalContent   // Modal entrance
animations.variants.listItem       // Item in list (staggered)
```

**Usage in React**:
```tsx
import { motion } from 'motion/react';
import { animations } from '@/tokens';

// Using predefined variants
<motion.div {...animations.variants.fadeIn}>
  Fading in...
</motion.div>

// Using custom animation
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3 }}
>
  Content
</motion.div>

// Staggered list items
<motion.div {...animations.variants.listContainer}>
  {items.map(item => (
    <motion.div key={item.id} {...animations.variants.listItem}>
      {item.name}
    </motion.div>
  ))}
</motion.div>
```

---

## Usage Patterns

### 1. Component Styling with Tokens

**In TypeScript/React**:
```tsx
import { colors, spacing, typography } from '@/tokens';

export default function Card({ title, children }) {
  return (
    <div
      className="bg-neutral-900 border border-white/10 rounded-2xl p-6"
      style={{
        backgroundColor: colors.background.secondary,
        borderColor: colors.border.default,
        padding: spacing[6],
      }}
    >
      <h3 className="text-2xl font-bold font-bricolage text-white">
        {title}
      </h3>
      <div className="text-neutral-400 text-sm">
        {children}
      </div>
    </div>
  );
}
```

### 2. Status Badge Pattern

```tsx
import { colors } from '@/tokens';

const statusColors = {
  active: colors.status.active,
  pending: colors.status.pending,
  failed: colors.status.failed,
  completed: colors.status.completed,
};

export default function StatusBadge({ status, label }) {
  const badge = statusColors[status];
  
  return (
    <span
      className="px-3 py-1 rounded-full text-sm font-medium"
      style={{
        backgroundColor: badge.bg,
        borderColor: badge.border,
        color: badge.text,
        border: `1px solid ${badge.border}`,
      }}
    >
      {label}
    </span>
  );
}
```

### 3. Form Input Pattern

```tsx
import { colors, spacing } from '@/tokens';

export default function FormInput({ label, placeholder }) {
  return (
    <div style={{ marginBottom: spacing[4] }}>
      <label className="text-sm font-medium text-neutral-400 block mb-1">
        {label}
      </label>
      <input
        className="w-full rounded-lg px-4 py-3 focus:outline-none transition-colors"
        placeholder={placeholder}
        style={{
          backgroundColor: colors.background.input,
          color: colors.text.primary,
          borderColor: colors.border.default,
          border: `1px solid ${colors.border.default}`,
        }}
        onFocus={(e) => {
          e.target.style.borderColor = colors.border.focus;
        }}
        onBlur={(e) => {
          e.target.style.borderColor = colors.border.default;
        }}
      />
    </div>
  );
}
```

### 4. Modal with Animation

```tsx
import { motion, AnimatePresence } from 'motion/react';
import { animations, colors } from '@/tokens';

export default function Modal({ isOpen, onClose, children }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            {...animations.variants.modalOverlay}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />
          <motion.div
            {...animations.variants.modalContent}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 glass-panel rounded-2xl p-8 max-w-md"
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

---

## Implementation Guidelines

### When to Use Tailwind Classes
- Quick prototyping
- Standard utility usage
- One-off styling

**Example**:
```tsx
<div className="bg-neutral-900 p-6 rounded-2xl border border-white/10">
  Content
</div>
```

### When to Use Token Values Directly
- Complex conditional styling
- Dynamic values
- Reusable style objects
- Design system consistency

**Example**:
```tsx
import { colors } from '@/tokens';

const getStatusColor = (status) => colors.status[status]?.text;

<span style={{ color: getStatusColor(contractStatus) }}>
  {contractStatus}
</span>
```

---

## Color Contrast & Accessibility

All color combinations meet WCAG AA standards:

- **Text on backgrounds**: White text on neutral-900 (contrast ~18:1)
- **Semantic colors**: All colors have sufficient contrast for readability
- **Focus indicators**: Focus ring uses emerald at 0.3 opacity for clear indication

---

## Dark Mode & Future Theme Support

Currently, ContractEase uses **dark mode only**. The token structure is designed for future light mode support:

- All colors are organized semantically
- Neutral palette can be inverted for light themes
- Semantic colors have full scale definitions

To implement light mode:
1. Add theme variants to color tokens
2. Create Tailwind dark/light theme configuration
3. Add theme toggle to UI store

---

## Token Maintenance

### Adding New Tokens

1. Add to appropriate token file (`colors.ts`, `typography.ts`, etc.)
2. Export from `index.ts`
3. Update documentation in this file
4. Use in components with `import { tokenName } from '@/tokens'`

### Deprecating Tokens

1. Mark as deprecated in comments
2. Update all usages to new tokens
3. Remove after a reasonable transition period

### Versioning

Current version: **1.0.0**

Breaking changes require major version bump.

---

## Resources

- **Tokens Directory**: `src/tokens/`
- **Tailwind Config**: `tailwind.config.js`
- **Global Styles**: `src/index.css`
- **Motion Library Docs**: https://motion.dev
- **Tailwind Docs**: https://tailwindcss.com

---

## Quick Reference

| Category | Key File | Main Purpose |
|----------|----------|--------------|
| Colors | `colors.ts` | Color palette, semantic colors, status states |
| Typography | `typography.ts` | Font families, sizes, weights, line heights |
| Spacing | `spacing.ts` | Padding, margin, gap values |
| Shadows | `shadows.ts` | Elevation, depth effects, box shadows |
| Animations | `animations.ts` | Motion presets, durations, easing |

**Import all**: `import { colors, typography, spacing, shadows, animations } from '@/tokens'`
