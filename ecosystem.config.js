module.exports = {
  apps: [{
    name: 'cryptexa',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development',
      PORT: 3000,
      DB_FILE: './data/cryptexa.json',
      MAX_CONTENT_SIZE: '5mb',
      RATE_LIMIT_REQUESTS: 1000,
      RATE_LIMIT_WINDOW_MS: 900000,
      LOG_LEVEL: 'debug'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
      DB_FILE: './data/cryptexa.json',
      MAX_CONTENT_SIZE: '1mb',
      RATE_LIMIT_REQUESTS: 100,
      RATE_LIMIT_WINDOW_MS: 900000,
      LOG_LEVEL: 'info'
    },
    // Logging
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Process management
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'data'],
    max_memory_restart: '500M',
    
    // Restart policy
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '10s',
    
    // Health monitoring
    health_check_grace_period: 3000,
    
    // Advanced features
    kill_timeout: 5000,
    listen_timeout: 3000,
    
    // Environment specific settings
    node_args: '--max-old-space-size=512'
  }],
  
  deploy: {
    production: {
      user: 'deploy',
      host: 'your-server.com',
      ref: 'origin/main',
      repo: 'https://github.com/yourusername/cryptexa.git',
      path: '/var/www/cryptexa',
      'post-deploy': 'npm ci --production && pm2 reload ecosystem.config.js --env production'
    }
  }
};