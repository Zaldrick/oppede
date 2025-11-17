/**
 * Script de validation de la navigation menu Combat → Team → Detail
 * 
 * Ce script vérifie que:
 * 1. Les méthodes bringToTop sont présentes aux bons endroits
 * 2. Les flags inBattle sont correctement passés
 * 3. Le bouton "Envoyer au combat" a la logique correcte
 * 4. Les retours de scène gèrent bien le z-index
 */

const fs = require('fs');
const path = require('path');

const COLORS = {
    RESET: '\x1b[0m',
    GREEN: '\x1b[32m',
    RED: '\x1b[31m',
    YELLOW: '\x1b[33m',
    CYAN: '\x1b[36m',
    BOLD: '\x1b[1m'
};

function log(message, color = COLORS.RESET) {
    console.log(`${color}${message}${COLORS.RESET}`);
}

function readFile(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
        log(`❌ Erreur lecture fichier ${filePath}: ${error.message}`, COLORS.RED);
        return null;
    }
}

function validateBattleScene() {
    log('\n📋 Validation PokemonBattleScene.js', COLORS.CYAN);
    
    const filePath = path.join(__dirname, '../src/PokemonBattleScene.js');
    const content = readFile(filePath);
    
    if (!content) return false;
    
    let allGood = true;
    
    // Test 1: showPokemonMenu doit avoir bringToTop après launch
    const showPokemonMenuMatch = content.match(/showPokemonMenu\(\)\s*\{[\s\S]*?this\.scene\.launch\('PokemonTeamScene'[\s\S]*?\)/);
    
    if (showPokemonMenuMatch) {
        const menuCode = showPokemonMenuMatch[0];
        
        if (menuCode.includes('this.scene.bringToTop(\'PokemonTeamScene\')')) {
            log('  ✅ showPokemonMenu: bringToTop présent après launch', COLORS.GREEN);
        } else {
            log('  ❌ showPokemonMenu: bringToTop MANQUANT après launch', COLORS.RED);
            allGood = false;
        }
        
        if (menuCode.includes('inBattle: true')) {
            log('  ✅ showPokemonMenu: flag inBattle=true passé', COLORS.GREEN);
        } else {
            log('  ❌ showPokemonMenu: flag inBattle MANQUANT', COLORS.RED);
            allGood = false;
        }
        
        if (menuCode.includes('battleState: this.battleState')) {
            log('  ✅ showPokemonMenu: battleState passé', COLORS.GREEN);
        } else {
            log('  ❌ showPokemonMenu: battleState MANQUANT', COLORS.RED);
            allGood = false;
        }
    } else {
        log('  ❌ showPokemonMenu non trouvée', COLORS.RED);
        allGood = false;
    }
    
    // Test 2: Vérifier que switchPokemon existe
    if (content.includes('switchPokemon(teamIndex)')) {
        log('  ✅ switchPokemon: méthode présente', COLORS.GREEN);
    } else {
        log('  ⚠️  switchPokemon: vérifier que la méthode existe', COLORS.YELLOW);
    }
    
    return allGood;
}

function validateTeamScene() {
    log('\n📋 Validation PokemonTeamScene.js', COLORS.CYAN);
    
    const filePath = path.join(__dirname, '../src/PokemonTeamScene.js');
    const content = readFile(filePath);
    
    if (!content) return false;
    
    let allGood = true;
    
    // Test 1: goToDetail doit avoir bringToTop après start
    const goToDetailMatch = content.match(/goToDetail\(pokemon\)[\s\S]*?this\.scene\.start\('PokemonDetailScene'[\s\S]*?\)/);
    
    if (goToDetailMatch) {
        const detailCode = goToDetailMatch[0];
        
        if (detailCode.includes('this.scene.bringToTop(\'PokemonDetailScene\')')) {
            log('  ✅ goToDetail: bringToTop présent après start', COLORS.GREEN);
        } else {
            log('  ❌ goToDetail: bringToTop MANQUANT après start', COLORS.RED);
            allGood = false;
        }
        
        if (detailCode.includes('inBattle: this.inBattle')) {
            log('  ✅ goToDetail: flag inBattle passé', COLORS.GREEN);
        } else {
            log('  ❌ goToDetail: flag inBattle MANQUANT', COLORS.RED);
            allGood = false;
        }
        
        if (detailCode.includes('battleState: this.battleState')) {
            log('  ✅ goToDetail: battleState passé', COLORS.GREEN);
        } else {
            log('  ❌ goToDetail: battleState MANQUANT', COLORS.RED);
            allGood = false;
        }
    } else {
        log('  ❌ goToDetail non trouvée', COLORS.RED);
        allGood = false;
    }
    
    // Test 2: returnToScene doit avoir bringToTop
    const returnToSceneMatch = content.match(/returnToScene\(\)[\s\S]*?\}/);
    
    if (returnToSceneMatch) {
        const returnCode = returnToSceneMatch[0];
        
        if (returnCode.includes('this.scene.bringToTop(this.returnScene)')) {
            log('  ✅ returnToScene: bringToTop présent', COLORS.GREEN);
        } else {
            log('  ❌ returnToScene: bringToTop MANQUANT', COLORS.RED);
            allGood = false;
        }
    } else {
        log('  ❌ returnToScene non trouvée', COLORS.RED);
        allGood = false;
    }
    
    return allGood;
}

function validateDetailScene() {
    log('\n📋 Validation PokemonDetailScene.js', COLORS.CYAN);
    
    const filePath = path.join(__dirname, '../src/PokemonDetailScene.js');
    const content = readFile(filePath);
    
    if (!content) return false;
    
    let allGood = true;
    
    // Test 1: createSendToBattleButton doit vérifier K.O. et actif
    const sendButtonMatch = content.match(/createSendToBattleButton\(\)[\s\S]*?button\.on\('pointerdown'[\s\S]*?\}\);/);
    
    if (sendButtonMatch) {
        const buttonCode = sendButtonMatch[0];
        
        // Vérif conditions d'affichage
        if (buttonCode.includes('isKO') && buttonCode.includes('isActive')) {
            log('  ✅ createSendToBattleButton: conditions K.O. et actif présentes', COLORS.GREEN);
        } else {
            log('  ❌ createSendToBattleButton: conditions d\'affichage MANQUANTES', COLORS.RED);
            allGood = false;
        }
        
        // Vérif early return
        if (buttonCode.match(/if\s*\(\s*isKO\s*\|\|\s*isActive\s*\)[\s\S]*?return/)) {
            log('  ✅ createSendToBattleButton: early return si K.O./actif', COLORS.GREEN);
        } else {
            log('  ❌ createSendToBattleButton: early return MANQUANT', COLORS.RED);
            allGood = false;
        }
        
        // Vérif bringToTop
        if (buttonCode.includes('this.scene.bringToTop(\'PokemonBattleScene\')')) {
            log('  ✅ createSendToBattleButton: bringToTop présent', COLORS.GREEN);
        } else {
            log('  ❌ createSendToBattleButton: bringToTop MANQUANT', COLORS.RED);
            allGood = false;
        }
        
        // Vérif appel switchPokemon
        if (buttonCode.includes('battleScene.switchPokemon')) {
            log('  ✅ createSendToBattleButton: appel switchPokemon présent', COLORS.GREEN);
        } else {
            log('  ❌ createSendToBattleButton: appel switchPokemon MANQUANT', COLORS.RED);
            allGood = false;
        }
        
        // Vérif feedback hover
        if (buttonCode.includes('pointerover') && buttonCode.includes('scaleX: 1.05')) {
            log('  ✅ createSendToBattleButton: feedback hover présent', COLORS.GREEN);
        } else {
            log('  ⚠️  createSendToBattleButton: feedback hover simple ou absent', COLORS.YELLOW);
        }
        
    } else {
        log('  ❌ createSendToBattleButton non trouvée', COLORS.RED);
        allGood = false;
    }
    
    // Test 2: Gestion du flag inBattle dans init
    if (content.includes('this.inBattle = data?.inBattle')) {
        log('  ✅ init: flag inBattle stocké', COLORS.GREEN);
    } else {
        log('  ❌ init: flag inBattle MANQUANT', COLORS.RED);
        allGood = false;
    }
    
    // Test 3: Appel conditionnel du bouton
    if (content.includes('if (this.inBattle)') && content.includes('createSendToBattleButton')) {
        log('  ✅ create: bouton affiché uniquement si inBattle', COLORS.GREEN);
    } else {
        log('  ⚠️  create: vérifier condition inBattle pour affichage bouton', COLORS.YELLOW);
    }
    
    return allGood;
}

function validateNavigation() {
    log(`${COLORS.BOLD}${COLORS.CYAN}╔═══════════════════════════════════════════════════╗${COLORS.RESET}`);
    log(`${COLORS.BOLD}${COLORS.CYAN}║   Validation Navigation Menu Combat → Team → Detail   ║${COLORS.RESET}`);
    log(`${COLORS.BOLD}${COLORS.CYAN}╚═══════════════════════════════════════════════════╝${COLORS.RESET}`);
    
    const results = {
        battleScene: validateBattleScene(),
        teamScene: validateTeamScene(),
        detailScene: validateDetailScene()
    };
    
    log('\n' + '─'.repeat(60), COLORS.CYAN);
    log(`${COLORS.BOLD}RÉSUMÉ FINAL${COLORS.RESET}`, COLORS.CYAN);
    log('─'.repeat(60), COLORS.CYAN);
    
    log(`\nPokemonBattleScene.js: ${results.battleScene ? '✅ VALIDÉ' : '❌ ERREURS'}`, 
        results.battleScene ? COLORS.GREEN : COLORS.RED);
    log(`PokemonTeamScene.js:   ${results.teamScene ? '✅ VALIDÉ' : '❌ ERREURS'}`, 
        results.teamScene ? COLORS.GREEN : COLORS.RED);
    log(`PokemonDetailScene.js: ${results.detailScene ? '✅ VALIDÉ' : '❌ ERREURS'}`, 
        results.detailScene ? COLORS.GREEN : COLORS.RED);
    
    const allValid = results.battleScene && results.teamScene && results.detailScene;
    
    log('\n' + '═'.repeat(60), COLORS.CYAN);
    if (allValid) {
        log(`${COLORS.BOLD}${COLORS.GREEN}🎉 VALIDATION RÉUSSIE - Tous les fichiers sont conformes${COLORS.RESET}`);
        log(`${COLORS.GREEN}Vous pouvez maintenant tester manuellement avec les tests de TEST_MENU_NAVIGATION.md${COLORS.RESET}`);
    } else {
        log(`${COLORS.BOLD}${COLORS.RED}⚠️  VALIDATION ÉCHOUÉE - Des corrections sont nécessaires${COLORS.RESET}`);
        log(`${COLORS.YELLOW}Consultez les erreurs ci-dessus pour les détails${COLORS.RESET}`);
    }
    log('═'.repeat(60), COLORS.CYAN);
    
    process.exit(allValid ? 0 : 1);
}

// Exécution
validateNavigation();
