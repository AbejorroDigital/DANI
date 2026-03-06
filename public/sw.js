/**
 * @fileoverview Service Worker para la aplicación DANI.
 * Gestiona la ejecución en segundo plano y las notificaciones nativas del sistema.
 */

self.addEventListener('install', (event) => {
  // Fuerza la activación inmediata del Service Worker
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Toma el control de todos los clientes (pestañas) abiertos inmediatamente
  event.waitUntil(self.clients.claim());
});

/**
 * Mapa en memoria para almacenar los identificadores de los temporizadores (timeouts)
 * de las notificaciones programadas.
 * Nota: Si el Service Worker se detiene por el SO, este mapa se reinicia.
 * La aplicación principal tiene un fallback (checkDueNotes) para mitigar esto.
 */
const scheduledNotifications = new Map();

/**
 * Escucha mensajes provenientes del hilo principal (la aplicación web).
 * Principalmente utilizado para programar nuevas notificaciones.
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SCHEDULE_NOTIFICATION') {
    const note = event.data.note;
    const scheduledTime = new Date(note.fechaProgramada).getTime();
    const now = new Date().getTime();
    const delay = scheduledTime - now;

    if (delay > 0) {
      // Programa la notificación para el futuro
      const timeoutId = setTimeout(() => {
        showNotification(note);
        scheduledNotifications.delete(note.id);
      }, delay);
      scheduledNotifications.set(note.id, timeoutId);
    } else {
      // Si el tiempo ya pasó, muestra la notificación inmediatamente
      showNotification(note);
    }
  }
});

/**
 * Muestra una notificación nativa del sistema operativo.
 * @param {Object} note - Objeto que contiene los datos de la nota (destino, contenido, id).
 */
function showNotification(note) {
  self.registration.showNotification(`Es hora de enviar a ${note.destino}`, {
    body: 'Toca para copiar el mensaje y enviarlo.',
    data: { noteId: note.id, contenido: note.contenido },
    requireInteraction: true, // Mantiene la notificación visible hasta que el usuario interactúe
    vibrate: [200, 100, 200] // Patrón de vibración para dispositivos móviles
  });
}

/**
 * Escucha el evento de clic (interacción) sobre una notificación.
 * Se encarga de comunicar a la aplicación principal que debe copiar el texto y actualizar la base de datos.
 */
self.addEventListener('notificationclick', (event) => {
  // Cierra la notificación al ser tocada
  event.notification.close();
  const noteData = event.notification.data;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Envía un mensaje a todos los clientes abiertos para actualizar el estado en la BD
      for (const client of clientList) {
        client.postMessage({
          type: 'MARK_NOTIFIED',
          id: noteData.noteId
        });
      }

      // Si hay una pestaña de la app abierta, enfócala y envía el comando de copiar
      if (clientList.length > 0) {
        let client = clientList[0];
        client.focus();
        client.postMessage({
          type: 'COPY_TO_CLIPBOARD',
          contenido: noteData.contenido
        });
        return;
      }
      
      // Si la app está cerrada, abre una nueva ventana/pestaña
      return self.clients.openWindow('/').then(client => {
        if (client) {
          // Espera un momento para que la ventana cargue antes de enviar los mensajes
          setTimeout(() => {
            client.postMessage({
              type: 'MARK_NOTIFIED',
              id: noteData.noteId
            });
            client.postMessage({
              type: 'COPY_TO_CLIPBOARD',
              contenido: noteData.contenido
            });
          }, 1000);
        }
      });
    })
  );
});
