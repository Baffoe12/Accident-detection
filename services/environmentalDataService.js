const axios = require('axios');

const WEATHERAPI_KEY = process.env.WEATHERAPI_KEY;
const WEATHERAPI_BASE_URL = 'http://api.weatherapi.com/v1';

async function getWeatherData(lat, lng, timestamp) {
  try {
    // WeatherAPI.com historical weather endpoint requires date in yyyy-MM-dd format
    const date = new Date(timestamp).toISOString().split('T')[0];
    const url = `${WEATHERAPI_BASE_URL}/history.json?key=${WEATHERAPI_KEY}&q=${lat},${lng}&dt=${date}`;
    console.log('Fetching weather data from WeatherAPI:', url);

    const response = await axios.get(url);
    if (response.status === 200) {
      console.log('Weather data fetched successfully from WeatherAPI:', response.data);
      return response.data;
    } else {
      console.error('Failed to fetch weather data from WeatherAPI:', response.status, response.statusText);
      return null;
    }
  } catch (error) {
    if (error.response) {
      console.error('Error fetching weather data from WeatherAPI:', error.response.status, error.response.data);
    } else {
      console.error('Error fetching weather data from WeatherAPI:', error.message);
    }
    return null;
  }
}

module.exports = {
  getWeatherData,
};
