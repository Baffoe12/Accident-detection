"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert("sensor_data", [
      {
        alcohol: 0.03,
        vibration: 1.2,
        distance: 18.0,
        seatbelt: false,
        impact: 1.5,
        lcd_display: "Speed: 50km/h",
        lat: 37.7750,
        lng: -122.4195,
        timestamp: new Date().toISOString()
      },
      {
        alcohol: 0.01,
        vibration: 0.5,
        distance: 30.0,
        seatbelt: true,
        impact: 0.5,
        lcd_display: "Speed: 35km/h",
        lat: 37.7751,
        lng: -122.4196,
        timestamp: new Date().toISOString()
      }
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete("sensor_data", { lcd_display: ["Speed: 50km/h", "Speed: 35km/h"] });
  }
};
