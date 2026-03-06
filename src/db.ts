/**
 * @fileoverview Módulo de base de datos local utilizando IndexedDB.
 * Gestiona la persistencia inalterable de las notas de DANI.
 */

/**
 * Interfaz que define la estructura estricta de una nota en DANI.
 * Cada registro en IndexedDB debe seguir este formato JSON.
 */
export interface DaniNote {
  /** Identificador único de la nota (UUID). */
  id: string;
  /** Contenido del mensaje a enviar. */
  contenido: string;
  /** Nombre del destinatario o grupo. */
  destino: string;
  /** Fecha y hora programada para la notificación (formato ISO string). */
  fechaProgramada: string;
  /** Indica si la notificación ya fue disparada e interactuada. */
  notificado: boolean;
  /** Fecha y hora de creación del registro (formato ISO string). */
  creadoEn: string;
}

const DB_NAME = 'DaniDB';
const STORE_NAME = 'notes';
const DB_VERSION = 1;

/**
 * Clase que encapsula las operaciones de IndexedDB para la aplicación DANI.
 * Proporciona métodos asíncronos para el CRUD y mantenimiento de notas.
 */
export class Database {
  private db: IDBDatabase | null = null;

  /**
   * Inicializa la conexión con IndexedDB y crea el almacén de objetos si no existe.
   * @returns {Promise<void>} Promesa que se resuelve cuando la base de datos está lista.
   */
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('fechaProgramada', 'fechaProgramada', { unique: false });
        }
      };
    });
  }

  /**
   * Añade una nueva nota o actualiza una existente (si el ID coincide).
   * @param {DaniNote} note - El objeto nota a guardar.
   * @returns {Promise<void>}
   */
  async addNote(note: DaniNote): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('Base de datos no inicializada'));
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(note);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Recupera todas las notas almacenadas, ordenadas por fecha programada (ascendente).
   * @returns {Promise<DaniNote[]>} Un array con todas las notas.
   */
  async getAllNotes(): Promise<DaniNote[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('Base de datos no inicializada'));
      const tx = this.db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      
      request.onsuccess = () => {
        const notes = request.result as DaniNote[];
        notes.sort((a, b) => new Date(a.fechaProgramada).getTime() - new Date(b.fechaProgramada).getTime());
        resolve(notes);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Actualiza propiedades específicas de una nota existente.
   * @param {string} id - El ID de la nota a actualizar.
   * @param {Partial<DaniNote>} updates - Objeto con las propiedades a modificar.
   * @returns {Promise<void>}
   */
  async updateNote(id: string, updates: Partial<DaniNote>): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('Base de datos no inicializada'));
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        const data = getReq.result;
        if (data) {
          const updated = { ...data, ...updates };
          const putReq = store.put(updated);
          putReq.onsuccess = () => resolve();
          putReq.onerror = () => reject(putReq.error);
        } else {
          reject(new Error('Nota no encontrada'));
        }
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  /**
   * Elimina permanentemente una nota de la base de datos.
   * @param {string} id - El ID de la nota a eliminar.
   * @returns {Promise<void>}
   */
  async deleteNote(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('Base de datos no inicializada'));
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(id);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Algoritmo de Mantenimiento (Auto-purga).
   * Recorre la base de datos y elimina permanentemente todos los registros 
   * cuya fechaProgramada sea anterior a las 24 horas actuales.
   * @returns {Promise<number>} La cantidad de notas eliminadas.
   */
  async purgeOldNotes(): Promise<number> {
    const notes = await this.getAllNotes();
    const now = new Date().getTime();
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    let purgedCount = 0;

    for (const note of notes) {
      const scheduledTime = new Date(note.fechaProgramada).getTime();
      // Purga si el tiempo programado es más antiguo que 24 horas desde ahora
      if (now - scheduledTime > ONE_DAY_MS) {
        await this.deleteNote(note.id);
        purgedCount++;
      }
    }
    return purgedCount;
  }
}
