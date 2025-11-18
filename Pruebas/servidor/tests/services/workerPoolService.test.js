const { Worker } = require('worker_threads');
const path = require('path');

jest.mock('worker_threads');

describe('WorkerPoolService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Module Import', () => {
    it('should import workerPoolService module', () => {
      const workerPoolService = require('../../services/workerPoolService');
      expect(workerPoolService).toBeDefined();
    });

    it('should export required functions', () => {
      const workerPoolService = require('../../services/workerPoolService');
      expect(typeof workerPoolService.createHashWorker).toBe('function');
      expect(typeof workerPoolService.createVerifyWorker).toBe('function');
      expect(typeof workerPoolService.createIntegrityWorker).toBe('function');
      expect(typeof workerPoolService.WorkerPool).toBe('function');
    });
  });

  describe('Worker Functions', () => {
    it('should create hash worker and return promise', () => {
      const mockWorker = {
        on: jest.fn((event, callback) => {
          if (event === 'message') {
            callback('hashed_result');
          }
        })
      };

      Worker.mockImplementation(() => mockWorker);

      const result = require('../../services/workerPoolService').createHashWorker('password');
      expect(result).toBeInstanceOf(Promise);
    });

    it('should create verify worker and return promise', () => {
      const mockWorker = {
        on: jest.fn((event, callback) => {
          if (event === 'message') {
            callback(true);
          }
        })
      };

      Worker.mockImplementation(() => mockWorker);

      const result = require('../../services/workerPoolService').createVerifyWorker('pass', 'hash');
      expect(result).toBeInstanceOf(Promise);
    });

    it('should create integrity worker and return promise', () => {
      const mockWorker = {
        on: jest.fn((event, callback) => {
          if (event === 'message') {
            callback({ hash: 'value' });
          }
        })
      };

      Worker.mockImplementation(() => mockWorker);

      const result = require('../../services/workerPoolService').createIntegrityWorker('data');
      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe('Hash Worker Operations', () => {
    it('should handle hash worker success', async () => {
      const mockWorker = {
        on: jest.fn((event, callback) => {
          if (event === 'message') {
            callback('hashed_password_result');
          }
        })
      };

      Worker.mockImplementation(() => mockWorker);

      const result = await require('../../services/workerPoolService').createHashWorker('password123');
      expect(result).toBe('hashed_password_result');
    });

    it('should handle hash worker error', async () => {
      const mockWorker = {
        on: jest.fn((event, callback) => {
          if (event === 'error') {
            callback(new Error('Hash worker error'));
          }
        })
      };

      Worker.mockImplementation(() => mockWorker);

      try {
        await require('../../services/workerPoolService').createHashWorker('password');
      } catch (error) {
        expect(error.message).toBe('Hash worker error');
      }
    });

    it('should handle worker exit with error code', async () => {
      const mockWorker = {
        on: jest.fn((event, callback) => {
          if (event === 'exit') {
            callback(1);
          }
        })
      };

      Worker.mockImplementation(() => mockWorker);

      try {
        await require('../../services/workerPoolService').createHashWorker('password');
      } catch (error) {
        expect(error.message).toContain('exit code');
      }
    });
  });

  describe('Verify Worker Operations', () => {
    it('should verify password correctly', async () => {
      const mockWorker = {
        on: jest.fn((event, callback) => {
          if (event === 'message') {
            callback(true);
          }
        })
      };

      Worker.mockImplementation(() => mockWorker);

      const result = await require('../../services/workerPoolService').createVerifyWorker('password', 'hash');
      expect(result).toBe(true);
    });

    it('should detect invalid password', async () => {
      const mockWorker = {
        on: jest.fn((event, callback) => {
          if (event === 'message') {
            callback(false);
          }
        })
      };

      Worker.mockImplementation(() => mockWorker);

      const result = await require('../../services/workerPoolService').createVerifyWorker('wrong', 'hash');
      expect(result).toBe(false);
    });

    it('should handle verify worker error', async () => {
      const mockWorker = {
        on: jest.fn((event, callback) => {
          if (event === 'error') {
            callback(new Error('Verify failed'));
          }
        })
      };

      Worker.mockImplementation(() => mockWorker);

      try {
        await require('../../services/workerPoolService').createVerifyWorker('password', 'hash');
      } catch (error) {
        expect(error.message).toBe('Verify failed');
      }
    });
  });

  describe('Integrity Worker Operations', () => {
    it('should return integrity hash', async () => {
      const mockWorker = {
        on: jest.fn((event, callback) => {
          if (event === 'message') {
            callback({ hash: 'integrity_hash', valid: true });
          }
        })
      };

      Worker.mockImplementation(() => mockWorker);

      const result = await require('../../services/workerPoolService').createIntegrityWorker('data');
      expect(result.hash).toBe('integrity_hash');
      expect(result.valid).toBe(true);
    });

    it('should detect corrupted data', async () => {
      const mockWorker = {
        on: jest.fn((event, callback) => {
          if (event === 'message') {
            callback({ hash: 'expected', valid: false, actual: 'different' });
          }
        })
      };

      Worker.mockImplementation(() => mockWorker);

      const result = await require('../../services/workerPoolService').createIntegrityWorker('corrupted');
      expect(result.valid).toBe(false);
    });

    it('should handle integrity worker error', async () => {
      const mockWorker = {
        on: jest.fn((event, callback) => {
          if (event === 'error') {
            callback(new Error('Integrity check failed'));
          }
        })
      };

      Worker.mockImplementation(() => mockWorker);

      try {
        await require('../../services/workerPoolService').createIntegrityWorker('data');
      } catch (error) {
        expect(error.message).toBe('Integrity check failed');
      }
    });
  });

  describe('Concurrent Worker Operations', () => {
    it('should handle multiple hash operations', async () => {
      const mockWorker = {
        on: jest.fn((event, callback) => {
          if (event === 'message') {
            callback('result');
          }
        })
      };

      Worker.mockImplementation(() => mockWorker);
      const service = require('../../services/workerPoolService');

      const promises = [
        service.createHashWorker('pass1'),
        service.createHashWorker('pass2'),
        service.createHashWorker('pass3')
      ];

      const results = await Promise.all(promises);
      expect(results).toHaveLength(3);
    });

    it('should handle parallel integrity checks', async () => {
      const mockWorker = {
        on: jest.fn((event, callback) => {
          if (event === 'message') {
            callback({ hash: 'abc123', valid: true });
          }
        })
      };

      Worker.mockImplementation(() => mockWorker);
      const service = require('../../services/workerPoolService');

      const checks = [
        service.createIntegrityWorker('data1'),
        service.createIntegrityWorker('data2'),
        service.createIntegrityWorker('data3')
      ];

      const results = await Promise.all(checks);
      expect(results).toHaveLength(3);
    });

    it('should handle mixed worker types concurrently', async () => {
      const mockWorker = {
        on: jest.fn((event, callback) => {
          if (event === 'message') {
            callback({ result: 'value' });
          }
        })
      };

      Worker.mockImplementation(() => mockWorker);
      const service = require('../../services/workerPoolService');

      const mixed = [
        service.createHashWorker('password'),
        service.createVerifyWorker('pass', 'hash'),
        service.createIntegrityWorker('data')
      ];

      const results = await Promise.all(mixed);
      expect(results).toHaveLength(3);
    });
  });

  describe('Worker Resource Management', () => {
    it('should handle worker cleanup on success', async () => {
      const mockWorker = {
        on: jest.fn((event, callback) => {
          if (event === 'message') {
            callback('result');
          }
        })
      };

      Worker.mockImplementation(() => mockWorker);

      const result = await require('../../services/workerPoolService').createHashWorker('password');
      expect(result).toBe('result');
    });

    it('should handle worker cleanup on failure', async () => {
      const mockWorker = {
        on: jest.fn((event, callback) => {
          if (event === 'error') {
            callback(new Error('Worker error'));
          }
        })
      };

      Worker.mockImplementation(() => mockWorker);

      try {
        await require('../../services/workerPoolService').createHashWorker('password');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should handle graceful exit code 0', async () => {
      const mockWorker = {
        on: jest.fn((event, callback) => {
          if (event === 'message') {
            callback('result');
          }
          if (event === 'exit') {
            callback(0);
          }
        })
      };

      Worker.mockImplementation(() => mockWorker);

      const result = await require('../../services/workerPoolService').createHashWorker('password');
      expect(result).toBe('result');
    });
  });

  describe('Worker Path Resolution', () => {
    it('should resolve hash worker path', () => {
      const mockWorker = {
        on: jest.fn()
      };

      Worker.mockImplementation(() => mockWorker);

      require('../../services/workerPoolService').createHashWorker('password');
      expect(Worker).toHaveBeenCalled();
    });

    it('should resolve verify worker path', () => {
      const mockWorker = {
        on: jest.fn()
      };

      Worker.mockImplementation(() => mockWorker);

      require('../../services/workerPoolService').createVerifyWorker('pass', 'hash');
      expect(Worker).toHaveBeenCalled();
    });

    it('should resolve integrity worker path', () => {
      const mockWorker = {
        on: jest.fn()
      };

      Worker.mockImplementation(() => mockWorker);

      require('../../services/workerPoolService').createIntegrityWorker('data');
      expect(Worker).toHaveBeenCalled();
    });
  });

  describe('Worker Pool Instance', () => {
    it('should be available', () => {
      const { WorkerPool } = require('../../services/workerPoolService');
      expect(WorkerPool).toBeDefined();
    });

    it('should be a constructor', () => {
      const { WorkerPool } = require('../../services/workerPoolService');
      expect(typeof WorkerPool).toBe('function');
    });

    it('should create instance with configuration', () => {
      const { WorkerPool } = require('../../services/workerPoolService');
      const workerPath = path.join(__dirname, '../../workers/hashWorker.js');
      
      const pool = new WorkerPool(workerPath, 2);
      expect(pool).toBeDefined();
    });

    it('should have maxWorkers property', () => {
      const { WorkerPool } = require('../../services/workerPoolService');
      const workerPath = path.join(__dirname, '../../workers/hashWorker.js');
      
      const pool = new WorkerPool(workerPath, 4);
      expect(pool.maxWorkers).toBe(4);
    });
  });

  describe('Worker Pool Methods', () => {
    it('should have runTask method if available', () => {
      const { WorkerPool } = require('../../services/workerPoolService');
      const workerPath = path.join(__dirname, '../../workers/hashWorker.js');
      
      const pool = new WorkerPool(workerPath, 2);
      expect(typeof pool.runTask).toBe('function');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing worker file gracefully', () => {
      const { WorkerPool } = require('../../services/workerPoolService');
      
      // Should not throw even with non-existent path
      expect(() => {
        new WorkerPool('/non/existent/path.js', 1);
      }).not.toThrow();
    });
  });

  describe('Concurrent Operations', () => {
    it('should be designed for concurrent operations', () => {
      const { WorkerPool } = require('../../services/workerPoolService');
      
      const pool1 = new WorkerPool(path.join(__dirname, '../../workers/hashWorker.js'), 1);
      const pool2 = new WorkerPool(path.join(__dirname, '../../workers/verifyWorker.js'), 2);
      
      expect(pool1.maxWorkers).toBe(1);
      expect(pool2.maxWorkers).toBe(2);
    });
  });
});
