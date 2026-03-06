/**
 * @fileoverview Módulo de lógica pura para la evaluación de notificaciones pendientes.
 * Desacoplado de las APIs del navegador (serviceWorker, Notification) para ser testeable.
 */

import type { DaniNote } from '../db';

/**
 * Determina si una nota ya debe disparar su notificación.
 * La condición es: el tiempo actual sea >= a la fechaProgramada.
 *
 * @param note - La nota a evaluar.
 * @param currentTime - El timestamp actual (normalmente Date.now()).
 * @returns `true` si la notificación debe dispararse, `false` si aún es prematura.
 */
export function isDue(note: DaniNote, currentTime: number): boolean {
    const scheduledTime = new Date(note.fechaProgramada).getTime();
    return currentTime >= scheduledTime;
}

/**
 * Filtra el array de notas para obtener las que están pendientes de notificar
 * y cuyo tiempo programado ya ha llegado o pasado.
 *
 * @param notes - Array completo de notas.
 * @param currentTime - El timestamp actual.
 * @returns Sub-array de notas que deben notificarse ahora.
 */
export function getDueNotes(notes: DaniNote[], currentTime: number): DaniNote[] {
    return notes.filter((note) => !note.notificado && isDue(note, currentTime));
}
