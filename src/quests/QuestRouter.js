export class QuestRouter {
  constructor({ scene, mapManager, eventManager, handlers = [] }) {
    this.scene = scene;
    this.mapManager = mapManager;
    this.eventManager = eventManager;
    this.handlers = handlers;
  }

  addHandler(handler) {
    if (!handler) return;
    this.handlers.push(handler);
  }

  spawnForMap(mapKey) {
    for (const handler of this.handlers) {
      if (typeof handler.spawnForMap === 'function') {
        handler.spawnForMap(mapKey);
      }
    }
  }

  update() {
    for (const handler of this.handlers) {
      if (typeof handler.update === 'function') {
        handler.update();
      }
    }
  }

  handleNPCInteraction(npc) {
    for (const handler of this.handlers) {
      if (typeof handler.handleNPCInteraction !== 'function') continue;
      const handled = handler.handleNPCInteraction(npc);
      if (handled) return true;
    }
    return false;
  }
}
