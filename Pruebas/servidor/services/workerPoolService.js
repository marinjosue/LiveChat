const { Worker } = require('worker_threads');
const path = require('path');
const EventEmitter = require('events');

/**
 * Worker para hashing de contraseñas
 */
function createHashWorker(password) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, '../workers/hashWorker.js'), {
      workerData: { password }
    });

    worker.on('message', resolve);
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Hash worker stopped with exit code ${code}`));
      }
    });
  });
}

/**
 * Worker para verificación de contraseñas
 */
function createVerifyWorker(password, hash) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, '../workers/verifyWorker.js'), {
      workerData: { password, hash }
    });

    worker.on('message', resolve);
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Verify worker stopped with exit code ${code}`));
      }
    });
  });
}

/**
 * Worker para verificación de integridad de datos
 */
function createIntegrityWorker(data) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, '../workers/integrityWorker.js'), {
      workerData: { data }
    });

    worker.on('message', resolve);
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Integrity worker stopped with exit code ${code}`));
      }
    });
  });
}

/**
 * Pool de Workers con gestión de concurrencia
 */
class WorkerPool extends EventEmitter {
  constructor(workerScript, maxWorkers = 4) {
    super();
    this.workerScript = workerScript;
    this.maxWorkers = maxWorkers;
    this.workers = [];
    this.freeWorkers = [];
    this.taskQueue = [];
    this.activeWorkers = 0;
  }

  /**
   * Ejecuta una tarea en un worker del pool
   */
  async runTask(workerData, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const task = {
        workerData,
        resolve,
        reject,
        timeout: setTimeout(() => {
          reject(new Error('Worker task timeout'));
        }, timeout)
      };

      this.taskQueue.push(task);
      this._processQueue();
    });
  }

  /**
   * Procesa la cola de tareas
   */
  _processQueue() {
    while (this.taskQueue.length > 0 && this.activeWorkers < this.maxWorkers) {
      const task = this.taskQueue.shift();
      this._executeTask(task);
    }
  }

  /**
   * Ejecuta una tarea individual
   */
  _executeTask(task) {
    this.activeWorkers++;

    const worker = new Worker(this.workerScript, {
      workerData: task.workerData
    });

    worker.on('message', (result) => {
      clearTimeout(task.timeout);
      task.resolve(result);
      this.activeWorkers--;
      worker.terminate();
      this._processQueue();
    });

    worker.on('error', (error) => {
      clearTimeout(task.timeout);
      task.reject(error);
      this.activeWorkers--;
      worker.terminate();
      this._processQueue();
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        clearTimeout(task.timeout);
        task.reject(new Error(`Worker stopped with exit code ${code}`));
        this.activeWorkers--;
        this._processQueue();
      }
    });
  }

  /**
   * Cierra todos los workers
   */
  async close() {
    this.taskQueue = [];
    const terminatePromises = this.workers.map(w => w.terminate());
    await Promise.all(terminatePromises);
    this.workers = [];
    this.freeWorkers = [];
    this.activeWorkers = 0;
  }

  /**
   * Obtiene estadísticas del pool
   */
  getStats() {
    return {
      maxWorkers: this.maxWorkers,
      activeWorkers: this.activeWorkers,
      queuedTasks: this.taskQueue.length,
      utilization: (this.activeWorkers / this.maxWorkers * 100).toFixed(2) + '%'
    };
  }
}

module.exports = {
  createHashWorker,
  createVerifyWorker,
  createIntegrityWorker,
  WorkerPool
};
