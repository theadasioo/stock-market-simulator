# Stock Market Simulator

Simple stock market simulation service built with Node.js, Express and TypeScript.

## Features

- Wallets that hold stocks
- Bank that manages stock availability
- Buy / sell operations
- Audit log of successful operations
- High availability using Node.js cluster

## How to run

npm install
npm run dev

Application runs on:
http://localhost:3000

## API

POST /stocks
Set bank state

Example body:
{
"stocks": [
{ "name": "apple", "quantity": 10 }
]
}

---

GET /stocks
Get current state of the bank

---

POST /wallets/{wallet_id}/stocks/{stock_name}

Example body:
{
"type": "buy" or "sell"
}

Rules:
- 404 if stock does not exist
- 400 if buy not possible (no stock in bank)
- 400 if sell not possible (no stock in wallet)
- wallet is created automatically if it does not exist

---

GET /wallets/{wallet_id}
Get wallet state

---

GET /wallets/{wallet_id}/stocks/{stock_name}
Get quantity of a specific stock in a wallet

---

GET /log
Get audit log (only successful operations)

---

POST /chaos
Kills a worker process (simulates failure)

## Architecture

- Node.js cluster (multi-process)
- Master process holds application state
- Workers handle HTTP requests
- Workers communicate with master via IPC

## Notes

This solution uses in-memory storage for simplicity.
