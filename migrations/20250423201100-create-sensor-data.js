"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("sensor_data", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      alcohol: {
        type: Sequelize.FLOAT,
        allowNull: false
      },
      vibration: {
        type: Sequelize.FLOAT,
        allowNull: false
      },
      distance: {
        type: Sequelize.FLOAT,
        allowNull: false
      },
      seatbelt: {
        type: Sequelize.BOOLEAN,
        allowNull: false
      },
      impact: {
        type: Sequelize.FLOAT,
        allowNull: false
      },
      lcd_display: {
        type: Sequelize.STRING,
        allowNull: true
      },
      lat: {
        type: Sequelize.FLOAT,
        allowNull: true
      },
      lng: {
        type: Sequelize.FLOAT,
        allowNull: true
      },
      timestamp: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("sensor_data");
  }
};
