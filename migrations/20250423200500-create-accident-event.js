"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("accident_events", {
      id: {
        type: Sequelize.STRING,
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
    await queryInterface.dropTable("accident_events");
  }
};
