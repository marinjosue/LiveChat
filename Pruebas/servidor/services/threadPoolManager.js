const EventEmitter = require('events');
const { Worker } = require('worker_threads');

/**
 * Gestor avanzado de concurrencia con Worker Threads
 * Implementa:
 * - Pool de workers dinámico
 * - Cola de tareas con prioridades
 * - Sincronización y prevención de deadlocks
 * - Monitoreo de carga
 * - Balanceo de carga
 */

class Task {
  constructor(id, workerScript, workerData, priority = 0, timeout = 30000) {
    this.id = id;
    this.workerScript = workerScript;
    this.workerData = workerData;
    this.priority = priority; 
    this.timeout = timeout;
    this.createdAt = Date.now();
    this.startedAt = null;
    this.completedAt = null;
    this.attempts = 0;
    this.maxAttempts = 3;
  }

  getDuration() {
    if (!this.completedAt) return null;
    return this.completedAt - this.startedAt;
  }

  getWaitTime() {
    if (!this.startedAt) return Date.now() - this.createdAt;
    return this.startedAt - this.createdAt;
  }
}

class ThreadPoolManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Configuración
    this.minWorkers = options.minWorkers || 2;
    this.maxWorkers = options.maxWorkers || 8;
    this.idleTimeout = options.idleTimeout || 60000; // 60 segundos
    this.taskTimeout = options.taskTimeout || 30000; // 30 segundos
    this.autoScale = options.autoScale !== false;
    
    // Estado
    this.workers = new Map(); // workerId -> { worker, busy, lastUsed, tasksCompleted }
    this.taskQueue = []; // Cola de tareas ordenada por prioridad
    this.activeTasks = new Map(); // taskId -> { task, worker, timeoutHandle }
    this.completedTasks = [];
    this.failedTasks = [];
    
    // Métricas
    this.metrics = {
      tasksQueued: 0,
      tasksCompleted: 0,
      tasksFailed: 0,
      totalWaitTime: 0,
      totalExecutionTime: 0,
      peakQueueSize: 0,
      peakWorkerCount: 0
    };
    
    // Locks y sincronización
    this.locks = new Map(); // resourceId -> { locked, queue }
    
    // Inicializar workers mínimos
    this._initializeWorkers();
    
    // Auto-scaling
    if (this.autoScale) {
      this._startAutoScaling();
    }
    
    // Cleanup de workers inactivos
    this._startIdleCleanup();
  }

  /**
   * Inicializa workers mínimos
   */
  _initializeWorkers() {
    for (let i = 0; i < this.minWorkers; i++) {
      this._createWorker();
    }
  }

  /**
   * Crea un nuevo worker
   */
  _createWorker() {
    const workerId = `worker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const workerInfo = {
      id: workerId,
      busy: false,
      lastUsed: Date.now(),
      tasksCompleted: 0,
      createdAt: Date.now()
    };
    
    this.workers.set(workerId, workerInfo);
    this.metrics.peakWorkerCount = Math.max(this.metrics.peakWorkerCount, this.workers.size);
    
    this.emit('worker-created', { workerId, totalWorkers: this.workers.size });
    
    return workerId;
  }

  /**
   * Elimina un worker
   */
  async _destroyWorker(workerId) {
    const workerInfo = this.workers.get(workerId);
    if (!workerInfo) return;
    
    if (workerInfo.worker) {
      await workerInfo.worker.terminate();
    }
    
    this.workers.delete(workerId);
    this.emit('worker-destroyed', { workerId, totalWorkers: this.workers.size });
  }

  /**
   * Obtiene un worker disponible
   */
  _getAvailableWorker() {
    for (const [workerId, info] of this.workers.entries()) {
      if (!info.busy) {
        return workerId;
      }
    }
    return null;
  }

  /**
   * Escala workers según la carga
   */
  _scaleWorkers() {
    const queueSize = this.taskQueue.length;
    const activeWorkers = Array.from(this.workers.values()).filter(w => w.busy).length;
    const totalWorkers = this.workers.size;
    
    // Escalar hacia arriba si hay muchas tareas en cola
    if (queueSize > totalWorkers && totalWorkers < this.maxWorkers) {
      const workersToAdd = Math.min(
        Math.ceil(queueSize / 2),
        this.maxWorkers - totalWorkers
      );
      
      for (let i = 0; i < workersToAdd; i++) {
        this._createWorker();
      }
      
      this.emit('scaled-up', { 
        added: workersToAdd, 
        total: this.workers.size,
        queueSize 
      });
    }
  }

  /**
   * Limpia workers inactivos
   */
  _cleanupIdleWorkers() {
    const now = Date.now();
    const workersToRemove = [];
    
    for (const [workerId, info] of this.workers.entries()) {
      if (!info.busy && 
          this.workers.size > this.minWorkers &&
          now - info.lastUsed > this.idleTimeout) {
        workersToRemove.push(workerId);
      }
    }
    
    for (const workerId of workersToRemove) {
      this._destroyWorker(workerId);
    }
    
    if (workersToRemove.length > 0) {
      this.emit('scaled-down', { 
        removed: workersToRemove.length, 
        total: this.workers.size 
      });
    }
  }

  /**
   * Inicia auto-scaling periódico
   */
  _startAutoScaling() {
    this.autoScaleInterval = setInterval(() => {
      this._scaleWorkers();
    }, 5000); // Cada 5 segundos
  }

  /**
   * Inicia limpieza de workers inactivos
   */
  _startIdleCleanup() {
    this.idleCleanupInterval = setInterval(() => {
      this._cleanupIdleWorkers();
    }, 30000); // Cada 30 segundos
  }

  /**
   * Procesa la cola de tareas
   */
  _processQueue() {
    while (this.taskQueue.length > 0) {
      const workerId = this._getAvailableWorker();
      
      if (!workerId) {
        // No hay workers disponibles, escalar si es posible
        if (this.autoScale && this.workers.size < this.maxWorkers) {
          this._createWorker();
        }
        break;
      }
      
      // Ordenar por prioridad
      this.taskQueue.sort((a, b) => b.priority - a.priority);
      
      const task = this.taskQueue.shift();
      this._executeTask(task, workerId);
    }
  }

  /**
   * Ejecuta una tarea en un worker
   */
  _executeTask(task, workerId) {
    const workerInfo = this.workers.get(workerId);
    if (!workerInfo) return;
    
    workerInfo.busy = true;
    task.startedAt = Date.now();
    task.attempts++;
    
    // Crear worker
    const worker = new Worker(task.workerScript, {
      workerData: task.workerData
    });
    
    workerInfo.worker = worker;
    
    // Timeout de la tarea
    const timeoutHandle = setTimeout(() => {
      worker.terminate();
      this._handleTaskFailure(task, workerId, new Error('Task timeout'));
    }, task.timeout);
    
    // Registrar tarea activa
    this.activeTasks.set(task.id, {
      task,
      workerId,
      timeoutHandle
    });
    
    // Manejar resultados
    worker.on('message', (result) => {
      clearTimeout(timeoutHandle);
      this._handleTaskSuccess(task, workerId, result);
    });
    
    worker.on('error', (error) => {
      clearTimeout(timeoutHandle);
      this._handleTaskFailure(task, workerId, error);
    });
    
    worker.on('exit', (code) => {
      if (code !== 0 && !task.completedAt) {
        clearTimeout(timeoutHandle);
        this._handleTaskFailure(task, workerId, new Error(`Worker exited with code ${code}`));
      }
    });
    
    this.emit('task-started', { 
      taskId: task.id, 
      workerId,
      waitTime: task.getWaitTime()
    });
  }

  /**
   * Maneja éxito de tarea
   */
  _handleTaskSuccess(task, workerId, result) {
    task.completedAt = Date.now();
    
    const workerInfo = this.workers.get(workerId);
    if (workerInfo) {
      workerInfo.busy = false;
      workerInfo.lastUsed = Date.now();
      workerInfo.tasksCompleted++;
      
      if (workerInfo.worker) {
        workerInfo.worker.terminate();
        workerInfo.worker = null;
      }
    }
    
    this.activeTasks.delete(task.id);
    this.completedTasks.push(task);
    
    // Actualizar métricas
    this.metrics.tasksCompleted++;
    this.metrics.totalWaitTime += task.getWaitTime();
    this.metrics.totalExecutionTime += task.getDuration();
    
    this.emit('task-completed', {
      taskId: task.id,
      workerId,
      duration: task.getDuration(),
      result
    });
    
    // Procesar siguiente tarea
    this._processQueue();
  }

  /**
   * Maneja fallo de tarea
   */
  _handleTaskFailure(task, workerId, error) {
    const workerInfo = this.workers.get(workerId);
    if (workerInfo) {
      workerInfo.busy = false;
      workerInfo.lastUsed = Date.now();
      
      if (workerInfo.worker) {
        workerInfo.worker.terminate();
        workerInfo.worker = null;
      }
    }
    
    this.activeTasks.delete(task.id);
    
    // Reintentar si no se alcanzó el máximo
    if (task.attempts < task.maxAttempts) {
      console.warn(`[THREAD-POOL] Retrying task ${task.id} (attempt ${task.attempts + 1}/${task.maxAttempts})`);
      this.taskQueue.unshift(task); // Agregar al inicio de la cola
      this._processQueue();
    } else {
      task.completedAt = Date.now();
      this.failedTasks.push(task);
      this.metrics.tasksFailed++;
      
      this.emit('task-failed', {
        taskId: task.id,
        workerId,
        error: error.message,
        attempts: task.attempts
      });
      
      // Procesar siguiente tarea
      this._processQueue();
    }
  }

  /**
   * Encola una nueva tarea
   */
  async enqueueTask(workerScript, workerData, options = {}) {
    const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const task = new Task(
      taskId,
      workerScript,
      workerData,
      options.priority || 0,
      options.timeout || this.taskTimeout
    );
    
    return new Promise((resolve, reject) => {
      // Agregar callbacks
      const onCompleted = (data) => {
        if (data.taskId === taskId) {
          this.removeListener('task-completed', onCompleted);
          this.removeListener('task-failed', onFailed);
          resolve(data.result);
        }
      };
      
      const onFailed = (data) => {
        if (data.taskId === taskId) {
          this.removeListener('task-completed', onCompleted);
          this.removeListener('task-failed', onFailed);
          reject(new Error(data.error));
        }
      };
      
      this.on('task-completed', onCompleted);
      this.on('task-failed', onFailed);
      
      // Encolar tarea
      this.taskQueue.push(task);
      this.metrics.tasksQueued++;
      this.metrics.peakQueueSize = Math.max(this.metrics.peakQueueSize, this.taskQueue.length);
      
      this.emit('task-queued', { 
        taskId, 
        queueSize: this.taskQueue.length,
        priority: task.priority
      });
      
      // Procesar cola
      this._processQueue();
    });
  }

  /**
   * Adquiere un lock para un recurso
   */
  async acquireLock(resourceId, timeout = 10000) {
    return new Promise((resolve, reject) => {
      if (!this.locks.has(resourceId)) {
        this.locks.set(resourceId, { locked: false, queue: [] });
      }
      
      const lock = this.locks.get(resourceId);
      
      if (!lock.locked) {
        lock.locked = true;
        resolve();
      } else {
        const timeoutHandle = setTimeout(() => {
          const index = lock.queue.findIndex(item => item.resolve === resolve);
          if (index !== -1) {
            lock.queue.splice(index, 1);
          }
          reject(new Error(`Lock timeout for resource ${resourceId}`));
        }, timeout);
        
        lock.queue.push({ resolve, reject, timeoutHandle });
      }
    });
  }

  /**
   * Libera un lock
   */
  releaseLock(resourceId) {
    const lock = this.locks.get(resourceId);
    if (!lock) return;
    
    if (lock.queue.length > 0) {
      const next = lock.queue.shift();
      clearTimeout(next.timeoutHandle);
      next.resolve();
    } else {
      lock.locked = false;
    }
  }

  /**
   * Obtiene estadísticas del pool
   */
  getStats() {
    const activeWorkers = Array.from(this.workers.values()).filter(w => w.busy).length;
    
    return {
      workers: {
        total: this.workers.size,
        active: activeWorkers,
        idle: this.workers.size - activeWorkers,
        min: this.minWorkers,
        max: this.maxWorkers
      },
      tasks: {
        queued: this.taskQueue.length,
        active: this.activeTasks.size,
        completed: this.metrics.tasksCompleted,
        failed: this.metrics.tasksFailed,
        total: this.metrics.tasksQueued
      },
      performance: {
        avgWaitTime: this.metrics.tasksCompleted > 0 
          ? (this.metrics.totalWaitTime / this.metrics.tasksCompleted).toFixed(2) + 'ms'
          : '0ms',
        avgExecutionTime: this.metrics.tasksCompleted > 0 
          ? (this.metrics.totalExecutionTime / this.metrics.tasksCompleted).toFixed(2) + 'ms'
          : '0ms',
        peakQueueSize: this.metrics.peakQueueSize,
        peakWorkerCount: this.metrics.peakWorkerCount
      },
      utilization: ((activeWorkers / this.workers.size) * 100).toFixed(2) + '%'
    };
  }

  /**
   * Cierra el pool de manera ordenada
   */
  async shutdown() {
    clearInterval(this.autoScaleInterval);
    clearInterval(this.idleCleanupInterval);
    
    // Esperar a que terminen las tareas activas
    while (this.activeTasks.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Terminar todos los workers
    const terminatePromises = [];
    for (const [workerId, info] of this.workers.entries()) {
      if (info.worker) {
        terminatePromises.push(info.worker.terminate());
      }
    }
    
    await Promise.all(terminatePromises);
    this.workers.clear();
    
    this.emit('shutdown', { 
      tasksCompleted: this.metrics.tasksCompleted,
      tasksFailed: this.metrics.tasksFailed
    });
  }
}

module.exports = { ThreadPoolManager, Task };
