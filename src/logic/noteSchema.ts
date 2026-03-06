/**
 * @fileoverview Módulo de lógica pura para la creación y validación de notas.
 * Este módulo es la ÚNICA fuente de verdad del esquema de datos de DANI.
 * Deliberadamente libre de dependencias de DOM para ser 100% testeable.
 */

import type { DaniNote } from '../db';

/** Campos obligatorios del esquema DaniNote */
const REQUIRED_FIELDS: (keyof DaniNote)[] = [
    'id',
    'contenido',
    'destino',
    'fechaProgramada',
    'notificado',
    'creadoEn',
];

/** Resultado de la validación de esquema */
export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

/**
 * Valida que un objeto cumpla estrictamente el esquema DaniNote.
 * @param note - Objeto a validar (tipado como unknown para máxima seguridad).
 * @returns Un objeto { valid, errors } con el resultado de la validación.
 */
export function validateNote(note: unknown): ValidationResult {
    const errors: string[] = [];

    if (typeof note !== 'object' || note === null) {
        return { valid: false, errors: ['El objeto nota es null o no es un objeto'] };
    }

    const obj = note as Record<string, unknown>;

    // --- Validación de presencia de campos obligatorios ---
    for (const field of REQUIRED_FIELDS) {
        if (!(field in obj) || obj[field] === undefined || obj[field] === null) {
            errors.push(`Campo obligatorio ausente o nulo: "${field}"`);
        }
    }

    // --- Validación de tipos estrictos ---
    if (typeof obj.id !== 'undefined' && typeof obj.id !== 'string') {
        errors.push(`"id" debe ser string, recibido: ${typeof obj.id}`);
    }
    if (typeof obj.id === 'string' && obj.id.trim() === '') {
        errors.push('"id" no puede ser un string vacío');
    }

    if (typeof obj.contenido !== 'undefined' && typeof obj.contenido !== 'string') {
        errors.push(`"contenido" debe ser string, recibido: ${typeof obj.contenido}`);
    }

    if (typeof obj.destino !== 'undefined' && typeof obj.destino !== 'string') {
        errors.push(`"destino" debe ser string, recibido: ${typeof obj.destino}`);
    }

    // --- Validación de formato ISO 8601 en fechas ---
    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

    if (typeof obj.fechaProgramada !== 'undefined') {
        if (typeof obj.fechaProgramada !== 'string') {
            errors.push(`"fechaProgramada" debe ser string ISO, recibido: ${typeof obj.fechaProgramada}`);
        } else {
            const date = new Date(obj.fechaProgramada as string);
            if (!isoRegex.test(obj.fechaProgramada as string) || isNaN(date.getTime())) {
                errors.push(`"fechaProgramada" no es una fecha ISO válida: "${obj.fechaProgramada}"`);
            }
        }
    }

    if (typeof obj.creadoEn !== 'undefined') {
        if (typeof obj.creadoEn !== 'string') {
            errors.push(`"creadoEn" debe ser string ISO, recibido: ${typeof obj.creadoEn}`);
        } else {
            const date = new Date(obj.creadoEn as string);
            if (!isoRegex.test(obj.creadoEn as string) || isNaN(date.getTime())) {
                errors.push(`"creadoEn" no es una fecha ISO válida: "${obj.creadoEn}"`);
            }
        }
    }

    // --- Validación estricta de tipo boolean para "notificado" ---
    if (typeof obj.notificado !== 'undefined' && typeof obj.notificado !== 'boolean') {
        errors.push(
            `"notificado" debe ser boolean, recibido: ${typeof obj.notificado} ("${obj.notificado}")`
        );
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Fábrica que crea un objeto DaniNote válido y tipado.
 * @param data - Datos parciales de la nota (sin id ni creadoEn, generados automáticamente).
 * @returns Un objeto DaniNote completo y válido.
 */
export function createNote(
    data: Pick<DaniNote, 'contenido' | 'destino' | 'fechaProgramada'>
): DaniNote {
    return {
        id: crypto.randomUUID(),
        contenido: data.contenido,
        destino: data.destino,
        fechaProgramada: data.fechaProgramada,
        notificado: false,
        creadoEn: new Date().toISOString(),
    };
}
