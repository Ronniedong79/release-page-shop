// Worker thread for the concurrency test: its own SQLite connection, waits for the
// starting signal, then tries to buy one unit. Reports "ok" or the error code.
import { parentPort, workerData } from "node:worker_threads";
import { openDb, setDb } from "../../src/server/db/connection";
import { placeOrder } from "../../src/server/services/orderService";

const { dbFile, gate, userId, productId } = workerData as {
  dbFile: string;
  gate: SharedArrayBuffer;
  userId: number;
  productId: number;
};

setDb(openDb(dbFile));
parentPort!.postMessage("ready");
Atomics.wait(new Int32Array(gate), 0, 0); // block until the test releases every worker at once

try {
  placeOrder(userId, [{ productId, quantity: 1 }]);
  parentPort!.postMessage("ok");
} catch (err) {
  parentPort!.postMessage((err as { code?: string }).code ?? String(err));
}
