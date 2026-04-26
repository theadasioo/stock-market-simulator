import cluster from "cluster";
import os from "os";
import { setupMaster } from "./master";
import { startWorker } from "./worker";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

if (cluster.isPrimary) {
    const cpuCount = os.cpus().length;

    console.log(`Master ${process.pid} is running`);

    setupMaster();

    for (let i = 0; i < cpuCount; i++) {
        cluster.fork();
    }
} else {
    startWorker(PORT);
}