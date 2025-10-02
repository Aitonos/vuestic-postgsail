import { defineStore } from 'pinia'
import { useStorage } from '@vueuse/core'
import PostgSail from '../services/api-client'
import deepMerge from '../utils/deepMerge'
import OpenMeteo from '../services/openmeteo'
import moment from 'moment'
import { userBadges, WMO } from '../utils/PostgSail'

const demo_pattern = /^[A-Za-z0-9._%+-]+@openplotter.cloud$/

const defaultState = {
  keepLoggedIn: false,
  isLoggedIn: false,
  isSidebarMinimized: false,
  isMobile: false,
  doShowAsCards: 1,
  language: 'gb',
  currentTheme: 'light',
  token: '',
  // de-duplication to reduce syncing requirements; now in getters:
  //userName: '',
  //validEmail: false,
  count: 0,
  unsplash: null,
  openweather: null,
  currentweather: {},
  monitoring2: [],
  monitoringlive: [],
  stats: {
    stats_logs: {
      name: null,
      count: 0,
      last_date: null,
      max_speed: null,
      first_date: null,
      max_distance: null,
      max_duration: null,
      max_speed_id: null,
      sum_distance: null,
      sum_duration: null,
      max_wind_speed: null,
      max_distance_id: null,
      max_duration_id: null,
      max_wind_speed_id: null,
    },
    logs_top_speed: null,
    stats_moorages: {
      home_ports: 0,
      time_spent_away: null,
      unique_moorages: 0,
      time_at_home_ports: null,
      time_spent_away_arr: null,
    },
    logs_top_distance: null,
    logs_top_duration: null,
    logs_top_avg_speed: null,
    logs_top_wind_speed: null,
    moorages_top_arrivals: null,
    moorages_top_duration: null,
    moorages_top_countries: null,
  },
  status: 'pending',
  versions: {
    web_version: '',
    api_version: '',
    sys_version: '',
    timescaledb: '',
    postgis: '',
    postgrest: '',
  },
  settings: {
    email: '',
    first: '',
    last: '',
    preferences: {
      website: '',
      alerting: {
        enabled: false,
        min_notification_interval: 6,
        low_pressure_threshold: 990,
        high_wind_speed_threshold: 30,
        low_water_depth_threshold: 1.0,
        high_pressure_drop_threshold: 12,
        low_battery_charge_threshold: 50,
        low_battery_voltage_threshold: 12.5,
        low_water_temperature_threshold: 10.0,
        low_indoor_temperature_threshold: 7.0,
        low_outdoor_temperature_threshold: 3.0,
      },
      badges: {},
      telegram: {},
      email_valid: false,
      pushover_user_key: '',
      instagram_handle: '',
      public_profile: false,
      public_logs: false,
      public_stats: false,
      public_logs_list: false,
      public_timelapse: false,
      public_vessel: '',
      public_windy: false,
      public_monitoring: false,
      preferred_homepage: 0,
      use_imperial_units: false,
      email_notifications: true,
      phone_notifications: false,
      windy: null,
      /*cache_minutes: 10,
      cache_clear_on_logout: true*/
    },
    created_at: '',
    username: '',
    has_vessel: false,
    public_vessel: '',
  },
  badges: {},
  ispublic: false,
}

export const useGlobalStore = defineStore('global', {
  state: () =>
    useStorage(
      'global',
      structuredClone(defaultState),
      localStorage,
      { mergeDefaults: true },
      //{ mergeDefaults: (storageValue, defaults) => deepMerge(defaultState, storageValue) }
    ).value,
  actions: {
    login(token: string, keepLoggedIn: boolean) {
      this.token = token
      this.isLoggedIn = true
      this.keepLoggedIn = keepLoggedIn
      return token
      //return this.fetchSettings()
    },
    logout() {
      this.isLoggedIn = false
      this.token = ''
      // to update existing refs pointing to preferences:
      //deepMerge(this.settings, defaultState.settings)
      localStorage.removeItem('global')
      localStorage.removeItem('cache')
      localStorage.removeItem('map')
      localStorage.removeItem('vessel')
    },
    toggleSidebar() {
      this.isSidebarMinimized = !this.isSidebarMinimized
    },
    changeUserName(username: string) {
      this.settings.username = username
    },

    async fetchVersions(web_version: string) {
      const api = new PostgSail()
      try {
        const response = await api.versions()
        this.versions = response
        this.versions.web_version = web_version
        console.log('GlobalStore fetchVersions this.versions', this.versions)
      } catch (error) {
        console.log(error)
      }
    },
    async fetchSettings(_refresh = false): Promise<Record<string, any>> {
      console.log('GlobalStore fetchSettings', _refresh, this.userName, this.settings)
      //if (this.ispublic) return this.settings /* Ignore on anonymous access */
      if (!_refresh && this.userName) return this.settings /* Force refresh */
      const api = new PostgSail()
      try {
        const settings = await api.settings()
        if (Number.isInteger(settings) && settings === 401) {
          console.error('401')
          this.logout()
        } else {
          //this.settings = (await api.settings()).settings
          deepMerge(this.settings, settings.settings)
        }
      } catch (error) {
        console.error(error)
      }
      await this.set_userBadges()
      this.settings.public_vessel = this.settings?.preferences?.public_vessel || 'no_public_vessel'
      return this.settings
    },
    async updatePref(key: string, value: any): Promise<any> {
      const api = new PostgSail()
      try {
        const response = await api.update_user_preferences({ key: `{${key}}`, value: value })
        //const preferences: Record<string, any> = this.settings.preferences
        //preferences[key] = value
        console.log('GlobalStore updatePref response', response)
        return response
      } catch (error) {
        console.log(error)
      }
    },
    set_web_version(web_version: string) {
      this.versions.web_version = web_version
    },
    set_currentWeather() {
      if (this.openweather && this.openweather['daily']) {
        this.currentweather = Object.assign({
          temp: this.openweather['current']['temperature_2m'],
          description: WMO[this.openweather['current']['weather_code']]['day']['description'],
          img: WMO[this.openweather['current']['weather_code']]['day']['image'],
          sunriseTime: moment.unix(this.openweather['daily']['sunrise'][0]).format('HH:mm'),
          sunsetTime: moment.unix(this.openweather['daily']['sunset'][0]).format('HH:mm'),
        })
      }
    },
    async fetchWeatherForecast(coordinates: [number, number]) {
      const weather = new OpenMeteo()
      try {
        await weather.updateForecast(coordinates as [number, number])
        this.openweather = weather.data
        console.log('GlobalStore fetchWeatherForecast', weather.data)
        this.set_currentWeather()
        console.log('GlobalStore fetchWeatherForecast', this.currentweather)
        return this.openweather
      } catch (error) {
        console.log(error)
      }
    },
    async fetchMonitoring2() {
      const api = new PostgSail()
      try {
        const response = await api.monitoring2()
        this.monitoring2 = response
        console.log('GlobalStore fetchMonitoring2 response', response)
        return this.monitoring2
      } catch (error) {
        console.log(error)
      }
    },
    async fetchMonitoringLive() {
      const api = new PostgSail()
      try {
        const response = await api.monitoring_live()
        this.monitoringlive = response
        console.log('GlobalStore fetchMonitoringLive response', response)
        return this.monitoringlive
      } catch (error) {
        console.log(error)
      }
    },
    async fetchStats() {
      const payload = {
        start_date: null,
        end_date: null,
      }
      const api = new PostgSail()
      try {
        const response = await api.stats(payload)
        this.stats = response.stats || {}
        console.log('GlobalStore fetchStats response', response)
        return this.stats
      } catch (error) {
        console.log(error)
      }
    },
    async set_userBadges() {
      const user_badges = this.settings?.preferences?.badges || {}
      console.log('GlobalStore set_userBadges', user_badges)
      this.badges = await userBadges(user_badges)
      //return this.badges
    },
    async is_public(boat: string, type: string, id = 0 as number) {
      const api = new PostgSail()
      try {
        const response = await api.is_public({ boat: boat, _type: type, _id: id })
        this.ispublic = response
        console.log('GlobalStore is_public response', response)
        if (this.ispublic == true) {
          api.setHeader('x-is-public', btoa(`${boat},${type},${id}`))
          this.settings.public_vessel = boat
        }
        return this.ispublic
      } catch (error) {
        console.log(error)
      }
    },
  },
  getters: {
    userName: (state) => state.settings?.username,
    validEmail: (state) => state.settings?.preferences?.email_valid,
    hasVessel: (state) => state.settings?.has_vessel,
    hasLogs: (state) => state.stats?.stats_logs?.count || 0,
    preferredHomepage: (state) =>
      ['dashboard', 'logs', 'monitoring', 'stats', 'map-explorer'][
        state.settings?.preferences?.preferred_homepage || 0
      ],
    imperialUnits: (state) => state.settings?.preferences?.use_imperial_units || false,
    doubleCount: (state) => state.count * 2,
    Monitoring2: (state) => state.monitoring2,
    MonitoringLive: (state) => state.monitoringlive[0] || {},
    stats_logs: (state) => state.stats?.stats_logs || {},
    stats_moorages: (state) => state.stats?.stats_moorages || {},
    openWeather: (state) => state.openweather,
    currentWeather: (state) => state.currentweather,
    Badges: (state) => state.settings?.preferences?.badges || {},
    userBadges: (state) => state?.badges || {},
    publicVessel: (state) => state.settings?.public_vessel || null,
    publicTimelapse: (state) => state.settings?.preferences?.public_timelapse || false,
    isPublic: (state) => state.ispublic || false,
    firstName: (state) => state.settings?.first,
    instagram: (state) => state.settings?.preferences?.instagram_handle,
    website: (state) => state.settings?.preferences?.website,
    windy: (state) => state.settings?.preferences?.windy,
    readOnly: (state) => {
      const demo_email = state.settings?.email.match(demo_pattern)
      console.debug('readOnly', demo_email)
      if (demo_email != null && import.meta.env.PROD) {
        return true
      }
      return false
    },
  },
})
export default useGlobalStore
