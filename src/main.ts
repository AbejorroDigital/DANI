/**
 * @fileoverview Controlador principal de la interfaz de usuario (Scriptorium).
 * Gestiona la interacción del DOM, el guardado automático y la comunicación con el Service Worker.
 */

import { Database, DaniNote } from './db';

const db = new Database();

// Referencias a elementos del DOM
const form = document.getElementById('dani-form') as HTMLFormElement;
const destinoInput = document.getElementById('destino') as HTMLInputElement;
const fechaInput = document.getElementById('fechaProgramada') as HTMLInputElement;
const contenidoInput = document.getElementById('contenido') as HTMLTextAreaElement;
const autosaveIndicator = document.getElementById('autosave-indicator') as HTMLSpanElement;
const notesList = document.getElementById('notes-list') as HTMLDivElement;

// Estado de la aplicación
let currentDraftId: string | null = null;
let autosaveTimeout: number | null = null;

/**
 * Inicializa la aplicación.
 * Conecta a la base de datos, ejecuta la purga de mantenimiento,
 * carga las notas existentes y configura los event listeners.
 */
async function init() {
  await db.init();
  
  // RF-06: Algoritmo de Mantenimiento (Auto-purga)
  const purged = await db.purgeOldNotes();
  if (purged > 0) {
    console.log(`Purga completada: ${purged} registros antiguos eliminados.`);
  }

  await loadNotes();
  setupEventListeners();
  requestNotificationPermission();
  registerServiceWorker();
  
  // Verificación periódica de notificaciones pendientes (Fallback si la app está abierta)
  setInterval(checkDueNotes, 30000);
}

/**
 * Configura los escuchadores de eventos para el formulario y el Service Worker.
 */
function setupEventListeners() {
  // RF-03: Autosave - Detecta cambios en los inputs
  contenidoInput.addEventListener('input', handleAutosave);
  destinoInput.addEventListener('input', handleAutosave);
  fechaInput.addEventListener('input', handleAutosave);

  // Manejo del envío final del formulario
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveNote(true);
  });
  
  // Escucha mensajes provenientes del Service Worker (ej. interacción con notificación)
  navigator.serviceWorker.addEventListener('message', async (event) => {
    if (event.data && event.data.type === 'MARK_NOTIFIED') {
      await db.updateNote(event.data.id, { notificado: true });
      await loadNotes();
    }
    // RF-05: Acción de Notificación - Copiar al portapapeles
    if (event.data && event.data.type === 'COPY_TO_CLIPBOARD') {
      try {
        await navigator.clipboard.writeText(event.data.contenido);
        alert('Mensaje copiado al portapapeles. Listo para pegar y enviar.');
      } catch (err) {
        console.error('Error al copiar:', err);
        alert('No se pudo copiar automáticamente. Por favor copia el mensaje manualmente.');
      }
    }
  });
}

/**
 * Maneja la lógica de guardado automático (Autosave).
 * Utiliza un debounce de 1 segundo para evitar escrituras excesivas en la base de datos.
 */
function handleAutosave() {
  if (autosaveTimeout) {
    window.clearTimeout(autosaveTimeout);
  }
  
  autosaveIndicator.textContent = 'Guardando...';
  autosaveIndicator.classList.add('visible');

  autosaveTimeout = window.setTimeout(async () => {
    if (contenidoInput.value.trim() !== '' || destinoInput.value.trim() !== '') {
      await saveNote(false);
      autosaveIndicator.textContent = 'Borrador guardado';
      setTimeout(() => {
        autosaveIndicator.classList.remove('visible');
      }, 2000);
    } else {
      autosaveIndicator.classList.remove('visible');
    }
  }, 1000);
}

/**
 * Guarda o actualiza una nota en la base de datos.
 * @param {boolean} isFinalSubmit - Indica si es un guardado final (submit) o un autosave (borrador).
 */
async function saveNote(isFinalSubmit: boolean) {
  const contenido = contenidoInput.value.trim();
  const destino = destinoInput.value.trim();
  const fechaProgramada = fechaInput.value;

  // Validación estricta solo en el envío final
  if (isFinalSubmit && (!contenido || !destino || !fechaProgramada)) {
    alert('Por favor, completa todos los campos para programar el mensaje.');
    return;
  }

  const now = new Date().toISOString();
  
  const note: DaniNote = {
    id: currentDraftId || crypto.randomUUID(),
    contenido,
    destino,
    fechaProgramada: fechaProgramada || now,
    notificado: false,
    creadoEn: now
  };

  await db.addNote(note);
  currentDraftId = note.id;

  if (isFinalSubmit) {
    // Programa la notificación en el Service Worker
    scheduleNotification(note);
    
    // Resetea el formulario y el estado del borrador
    form.reset();
    currentDraftId = null;
    await loadNotes();
    alert('Mensaje programado con éxito.');
  }
}

/**
 * Recupera todas las notas de la base de datos y renderiza la lista en el DOM.
 */
async function loadNotes() {
  const notes = await db.getAllNotes();
  notesList.innerHTML = '';

  if (notes.length === 0) {
    notesList.innerHTML = '<p style="color: var(--color-3); grid-column: 1/-1; text-align: center; font-style: italic;">No hay mensajes programados.</p>';
    return;
  }

  notes.forEach(note => {
    const card = document.createElement('div');
    card.className = 'note-card';
    
    const dateObj = new Date(note.fechaProgramada);
    const dateStr = dateObj.toLocaleString('es-ES', { 
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' 
    });

    card.innerHTML = `
      <div class="note-header">
        <span>Para: ${note.destino}</span>
        <span class="badge ${note.notificado ? 'notified' : ''}">${note.notificado ? 'Notificado' : 'Pendiente'}</span>
      </div>
      <div class="note-content">${note.contenido}</div>
      <div class="note-footer">
        <span>🕒 ${dateStr}</span>
        <button class="btn-delete" data-id="${note.id}">Eliminar</button>
      </div>
    `;

    // Event listener para eliminar la nota manualmente
    const deleteBtn = card.querySelector('.btn-delete');
    deleteBtn?.addEventListener('click', async () => {
      if (confirm('¿Eliminar este mensaje programado?')) {
        await db.deleteNote(note.id);
        await loadNotes();
      }
    });

    notesList.appendChild(card);
  });
}

/**
 * Solicita permisos al usuario para mostrar notificaciones del sistema.
 */
async function requestNotificationPermission() {
  if ('Notification' in window) {
    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      await Notification.requestPermission();
    }
  }
}

/**
 * Registra el Service Worker necesario para las notificaciones en segundo plano y PWA.
 */
async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registrado.');
    } catch (error) {
      console.error('Error al registrar Service Worker:', error);
    }
  }
}

/**
 * Envía un mensaje al Service Worker para programar una notificación.
 * @param {DaniNote} note - La nota que debe ser notificada.
 */
function scheduleNotification(note: DaniNote) {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SCHEDULE_NOTIFICATION',
      note
    });
  }
}

/**
 * Función de respaldo (Fallback) que verifica periódicamente si hay notas pendientes 
 * de notificar en caso de que la aplicación esté abierta y activa.
 */
async function checkDueNotes() {
  const notes = await db.getAllNotes();
  const now = new Date().getTime();

  for (const note of notes) {
    if (!note.notificado) {
      const scheduledTime = new Date(note.fechaProgramada).getTime();
      if (now >= scheduledTime) {
        // Dispara la notificación localmente si el tiempo ha llegado
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.ready;
          registration.showNotification(`Es hora de enviar a ${note.destino}`, {
            body: 'Toca para copiar el mensaje y enviarlo.',
            data: { noteId: note.id, contenido: note.contenido },
            requireInteraction: true
          });
          
          await db.updateNote(note.id, { notificado: true });
          await loadNotes();
        }
      }
    }
  }
}

// Inicia el ciclo de vida de la aplicación
init();
