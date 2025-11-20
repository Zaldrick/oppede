# Phase 3: Combat System - To-Do List 📝

## ✅ Completed Tasks

### 1. Core Battle System
- [x] **Battle Scene UI**: Layout, HP bars, XP bar, Move selector.
- [x] **Battle Logic**: Turn-based system, damage calculation, type effectiveness.
- [x] **Sprite Management**: Hybrid system (GIFs for animations, PNGs for static/fallback).
- [x] **Managers Refactoring**: Split `PokemonBattleScene` into modular managers (`BattleUIManager`, `BattleMenuManager`, `BattleSpriteManager`, etc.).

### 2. Inventory Integration
- [x] **Inventory UI**: Tabbed interface, pagination, category filtering.
- [x] **Battle Inventory**: Filter items usable in battle (Pokéballs, Potions, Status Heals).
- [ ] **Visual Fix**: (Reverted) User prefers GIFs to remain visible even if overlapping.
- [x] **Database**: Seeded database with essential items (Super Potion, Antidote, CTs).

### 3. Pokémon Management
- [x] **Switching**: Ability to switch Pokémon during battle.
- [x] **Persistence**: HP/Status updates saved to database.

---

## ⏳ Pending / In Progress

### 1. Item Usage Mechanics
- [ ] **Consumables**: Implement logic for Potions (restore HP) and Status Heals (cure conditions).
- [ ] **Capture System**: 
    - [ ] Animation for throwing Pokéball.
    - [ ] Capture rate calculation (based on HP, status, ball type).
    - [ ] Success/Failure handling (shake animation).
    - [ ] Add captured Pokémon to team or PC.

### 2. Battle Polish
- [ ] **Animations**: Add particle effects for moves (Tackle, Thunderbolt, etc.).
- [ ] **Sound Effects**: Add BGM and SFX for attacks/UI.
- [ ] **Mobile Responsiveness**: Ensure all buttons are touch-friendly and layout adapts.

### 3. AI & Difficulty
- [ ] **Opponent AI**: Improve wild Pokémon AI (random moves vs smart choices).
- [ ] **Trainer Battles**: Implement Trainer vs Trainer logic (currently focused on Wild battles).

### 4. Bugs & Refinements
- [ ] **Verify Resume**: Confirm GIFs reappear correctly after closing inventory (Fix implemented, needs testing).
- [ ] **Move Learning**: Verify "Learn Move" scene triggers correctly on level up.

---

## 🚀 Next Immediate Steps

1. **Test Inventory Closing**: Verify that Pokémon animations (GIFs) return when closing the bag.
2. **Implement Potion Logic**: Connect the "Use" button in inventory to the `useItemInBattle` method.
3. **Implement Capture Logic**: Connect Pokéballs to the capture calculation.
