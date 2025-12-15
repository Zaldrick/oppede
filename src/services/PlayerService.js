class PlayerService {
  constructor() {
    if (!PlayerService.instance) {
      this.playerData = null;
      this.inventory = [];
      PlayerService.instance = this;
    }
    return PlayerService.instance;
  }

  async fetchPlayerData(playerPseudo) { 
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/players/${playerPseudo}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      this.playerData = await response.json();
      return this.playerData;
    } catch (error) {
      console.error("Error fetching player data:", error);
      throw error;
    }
  }

  async fetchInventory(playerId) {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/inventory/${playerId}`);
      if (!response.ok) {
        if (response.status === 404) {
          console.warn("Inventory not found, returning an empty inventory.");
          this.inventory = []; // Return an empty inventory for 404
          return this.inventory;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (Array.isArray(data)) {
        this.inventory = data;
      } else if (data && Array.isArray(data.inventory)) {
        this.inventory = data.inventory;
      } else {
        this.inventory = [];
      }
      return this.inventory;
    } catch (error) {
      console.error("Error fetching inventory data:", error);
      throw error;
    }
  }

  getPlayerData() {
    return this.playerData;
  }

    // Définit les données du joueur
    setPlayerData(data) {
        this.playerData = data;
    }

    // Met à jour une ou plusieurs propriétés des données du joueur
    updatePlayerData(updates) {
        if (!this.playerData) {
            console.warn("Player data is not initialized. Cannot update.");
            return;
        }

        this.playerData = { ...this.playerData, ...updates };
        console.log("Player data updated:", this.playerData);
    }

  getInventory() {
    return this.inventory;
  }

  addItemToInventory(item) {
    if (!item || !item.nom) return;
    const quantityToAdd = Number(item.quantite ?? item['quantité'] ?? item.quantity ?? 1) || 1;

    const existingItem = this.inventory.find(i => i && i.nom === item.nom);
    if (existingItem) {
      const currentQty = Number(existingItem.quantite ?? existingItem['quantité'] ?? 0) || 0;
      existingItem.quantite = currentQty + quantityToAdd;
      if (existingItem['quantité'] !== undefined) {
        existingItem['quantité'] = existingItem.quantite;
      }
    } else {
      this.inventory.push({
        ...item,
        quantite: Number(item.quantite ?? item['quantité'] ?? item.quantity ?? 1) || 1
      });
    }
  }

  removeItemFromInventory(itemName, quantity) {
    const itemIndex = this.inventory.findIndex(i => i.nom === itemName);
    if (itemIndex !== -1) {
      const currentQty = Number(this.inventory[itemIndex].quantite ?? this.inventory[itemIndex]['quantité'] ?? 0) || 0;
      const newQty = currentQty - (Number(quantity) || 1);
      this.inventory[itemIndex].quantite = newQty;
      if (this.inventory[itemIndex]['quantité'] !== undefined) {
        this.inventory[itemIndex]['quantité'] = newQty;
      }

      if (newQty <= 0) {
        this.inventory.splice(itemIndex, 1);
      }
    }
  }
}

const instance = new PlayerService();
export default instance;
