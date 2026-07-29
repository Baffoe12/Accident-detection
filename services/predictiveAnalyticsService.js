const { Op } = require('sequelize');
const db = require('../models');
const environmentalDataService = require('./environmentalDataService');

const AccidentEventModel = db.AccidentEvent;
const SensorDataModel = db.SensorData;

// Placeholder for predictive analytics logic
// This example uses simple heuristics; replace with ML models as needed

async function calculateRiskScore(lat, lng, timestamp) {
  try {
    // Validate inputs
    if (typeof lat !== 'number' || typeof lng !== 'number' || !timestamp) {
      throw new Error('Invalid input parameters');
    }

    // Fetch recent accident events near location and time window (e.g., last 7 days)
    const startTime = new Date(new Date(timestamp).getTime() - 7 * 24 * 60 * 60 * 1000);
    const endTime = new Date(timestamp);

    const accidents = await AccidentEventModel.findAll({
      where: {
        lat: { [Op.between]: [lat - 0.1, lat + 0.1] },
        lng: { [Op.between]: [lng - 0.1, lng + 0.1] },
        timestamp: { [Op.between]: [startTime, endTime] }
      }
    });

    // Fetch recent sensor data in same area and time window
    const sensors = await SensorDataModel.findAll({
      where: {
        lat: { [Op.between]: [lat - 0.1, lat + 0.1] },
        lng: { [Op.between]: [lng - 0.1, lng + 0.1] },
        timestamp: { [Op.between]: [startTime, endTime] }
      }
    });

    // Fetch environmental data
    let weatherData;
    try {
      weatherData = await environmentalDataService.getWeatherData(lat, lng, timestamp);
    } catch (err) {
      console.error('Failed to fetch weather data:', err);
      weatherData = null;
    }

    // Simple risk score calculation based on counts and weather conditions
    let riskScore = 0;

    riskScore += accidents.length * 10; // weight accidents count
    riskScore += sensors.length * 2;    // weight sensor events count

    let weatherConditionText = 'Unknown';
    if (weatherData) {
      if (weatherData.current && weatherData.current.condition) {
        weatherConditionText = weatherData.current.condition.text;
      } else if (weatherData.forecast && weatherData.forecast.forecastday && weatherData.forecast.forecastday.length > 0) {
        weatherConditionText = weatherData.forecast.forecastday[0].day.condition.text;
      }
    }
    const weatherMain = weatherConditionText.toLowerCase();
    if (weatherMain.includes('rain') || weatherMain.includes('storm') || weatherMain.includes('snow')) {
      riskScore += 20; // increase risk for bad weather
    } else {
      console.warn('Weather data is missing or malformed, proceeding without weather adjustment');
    }

    // Normalize risk score to 0-100 scale
    riskScore = Math.min(100, riskScore);

    return {
      riskScore,
      accidentsCount: accidents.length,
      sensorEventsCount: sensors.length,
      weatherCondition: weatherConditionText
    };
  } catch (error) {
    console.error('Error calculating risk score:', error);
    throw error;  // Throw error to be handled by caller
  }
}

module.exports = {
  calculateRiskScore,
};
