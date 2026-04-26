import cluster from "cluster";
import { bank, wallets, log } from "./store";
import { IPCRequest, IPCResponse } from "./types";

export function setupMaster() {
    cluster.on("message", (worker, message: IPCRequest) => {
        const response: IPCResponse = {
            id: message.id,
            status: 200,
        };

        try {
            if (message.action === "PlaceHolder") {
                response.data = "placeholder";
            }
            else if (message.action === "ECHO") {
                response.data = message.payload;
            }
            else {
                response.status = 400;
                response.error = "Unknown action";
            }
        } catch (e: any) {
            response.status = 500;
            response.error = e.message;
        }

        worker.send(response);
    });

    cluster.on("exit", (worker) => {
        console.log(`Worker ${worker.process.pid} died. Restarting...`);
        cluster.fork();
    });
}