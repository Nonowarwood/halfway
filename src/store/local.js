// Test storage: everything lives in this browser's localStorage.
// Two tabs (?as=noah and ?as=erin) see each other's changes live,
// which is enough to try the whole flow alone. The online version will
// swap this file for one that talks to a real database, same functions.

const KEY = 'halfway:db';

const blank = () => ({ answers: {}, corrections: {}, meta: {} });

function read() {
  try {
    return { ...blank(), ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return blank();
  }
}

const write = (db) => localStorage.setItem(KEY, JSON.stringify(db));

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const localStore = {
  kind: 'local',

  async load() {
    const db = read();
    return { answers: Object.values(db.answers), corrections: Object.values(db.corrections), meta: db.meta };
  },

  async saveAnswer(date, author, text) {
    const db = read();
    const id = `${date}_${author}`;
    const now = new Date().toISOString();
    db.answers[id] = { id, date, author, text, createdAt: db.answers[id]?.createdAt ?? now, updatedAt: now };
    write(db);
  },

  async addCorrection(fix) {
    const db = read();
    const id = uid();
    db.corrections[id] = { ...fix, id, status: 'pending', createdAt: new Date().toISOString() };
    write(db);
    return id;
  },

  async updateCorrection(id, patch) {
    const db = read();
    if (!db.corrections[id]) return;
    db.corrections[id] = { ...db.corrections[id], ...patch };
    write(db);
  },

  async deleteCorrection(id) {
    const db = read();
    delete db.corrections[id];
    write(db);
  },

  onChange(callback) {
    addEventListener('storage', (e) => {
      if (e.key === KEY || e.key === null) callback();
    });
  },

  async replaceAll(db) {
    write(db);
  },

  async reset() {
    localStorage.removeItem(KEY);
  },
};
