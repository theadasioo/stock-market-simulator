import express from "express";
import { randomUUID } from "crypto";
import { IPCRequest, IPCResponse } from "./types";

const app = express();
app.use(express.json());

function sendToMaster(action: string, payload?: any): Promise<IPCResponse> {
    return new Promise((resolve) => {
        const id = randomUUID();

        const message: IPCRequest = {
            id,
            action,
            payload,
        };

        process.send?.(message);

        function handler(response: IPCResponse) {
            if (response.id === id) {
                process.off("message", handler);
                resolve(response);
            }
        }

        process.on("message", handler);
    });
}

app.get("/health", async (req, res) => {
    const response = await sendToMaster("PlaceHolder");

    res.status(response.status).json(response);
});

app.post("/echo", async (req, res) => {
    const response = await sendToMaster("ECHO", req.body);
    res.status(response.status).json(response);
});

export function startWorker(port: number) {
    app.listen(port, () => {
        console.log(`Worker ${process.pid} running on port ${port}`);
    });
}