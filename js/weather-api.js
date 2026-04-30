// js/weather-api.js

export class WeatherService {
    constructor() {
        this.baseUrl = "https://api.open-meteo.com/v1/forecast"
    }

    // fetch the current weather condition based on geolocation
    fetchCurrentWeather = async () => {
        try {
            // attempt to get geolocation first (this may fail for several reasons)
            const position = await this.getLocation()
            console.log("Geolocation obtained:", position.coords)
            const { latitude: lat, longitude: lon } = position.coords

            // with latitude and longitude, we can now fetch the weather data
            const url = `${this.baseUrl}?latitude=${lat}&longitude=${lon}&current=weather_code`
            const response = await fetch(url)
            console.log("Weather API responded")
            const data = await response.json()
            console.log("Weather data parsed:", data)
            // if weather fetch is successful, we determine if it's raining based on the weather code
            const isRaining = data.current.weather_code >= 51
            return { condition: isRaining ? 'Rain' : 'Clear' }

        } catch (error) {
            console.warn("Weather fetch failed, defaulting to Clear:", error)
            // if any step fails (geolocation or weather fetch), we default to 'Clear'
            return { condition: 'Clear' }
        }
    }

    // helper function to get geolocation as a Promise
    getLocation = () => {
        return new Promise((resolve, reject) => {
            if (!('geolocation' in navigator)) {
                console.log("in error message for geolocation support")
                reject(new Error("Geolocation not supported"))
            }
            console.log("Attempting to get geolocation...")
            navigator.geolocation.getCurrentPosition(resolve, reject)
        })
    }
}