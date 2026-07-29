// Sequelize model for AccidentEvent
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AccidentEvent = sequelize.define('AccidentEvent', {
    id: { type: DataTypes.STRING, primaryKey: true },
    alcohol: { type: DataTypes.FLOAT, allowNull: false },
    vibration: { type: DataTypes.FLOAT, allowNull: false },
    distance: { type: DataTypes.FLOAT, allowNull: false },
    seatbelt: { type: DataTypes.BOOLEAN, allowNull: false },
    impact: { type: DataTypes.FLOAT, allowNull: false },
    lat: { type: DataTypes.FLOAT },
    lng: { type: DataTypes.FLOAT },
    lcd_display: { type: DataTypes.STRING },
    timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'accident_events',
    timestamps: true
  });

  return AccidentEvent;
};
