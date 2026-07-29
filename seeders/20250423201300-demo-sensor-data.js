"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert("sensor_data", [
      {
        // id omitted for auto-increment
        alcohol: 0.02,
        vibration: 0.9,
        distance: 22.5,
        seatbelt: true,
        impact: 1.1,
        lcd_display: "Speed: 40km/h",
        lat: 37.7749,
        lng: -122.4194,
        timestamp: new Date().toISOString()
      }
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete("sensor_data", { lcd_display: "Speed: 40km/h" });
  }
};
