/**
 * PM2 Ecosystem Configuration
 * Production-ready process management with auto-restart and monitoring
 */

module.exports = {
  apps: [
    {
      name: 'northeast-forum-api',
      script: 'server.js',
      cwd: __dirname,
      
      // Instance configuration
      instances: process.env.PM2_INSTANCES || 1, // Use 'max' for cluster mode
      exec_mode: 'fork', // Use 'cluster' for load balancing
      
      // Auto-restart configuration
      autorestart: true,
      watch: false, // Set to true in development
      max_memory_restart: '512M', // Restart if memory usage exceeds 512MB
      restart_delay: 4000, // Wait 4 seconds before restart
      max_restarts: 10, // Max restarts within min_uptime
      min_uptime: '10s', // Minimum uptime before considering stable
      
      // Environment variables
      env: {
        NODE_ENV: 'production',
        PORT: 8080,
        LOG_LEVEL: 'info',
        APP_VERSION: '1.0.0',
        AUTO_START_SCHEDULER: 'true'
      },
      
      env_development: {
        NODE_ENV: 'development',
        PORT: 8080,
        LOG_LEVEL: 'debug',
        AUTO_START_SCHEDULER: 'false'
      },
      
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 8080,
        LOG_LEVEL: 'info',
        AUTO_START_SCHEDULER: 'true'
      },
      
      // Logging configuration
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Advanced PM2 features
      kill_timeout: 5000, // Time to wait before force killing
      listen_timeout: 3000, // Time to wait for app to listen
      shutdown_with_message: true, // Enable graceful shutdown
      
      // Health monitoring
      health_check_grace_period: 3000,
      health_check_fatal_exceptions: true,
      
      // Process monitoring
      monitoring: true,
      pmx: true,
      
      // Custom startup script
      post_update: ['npm install', 'echo "Application updated successfully"'],
      
      // Cron restart (optional - restart daily at 3 AM)
      cron_restart: process.env.PM2_CRON_RESTART || null, // '0 3 * * *'
      
      // Source map support
      source_map_support: true,
      
      // Disable automatic restart on specific exit codes
      stop_exit_codes: [0],
      
      // Custom metadata
      vizion: true,
      automation: false,
      
      // Node.js specific options
      node_args: [
        '--max-old-space-size=512', // Limit memory usage
        '--optimize-for-size' // Optimize for memory usage
      ]
    }
  ],
  
  // Deployment configuration
  deploy: {
    production: {
      user: 'node',
      host: ['your-server.com'], // Replace with actual server
      ref: 'origin/main',
      repo: 'git@github.com:your-username/northeast-forum.git', // Replace with actual repo
      path: '/var/www/northeast-forum',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': '',
      'ssh_options': 'StrictHostKeyChecking=no'
    },
    
    staging: {
      user: 'node',
      host: ['staging-server.com'], // Replace with actual staging server
      ref: 'origin/develop',
      repo: 'git@github.com:your-username/northeast-forum.git',
      path: '/var/www/northeast-forum-staging',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env staging'
    }
  }
};