// Sequelize model for SensorData
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SensorData = sequelize.define('SensorData', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    alcohol: { type: DataTypes.FLOAT, allowNull: false },
    vibration: { type: DataTypes.FLOAT, allowNull: false },
    distance: { type: DataTypes.FLOAT, allowNull: false },
    impact: { type: DataTypes.FLOAT, allowNull: false },
    pulse: { type: DataTypes.FLOAT, allowNull: true },
    current_pulse: { type: DataTypes.FLOAT, allowNull: true },
    lat: { type: DataTypes.FLOAT },
    lng: { type: DataTypes.FLOAT },
    lcd_display: { type: DataTypes.STRING },
    timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'sensor_data',
    timestamps: true
  });

  return SensorData;
};
