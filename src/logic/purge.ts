/**
 * @fileoverview Módulo de lógica pura para el algoritmo de auto-purga.
 * Desacoplado completamente de IndexedDB y del DOM para permitir tests deterministas.
 * La clase Database.purgeOldNotes() debe delegar en estas funciones.
 */

import type { DaniNote } from '../db';

/** Constante de las 24 horas expresada en milisegundos */
export const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Determina si una nota ha expirado según el umbral de 24 horas.
 * Una nota expira cuando (referenceTime - fechaProgramada) > 24h.
 *
 * @param note - La nota a evaluar.
 * @param referenceTime - El timestamp de referencia (normalmente Date.now()).
 * @returns `true` si la nota debe ser purgada, `false` si debe permanecer.
 */
export function isNoteExpired(note: DaniNote, referenceTime: number): boolean {
    const scheduledTime = new Date(note.fechaProgramada).getTime();
    return referenceTime - scheduledTime > ONE_DAY_MS;
}

/**
 * Filtra un array de notas y devuelve únicamente las que deben ser purgadas.
 * Función pura — no modifica el array original ni accede a IndexedDB.
 *
 * @param notes - Array completo de notas.
 * @param referenceTime - El timestamp de referencia.
 * @returns Sub-array con las notas que deben eliminarse.
 */
export function filterExpiredNotes(notes: DaniNote[], referenceTime: number): DaniNote[] {
    return notes.filter((note) => isNoteExpired(note, referenceTime));
}

/**
 * Filtra un array de notas y devuelve únicamente las que deben permanecer.
 * Función pura — el complemento de filterExpiredNotes.
 *
 * @param notes - Array completo de notas.
 * @param referenceTime - El timestamp de referencia.
 * @returns Sub-array con las notas que deben conservarse.
 */
export function filterSurvivingNotes(notes: DaniNote[], referenceTime: number): DaniNote[] {
    return notes.filter((note) => !isNoteExpired(note, referenceTime));
}
