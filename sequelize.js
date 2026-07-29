const { Sequelize } = require('sequelize');
const env = process.env.NODE_ENV || 'development';
const config = require('./config/config.json')[env];

// Use SQLite for all environments
const sequelize = new Sequelize({
  dialect: config.dialect,
  storage: config.storage
});

module.exports = sequelize;
