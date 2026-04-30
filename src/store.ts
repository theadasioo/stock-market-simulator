import { AuditLogEntry } from "./types";

export const bank = new Map<string, number>();

export const wallets = new Map<string, Map<string, number>>();

export const auditLog: AuditLogEntry[] = [];