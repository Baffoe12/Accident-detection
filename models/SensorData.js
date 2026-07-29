// Sequelize model for SensorData
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SensorData = sequelize.define('SensorData', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    alcohol: { type: DataTypes.FLOAT, allowNull: false },
    vibration: { type: DataTypes.FLOAT, allowNull: false },
    distance: { type: DataTypes.FLOAT, allowNull: false },
    seatbelt: { type: DataTypes.BOOLEAN, allowNull: false },
    impact: { type: DataTypes.FLOAT, allowNull: false },
    lat: { type: DataTypes.FLOAT },
    lng: { type: DataTypes.FLOAT },
    lcd_display: { type: DataTypes.STRING },
    heart_rate: { type: DataTypes.INTEGER },
    timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'sensor_data',
    timestamps: true
  });

  return SensorData;
};
