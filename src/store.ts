export const bank = new Map<string, number>();

export const wallets = new Map<string, Map<string, number>>();

export const log: Array<{
    type: "buy" | "sell";
    wallet_id: string;
    stock_name: string;
}> = [];