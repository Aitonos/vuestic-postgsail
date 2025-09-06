import { ref } from 'vue'
import { Response } from './../data/types'
import type { JSObj, Callback_1Param, JSONObject } from '../data/types'
import defineAPIStore from './defineAPIStore'
import moment from 'moment'
import PostgSail from '../services/api-client'
import type * as GeoJSON from 'geojson'

const assertions: JSObj = {
  notArray: [
    (res: any) => Array.isArray(res),
    // De-duplication opportunity in next assertion's message
    (res: any) => 'Wrong API response. Expected array, got ' + typeof res,
  ],
  notPopulatedArray: [
    (res: any) => Array.isArray(res) && res[0],
    (res: any) => 'Wrong API response. Expected populated array, got ' + typeof res,
  ],
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const useCacheStore = defineAPIStore('cache', {
  state: () => ({
    store_ttl: (import.meta.env.DEV ? 10 : 60) * 60 * 1000, // m * s * ms
    logs: [],
    log_get: [],
    stays: [],
    stay_get: [],
    moorages: [],
    moorage_get: [],
    stats: new Array(12).fill(0),
    tiles: new Array(3).fill(0),
    lines: {},
    matrix: [],
    log_tags: [],
    refresh: 'false',
    logs_map: [],
    moorages_map: [],
    stays_map: [],
  }),

  actions: {
    async getAPI(endpoint: string, param: string | undefined): Promise<any> {
      const assertion: Callback_1Param =
          endpoint[0].slice(-4) === '_get' ? assertions.notPopulatedArray : assertions.notArray,
        addr: string[] = [endpoint]
      param && addr.push(param)
      return await this.getCached(addr, assertion, this.refresh)
    },
    async resetCache() {
      /* There is 2 layers of cache which can lead to confusion.
       * - Application cache using the store
       * - Network cache from browser cache, default 5min from api cache-control headers.
       * Below we reset the storage cache and enforce a request refresh to get the latest content
       */
      this.logs = []
      this.log_get = []
      this.log_tags = []
      this.stays = []
      this.stay_get = []
      this.moorages = []
      this.moorage_get = []
      this.store_ttl = null
      this.refresh = 'true'
      this.getAPI('logs')
      this.getAPI('stays')
      this.getAPI('moorages')
      this.refresh = 'false'
      this.logs_map = []
      this.moorages_map = []
      this.stays_map = []
      console.log('CacheStore resetCache')
    },

    getTags(): Array<string> {
      this.log_tags = []
      if (Array.isArray(this.logs) && this.logs.length > 0) {
        const tagSet = new Set<string>()
        this.logs.forEach(({ tags }: { tags: Array<string> }) => {
          if (tags) {
            tags.forEach((tag) => {
              tagSet.add(tag)
            })
          }
        })
        this.log_tags = Array.from(tagSet).sort()
      }
      return this.log_tags
    },
    InfoTiles(): Array<number> {
      if (this.logs && this.stays && this.moorages) {
        this.tiles = [this.logs.length, this.stays.length, this.moorages.length]
      } else {
        this.tiles = [0, 0, 0]
      }
      return this.tiles
    },
    barChart(): Array<number> {
      this.stats.fill(0)
      if (Array.isArray(this.logs) && this.logs.length > 0) {
        this.logs.forEach(({ started }: { started: string }) => (this.stats[new Date(started).getMonth()] += 1))
      }
      return this.stats
    },
    lineChartbyYear(): JSONObject {
      const obj = {} as JSONObject
      if (Array.isArray(this.logs) && this.logs.length > 0) {
        // Extract the year and create a 12 months array
        this.logs.forEach(
          ({ started }: { started: string }) => (obj[new Date(started).getFullYear()] = new Array(12).fill(0)),
        )
        // Extract the month and sum the months.
        this.logs.forEach(
          ({ started }: { started: string }) =>
            (obj[new Date(started).getFullYear()][new Date(started).getMonth()] += 1),
        )
        console.log('CacheStore lineChartbyYear obj', obj)
        this.lines = obj
      }
      return obj
    },
    matrixChartbyMonthDay(): Array<string> {
      if (!Array.isArray(this.logs)) return []
      const obj: { [key: string]: any } = []
      // Create a 12 months array per 7 days array zero fill
      const months = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
      const weekdays = [0, 1, 2, 3, 4, 5, 6]
      for (const [key, value] of Object.entries(months)) {
        //console.log(key, value)
        obj[value] = {}
        for (const [subkey, subvalue] of Object.entries(weekdays)) {
          //console.log(key, value, subkey, subvalue)
          obj[value][subvalue] = 0
        }
      }
      // Sum the days
      this.logs.forEach(({ started }: { started: string }) => {
        const date = new Date(started)
        const month = date.getMonth() // 0–11
        const weekday = date.getDay() // 0–6, Sunday = 0
        obj[month][weekday] += 1
      })
      // Create the matrix array of json
      // [ { x: 'January', y: 'Sunday', v: 0 }, ..., { x: 'December', y: 'Saturday', v: 0 } ]
      // [ { x: '0', y: '0', v: 0 }, ..., { x: '12', y: '6', v: 0 } ]
      const z: any[] = []
      for (const [key, value] of Object.entries(months)) {
        //console.log(key, value)
        for (const [subkey, subvalue] of Object.entries(weekdays)) {
          //console.log(key, value, subkey, subvalue, obj[value][subvalue])
          z.push({ x: value, y: subvalue, v: obj[value][subvalue] })
        }
      }
      console.log('CacheStore matrixChartbyMonthDay obj', obj)
      this.matrix = z
      return z
    },
    async fetchAllInBackground(type: 'logs' | 'moorages' | 'stays', startPage = 2, delayMs = 5000) {
      const api = new PostgSail()
      let page = startPage
      let done = false
      const allItems = [...this[`${type}_map`]] // start with the first batch already loaded

      while (!done) {
        const response = await api[`${type}_map`]({}, page)
        if (response && Array.isArray(response) && response.length > 0) {
          allItems.push(...response)
          this[`${type}_map`] = [...allItems] // update reactively
          console.debug(`Fetched ${type} page ${page}: ${response.length} entries`)
          if (response.length < 100) {
            done = true
          } else {
            page++
            await delay(delayMs)
          }
        } else {
          done = true
        }
      }

      console.log(`Finished loading all ${type}`)
    },

    async loadInitialPages() {
      const api = new PostgSail()

      // Load first 100 logs
      const logs = await api.logs_map({}, 1)
      this.logs_map = logs || []
      if (logs && logs.length == 100) {
        this.fetchAllInBackground('logs') // continue in background
      }
      // Load first 100 moorages
      const moorages = await api.moorages_map({}, 1)
      this.moorages_map = moorages || []
      if (moorages && moorages.length == 100) {
        this.fetchAllInBackground('moorages')
      }

      // Load first 100 stays
      const stays = await api.stays_map({}, 1)
      this.stays_map = stays || []
      if (stays && stays.length == 100) {
        this.fetchAllInBackground('stays')
      }
    },

    async getMap() {
      console.log(
        'CacheStore getMap',
        'logs_map',
        this.logs_map.length,
        'moorages_map',
        this.moorages_map.length,
        'stays_map',
        this.stays_map.length,
      )
      if (this.logs_map.length != 0 && this.logs_map.length === this.logs.length) return /// Data in cache
      if (this.moorages_map.length != 0 && this.moorages_map.length === this.moorages.length) return /// Data in cache
      if (this.stays_map.length != 0 && this.stays_map.length === this.stays.length) return /// Data in cache
      await this.loadInitialPages() // UI can render after this, rest loads in background
    } /*
    pieChartLogs(): JSONObject {
      const obj = {
        total_duration: [] as number[],
        total_distance: 0,
        total_count: 0,
        max_duration_id: 0,
        max_distance_id: 0,
        max_duration: [] as number[],
        max_distance: 0,
        percentage: 0,
      }
      // Extract Sum Distances,Sum Duration of logs
      this.logs.forEach(({ id, Distance, Duration }: { id: number; Distance: number; Duration: number }) => {
        obj.total_distance += Distance
        //obj.total_duration += moment.duration(Duration)
        obj.total_duration = moment.duration(Duration) + moment.duration(obj.total_duration)
        if (Math.max(Distance, obj.max_distance)) {
          obj.max_distance_id = id
          obj.max_distance = Math.max(Distance, obj.max_distance)
        }
        if (moment.duration(Duration) > moment.duration(obj.max_duration)) {
          obj.max_duration_id = id
          obj.max_duration = moment.duration(Duration)
        }
      })
      //obj.total_duration = moment.duration(obj.total_duration).humanize()
      const start = this.logs[0].started
      const end = this.logs[this.logs.length - 1].Ended
      obj.percentage = (moment.duration(obj.total_duration) / moment.duration(moment(start) - moment(end))) * 100
      obj.total_count = this.logs.length
      console.log('CacheStore pieChartLogs obj', obj)
      return obj
    },
    pieChartStays(): JSONObject {
      let total_duration = 0
      const obj = {
        Unclassified: { duration: 0, percentage: 0 },
        Anchor: { duration: 0, percentage: 0 },
        Buoy: { duration: 0, percentage: 0 },
        Dock: { duration: 0, percentage: 0 },
      }
      // Extract Sum Duration of stays by type
      this.stays.value.forEach(({ stayed_at_id, duration }: { stayed_at_id: number; duration: any }) => {
        total_duration += moment.duration(duration)
        switch (stayed_at_id) {
          case 1:
            obj.Unclassified.duration += moment.duration(duration)
            break
          case 2:
            obj.Anchor.duration += moment.duration(duration)
            break
          case 3:
            obj.Buoy.duration += moment.duration(duration)
            break
          case 4:
            obj.Dock.duration += moment.duration(duration)
            break
          default:
            break
        }
      })
      obj.Unclassified.percentage = (moment.duration(obj.Unclassified.duration) / moment.duration(total_duration)) * 100
      obj.Anchor.percentage = (moment.duration(obj.Anchor.duration) / moment.duration(total_duration)) * 100
      obj.Buoy.percentage = (moment.duration(obj.Buoy.duration) / moment.duration(total_duration)) * 100
      obj.Dock.percentage = (moment.duration(obj.Dock.duration) / moment.duration(total_duration)) * 100
      obj.Unclassified.duration = Math.trunc(moment.duration(obj.Unclassified.duration).as('days'))
      obj.Anchor.duration = Math.trunc(moment.duration(obj.Anchor.duration).as('days'))
      obj.Buoy.duration = Math.trunc(moment.duration(obj.Buoy.duration).as('days'))
      obj.Dock.duration = Math.trunc(moment.duration(obj.Dock.duration).as('days'))
      console.log('pieChartStays obj', obj)
      return obj
    },*/,
  } as JSObj,
  getters: {
    getInfoTiles: (state: JSObj) => state.tiles,
    logs_by_month: (state: JSObj) => state.stats,
    logs_by_year_by_month: (state: JSObj) => state.lines,
    logs_by_month_by_weekday: (state: JSObj) => state.matrix,
    GetLastLogId: (state: JSObj) => (state?.logs && state.logs.length > 1 ? state.logs[0].id : -1),
    GetLogsDistance: (state: JSObj) => {
      let sum = 0
      state.logs.forEach(({ distance }: { distance: number }) => {
        sum += distance
      })
      return sum
    },
    mapGeoJSON: (state: JSObj) => {
      return {
        logs_map: state.logs_map
          .map((row: { geojson: any }) => row.geojson) // unwrap first
          .filter((feature: any) => feature.geometry.type === 'LineString')
          .map((feature: any, index: number) => {
            // Clone or shallow copy if needed
            const midPoint = Math.round(feature.geometry.coordinates.length / 2)
            const centerLat = parseFloat(feature.geometry.coordinates[midPoint][1])
            const centerLng = parseFloat(feature.geometry.coordinates[midPoint][0])
            return {
              ...feature,
              properties: {
                ...feature.properties,
                logIndex: index,
                centercoords: [centerLat, centerLng],
              },
            }
          }),
        moorages_map: state.moorages_map
          .map((row: { geojson: any }) => row.geojson) // unwrap geojson
          .filter((feature: any) => feature.geometry.type === 'Point')
          .sort((a: any, b: any) => b.geometry.coordinates[1] - a.geometry.coordinates[1]) // north to south
          .map((feature: any, index: number) => {
            const defaultStayId = feature.properties.default_stay_id
            let iconUrl = '/anchoricon.png'
            if (defaultStayId === 3) {
              iconUrl = '/mooring_icon.png'
            } else if (defaultStayId === 4) {
              iconUrl = '/dock_icon.png'
            }

            return {
              ...feature,
              properties: {
                ...feature.properties,
                moorageIndex: index,
                iconUrl,
              },
            }
          }),
        stays_map: state.stays_map,
      }
    },
  },
})
export default useCacheStore
