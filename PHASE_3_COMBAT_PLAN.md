# Phase 3: Combat Mechanics - Implementation Plan

## Overview

Phase 3 introduces the **Battle System** - where players engage in turn-based combat with Pokémon. This phase builds on the foundation of Phase 1-2 (team management + lazy loading).

---

## Architecture Overview

```
┌─────────────────────────────────────────┐
│      PokemonBattleScene (UI)            │
│  ├─ Battle grid display                 │
│  ├─ Front/back sprite animation         │
│  ├─ HP bars with damage animation       │
│  ├─ Move selector                       │
│  └─ Battle log (action feed)            │
└──────────────┬──────────────────────────┘
               │
        PokemonBattleManager
        (Client API calls)
               │
               ↓
┌──────────────────────────────────────┐
│  /api/battle/* (Server routes)       │
│  ├─ POST /api/battle/start           │
│  ├─ POST /api/battle/turn            │
│  ├─ GET  /api/battle/:battleId       │
│  └─ POST /api/battle/end             │
└──────────────┬──────────────────────┘
               │
    PokemonBattleLogicManager
    (Server-side battle engine)
    ├─ Turn order (speed calculation)
    ├─ Damage formula
    ├─ Type effectiveness
    ├─ Status effects
    └─ AI logic
               │
               ↓
         MongoDB
         └─ battles collection
```

---

## Phase 3 Tasks

### 1. Server-Side: PokemonBattleLogicManager

**File:** `managers/PokemonBattleLogicManager.js`
**Purpose:** Core battle engine logic (no I/O, pure calculations)

#### Key Methods

```javascript
class PokemonBattleLogicManager {
    // Initialize battle state
    initializeBattle(playerTeam, opponentTeam, isAI = true) { }
    
    // Calculate turn order
    calculateTurnOrder(attacker, defender) { }
    
    // Process a single action
    processTurn(battler, action, targetId) { }
    
    // Damage calculation
    calculateDamage(attacker, defender, move) { }
    
    // Type effectiveness
    getTypeEffectiveness(attackType, defenseTypes) { }
    
    // Check battle end condition
    isBattleOver() { }
    
    // AI decision
    generateAIAction(pokemon) { }
}
```

#### Speed-Based Turn Order

```javascript
// Priority levels
1. User input (always first turn option)
2. Priority moves (+1, +2, etc.)
3. Speed stat

// Example:
Player Pikachu (speed: 100) vs Wild Raticate (speed: 72)
→ Pikachu goes first (100 > 72)

// With priority move:
Player Butterfree (quick_attack, +1 priority, speed 75)
vs Wild Pidgeot (speed 91)
→ Butterfree goes first (+1 > no priority)
```

#### Damage Formula (Gen V-style)

```javascript
// Simplified formula
damage = ((((2 * level / 5 + 2) * power * attack / defense) / 50) + 2) * modifier

where:
  level = attacker level
  power = move power
  attack = attacker attack stat
  defense = defender defense stat
  modifier = type effectiveness × STAB × critical × random (0.85-1.0)

// Type effectiveness
- Super effective: 2.0x
- Normal: 1.0x
- Not very effective: 0.5x

// STAB (Same Type Attack Bonus)
- Same type: 1.5x
- Different: 1.0x

// Critical hit
- 1/16 chance default: 2.0x damage
- Can be higher with abilities
```

---

### 2. Server-Side: PokemonBattleManager (API Routes)

**File:** `managers/PokemonBattleManager.js`
**Purpose:** HTTP routes + battle persistence

#### Routes

```javascript
// Start a new battle
POST /api/battle/start
Body: {
  playerId: ObjectId,
  opponentId: ObjectId | null,  // null = wild battle
  battleType: "wild" | "pvp"
}
Response: { battleId, playerTeam, opponentTeam, turnOrder }

// Execute turn
POST /api/battle/turn
Body: {
  battleId: ObjectId,
  actionType: "move" | "switch" | "item",
  moveId: String,
  targetId: ObjectId
}
Response: { battleLog, currentState, turnResult }

// Get battle state
GET /api/battle/:battleId
Response: { state, playerHP, opponentHP, turnOrder, battleLog }

// End battle
POST /api/battle/end
Body: {
  battleId: ObjectId,
  winner: "player" | "opponent"
}
Response: { success, rewards, xp, capturedPokemon }
```

#### Database Schema

```javascript
// battles collection
{
  _id: ObjectId,
  player_id: ObjectId,
  opponent_id: ObjectId | null,  // null = wild
  battle_type: "wild" | "pvp",
  player_team: [pokemonId, ...],
  opponent_team: [pokemonId, ...],  // or generated for wild
  
  current_player_active: pokemonId,
  current_opponent_active: pokemonId,
  
  turn_count: Integer,
  turn_order: ["player" | "opponent"],
  
  player_hp: [Integer],          // Current HP per Pokémon
  opponent_hp: [Integer],
  
  status_effects: {
    player: { pokemon_id: [status] },
    opponent: { pokemon_id: [status] }
  },
  
  battle_log: [
    {
      turn: Integer,
      actor: "player" | "opponent",
      action: String,
      result: String
    }
  ],
  
  state: "ongoing" | "player_won" | "opponent_won" | "fled",
  
  created_at: Date,
  ended_at: Date | null
}
```

---

### 3. Client-Side: PokemonBattleManager

**File:** `src/managers/PokemonBattleManager.js`
**Purpose:** Client API layer for battles

#### Methods

```javascript
class PokemonBattleManager {
    // Start battle
    async startBattle(playerId, opponentId = null, battleType = "wild") {
        const response = await fetch('/api/battle/start', {
            method: 'POST',
            body: JSON.stringify({ playerId, opponentId, battleType })
        });
        return response.json();
    }
    
    // Execute turn action
    async takeTurn(battleId, moveId, targetId) {
        const response = await fetch('/api/battle/turn', {
            method: 'POST',
            body: JSON.stringify({
                battleId,
                actionType: 'move',
                moveId,
                targetId
            })
        });
        return response.json();
    }
    
    // Get current battle state
    async getBattleState(battleId) {
        const response = await fetch(`/api/battle/${battleId}`);
        return response.json();
    }
    
    // End battle
    async endBattle(battleId, winner) {
        const response = await fetch('/api/battle/end', {
            method: 'POST',
            body: JSON.stringify({ battleId, winner })
        });
        return response.json();
    }
}
```

---

### 4. Frontend: PokemonBattleScene

**File:** `src/PokemonBattleScene.js`
**Purpose:** Battle UI + turn management

#### Scene Structure

```
┌─────────────────────────────────────────────────┐
│              Opponent Info                      │
│  [Sprite]  Level 15      HP: ██████░░░         │
│  "Pidgeotto" (flying)    15/25 HP              │
│                                                 │
│                                                 │
│              Battle Arena                       │
│                                                 │
│                                                 │
│  [Sprite]  Level 18      HP: ████████░░        │
│  "Pikachu" (electric)    18/24 HP              │
│            Player Info                         │
├─────────────────────────────────────────────────┤
│  Battle Log:                                    │
│  • Pidgeotto used Peck! (8 damage)             │
│  • Pikachu used Thunder Wave! (paralyzed!)    │
├─────────────────────────────────────────────────┤
│  [Tackle]    [Thunder]    [Quick Attack]      │
│  [Switch]    [Run]        [Items]             │
└─────────────────────────────────────────────────┘
```

#### Key Features

1. **Sprite Animation**
   - Front sprite (Gen V B&W animated) for player
   - Back sprite (Gen V B&W animated) for opponent
   - Idle animations during turns

2. **HP Bar Animation**
   - Smooth bar drain animation (0.5s)
   - Damage number popup
   - Color change (red near KO)

3. **Move Selection**
   - Grid of 4 moves max
   - PP (Power Points) display
   - Type badge color

4. **Battle Log**
   - Scrollable action feed
   - Color-coded messages (critical, super effective, etc.)
   - Turn indicators

5. **Turn System**
   - Player action selection
   - Animation of selected move
   - Opponent counter-attack
   - Auto-advance to next turn

#### Pseudocode

```javascript
class PokemonBattleScene extends Phaser.Scene {
    
    async create() {
        // Load battle state
        this.battleId = this.scene.get('data').battleId;
        this.battleState = await PokemonBattleManager.getBattleState(this.battleId);
        
        // Render UI
        this.renderBattleUI();
        this.attachEventListeners();
    }
    
    async selectMove(moveId) {
        // Player selects move
        const result = await PokemonBattleManager.takeTurn(
            this.battleId,
            moveId,
            this.battleState.opponent_active_id
        );
        
        // Animate move
        await this.animateMove(result.player_action);
        
        // Opponent's turn
        await this.animateMove(result.opponent_action);
        
        // Update UI
        this.updateBattleState(result);
        
        // Check win/lose
        if (result.state !== 'ongoing') {
            this.endBattle(result.state);
        }
    }
    
    animateMove(moveAction) {
        // Sprite animation + sound + particles
        // HP bar animation
        // Damage number
        // Battle log append
    }
    
    endBattle(result) {
        // Show winner screen
        // Rewards (XP, items)
        // Return to team screen or world
    }
}
```

---

### 5. Frontend: Move Animations

**File:** `src/scenes/animations/MoveAnimations.js`
**Purpose:** Sprite + particle animations for moves

#### Move Types

```
Physical Moves:
  - Scratch, Tackle, Bite, Wing Attack, etc.
  → Attacker lunges toward defender
  → Impact particle effect
  → Defender knockback

Special Moves:
  - Thunderbolt, Fireball, Water Gun, etc.
  → Energy projectile from attacker
  → Particle trail animation
  → Defender hit reaction

Status Moves:
  - Toxic, Thunder Wave, Leech Seed, etc.
  → Visual effect on defender
  → Status badge appears
```

#### Example: Thunder Animation

```javascript
async animateThunder(attacker, defender) {
    // 1. Charger effect on attacker
    const chargeEffect = this.add.particles(0xFFFF00);  // yellow
    chargeEffect.emitParticleAt(attacker.x, attacker.y, 10);
    
    // 2. Lightning bolt animation
    const bolt = this.add.graphics();
    for (let i = 0; i < 3; i++) {
        bolt.lineStyle(2, 0xFFFFFF);
        // Random jagged path
        await this.tweens.add({
            targets: bolt,
            duration: 200,
            // ...
        });
    }
    
    // 3. Impact on defender
    const impact = this.add.particles(0x0088FF);  // blue
    impact.emitParticleAt(defender.x, defender.y, 20);
    
    // 4. Screen shake
    this.cameras.main.shake(100, 0.02);
}
```

---

## Implementation Timeline

### Week 1: Core Logic
- Day 1-2: PokemonBattleLogicManager (turn order, damage)
- Day 3-4: PokemonBattleManager (routes, database)
- Day 5: Testing + type effectiveness verification

### Week 2: UI & Animation
- Day 1-2: PokemonBattleScene (layout, state management)
- Day 3-4: Move animations + HP bar tweens
- Day 5: Battle flow + edge cases

### Week 3: Polish & Integration
- Day 1-2: AI opponent logic
- Day 3-4: Audio + sound effects
- Day 5: Integration testing + bug fixes

**Total Estimate:** 7-10 days of active development

---

## Testing Strategy

### Unit Tests
- [ ] Damage calculation formula
- [ ] Type effectiveness matrix
- [ ] Turn order sorting
- [ ] Status effect application
- [ ] AI decision logic

### Integration Tests
- [ ] Start battle → end battle flow
- [ ] Verify HP deduction
- [ ] Multi-turn battles
- [ ] Status effects persist correctly

### UI Tests
- [ ] Animation completion
- [ ] Input handling during animations
- [ ] Battle log accuracy
- [ ] Scene transitions

### Performance Tests
- [ ] Animation frame rate (target: 60 FPS)
- [ ] Memory usage (target: <50MB additional)
- [ ] Network latency tolerance

---

## Future Enhancements (Phase 4+)

- [ ] **PvP Battles**: Real-time multiplayer battles
- [ ] **Pokémon Capture**: Catch wild Pokémon (balls mechanic)
- [ ] **Experience System**: Level up after battles
- [ ] **Ability System**: Pokémon abilities (passive effects)
- [ ] **Item System**: Held items, consumables in battle
- [ ] **Weather Effects**: Hail, rain, sun, sandstorm
- [ ] **Stat Stages**: Stat boosts/drops (Swords Dance, etc.)
- [ ] **Trainer AI**: Different difficulty levels
- [ ] **Battle Royale**: Multi-Pokémon team battles

---

## Key Decisions

### 1. Turn-Based Combat
- ✅ Simpler to implement
- ✅ Retro Pokémon feel
- ✅ Easier to balance
- ✅ Works well on mobile

### 2. Speed-Based Turn Order
- ✅ Strategic depth
- ✅ Matches Pokémon canon
- ✅ Rewards team building

### 3. Server-Side Calculation
- ✅ Prevents cheating (client can't modify damage)
- ✅ Single source of truth
- ✅ Centralized balance adjustments

### 4. No Real-Time Physics
- ✅ Simpler network model
- ✅ Predictable latency
- ✅ Works on poor connections

---

## Code Standards

### File Structure
```
managers/
├── PokemonBattleLogicManager.js    (core logic)
├── PokemonBattleManager.js         (API routes)
└── ...

src/
├── managers/
│   └── PokemonBattleManager.js     (client API)
├── scenes/
│   ├── PokemonBattleScene.js       (UI)
│   └── animations/
│       └── MoveAnimations.js
├── utils/
│   └── typeEffectiveness.js        (lookup table)
└── ...
```

### Naming Conventions
- **Methods:** `camelCase` (e.g., `calculateDamage`)
- **Constants:** `UPPER_SNAKE_CASE` (e.g., `BASE_DAMAGE_MULTIPLIER`)
- **Classes:** `PascalCase` (e.g., `PokemonBattleScene`)
- **Events:** `snake_case` (e.g., `battle_start`)

### Documentation
- All public methods documented with JSDoc
- Complex algorithms explained with comments
- Type hints for parameters
- Return type documentation

---

## Success Criteria

- ✅ Turn-based battles work from start to end
- ✅ Damage calculation matches Pokémon mechanics
- ✅ AI opponent makes reasonable moves
- ✅ UI is responsive (no lag/stutter)
- ✅ Animations are smooth (60 FPS)
- ✅ All edge cases handled (KO, status effects, etc.)
- ✅ Test coverage >80%
- ✅ Documentation complete

---

## Next Step

When ready to begin Phase 3:

```bash
# 1. Create new branch
git checkout -b phase-3/combat-system

# 2. Create manager files
touch managers/PokemonBattleLogicManager.js
touch managers/PokemonBattleManager.js
touch src/managers/PokemonBattleManager.js

# 3. Create UI files
touch src/PokemonBattleScene.js
touch src/scenes/animations/MoveAnimations.js
touch src/utils/typeEffectiveness.js

# 4. Start implementation
npm run server  # Backend development

# 5. Commit frequently
git add .
git commit -m "Phase 3: Combat mechanics - [section]"
```

---

**Ready for Phase 3?** 
Request: `"Go Phase 3"` to start implementing combat mechanics!

---

*Document Version: 3.0*
*Status: Ready for Implementation*
*Target Start Date: [Your choice]*
