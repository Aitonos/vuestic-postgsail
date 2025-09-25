<template>
  <va-card class="leaflet-map__full">
    <template v-if="apiError">
      <va-alert color="danger" outline class="mb-4"> {{ $t('api.error') }}: {{ apiError }} </va-alert>
    </template>
    <template v-if="offline && apiSuccess && nodatayet">
      <noDataYet />
    </template>
    <template v-if="!offline && apiSuccess && !nodatayet">
      <template v-if="mapGeoJsonFeatures">
        <l-map
          id="monitoring-map"
          :tabs="['modern']"
          :tabs-auto-open="true"
          :geo-json-feature="Array.isArray(mapGeoJsonFeatures) ? null : mapGeoJsonFeatures"
          :geo-json-features="Array.isArray(mapGeoJsonFeatures) ? mapGeoJsonFeatures : null"
          :map-zoom="13"
          map-type="Satellite"
        >
          <template #tab-modern>{{ items.vessel_name }}</template>
          <template #content-modern>
            <div v-if="items_modern" class="w-full">
              <h2 class="flex items-center gap-2">
                {{ items_modern.updated }} <span class="dot" :style="{ backgroundColor: statusColor }"></span>
                <VaImage :src="`/realtime.svg`" class="w-6 h-6 inline-block align-middle" />
              </h2>
              <hr class="cool-hr" />
              <h3 class="font-semibold">Wind & Depth</h3>
              <div class="w-full flex justify-center items-center">
                <div
                  v-if="items_modern.wind.speed !== null && items_modern.wind.speed !== undefined"
                  class="flex items-center space-x-4"
                >
                  <!-- Left Column -->
                  <div class="flex flex-col text-sm space-y-1 min-w-[100px]">
                    <div>Wind Speed: {{ speedFormatKnots(items_modern.wind.speed) }}</div>
                    <div>Wind Direction: {{ angleFormat(items_modern.wind.direction) }}</div>
                    <div>Depth: {{ depthFormatI18n(items_modern.water.depth) }}</div>
                  </div>

                  <!-- Right Column (Wind Compass) -->
                  <div
                    class="wind-compass group relative"
                    :title="`Wind: ${items_modern.wind.speed} Kt, ${items_modern.wind.direction} deg`"
                  >
                    <!-- Circular wind speed ring -->
                    <svg class="speed-circle" viewBox="0 0 100 100">
                      <circle class="bg" cx="50" cy="50" r="45" />
                      <circle
                        class="progress"
                        :stroke="getSpeedColor(items_modern.wind.speed)"
                        cx="50"
                        cy="50"
                        r="45"
                        :stroke-dasharray="dashArray"
                        stroke-dashoffset="0"
                      />
                    </svg>

                    <!-- Rotating Arrow -->
                    <svg
                      class="arrow-svg"
                      :style="{ transform: `rotate(${items_modern.wind.direction}deg)` }"
                      viewBox="0 0 36 36"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        x="3"
                        y="3"
                        width="25"
                        height="25"
                        transform="rotate(-249.5,15.5,15.5)"
                        fill="#145da0"
                        d="M26.675824776131577 2.519999999999989L2.500000600307402 13.822982731554148 2.500000600307402 14.764897959183662 10.46703356734037 18.728791208791197ZM11.291209391516192 19.55296703296702L15.25510264112373 27.51999999999999 16.197017868753242 27.51999999999999 27.500000600307402 3.3441758241758133Z"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              <hr class="cool-hr" />
              <h3 class="font-semibold">Temperature</h3>
              <div v-if="items_modern.temperature.inside" class="w-full h-24">
                <echartsProgress
                  :series="[items_modern.temperature.inside]"
                  title="Inside"
                  :alarm="items_modern.alarm.low_indoor_temperature_threshold"
                  :theme="currentTheme"
                />
              </div>
              <div v-if="items_modern.temperature.outside" class="w-full h-24">
                <echartsProgress
                  :series="[items_modern.temperature.outside]"
                  title="Outside"
                  :alarm="items_modern.alarm.low_outdoor_temperature_threshold"
                  :theme="currentTheme"
                />
              </div>
              <div v-if="items_modern.water.temperature" class="w-full h-24">
                <echartsProgress
                  :series="[items_modern.water.temperature]"
                  title="Water"
                  :alarm="items_modern.alarm.low_water_temperature_threshold"
                  :theme="currentTheme"
                />
              </div>
              <hr class="cool-hr" />
              <h3 class="font-semibold">Humidity</h3>
              <div v-if="items_modern.humidity.inside" class="w-full h-24">
                <echartsProgress
                  :series="[items_modern.humidity.inside]"
                  title="Inside"
                  :max="100"
                  unit="%"
                  :theme="currentTheme"
                />
              </div>
              <div v-if="items_modern.humidity.outside" class="w-full h-24">
                <echartsProgress
                  :series="[items_modern.humidity.outside]"
                  title="Outside"
                  :max="100"
                  unit="%"
                  :theme="currentTheme"
                />
              </div>
              <template v-if="items_modern.outsidepressurehistory">
                <hr class="cool-hr" />
                <h3 class="font-semibold">Barometer</h3>
                <div class="w-full h-28">
                  <echartsPressure
                    :series="items_modern.outsidepressurehistory"
                    title="Outside"
                    :theme="currentTheme"
                  />
                </div>
              </template>
              <template v-if="items_modern.battery.charge">
                <hr class="cool-hr" />
                <h3 class="font-semibold">Battery</h3>
                <div class="w-full h-28">
                  <echartsGauge
                    :series="[items_modern.battery.charge, items_modern.battery.voltage]"
                    unit="V"
                    unit-label="%"
                    :theme="currentTheme"
                  />
                </div>
              </template>
              <template v-if="items_modern.solar.power">
                <hr class="cool-hr" />
                <h3 class="font-semibold">Solar</h3>
                <div class="w-full h-28">
                  <echartsGauge
                    :series="[items_modern.solar.power, items_modern.solar.voltage]"
                    :max="items_modern.solar.power + 50"
                    unit="V"
                    unit-label="W"
                    :theme="currentTheme"
                  />
                </div>
              </template>
              <template v-if="items_modern.tank.level">
                <hr class="cool-hr" />
                <h3 class="font-semibold">Tank</h3>
                <div class="w-full h-28">
                  <echartsGauge
                    :series="[items_modern.tank.level, items_modern.tank.level]"
                    unit="%"
                    unit-label="%"
                    :theme="currentTheme"
                  />
                </div>
              </template>
            </div>
          </template>
        </l-map>
      </template>
    </template>
  </va-card>
</template>

<script setup>
  import 'leaflet/dist/leaflet.css'
  import 'leaflet.sidepanel/dist/leaflet.sidepanel.css'
  import L from 'leaflet'
  import 'leaflet.sidepanel'

  // TODO update setup with lang="ts"
  import { computed, ref, reactive, onMounted } from 'vue'
  import { setAppTitle } from '../../utils/app.js'
  import PostgSail from '../../services/api-client'
  import lMap from '../../components/maps/leafletMap.vue'
  import { useI18n } from 'vue-i18n'
  import { dateFormatUTC, fromNow, nowUTC } from '../../utils/dateFormatter.js'
  import { depthFormatI18n } from '../../utils/distanceFormatter.js'
  import { angleFormat } from '../../utils/angleFormatter.js'
  import { speedFormatKnots } from '../../utils/speedFormatter.js'
  import { kelvinToHuman } from '../../utils/temperatureFormatter.js'
  import { pascalToHectoPascal } from '../../utils/presureFormatter.js'
  import { floatToPercentage } from '../../utils/percentageFormatter.js'
  import { default as utils } from '../../utils/utils.js'

  import monitoringDatas from '../../data/monitoring.json'
  import useGlobalStore from '../../stores/global-store'
  import { storeToRefs } from 'pinia'

  import echartsProgress from '../../components/echarts/progress.vue'
  import echartsGauge from '../../components/echarts/gauge.vue'
  //import echartsPressure from '../../components/echarts/gaugePressure.vue'
  import echartsPressure from '../../components/echarts/timeseries.vue'

  import noDataYet from '../../components/noDataScreen.vue'

  const GlobalStore = useGlobalStore()
  const { isSidebarMinimized, currentTheme } = storeToRefs(GlobalStore)
  const { t } = useI18n()

  const isBusy = ref(false)
  const apiError = ref(null)
  const apiSuccess = ref(null)
  const apiData = reactive({ row: null })
  const nodatayet = ref(false)
  const offline = ref(true)

  const items = computed(() => {
    return apiData.row
      ? {
          wind: {
            headerString: t('monitoring.wind.headerString'),
            unitString: t('monitoring.wind.unitString'),
            detailString: t('monitoring.wind.detailString'),
            detailUnitString: 'deg',
            lcdDecimals: 0,
            value: utils.metersToKnots(apiData.row.windspeedoverground) || 0,
            altValue: utils.radiantToDegrees(apiData.row.winddirectiontrue) || 0,
          },
          temperature: {
            headerString: t('monitoring.temperature.headerString'),
            unitString: tempUnit.value,
            detailString: t('monitoring.temperature.detailString'),
            detailUnitString: tempUnit.value,
            lcdDecimals: 1,
            value: kelvinToHuman(apiData.row.insidetemperature) || 0.0,
            altValue: kelvinToHuman(apiData.row.outsidetemperature) || 0.0,
          },
          water: {
            headerString: t('monitoring.water.headerString'),
            unitString: depthUnit.value,
            detailString: t('monitoring.water.detailString'),
            detailUnitString: tempUnit.value,
            lcdDecimals: 1,
            value: meterToFeet.value || 0,
            altValue: kelvinToHuman(apiData.row.watertemperature) || 0.0,
          },
          battery: {
            headerString: t('monitoring.battery.headerString'),
            unitString: t('monitoring.battery.unitString'),
            detailString: t('monitoring.battery.detailString'),
            detailUnitString: 'V',
            lcdDecimals: 1,
            value: floatToPercentage(apiData.row.batterycharge) || 0,
            altValue: apiData.row.batteryvoltage || 0,
          },
          humidity: {
            headerString: t('monitoring.humidity.headerString'),
            unitString: t('monitoring.humidity.unitString'),
            detailString: t('monitoring.humidity.detailString'),
            detailUnitString: t('monitoring.humidity.unitString'),
            lcdDecimals: 0,
            value: floatToPercentage(apiData.row.insidehumidity) || 0,
            altValue: floatToPercentage(apiData.row.outsidehumidity) || 0,
          },
          pressure: {
            headerString: t('monitoring.pressure.headerString'),
            unitString: t('monitoring.pressure.unitString'),
            detailString: t('monitoring.pressure.detailString'),
            detailUnitString: t('monitoring.pressure.unitString'),
            lcdDecimals: 1,
            value: pascalToHectoPascal(apiData.row.insidepressure) || 0.0,
            altValue: pascalToHectoPascal(apiData.row.outsidepressure) || 0.0,
          },
          solar: {
            headerString: t('monitoring.solar.headerString'),
            unitString: t('monitoring.solar.unitString'),
            detailString: t('monitoring.battery.detailString'),
            detailUnitString: 'V',
            lcdDecimals: 1,
            value: apiData.row.solarpower || 0,
            altValue: apiData.row.solarvoltage || 0,
          },
          vessel_name: apiData.row.name,
          geojson: apiData.row.geojson,
          live: apiData.row.live,
        }
      : {}
  })

  const getSpeedColor = (speed) => {
    if (speed <= 10) return '#91cc75'
    if (speed <= 20) return '#fac858'
    return '#ee6666'
  }
  const circumference = 2 * Math.PI * 45 // r = 38 now
  const dashArray = computed(() => {
    if (!items.value?.wind?.speed) return `0, ${circumference}`
    return `${(items.value.wind.speed / 30) * circumference}, ${circumference}`
  })
  const statusColor = computed(() => {
    return apiData.row.offline ? 'orange' : 'green'
  })

  const items_modern = computed(() => {
    console.debug('items api_monitoring', apiData.row)
    return apiData.row
      ? {
          time: dateFormatUTC(apiData.row.time),
          updated: fromNow(apiData.row.time),
          wind: {
            speed: isNaN(apiData.row.windspeedoverground) ? null : utils.metersToKnots(apiData.row.windspeedoverground),
            direction: utils.radiantToDegrees(apiData.row.winddirectiontrue) || null,
          },
          temperature: {
            inside: kelvinToHuman(apiData.row.insidetemperature) || null,
            outside: kelvinToHuman(apiData.row.outsidetemperature) || null,
          },
          water: {
            depth: depthFormatI18n(apiData.row.depth) || null,
            temperature: kelvinToHuman(apiData.row.watertemperature) || null,
          },
          battery: {
            charge: floatToPercentage(apiData.row.batterycharge) || null,
            voltage: parseFloat(apiData.row.batteryvoltage).toFixed(1) || null,
          },
          humidity: {
            inside: floatToPercentage(apiData.row.insidehumidity) || null,
            outside: floatToPercentage(apiData.row.outsidehumidity) || null,
          },
          pressure: {
            inside: pascalToHectoPascal(apiData.row.insidepressure) || null,
            outside: pascalToHectoPascal(apiData.row.outsidepressure) || null,
          },
          solar: {
            voltage: parseFloat(apiData.row.solarvoltage).toFixed(1) || null,
            power: isNaN(apiData.row.solarpower) ? null : parseInt(apiData.row.solarpower), // 0 is treat as false
          },
          tank: {
            level: floatToPercentage(apiData.row.tanklevel) || null,
          },
          outsidepressurehistory: apiData.row.outsidepressurehistory || null,
          vessel_name: apiData.row.name,
          status: apiData.row.status,
          geojson: apiData.row.geojson,
          live: apiData.row.live,
          alarm: GlobalStore.settings.preferences.alerting,
          offline: apiData.row.offline,
        }
      : {}
  })

  const msg_fromNow = computed(() => {
    return fromNow(apiData.row.time)
  })

  const sub_msg = computed(() => {
    return apiData.row.time && !apiData.row.offline ? 'Online' : 'Offline'
  })

  const mapGeoJsonFeatures = computed(() => {
    if (apiData.row.status != 'moored' && apiData.row.status != 'anchored') {
      return items.value.live.features
    }
    return apiData.row.live ? items.value.live : items.value.geojson
  })

  const tempUnit = computed(() => {
    return GlobalStore.imperialUnits
      ? t('monitoring.imperial_units.temperature')
      : t('monitoring.temperature.unitString')
  })

  const depthUnit = computed(() => {
    return GlobalStore.imperialUnits ? t('monitoring.imperial_units.depth') : t('monitoring.water.unitString')
  })

  const meterToFeet = computed(() => {
    return GlobalStore.imperialUnits ? (apiData.row.depth || 0) * 3.2808399 : apiData.row.depth || 0
  })

  const windDirection = computed(() => ({
    rotate: `${utils.radiantToDegrees(apiData.row.winddirectiontrue) - 180}deg`,
  }))

  onMounted(async () => {
    isBusy.value = true
    apiError.value = null
    const api = new PostgSail()
    try {
      const response = await api.monitoring_live()
      if (Array.isArray(response) && response[0]) {
        //console.debug(response[0])
        apiSuccess.value = true
        offline.value = false
        nodatayet.value = false
        //offline.value = response[0].offline
        apiData.row = response[0]
        //console.log(apiData)
        //console.log(response[0].time)
        //console.log(moment.utc(response[0].time).locale('es').fromNow())
        //setTimeout(() => monitor(), 60 * 1000) // 1 min
        if (apiData.row.name) {
          document.title = setAppTitle(t('monitoring.title') + ': ' + apiData.row.name)
        }
      } else {
        console.warn('monitoring', response)
        if ((Array.isArray(response) && response.length === 0) || !response[0]) {
          apiSuccess.value = true
          offline.value = true
          nodatayet.value = true
          apiData.row = []
        }
        //throw { response }
      }
    } catch ({ response }) {
      console.log(response)
      apiError.value = t('monitoring.error')
      if (!import.meta.env.PROD) {
        console.warn('Fallback using sample data from local json...', apiError.value)
        //console.log(monitoringDatas[0].time)
        // Update time to now
        monitoringDatas[0].time = nowUTC()
        apiData.row = monitoringDatas[0]
      }
    } finally {
      isBusy.value = false
    }
  })
</script>

<style lang="scss">
  #monitoring-map {
    width: 100%;
    height: calc(100vh - 4.5rem);
  }
  .sidepanel {
    width: 240px;
    height: 100%;
    .sidepanel-content {
      width: 240px;
      height: 100%;
    }
  }

  .wind-compass {
    position: relative;
    width: 80px;
    height: 80px;
  }

  .speed-circle {
    width: 80px;
    height: 80px;
    transform: rotate(-90deg);
  }

  circle.bg {
    fill: none;
    stroke: #eee;
    stroke-width: 12;
  }

  circle.progress {
    fill: none;
    stroke-width: 12;
    transition: stroke 0.3s;
  }

  .arrow-svg {
    position: absolute;
    top: 12px;
    left: 12px;
    width: 56px;
    height: 56px;
    opacity: 0.8;
    transition: transform 0.5s ease;
    transform-origin: center center;
  }

  .dot {
    display: inline-block; /* Ensures it's on the same line as the text */
    width: 10px; /* Size of the dot */
    height: 10px; /* Size of the dot */
    //background-color: green; /* Green color for the dot */
    border-radius: 50%; /* Makes it circular */
    animation: pulseAnimation 1s infinite; /* Makes it pulse */
    margin-left: 10px; /* Adds space between the text and the dot */
  }

  @keyframes pulseAnimation {
    0% {
      transform: scale(1);
      opacity: 1;
    }
    50% {
      transform: scale(1.5); /* Increase the size slightly */
      opacity: 0.6;
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }
  .cool-hr {
    margin: 5px;
  }
</style>
