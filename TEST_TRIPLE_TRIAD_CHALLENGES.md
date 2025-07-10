# ?? Guide de Test - Système de Défis Triple Triad

## ?? **Comment tester le nouveau système de défis**

### **?? Prérequis :**
1. Au moins **2 joueurs connectés** sur le serveur
2. Chaque joueur doit avoir **au moins 5 cartes** dans son inventaire
3. Les deux joueurs doivent être sur la même carte/zone

### **?? Test du défi PvP complet :**

#### **?? Joueur A (Challenger) :**
1. **Clique sur Joueur B** (bouton A à proximité)
2. **Sélectionne "Défier"** dans le menu d'interaction
3. **Configure les règles** dans le menu PvP :
   - ?? Règle Identique
   - ?? Règle Plus  
   - ? Règle Murale
   - ? Mort Subite
4. **Clique "Lancer le Défi"**
5. **Voit le message** : "Défi envoyé à [Nom]. En attente de réponse..."

#### **?? Joueur B (Challengé) :**
1. **Reçoit une popup** avec :
   - "Défi reçu de [Nom]"
   - "Règles: Identique, Plus"
   - "Accepter le duel ?"
2. **Clique "Accepter"** ou **"Refuser"**

#### **?? Si accepté :**
- **Joueur A :** Lance `TripleTriadSelectScene` (mode PvP)
- **Joueur B :** Lance `TripleTriadSelectScene` (mode PvP) 
- **Les deux** sélectionnent leurs 5 cartes
- **Validation** lance `TripleTriadGameScene` avec les règles configurées

### **?? Points de vérification :**

#### **? Console Browser (F12) :**
```javascript
// Lors de l'envoi du défi :
[PvPConfig] Défi envoyé à [Nom] avec les règles: {same: true, plus: true, murale: false, mortSubite: false}

// Lors de la réception :
[SocketManager] Challenge reçu avec règles: {same: true, plus: true, murale: false, mortSubite: false}
```

#### **? Console Serveur :**
```
[TripleTriad] Challenge envoyé: challengerId -> challengedId
[TripleTriad] Règles incluses: {same: true, plus: true, murale: false, mortSubite: false}
```

### **?? Problèmes possibles et solutions :**

#### **? "Joueur ne reçoit pas le défi" :**
- **Vérifier** que `SocketManager` est bien initialisé
- **Vérifier** que les deux joueurs sont connectés au même serveur
- **Vérifier** les logs serveur pour les événements `challenge:send`

#### **? "Règles pas transmises" :**
- **Vérifier** que `tripleTriadChallengeRules` est bien dans le registry
- **Regarder** la console browser pour les erreurs JavaScript

#### **? "Menu PvP ne s'ouvre pas" :**
- **Vérifier** que le joueur a assez de cartes (?5)
- **Vérifier** que `startTripleTriadPvP()` est bien appelé

### **?? Flux complet testé :**

```
Joueur A ? Défier Joueur B
    ?
Menu PvP Config (règles)
    ?  
Lancer le Défi (socket.emit)
    ?
Serveur ? challenge:received
    ?
Joueur B ? Popup avec règles
    ?
Accepter ? challenge:accepted  
    ?
Les deux ? TripleTriadSelectScene
    ?
Validation ? TripleTriadGameScene (avec règles)
```

### **?? Debug avancé :**

#### **Vérifier les règles stockées :**
```javascript
// Dans la console browser :
console.log(game.scene.scenes[0].registry.get("tripleTriadChallengeRules"));
```

#### **Forcer un défi de test :**
```javascript
// Dans la console browser :
const gameScene = game.scene.scenes.find(s => s.scene.key === "GameScene");
gameScene.socketManager.sendChallenge("socket-id-target");
```

---

**?? Si tout fonctionne, vous devriez maintenant pouvoir défier un joueur avec des règles personnalisées !**