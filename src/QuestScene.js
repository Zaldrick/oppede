import Phaser from "phaser";
import ConfigManager from "./managers/ConfigManager.js";

export class QuestScene extends Phaser.Scene {
    constructor() {
        super("QuestScene");
    }

    init(data) {
        this.playerId = data.playerId;
        this.returnScene = data.returnScene || 'GameScene';
        this.quests = [];
        this.selectedQuest = null;
        this.currentTab = 'active'; // 'active' or 'completed'
    }

    preload() {
        // Load assets if needed, using existing ones for now
    }

    async create() {
        this.destroyDom();
        this.createDomOverlay();
        await this.loadQuests();
        this.drawQuests();
        
        this.events.on('shutdown', () => this.destroyDom());
        this.events.on('destroy', () => this.destroyDom());
    }

    async loadQuests() {
        try {
            const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:3000";
            const response = await fetch(`${apiUrl}/api/quests/${this.playerId}`);
            const data = await response.json();
            this.quests = Array.isArray(data) ? data : [];
        } catch (error) {
            console.error("Error loading quests:", error);
            this.quests = [];
        }
    }

    createDomOverlay() {
        this.domContainer = document.createElement('div');
        this.domContainer.className = 'quest-overlay';
        
        const style = document.createElement('style');
        style.textContent = `
            .quest-overlay {
                position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                background-color: rgba(0, 0, 0, 0.85); z-index: 100;
                display: flex; flex-direction: column;
                font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
                color: white; box-sizing: border-box; pointer-events: auto; user-select: none;
            }
            .quest-header {
                display: flex; justify-content: space-between; align-items: center;
                padding: 15px 30px; background: rgba(0,0,0,0.5);
                border-bottom: 1px solid rgba(255,255,255,0.1);
            }
            .quest-header h2 { margin: 0; font-size: 24px; color: #FFD700; }
            .close-btn {
                cursor: pointer; font-size: 24px; color: #aaa; transition: color 0.2s;
            }
            .close-btn:hover { color: white; }
            
            .quest-content {
                display: flex; flex: 1; overflow: hidden; padding: 20px; gap: 20px;
            }
            
            .quest-list-panel {
                flex: 1; background: rgba(255,255,255,0.05); border-radius: 8px;
                display: flex; flex-direction: column;
            }
            
            .quest-tabs {
                display: flex; border-bottom: 1px solid rgba(255,255,255,0.1);
            }
            .quest-tab {
                flex: 1; padding: 15px; text-align: center; cursor: pointer;
                background: rgba(0,0,0,0.2); color: #aaa; transition: all 0.2s;
            }
            .quest-tab.active {
                background: rgba(255,255,255,0.1); color: white; font-weight: bold;
                border-bottom: 2px solid #FFD700;
            }
            
            .quest-list {
                flex: 1; overflow-y: auto; padding: 10px;
            }
            .quest-item {
                padding: 15px; margin-bottom: 8px; background: rgba(0,0,0,0.3);
                border-radius: 4px; cursor: pointer; border-left: 3px solid transparent;
                transition: all 0.2s;
            }
            .quest-item:hover { background: rgba(255,255,255,0.1); }
            .quest-item.selected {
                background: rgba(255,255,255,0.15); border-left-color: #FFD700;
            }
            .quest-item h3 { margin: 0 0 5px 0; font-size: 16px; }
            .quest-item p { margin: 0; font-size: 12px; color: #aaa; }
            
            .quest-details-panel {
                flex: 2; background: rgba(0,0,0,0.4); border-radius: 8px; padding: 20px;
                overflow-y: auto; border: 1px solid rgba(255,255,255,0.1);
            }
            .quest-details-title {
                font-size: 28px; color: #FFD700; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;
            }
            .quest-step {
                margin-bottom: 15px; padding: 10px; background: rgba(255,255,255,0.05);
                border-radius: 4px; font-size: 14px; line-height: 1.4;
            }
            .quest-empty {
                text-align: center; color: #666; margin-top: 50px; font-style: italic;
            }
        `;
        this.domContainer.appendChild(style);

        // Header
        const header = document.createElement('div');
        header.className = 'quest-header';
        header.innerHTML = `
            <h2>Journal de Quêtes</h2>
            <div class="close-btn">✕</div>
        `;
        header.querySelector('.close-btn').onclick = () => this.closeScene();
        this.domContainer.appendChild(header);

        // Content
        const content = document.createElement('div');
        content.className = 'quest-content';
        
        // Left Panel (List)
        const listPanel = document.createElement('div');
        listPanel.className = 'quest-list-panel';
        
        // Tabs
        const tabs = document.createElement('div');
        tabs.className = 'quest-tabs';
        
        const activeTab = document.createElement('div');
        activeTab.className = `quest-tab ${this.currentTab === 'active' ? 'active' : ''}`;
        activeTab.textContent = 'En cours';
        activeTab.onclick = () => this.switchTab('active');
        
        const completedTab = document.createElement('div');
        completedTab.className = `quest-tab ${this.currentTab === 'completed' ? 'active' : ''}`;
        completedTab.textContent = 'Terminées';
        completedTab.onclick = () => this.switchTab('completed');
        
        tabs.appendChild(activeTab);
        tabs.appendChild(completedTab);
        listPanel.appendChild(tabs);
        
        // List Container
        this.questListContainer = document.createElement('div');
        this.questListContainer.className = 'quest-list';
        listPanel.appendChild(this.questListContainer);
        
        content.appendChild(listPanel);
        
        // Right Panel (Details)
        this.detailsPanel = document.createElement('div');
        this.detailsPanel.className = 'quest-details-panel';
        content.appendChild(this.detailsPanel);
        
        this.domContainer.appendChild(content);
        document.body.appendChild(this.domContainer);
    }

    switchTab(tab) {
        this.currentTab = tab;
        this.selectedQuest = null;
        
        // Update tab UI
        const tabs = this.domContainer.querySelectorAll('.quest-tab');
        tabs.forEach(t => {
            if (t.textContent === (tab === 'active' ? 'En cours' : 'Terminées')) {
                t.classList.add('active');
            } else {
                t.classList.remove('active');
            }
        });
        
        this.drawQuests();
    }

    drawQuests() {
        this.questListContainer.innerHTML = '';
        this.detailsPanel.innerHTML = '<div class="quest-empty">Sélectionnez une quête pour voir les détails</div>';
        
        const filteredQuests = this.quests.filter(q => q.status === this.currentTab);
        
        if (filteredQuests.length === 0) {
            this.questListContainer.innerHTML = '<div class="quest-empty">Aucune quête dans cette catégorie</div>';
            return;
        }

        filteredQuests.forEach(quest => {
            const item = document.createElement('div');
            item.className = `quest-item ${this.selectedQuest === quest ? 'selected' : ''}`;
            item.innerHTML = `
                <h3>${quest.title}</h3>
                <p>Étape ${quest.stepIndex + 1}</p>
            `;
            item.onclick = () => this.selectQuest(quest);
            this.questListContainer.appendChild(item);
        });
    }

    selectQuest(quest) {
        this.selectedQuest = quest;
        this.drawQuests(); // Re-render list to update selection highlight
        
        // Render details
        this.detailsPanel.innerHTML = `
            <div class="quest-details-title">${quest.title}</div>
            <div style="white-space: pre-wrap; font-size: 16px; line-height: 1.6;">${quest.description}</div>
            <div style="margin-top: auto; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1);">
                <button class="debug-delete-btn" style="background: #d32f2f; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-family: inherit;">
                    🗑️ Supprimer la quête (Debug)
                </button>
            </div>
        `;

        const deleteBtn = this.detailsPanel.querySelector('.debug-delete-btn');
        if (deleteBtn) {
            deleteBtn.onclick = () => this.deleteQuest(quest);
        }
    }

    async deleteQuest(quest) {
        if (!window.confirm(`Êtes-vous sûr de vouloir supprimer la quête "${quest.title}" ?`)) {
            return;
        }

        // 1. Mise à jour du registre local (Client)
        const playerData = this.registry.get('playerData');
        if (playerData && playerData.quests) {
            delete playerData.quests[quest.title];
            this.registry.set('playerData', playerData);
            console.log(`Quête "${quest.title}" supprimée du registre local.`);
        }

        // 2. Tentative de mise à jour côté serveur
        try {
            const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:3000";
            // On tente une requête DELETE standard
            await fetch(`${apiUrl}/api/quests/${this.playerId}/${encodeURIComponent(quest.title)}`, {
                method: 'DELETE'
            });
            console.log("Requête de suppression envoyée au serveur.");
        } catch (error) {
            console.warn("Erreur lors de la suppression serveur (API peut-être manquante):", error);
        }

        // 3. Mise à jour de l'interface
        this.quests = this.quests.filter(q => q !== quest);
        this.selectedQuest = null;
        this.drawQuests();
    }

    closeScene() {
        this.destroyDom();
        this.scene.stop();
        if (this.returnScene) {
            this.scene.resume(this.returnScene);
        }
    }

    destroyDom() {
        if (this.domContainer) {
            this.domContainer.remove();
            this.domContainer = null;
        }
    }
}
