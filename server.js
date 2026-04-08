const express = require('express');
const runtime = require('./dist/server.js');
void express;

if (require.main === module) {
    Promise.resolve(runtime.startServer())
        .catch((error) => {
            console.error('Failed to start server:', error);
            process.exit(1);
        });
} else {
    module.exports = runtime.default || runtime;
}
