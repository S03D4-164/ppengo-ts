const path = require("path");

module.exports = {
  apps: [
    {
      interpreter: "ts-node",
      name: "ppengo",
      script: "bin/www.ts",
      instances: 1,
      autorestart: true,
      env_production: {
        NODE_ENV: "production",
        DEBUG: "custom:*",
        MONGO_DATABASE: "mongodb://mongodb:27017/wgeteer",
      },
      env_development: {
        NODE_ENV: "development",
        DEBUG: "custom:*",
        MONGO_DATABASE: "mongodb://localhost:27017/wgeteer",
      },
      watch: path.resolve(__dirname, "routes"),
      ignore_watch: ["node_modules"],
      max_memory_restart: "2G",
    },
  ],
};
