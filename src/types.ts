export type OperationType = "buy" | "sell";

export interface IPCRequest {
    id: string;
    action: string;
    payload?: any;
}

export interface IPCResponse {
    id: string;
    status: number;
    data?: any;
    error?: string;
}