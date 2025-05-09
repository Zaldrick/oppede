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
