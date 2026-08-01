"use strict";

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.removeColumn("sensor_data", "pulse");
    await queryInterface.removeColumn("sensor_data", "current_pulse");
  },

  down: async (queryInterface) => {
    await queryInterface.addColumn("sensor_data", "pulse", {
      type: "FLOAT",
      allowNull: true
    });
    await queryInterface.addColumn("sensor_data", "current_pulse", {
      type: "FLOAT",
      allowNull: true
    });
  }
};
