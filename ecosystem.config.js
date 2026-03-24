module.exports = {
    apps: [
        {
            name: 'tanish-physio-backend',
            script: './server.js',

            // Performance optimization
            instances: 2, // Start 2 instances (adjust based on CPU cores)
            exec_mode: 'cluster', // Cluster mode for better performance

            // Resource management
            max_memory_restart: '500M', // Auto-restart if memory exceeds 500MB
            max_restarts: 10,
            min_uptime: '30s',

            // Error handling
            error_file: './logs/pm2-error.log',
            out_file: './logs/pm2-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
            merge_logs: true,

            // Environment variables
            env_production: {
                NODE_ENV: 'production',
                PORT: 5000
            },

            // Advanced settings
            watch: false, // Disable file watching in production
            ignore_watch: ['node_modules', 'logs', 'public/uploads'],
            max_restarts: 10,
            restart_delay: 4000,

            // Health check
            status_check_interval: 5000
        }
    ]
};
