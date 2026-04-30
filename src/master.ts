import cluster from "cluster";
import { auditLog, bank, wallets } from "./store";
import { IPCRequest, IPCResponse, StockEntry, WalletView } from "./types";



function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}


function normalizeName(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }

    const trimmed = value.trim();

    return trimmed.length > 0 ? trimmed : null;
}


function isNonNegativeInteger(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function ok<T>(id: string, data: T): IPCResponse<T> {
    return {
        id,
        status: 200,
        data
    };
}

function fail(id: string, status: number, error: string): IPCResponse {
    return {
        id,
        status,
        error,
    };
}

function serializeStocks(map: Map<string, number>): StockEntry[] {
    return [...map.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([name, quantity]) => ({
            name,
            quantity,
        }));
}

function buildWalletView(walletId: string): WalletView {
    const wallet = wallets.get(walletId);

    if (!wallet) {
        return {
            id: walletId,
            stocks: [],
        };
    }

    return {
        id: walletId,
        stocks: [...wallet.entries()]
            .filter(([, quantity]) => quantity > 0)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([name, quantity]) => ({
                name,
                quantity,
            })),
    };
}

function ensureWallet(walletId: string): Map<string, number> {
    let wallet = wallets.get(walletId);

    if (!wallet) {
        wallet = new Map<string, number>();
        wallets.set(walletId, wallet);
    }

    return wallet;
}

function parseStocksArray(value: unknown): StockEntry[] | null {
    if (!Array.isArray(value)) {
        return null;
    }

    const grouped = new Map<string, number>();

    for (const item of value) {
        if (!isRecord(item)) {
            return null;
        }

        const name = normalizeName(item.name);
        const quantity = item.quantity;

        if (!name || !isNonNegativeInteger(quantity)) {
            return null;
        }

        grouped.set(name, (grouped.get(name) ?? 0) + quantity);
    }

    return [...grouped.entries()].map(([name, quantity]) => ({
        name,
        quantity
    }));
}

function isIPCRequest(value: unknown): value is IPCRequest {
    return (
        isRecord(value) &&
        typeof value.id === "string" &&
        typeof value.action === "string"
    );
}





function handleRequest(message: IPCRequest): IPCResponse {
    const { id, action } = message;

    switch (action) {
        case "PING":
            return ok(id, "pong");

        case "GET_BANK":
            return ok(id, { stocks: serializeStocks(bank) });

        case "SET_BANK": {
            if (!isRecord(message.payload)) {
                return fail(id, 400, "Invalid payload");
            }

            const stocks = parseStocksArray(message.payload.stocks);

            if (!stocks) {
                return fail(id, 400, "Invalid stocks array");
            }

            bank.clear();

            for (const stock of stocks) {
                bank.set(stock.name, stock.quantity);
            }

            return ok(id, { stocks: serializeStocks(bank) });
        }

        case "GET_WALLET": {
            if (!isRecord(message.payload)) {
                return fail(id, 400, "Invalid payload");
            }

            const walletId = normalizeName(message.payload.walletId);

            if (!walletId) {
                return fail(id, 400, "Invalid wallet id");
            }

            return ok(id, buildWalletView(walletId));
        }

        case "GET_WALLET_STOCK": {
            if (!isRecord(message.payload)) {
                return fail(id, 400, "Invalid payload");
            }

            const walletId = normalizeName(message.payload.walletId);
            const stockName = normalizeName(message.payload.stockName);

            if (!walletId || !stockName) {
                return fail(id, 400, "Invalid payload");
            }

            const wallet = wallets.get(walletId);
            const quantity = wallet?.get(stockName) ?? 0;

            return ok(id, quantity);
        }

        case "TRADE_STOCK": {
            if (!isRecord(message.payload)) {
                return fail(id, 400, "Invalid payload");
            }

            const walletId = normalizeName(message.payload.walletId);
            const stockName = normalizeName(message.payload.stockName);
            const type = message.payload.type;

            if (!walletId || !stockName || (type !== "buy" && type !== "sell")) {
                return fail(id, 400, "Invalid payload");
            }

            const wallet = ensureWallet(walletId);

            if (!bank.has(stockName)) {
                return fail(id, 404, "Stock does not exist");
            }

            const bankQuantity = bank.get(stockName) ?? 0;

            if (type === "buy") {
                if (bankQuantity <= 0) {
                    return fail(id, 400, "No stock available in bank");
                }

                bank.set(stockName, bankQuantity - 1);
                wallet.set(stockName, (wallet.get(stockName) ?? 0) + 1);
            } else {
                const walletQuantity = wallet.get(stockName) ?? 0;

                if (walletQuantity <= 0) {
                    return fail(id, 400, "No stock in wallet");
                }

                if (walletQuantity === 1) {
                    wallet.delete(stockName);
                } else {
                    wallet.set(stockName, walletQuantity - 1);
                }

                bank.set(stockName, bankQuantity + 1);
            }

            auditLog.push({
                type,
                wallet_id: walletId,
                stock_name: stockName,
            });

            return ok(id, { ok: true });
        }

        case "GET_LOG":
            return ok(id, { log: [...auditLog] });

        default:
            return fail(id, 400, "Unknown action");
    }
}


export function setupMaster() {
    cluster.on("message", (worker, message) => {
        if (!isIPCRequest(message)) {
            worker.send({
                id: "invalid",
                status: 400,
                error: "Invalid IPC request",
            });

            return;
        }

        const response = handleRequest(message);
        worker.send(response);
    });

    cluster.on("exit", (worker, code, signal) => {
        console.log(
            `Worker ${worker.process.pid} died (code=${code}, signal=${signal}). Restarting...`
        );
        cluster.fork();
    });
}