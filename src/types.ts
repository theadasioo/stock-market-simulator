export type OperationType = "buy" | "sell";

export type IPCAction =
    | "PING"
    | "GET_BANK"
    | "SET_BANK"
    | "GET_WALLET"
    | "GET_WALLET_STOCK"
    | "TRADE_STOCK"
    | "GET_LOG";

export interface StockEntry {
    name: string;
    quantity: number;
}

export interface WalletView {
    id: string;
    stocks: StockEntry[];
}

export interface AuditLogEntry {
    type: OperationType;
    wallet_id: string;
    stock_name: string;
}

export interface IPCRequest {
    id: string;
    action: IPCAction;
    payload?: unknown;
}

export interface IPCResponse<T = unknown> {
    id: string;
    status: number;
    data?: T;
    error?: string;
}