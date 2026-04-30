import express, { Response } from "express";
import { randomUUID } from "crypto";
import { IPCAction, IPCRequest, IPCResponse } from "./types";

const app = express();
app.use(express.json());

type Resolver = (response: IPCResponse<unknown>) => void;

const pending = new Map<string, Resolver>();

process.on("message", (message: IPCResponse<unknown>) => {
    if (
        typeof message !== "object" ||
        message === null ||
        typeof message.id !== "string"
    ) {
        return;
    }

    const resolver = pending.get(message.id);

    if (!resolver) {
        return;
    }

    pending.delete(message.id);
    resolver(message);
});

function sendToMaster<T>(
    action: IPCAction,
    payload?: unknown
): Promise<IPCResponse<T>> {
    return new Promise((resolve) => {
        if (typeof process.send !== "function") {
            resolve({
                id: "ipc-unavailable",
                status: 500,
                error: "IPC channel is unavailable",
            });

            return;
        }

        const id = randomUUID();
        pending.set(id, resolve as Resolver);
        process.send({ id, action, payload });
    });
}

function sendResult<T>(res: Response, ipcResponse: IPCResponse<T>): void {
    if (ipcResponse.status >= 400) {
        res.status(ipcResponse.status).json({
            error: ipcResponse.error ?? "Request failed",
        });
        return;
    }

    res.status(ipcResponse.status).json(ipcResponse.data);
}

async function forward<T>(
    res: Response,
    action: IPCAction,
    payload?: unknown
): Promise<void> {
    try {
        const response = await sendToMaster<T>(action, payload);
        sendResult(res, response);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unexpected error";
        res.status(500).json({ error: message });
    }
}

app.get("/health", async (_req, res) => {
    await forward(res, "PING");
});

app.get("/stocks", async (_req, res) => {
    await forward(res, "GET_BANK");
});

app.post("/stocks", async (req, res) => {
    await forward(res, "SET_BANK", req.body);
});

app.get("/wallets/:walletId", async (req, res) => {
    await forward(res, "GET_WALLET", {
        walletId: req.params.walletId,
    });
});

app.get("/wallets/:walletId/stocks/:stockName", async (req, res) => {
    await forward(res, "GET_WALLET_STOCK", {
        walletId: req.params.walletId,
        stockName: req.params.stockName,
    });
});

app.post("/wallets/:walletId/stocks/:stockName", async (req, res) => {
    await forward(res, "TRADE_STOCK", {
        walletId: req.params.walletId,
        stockName: req.params.stockName,
        type: req.body?.type,
    });
});

app.post("/chaos", (_req, res) => {
    res.status(200).json({ ok: true });

    res.once("finish", () => {
        setTimeout(() => {
            process.exit(1);
        }, 25);
    });
});

app.get("/log", async (_req, res) => {
    await forward(res, "GET_LOG");
});

export function startWorker(port: number) {
    app.listen(port, () => {
        console.log(`Worker ${process.pid} running on port ${port}`);
    });
}