(function (root) {
  function normalizeTags(tags) {
    if (Array.isArray(tags)) {
      return tags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 12);
    }
    if (typeof tags === 'string') {
      return tags.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 12);
    }
    return [];
  }

  function normalizeAnnotation(input, fallbackUpdatedAt) {
    if (!input || typeof input !== 'object') return null;
    const entityId = String(input.entityId || '').trim();
    if (!entityId) return null;
    const note = input.note ? String(input.note).trim() : input.displayName ? String(input.displayName).trim() : '';

    return {
      entityId,
      note,
      tags: normalizeTags(input.tags),
      updatedAt: input.updatedAt || fallbackUpdatedAt || new Date().toISOString(),
    };
  }

  class MemoryStorageArea {
    constructor(seed) {
      this.values = Object.assign({}, seed);
    }

    async get(key) {
      return this.values[key];
    }

    async set(key, value) {
      this.values[key] = value;
    }
  }

  class ChromeStorageArea {
    constructor(area) {
      this.area = area;
    }

    async get(key) {
      const result = await this.area.get(key);
      return result[key];
    }

    async set(key, value) {
      await this.area.set({ [key]: value });
    }
  }

  class AnnotationStorage {
    constructor(storage, key) {
      this.storage = storage;
      this.key = key;
      this.cache = new Map();
    }

    async load() {
      const raw = await this.storage.get(this.key);
      const parsed = typeof raw === 'string' ? JSON.parse(raw || '[]') : raw;
      const items = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.items) ? parsed.items : [];
      this.cache = new Map();
      for (const item of items) {
        const normalized = normalizeAnnotation(item);
        if (normalized) this.cache.set(normalized.entityId, normalized);
      }
    }

    get(entityId) {
      return this.cache.get(entityId);
    }

    findByAddressLabel(label) {
      const normalized = String(label || '').trim();
      if (!normalized) return undefined;

      const exact = this.cache.get(normalized);
      if (exact) return exact;

      const compactMatch = normalized.match(/^(.{3,})\.\.\.(.{3,})$/);
      if (!compactMatch) return undefined;

      const [, prefix, suffix] = compactMatch;
      const matches = this.all().filter((item) => {
        return item.entityId.startsWith(prefix) && item.entityId.endsWith(suffix);
      });
      return matches.length === 1 ? matches[0] : undefined;
    }

    all() {
      return Array.from(this.cache.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }

    async upsert(annotation) {
      const normalized = normalizeAnnotation(annotation, new Date().toISOString());
      if (!normalized) throw new Error('Annotation requires entityId');
      this.cache.set(normalized.entityId, normalized);
      await this.persist();
      return normalized;
    }

    async remove(entityId) {
      this.cache.delete(entityId);
      await this.persist();
    }

    exportJson() {
      return {
        version: 1,
        exportedAt: new Date().toISOString(),
        items: this.all(),
      };
    }

    async importJson(payload) {
      const items = Array.isArray(payload) ? payload : payload && Array.isArray(payload.items) ? payload.items : [];
      for (const item of items) {
        const normalized = normalizeAnnotation(item, new Date().toISOString());
        if (normalized) this.cache.set(normalized.entityId, normalized);
      }
      await this.persist();
    }

    async persist() {
      await this.storage.set(this.key, JSON.stringify(this.all()));
    }
  }

  root.RRAnnotationStorage = AnnotationStorage;
  root.RRMemoryStorageArea = MemoryStorageArea;
  root.RRChromeStorageArea = ChromeStorageArea;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AnnotationStorage, MemoryStorageArea, ChromeStorageArea, normalizeAnnotation };
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
