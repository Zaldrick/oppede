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
      this.inventory = await response.json();
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
    const existingItem = this.inventory.find(i => i.nom === item.nom);
    if (existingItem) {
      existingItem.quantité += item.quantité;
    } else {
      this.inventory.push(item);
    }
  }

  removeItemFromInventory(itemName, quantity) {
    const itemIndex = this.inventory.findIndex(i => i.nom === itemName);
    if (itemIndex !== -1) {
      this.inventory[itemIndex].quantité -= quantity;
      if (this.inventory[itemIndex].quantité <= 0) {
        this.inventory.splice(itemIndex, 1);
      }
    }
  }
}

const instance = new PlayerService();
export default instance;
