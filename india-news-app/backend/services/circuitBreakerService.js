/**
 * Circuit Breaker Service
 * Fail-fast pattern for database and external service calls under stress
 */

const CircuitBreaker = require('opossum');

class CircuitBreakerService {
  constructor() {
    this.breakers = new Map();
    this.initializeBreakers();
  }

  /**
   * Initialize circuit breakers for critical services
   */
  initializeBreakers() {
    // Database operations circuit breaker
    const dbBreakerOptions = {
      timeout: 3000, // 3s timeout
      errorThresholdPercentage: 50, // Trip at 50% error rate
      resetTimeout: 30000, // Try again after 30s
      rollingCountTimeout: 10000, // 10s rolling window
      rollingCountBuckets: 10,
      name: 'database',
      group: 'database-operations'
    };

    this.breakers.set('database', new CircuitBreaker(this.databaseOperation, dbBreakerOptions));

    // Auth operations circuit breaker
    const authBreakerOptions = {
      timeout: 2000, // 2s timeout
      errorThresholdPercentage: 60, // Trip at 60% error rate
      resetTimeout: 15000, // Try again after 15s
      rollingCountTimeout: 5000, // 5s rolling window
      rollingCountBuckets: 5,
      name: 'auth',
      group: 'auth-operations'
    };

    this.breakers.set('auth', new CircuitBreaker(this.authOperation, authBreakerOptions));

    // Redis operations circuit breaker
    const redisBreakerOptions = {
      timeout: 1000, // 1s timeout
      errorThresholdPercentage: 70, // Trip at 70% error rate
      resetTimeout: 10000, // Try again after 10s
      rollingCountTimeout: 5000, // 5s rolling window
      rollingCountBuckets: 5,
      name: 'redis',
      group: 'cache-operations'
    };

    this.breakers.set('redis', new CircuitBreaker(this.redisOperation, redisBreakerOptions));

    // Setup event listeners
    this.setupEventListeners();
  }

  /**
   * Setup circuit breaker event listeners
   */
  setupEventListeners() {
    this.breakers.forEach((breaker, name) => {
      breaker.on('open', () => {
        console.warn(`🔴 Circuit breaker OPEN for ${name} - failing fast`);
      });

      breaker.on('halfOpen', () => {
        console.log(`🟡 Circuit breaker HALF-OPEN for ${name} - testing`);
      });

      breaker.on('close', () => {
        console.log(`🟢 Circuit breaker CLOSED for ${name} - normal operation`);
      });

      breaker.on('fallback', (result) => {
        console.warn(`⚡ Circuit breaker FALLBACK for ${name}:`, result);
      });
    });
  }

  /**
   * Execute database operation with circuit breaker
   */
  async executeDatabase(operation) {
    const breaker = this.breakers.get('database');
    return breaker.fire(operation);
  }

  /**
   * Execute auth operation with circuit breaker
   */
  async executeAuth(operation) {
    const breaker = this.breakers.get('auth');
    return breaker.fire(operation);
  }

  /**
   * Execute Redis operation with circuit breaker
   */
  async executeRedis(operation) {
    const breaker = this.breakers.get('redis');
    return breaker.fire(operation);
  }

  /**
   * Database operation wrapper
   */
  async databaseOperation(operation) {
    try {
      return await operation();
    } catch (error) {
      console.error('Database operation failed:', error.message);
      throw error;
    }
  }

  /**
   * Auth operation wrapper
   */
  async authOperation(operation) {
    try {
      return await operation();
    } catch (error) {
      console.error('Auth operation failed:', error.message);
      throw error;
    }
  }

  /**
   * Redis operation wrapper
   */
  async redisOperation(operation) {
    try {
      return await operation();
    } catch (error) {
      console.error('Redis operation failed:', error.message);
      throw error;
    }
  }

  /**
   * Get circuit breaker status
   */
  getStatus() {
    const status = {};
    this.breakers.forEach((breaker, name) => {
      status[name] = {
        state: breaker.opened ? 'OPEN' : breaker.halfOpen ? 'HALF-OPEN' : 'CLOSED',
        stats: breaker.stats,
        options: {
          timeout: breaker.options.timeout,
          errorThresholdPercentage: breaker.options.errorThresholdPercentage,
          resetTimeout: breaker.options.resetTimeout
        }
      };
    });
    return status;
  }

  /**
   * Reset all circuit breakers (for testing)
   */
  resetAll() {
    this.breakers.forEach((breaker) => {
      breaker.close();
    });
    console.log('🔄 All circuit breakers reset');
  }

  /**
   * Shutdown all circuit breakers
   */
  shutdown() {
    this.breakers.forEach((breaker) => {
      breaker.shutdown();
    });
    console.log('🛑 Circuit breakers shut down');
  }
}

// Export singleton instance
module.exports = new CircuitBreakerService();