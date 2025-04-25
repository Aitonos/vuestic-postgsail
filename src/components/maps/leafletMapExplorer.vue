<script setup>
  /* eslint-disable */
  import { onMounted, ref, computed, watch, reactive } from 'vue'
  import 'leaflet/dist/leaflet.css'
  import 'leaflet.sidepanel/dist/style.css'
  import L from 'leaflet'
  import 'leaflet.sidepanel'
  import SmoothMarkerBouncing from 'leaflet.smooth_marker_bouncing'

  import PostgSail from '../../services/api-client'
  import { dateFormatUTC, durationFormatHours, fromNow, nowUTC } from '../../utils/dateFormatter.js'
  import { distanceFormatMiles, distanceFormat } from '../../utils/distanceFormatter.js'
  import { speedFormatKnots } from '../../utils/speedFormatter.js'
  import { stayed_at_options } from '../../utils/PostgSail.ts'
  import { kelvinToHuman } from '../../utils/temperatureFormatter.js'
  import { pascalToHectoPascal } from '../../utils/presureFormatter.js'
  import { floatToPercentage } from '../../utils/percentageFormatter.js'
  import { default as utils } from '../../utils/utils.js'
  import { baseMaps, overlayMaps } from './leafletHelpers.js'

  import { storeToRefs } from 'pinia'
  import { useGlobalStore } from '../../stores/global-store'
  const GlobalStore = useGlobalStore()
  const { isSidebarMinimized } = storeToRefs(GlobalStore)

  import { useI18n } from 'vue-i18n'
  const { t } = useI18n()

  // Adds bouncing plugin code to the global L variable
  SmoothMarkerBouncing(L)
  // Sets options of bouncing of all markers
  L.Marker.setBouncingOptions({
    bounceHeight: 60, // height of the bouncing
    bounceSpeed: 54, // bouncing speed coefficient
    exclusive: true, // if this marker is bouncing all others must stop
  })

  const isBusy = ref(false)
  const apiError = ref(null)
  const api_geojson = ref({})
  const map = ref(null)
  const currentZoom = ref(7)
  const tabs = ['Logs', 'Moorages']
  const sidepanelLeft = ref(null)
  const mooragesLayers = ref([])
  const mooragesMakers = ref([])
  const logsLayers = ref([])
  const mooragesList = ref([])
  const logsList = ref([])
  const api_monitoring = ref({})

  onMounted(async () => {
    isBusy.value = true
    apiError.value = null
    try {
      const api = new PostgSail()
      const response = await api.logs_mapgl()
      if (response.geojson) {
        api_geojson.value = response.geojson
        console.log('Explore map geojson', api_geojson.value)
      } else {
        throw { response }
      }
    } catch (e) {
      if (!import.meta.env.PROD) {
        console.warn('Fallback using sample data from local json...', e)
        api_geojson.value = {}
        apiError.value = 'Error'
        isBusy.value = false
        return
      }
    } finally {
      isBusy.value = false
    }

    // Extract the first coordinates as a center
    const coords = api_geojson.value.features[0].geometry.coordinates[0]
    map.value = L.map(document.getElementById('explore-map'), {
      //center: [coords[1], coords[0]],
      zoom: currentZoom.value,
      zoomControl: false,
    })
    // Track zoom level and hide/show labels based on zoom
    map.value.on('zoomend', () => {
      currentZoom.value = map.value.getZoom()
    })
    const bMaps = baseMaps()
    const oMaps = overlayMaps()
    bMaps['CartoDB.Positron'].addTo(map.value)
    L.control.layers(bMaps, oMaps).addTo(map.value)
    // Zoom to bottomright
    L.control.zoom({ position: 'bottomright' }).addTo(map.value)

    // Backup full list of moorages and logs
    mooragesList.value = mooragesListFull.value
    logsList.value = logsListFull.value

    // Add moorage layers (each Point as a separate layer)
    mooragesLayers.value = mooragesList.value.map((feature) => {
      //console.log(feature)
      return L.geoJSON(feature, {
        pointToLayer: markerIcon,
        onEachFeature: onEachMoorageFeaturePopup,
      })
    })

    // Add log layers (each LineString as a separate layer)
    logsLayers.value = logsList.value.map((feature) => {
      //console.log(feature)
      return L.geoJSON(feature, {
        style: function (feature) {
          return { color: random_rgb_dark(), weight: 3 } // Apply random color to each LineString
        },
        onEachFeature: onEachLogFeaturePopup,
      })
    })

    // Create a side panel on the left
    sidepanelLeft.value = L.control
      .sidepanel('sidepanelLeft', {
        tabsPosition: 'top',
        startTab: 'tab-1',
      })
      .addTo(map.value)

    map.value.whenReady(function () {
      const sidepanel = document.getElementById('sidepanelLeft')

      // Watch class changes
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.attributeName === 'class') {
            if (sidepanel.classList.contains('opened')) {
              sidepanel.setAttribute('aria-hidden', 'false')
              // Sidebar has been opened
              console.log('Sidebar opened — updating map')
              updateMap()
            } else {
              sidepanel.setAttribute('aria-hidden', 'true')
            }
          }
        })
      })

      observer.observe(sidepanel, { attributes: true })

      // Optional: open sidepanel initially
      const toggleButton = document.querySelector('.sidepanel-toggle-button')
      if (toggleButton) toggleButton.click()
    })

    // Add initial logs and moorages layer
    updateMap()

    // Minimize sidebar
    isSidebarMinimized.value = true
  })

  // Extract all geometry Point from geojson to get a list of moorage geojson feature for map
  const mooragesListFull = computed(() => {
    if (!api_geojson.value?.features) return []
    return api_geojson.value.features
      .filter((feature) => feature.geometry.type === 'Point')
      .map((feature, index) => {
        feature.properties['moorageIndex'] = index // keep original index
        return feature
      })
  })

  // Extract all geometry LineString from geojson to get a list of log geojson feature for map
  const logsListFull = computed(() => {
    if (!api_geojson.value?.features) return []
    return api_geojson.value.features
      .filter((feature) => feature.geometry.type === 'LineString')
      .map((feature, index) => {
        feature.properties['logIndex'] = index // keep original index
        const midPoint = Math.round(feature.geometry.coordinates.length / 2)
        const centerLat = parseFloat(feature.geometry.coordinates[midPoint][1])
        const centerLng = parseFloat(feature.geometry.coordinates[midPoint][0])
        feature['properties']['centercoords'] = [centerLat, centerLng]
        return feature
      })
  })

  // Extract all geometry LineString from geojson to get a list of log date for slider
  const logsSlider = computed(() => {
    if (!api_geojson.value?.features) return []
    return api_geojson.value.features
      .filter((feature) => feature.geometry.type === 'LineString')
      .map((feature) => feature.properties.starttimestamp)
  })

  // Filter logs and update layers and set bounds
  const updateMap = () => {
    if (!map.value) return

    // Remove all existing layers from map
    logsLayers.value.forEach((layer) => map.value.removeLayer(layer))
    mooragesLayers.value.forEach((layer) => map.value.removeLayer(layer))

    // Reset visible lists
    logsList.value = []
    mooragesList.value = []

    // Get selected date range
    const [startIdx, endIdx] = selectedRange.value
    const logStart = new Date(logsListFull.value[startIdx].properties.starttimestamp)
    const logEnd = new Date(logsListFull.value[endIdx].properties.endtimestamp)

    // Add logs in range
    for (let i = startIdx; i <= endIdx; i++) {
      const logFeature = logsListFull.value[i]
      if (logsLayers.value[i]) {
        map.value.addLayer(logsLayers.value[i])
        logsList.value.push(logFeature)
      }
    }

    // Add moorages in range
    mooragesListFull.value.forEach((moorageFeature, i) => {
      const moorageStart = new Date(moorageFeature.properties.stay_first_seen)
      const moorageEnd = new Date(moorageFeature.properties.stay_last_seen)

      if (moorageStart <= logEnd && moorageEnd >= logStart) {
        mooragesList.value.push(moorageFeature)
        if (mooragesLayers.value[i]) {
          map.value.addLayer(mooragesLayers.value[i])
        }
      }
    })

    const updatedBounds = L.latLngBounds([])
    // Loop through each layer and extend the bounds with its coordinates
    mooragesLayers.value.forEach((layer) => {
      if (map.value.hasLayer(layer)) {
        layer.eachLayer((featureLayer) => {
          if (featureLayer.getLatLng) {
            updatedBounds.extend(featureLayer.getLatLng())
          }
        })
      }
    })

    // Fit the map to the calculated bounds
    if (updatedBounds.isValid()) {
      map.value.fitBounds(updatedBounds)
    }
  }

  const onEachLogFeaturePopup = (feature, layer) => {
    //console.log(feature)
    // is logbook
    let starttime = dateFormatUTC(feature.properties.starttimestamp)
    let endtime = dateFormatUTC(feature.properties.endtimestamp)
    let duration = durationFormatHours(feature.properties.duration)
    let distance = distanceFormatMiles(feature.properties.distance)
    let avg_speed = speedFormatKnots(feature.properties.avg_sog)
    let max_speed = speedFormatKnots(feature.properties.max_sog)
    let avg_depth = distanceFormat(feature.properties.avg_depth)
    let max_depth = distanceFormat(feature.properties.max_depth)
    let avg_tws = speedFormatKnots(feature.properties.avg_tws)
    let max_tws = speedFormatKnots(feature.properties.max_tws)
    let notes = feature.properties?.notes || ''
    let text = `<div class='mpopup'>
                          <h4>${feature.properties.name}</a><br/>
                          <table class='data'><tbody>
                          <tr><td>Start Time</td><td>${starttime}</td></tr>
                          <tr><td>End Time</td><td>${endtime}</td></tr>
                          <tr><td>Distance</td><td>${distance}</td></tr>
                          <tr><td>Duration</td><td>${duration} hours</td></tr>
                          <tr><td>Speed</td><td>avg ${avg_speed} / max ${max_speed}</td></tr>
                          <tr><td>Wind</td><td>avg ${avg_tws} / max ${max_tws}</td></tr>
                          <tr><td>Depth</td><td>avg ${avg_depth} / max ${max_depth}</td></tr>
                          <tr><td>Notes</td><td>${notes}</td></tr>
                          </tbody></table></br>
                          <a href="/timelapse/${feature.properties.id}">Replay</a>
                        </div>`
    layer.bindPopup(text)
    layer.bindTooltip(text)
  }

  const onEachMoorageFeaturePopup = function (feature, layer) {
    //console.log(feature)
    var popupContent = '<p>I started out as a GeoJSON ' + feature.geometry.type + ", but now I'm a Leaflet vector!</p>"
    if (feature.properties && feature.properties.id) {
      let duration = durationFormatHours(feature.properties.stays_sum_duration)
      let popup = `<div class='mpopup'><center><h4><a href="/moorage/${feature.properties.id}">${feature.properties.name}</a></h4></center>`
      popup += '<table class="data">'
      popup +=
        '<tr><th>Arrivals&Departures</th><td><a href="/moorage/arrivals-departures/' + feature.properties.id + '">'
      popup += `${feature?.properties?.logs_count}`
      popup += '</a></td></tr>'
      popup += '<tr><th>Visits</th><td><a href="/moorage/arrivals-departures/' + feature.properties.id + '">'
      popup += `${feature?.properties?.stays_count}`
      popup += '</a></td></tr>'
      popup += '<tr><th>Duration</th><td>'
      popup += '<a href="/stays/moorage/' + feature.properties.id + '">' + (duration || 0) + ' hour'
      if ((duration || 0) > 1) popup = popup + 's'
      popup = popup + '</a></td></tr>'
      popup +=
        '<tr><th>Preference</th><td>' + stayed_at_options[feature.properties.default_stay_id - 1].text + '</td></tr>'
      if (feature?.properties?.notes) {
        popup += '<tr><th>Notes</th><td>' + feature?.properties?.notes + '</td></tr>'
      }
      popup += '</table></div>'
      popupContent = popup
    }
    layer.bindPopup(popupContent, {
      autoPan: true,
      autoPanPadding: [30, 30], // optional: adds padding so popup isn’t too close to edge
    })
    //layer.bindTooltip(popupContent)
    /*
    layer.on('mouseover', function () {
      layer.bounce({ duration: 500, height: 80 })
      layer.openPopup()
    })
    layer.on('mouseout', function () {
      layer.stopBouncing()
      layer.closePopup()
    })
    */
  }

  const markerIcon = function (feature, latlng) {
    let multiplier = Math.max(map.value.getZoom(), 1)
    multiplier = Math.min(map.value.getZoom(), 9)
    //console.log('multiplier', multiplier)
    let myMarker = null
    if (feature.properties.default_stay_id == 3) {
      myMarker = L.marker(latlng, {
        icon: new L.Icon({
          iconSize: [multiplier * 4, multiplier * 4],
          iconAnchor: [multiplier * 2, multiplier * 2],
          iconUrl: '/mooring_icon.png',
          popupAnchor: [0, 0],
        }),
      })
    }
    if (feature.properties.default_stay_id == 4) {
      myMarker = L.marker(latlng, {
        icon: new L.Icon({
          iconSize: [multiplier * 4, multiplier * 4],
          iconAnchor: [multiplier * 2, multiplier * 2],
          iconUrl: '/dock_icon.png',
          popupAnchor: [0, 0],
        }),
      })
    } else {
      myMarker = L.marker(latlng, {
        icon: new L.Icon({
          iconSize: [multiplier * 4, multiplier * 4],
          iconAnchor: [multiplier * 2, multiplier * 2],
          iconUrl: '/anchoricon.png',
          popupAnchor: [0, 0],
        }),
      })
    }
    //console.log(myMarker)
    mooragesMakers.value.push(myMarker)
    return myMarker
  }

  function random_rgb_dark() {
    var o = Math.floor,
      r = Math.random,
      s = 256
    return 'rgb(' + o(r() * s) + ',' + o(r() * s) + ',' + o(r() * s) + ')'
  }

  // Array of date strings
  const dateArray = ref(['2024-10-01', '2024-10-05', '2024-10-10', '2024-10-15', '2024-10-20'])

  // Set the initial range with the first and last indices of the dateArray
  const selectedRange = ref([0, 10]) // Start from first date and go to last

  // Watch for changes in dateArray and update selectedRange accordingly
  watch(logsSlider, (newValue) => {
    selectedRange.value = [0, newValue.length - 1] // Reset range to the new limits
  })

  // Watch for changes in dateArray and update selectedRange accordingly
  watch(selectedRange, (newValue) => {
    const [start, end] = newValue
    console.log('selectedRange', [start, end])
    updateMap()
  })

  // Compute the formatted date range to display the selected dates
  const formattedDateRange = computed(() => {
    const startDate = logsSlider.value[selectedRange.value[0]] // Get start date
    const endDate = logsSlider.value[selectedRange.value[1]] // Get end date
    return `${formatDate(new Date(startDate))} - ${formatDate(new Date(endDate))}`
  })

  // Function to format a date for display in a user-friendly format
  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  // Function to format the label shown on the slider for each marker
  const formatDateLabel = (index) => {
    const date = new Date(logsSlider.value[index])
    return formatDate(date)
  }
  // Function to display tooltip text with the selected date range
  const tooltipLabel = computed(() => {
    const startDate = logsSlider.value[selectedRange.value[0]]
    const endDate = logsSlider.value[selectedRange.value[1]]
    return `${formatDate(new Date(startDate))} - ${formatDate(new Date(endDate))}`
  })

  const onLogClickNavigate = (coordinates, index) => {
    //console.log('onLogClickNavigate', index)
    logsLayers.value.forEach((geoJSONLayer, i) => {
      //console.log(geoJSONLayer, i, index)
      if (i === index) {
        map.value.addLayer(geoJSONLayer)
        map.value.flyTo(coordinates, 10, { animate: true })
        setTimeout(() => {
          map.value.fitBounds(geoJSONLayer.getBounds())
          geoJSONLayer.eachLayer(function (featureLayer) {
            if (featureLayer.openPopup) {
              // Open the popup
              featureLayer.openPopup()
              // Close the side panel
              sidepanelToggleButton()
            }
          })
        }, 1000)
      } else {
        map.value.removeLayer(geoJSONLayer)
      }
    })
  }
  const onMoorageClickNavigate = (coordinates, index) => {
    //console.log('onMoorageClickNavigate', coordinates, index)
    const latlng = L.latLng(coordinates[1], coordinates[0])
    map.value.flyTo(latlng, 10, { animate: true })
    // Find and open popup on the matching layer
    const layer = mooragesLayers.value[index]
    if (layer && layer.getLayers) {
      const markerLayer = layer.getLayers()[0] // assuming one marker per feature
      if (markerLayer && markerLayer.openPopup) {
        setTimeout(() => {
          //map.value.fitBounds(layer.getBounds())
          markerLayer.openPopup()
        }, 1000) // wait until flyTo animation completes
      }
    }
  }

  const onMoorageMouseEnter = (id) => {
    if (isNaN(id)) return
    const marker = mooragesMakers.value[id]
    //console.log('onMoorageMouseEnter', marker)
    if (marker && !marker._icon.classList.contains('bouncing')) {
      marker._icon.classList.add('bouncing')
      marker._bouncingMotion.isBouncing = true
      map.value.setZoom(7)
      map.value.panTo(marker.getLatLng())
    }
  }
  const stopBouncingMarker = (id) => {
    if (isNaN(id)) return
    const marker = mooragesMakers.value[id]
    //console.log('stopBouncingMarker', marker)
    if (marker && marker._icon.classList.contains('bouncing')) {
      marker._icon.classList.remove('bouncing')
    }
  }
  const onLogMouseEnter = (index) => {
    //console.log('onLogMouseEnter', index)
    if (isNaN(index)) return
    logsLayers.value.forEach((layer, i) => {
      //console.log(layer, i, index)
      if (i === index) {
        map.value.addLayer(layer)
        map.value.setZoom(10)
        map.value.panTo(layer.getBounds().getCenter())
        //map.value.fitBounds(layer.getBounds(), { maxZoom: 17 })
        layer.openPopup()
      } else {
        map.value.removeLayer(layer)
      }
    })
  }
  const onMouseLeaveLog = (index) => {
    // Remove all log layers
    logsLayers.value.forEach((layer) => map.value.removeLayer(layer))

    // Add back only selected ones
    const [startIdx, endIdx] = selectedRange.value
    for (let i = startIdx; i <= endIdx; i++) {
      if (logsLayers.value[i]) {
        map.value.addLayer(logsLayers.value[i])
      }
    }
  }

  const sidepanelToggleButton = () => {
    const toggleButton = document.querySelector('.sidepanel-toggle-button')
    console.log('sidepanelToggleButton', toggleButton)
    if (toggleButton) {
      toggleButton.click()
    }
  }
  const onLogsResetClick = (event) => {
    event.preventDefault() // if you're preventing default anchor behavior
    console.log('Logs tab clicked')
    // Show all logs
    selectedRange.value = [0, logsListFull.value.length - 1]
  }
  const onLogsTabClick = (event) => {
    event.preventDefault() // if you're preventing default anchor behavior
    console.log('Logs tab clicked')
    // Show all logs
  }
  const onMooragesTabClick = (event) => {
    event.preventDefault() // if you're preventing default anchor behavior
    console.log('Moorages tab clicked')
    // Show all Moorages
  }
  const onMonitoringTabClick = (event) => {
    event.preventDefault() // if you're preventing default anchor behavior
    console.log('Monitoring tab clicked')
    //fetchMonitoring()
  }
  const fetchMonitoring = async () => {
    // fetch the monitoring tab content
    console.log('Monitoring tab content updated')
    isBusy.value = true
    apiError.value = null
    const api = new PostgSail()
    try {
      const response = await api.monitoring_live()
      if (Array.isArray(response) && response[0]) {
        console.log(response[0])
        api_monitoring.value = response[0]
      } else {
        console.warn('monitoring', response)
        //throw { response }
      }
    } catch ({ response }) {
      console.log(response)
      apiError.value = t('monitoring.error')
      if (!import.meta.env.PROD) {
        console.warn('Fallback using sample data from local json...', apiError.value)
        // TODO
      }
    } finally {
      isBusy.value = false
    }
  }

  const items = computed(() => {
    console.log('items', api_monitoring.value)
    return api_monitoring.value.data
      ? {
          time: nowUTC(api_monitoring.value.time),
          updated: fromNow(api_monitoring.value.time),
          wind: {
            speed: utils.metersToKnots(api_monitoring.value.data.wind.speed) || 0,
            direction: utils.radiantToDegrees(api_monitoring.value.data.wind.direction) || 0,
          },
          temperature: {
            inside: kelvinToHuman(api_monitoring.value.data.temperature.inside) || 0.0,
            outside: kelvinToHuman(api_monitoring.value.data.temperature.outside) || 0.0,
          },
          water: {
            depth: api_monitoring.value.data.water.depth || 0,
            temperature: kelvinToHuman(api_monitoring.value.data.water.temperature) || 0.0,
          },
          battery: {
            charge: floatToPercentage(api_monitoring.value.data.battery.charge) || 0,
            voltage: api_monitoring.value.data.battery.voltage || 0,
          },
          humidity: {
            inside: floatToPercentage(api_monitoring.value.data.humidity.inside) || 0,
            outside: floatToPercentage(api_monitoring.value.data.humidity.outside) || 0,
          },
          /*
          pressure: {
            inside: pascalToHectoPascal(api_monitoring.value.data.pressure.inside) || 0.0,
            outside: pascalToHectoPascal(api_monitoring.value.data.pressure.outside) || 0.0,
          },
*/
          solar: {
            voltage: api_monitoring.value.data.solar.voltage || 0,
            current: api_monitoring.value.data.solar.current || 0,
          },
          vessel_name: api_monitoring.value.name,
          geojson: api_monitoring.value.geojson,
          live: api_monitoring.value.live,
        }
      : {}
  })
</script>

<template>
  <VaCard
    ><VaCardContent>
      <template v-if="apiError">
        <va-alert color="danger" outline class="mb-4">{{ $t('api.error') }}: {{ apiError }}</va-alert>
      </template>
      <va-inner-loading v-if="logsList.length > 0 || isBusy" :loading="isBusy">
        <div class="explore-maps leaflet-map__full">
          <template v-if="logsSlider.length > 1">
            <va-slider
              v-if="logsSlider.length > 1"
              v-model="selectedRange"
              :range="true"
              :min="0"
              :max="logsSlider.length - 1"
              :step="1"
              show-markers
              :tooltip="true"
              :tooltip-label="tooltipLabel"
            />
            {{ formattedDateRange }}
          </template>
          <div>
            <!-- Side Panel left -->
            <div id="sidepanelLeft" class="sidepanel" aria-label="side panel" aria-hidden="false">
              <div class="sidepanel-inner-wrapper">
                <nav class="sidepanel-tabs-wrapper" aria-label="sidepanel tab navigation">
                  <ul class="sidepanel-tabs">
                    <li class="sidepanel-tab">
                      <a href="#" class="sidebar-tab-link" role="tab" data-tab-link="tab-1" @click="onLogsTabClick">
                        <va-icon name="menu-logs" />
                        {{ t('menu.logs') }}
                      </a>
                    </li>
                    <li class="sidepanel-tab">
                      <a href="#" class="sidebar-tab-link" role="tab" data-tab-link="tab-2" @click="onMooragesTabClick">
                        <va-icon name="menu-moorages" />
                        {{ t('menu.moorages') }}
                      </a>
                    </li>
                    <li class="sidepanel-tab">
                      <a
                        href="#"
                        class="sidebar-tab-link"
                        role="tab"
                        data-tab-link="tab-3"
                        @click="onMonitoringTabClick"
                      >
                        <va-icon name="menu-monitoring" />
                        {{ t('menu.monitoring_realtime') }}
                      </a>
                    </li>
                  </ul>
                </nav>
                <div class="sidepanel-content-wrapper">
                  <div class="sidepanel-content">
                    <div id="logs-list" class="sidepanel-tab-content" data-tab-content="tab-1">
                      <!--
                      <div class="sidepanel-reset-button">
                        <VaButton color="primary" @click="onLogsResetClick"> {{ t('vuestic.reset') }} </VaButton>
                      </div>
                      -->
                      <div>
                        <ol>
                          <li
                            class="line-item"
                            id="lists"
                            v-if="logsList.length > 0"
                            v-for="(log, index) in logsList"
                            :key="index"
                          >
                            Trip #{{ index + 1 }}
                            <a
                              class="va-link"
                              @mouseenter="onLogMouseEnter(log.properties.logIndex)"
                              @click="onLogClickNavigate(log.properties.centercoords, log.properties.logIndex)"
                              >{{ log.properties.name }} • {{ durationFormatHours(log.properties.duration) }}H •
                              {{ distanceFormatMiles(log.properties.distance) }}
                            </a>
                          </li>
                        </ol>
                      </div>
                    </div>
                    <div id="moorages-list" class="sidepanel-tab-content" data-tab-content="tab-2">
                      <div>
                        <ol>
                          <li
                            class="line-item"
                            id="lists"
                            v-if="mooragesList.length > 0"
                            v-for="(moorage, index) in mooragesList"
                            :key="index"
                          >
                            {{ index + 1 }}.
                            <a
                              class="va-link line-item"
                              @mouseenter="onMoorageMouseEnter(moorage.properties.moorageIndex)"
                              @mouseleave="stopBouncingMarker(moorage.properties.moorageIndex)"
                              @click="
                                onMoorageClickNavigate(moorage.geometry.coordinates, moorage.properties.moorageIndex)
                              "
                              >{{ moorage.properties.name }}</a
                            >
                          </li>
                        </ol>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="sidepanel-toggle-container">
                <button class="sidepanel-toggle-button" type="button" aria-label="toggle side panel"></button>
              </div>
            </div>

            <div id="explore-map" class=""></div>
          </div>
        </div>
      </va-inner-loading> </VaCardContent
  ></VaCard>
</template>

<style>
  #explore-map {
    width: 100%;
    height: calc(91vh - 5rem);
  }
  .sidepanel {
    width: 350px;
    height: calc(91vh - 5rem);
    .sidepanel-content {
      width: 350px;
      height: calc(91vh - 5rem);
    }
    z-index: 999999 !important;
  }
  .mpopup {
    td:nth-child(1) {
      text-align: right;
      padding-right: 5px;
    }
    td:nth-child(2) {
      font-weight: bold;
    }
    a {
      cursor: pointer;
    }
  }
  .line-item:hover {
    background-color: yellow;
  }
  .bouncing {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    background-color: #ff5722;
  }

  @keyframes bounce {
    from {
      transform: translate3d(0, 0, 0);
    }

    to {
      transform: translate3d(0, 200px, 0);
    }
  }
  .zoom-display {
    position: absolute;
    top: 10px;
    right: 10px;
    background: white;
    padding: 5px 10px;
    border-radius: 6px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
    font-weight: bold;
  }
  .sidepanel-reset-button {
    text-align: center;
    width: 350px;
  }
</style>
