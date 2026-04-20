// db.js - IndexedDB wrapper para entorno client-side

const DB = {
    dbName: 'VNProdDatabase',
    dbVersion: 1,
    storeName: 'employees',
    db: null,

    generateUUID() {
        if(window.crypto && window.crypto.randomUUID) {
            try {
                return window.crypto.randomUUID();
            } catch(e) {}
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },

    init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = (event) => reject('IndexedDB error: ' + event.target.error);

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    // Cramos el store usando el 'id' auto incremental o un campo especifico
                    // Asumiremos un uuid o que generaremos uno nosotros
                    db.createObjectStore(this.storeName, { keyPath: 'uuid' });
                }
            };
        });
    },

    // Save a multiple set of records via batch transaction
    async insertBatch(records) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            
            // Clear existing records first to be safe, or just append. 
            // In a sync we just clear and add.
            store.clear().onsuccess = () => {
                records.forEach(record => {
                    // Asegurarnos de que tenga un uuid unico si no lo trae
                    if(!record.uuid) record.uuid = this.generateUUID();
                    // Asegurarse de que Variable existe
                    if(record['Variable'] === undefined) record['Variable'] = 0;
                    store.add(record);
                });
            };

            transaction.oncomplete = () => resolve(true);
            transaction.onerror = (event) => reject(event.target.error);
        });
    },

    async getAll() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });
    },
    
    async updateBatch(updatesArray) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            
            updatesArray.forEach(record => {
                store.put(record);
            });

            transaction.oncomplete = () => resolve(true);
            transaction.onerror = (event) => reject(event.target.error);
        });
    }
};

window.DB = DB;
