"use strict";

module.exports = {
  up: async (queryInterface) => {
    const hasPulse = await queryInterface.columnExists("sensor_data", "pulse");
    const hasCurrentPulse = await queryInterface.columnExists("sensor_data", "current_pulse");

    if (hasPulse) {
      await queryInterface.removeColumn("sensor_data", "pulse");
    }
    if (hasCurrentPulse) {
      await queryInterface.removeColumn("sensor_data", "current_pulse");
    }
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
