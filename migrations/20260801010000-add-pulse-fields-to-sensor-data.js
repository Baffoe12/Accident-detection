"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('sensor_data', 'pulse', {
      type: Sequelize.FLOAT,
      allowNull: true
    });
    await queryInterface.addColumn('sensor_data', 'current_pulse', {
      type: Sequelize.FLOAT,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('sensor_data', 'pulse');
    await queryInterface.removeColumn('sensor_data', 'current_pulse');
  }
};
