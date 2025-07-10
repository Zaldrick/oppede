# ?? Guide de Test - Syst�me de D�fis Triple Triad

## ?? **Comment tester le nouveau syst�me de d�fis**

### **?? Pr�requis :**
1. Au moins **2 joueurs connect�s** sur le serveur
2. Chaque joueur doit avoir **au moins 5 cartes** dans son inventaire
3. Les deux joueurs doivent �tre sur la m�me carte/zone

### **?? Test du d�fi PvP complet :**

#### **?? Joueur A (Challenger) :**
1. **Clique sur Joueur B** (bouton A � proximit�)
2. **S�lectionne "D�fier"** dans le menu d'interaction
3. **Configure les r�gles** dans le menu PvP :
   - ?? R�gle Identique
   - ?? R�gle Plus  
   - ? R�gle Murale
   - ? Mort Subite
4. **Clique "Lancer le D�fi"**
5. **Voit le message** : "D�fi envoy� � [Nom]. En attente de r�ponse..."

#### **?? Joueur B (Challeng�) :**
1. **Re�oit une popup** avec :
   - "D�fi re�u de [Nom]"
   - "R�gles: Identique, Plus"
   - "Accepter le duel ?"
2. **Clique "Accepter"** ou **"Refuser"**

#### **?? Si accept� :**
- **Joueur A :** Lance `TripleTriadSelectScene` (mode PvP)
- **Joueur B :** Lance `TripleTriadSelectScene` (mode PvP) 
- **Les deux** s�lectionnent leurs 5 cartes
- **Validation** lance `TripleTriadGameScene` avec les r�gles configur�es

### **?? Points de v�rification :**

#### **? Console Browser (F12) :**
```javascript
// Lors de l'envoi du d�fi :
[PvPConfig] D�fi envoy� � [Nom] avec les r�gles: {same: true, plus: true, murale: false, mortSubite: false}

// Lors de la r�ception :
[SocketManager] Challenge re�u avec r�gles: {same: true, plus: true, murale: false, mortSubite: false}
```

#### **? Console Serveur :**
```
[TripleTriad] Challenge envoy�: challengerId -> challengedId
[TripleTriad] R�gles incluses: {same: true, plus: true, murale: false, mortSubite: false}
```

### **?? Probl�mes possibles et solutions :**

#### **? "Joueur ne re�oit pas le d�fi" :**
- **V�rifier** que `SocketManager` est bien initialis�
- **V�rifier** que les deux joueurs sont connect�s au m�me serveur
- **V�rifier** les logs serveur pour les �v�nements `challenge:send`

#### **? "R�gles pas transmises" :**
- **V�rifier** que `tripleTriadChallengeRules` est bien dans le registry
- **Regarder** la console browser pour les erreurs JavaScript

#### **? "Menu PvP ne s'ouvre pas" :**
- **V�rifier** que le joueur a assez de cartes (?5)
- **V�rifier** que `startTripleTriadPvP()` est bien appel�

### **?? Flux complet test� :**

```
Joueur A ? D�fier Joueur B
    ?
Menu PvP Config (r�gles)
    ?  
Lancer le D�fi (socket.emit)
    ?
Serveur ? challenge:received
    ?
Joueur B ? Popup avec r�gles
    ?
Accepter ? challenge:accepted  
    ?
Les deux ? TripleTriadSelectScene
    ?
Validation ? TripleTriadGameScene (avec r�gles)
```

### **?? Debug avanc� :**

#### **V�rifier les r�gles stock�es :**
```javascript
// Dans la console browser :
console.log(game.scene.scenes[0].registry.get("tripleTriadChallengeRules"));
```

#### **Forcer un d�fi de test :**
```javascript
// Dans la console browser :
const gameScene = game.scene.scenes.find(s => s.scene.key === "GameScene");
gameScene.socketManager.sendChallenge("socket-id-target");
```

---

**?? Si tout fonctionne, vous devriez maintenant pouvoir d�fier un joueur avec des r�gles personnalis�es !**