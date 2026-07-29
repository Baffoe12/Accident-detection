"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert("accident_events", [
      {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        alcohol: 0.05,
        vibration: 1.2,
        distance: 15.5,
        seatbelt: false,
        impact: 3.7,
        lat: 37.7749,
        lng: -122.4194,
        timestamp: new Date().toISOString()
      }
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete("accident_events", null, {});
  }
};
