<template>
  <template v-if="tabs">
    <div id="sidepanel" class="sidepanel" aria-label="side panel" aria-hidden="false">
      <div class="sidepanel-inner-wrapper">
        <nav class="sidepanel-tabs-wrapper" aria-label="sidepanel tab navigation">
          <ul class="sidepanel-tabs">
            <li v-for="(tab, index) in tabs" :key="index" class="sidepanel-tab">
              <a :href="'#' + tab" class="sidebar-tab-link" role="tab" :data-tab-link="'tab-' + (index + 1)">
                <slot :name="'tab-' + tab"></slot>
              </a>
            </li>
          </ul>
        </nav>
        <div class="sidepanel-content-wrapper">
          <div class="sidepanel-content">
            <div
              v-for="(tab, index) in tabs"
              :key="index"
              class="sidepanel-tab-content"
              :data-tab-content="'tab-' + (index + 1)"
            >
              <slot :name="'content-' + tab"></slot>
            </div>
          </div>
        </div>
      </div>
      <div class="sidepanel-toggle-container">
        <button class="sidepanel-toggle-button" type="button" aria-label="toggle side panel"></button>
      </div>
    </div>
  </template>
  <div :id="id" class="leaflet-map"></div>
</template>

<script>
  import 'leaflet/dist/leaflet.css'
  import 'leaflet.sidepanel/dist/style.css'
  import L from 'leaflet'
  import 'leaflet-rotatedmarker'
  import 'leaflet.sidepanel'

  import { ref } from 'vue'

  import { defaultBaseMapType, baseMaps, overlayMaps, boatMarkerTypes } from './leafletHelpers.js'

  import { dateFormatUTC, durationFormatHours } from '../../utils/dateFormatter.js'
  import { distanceFormatMiles } from '../../utils/distanceFormatter.js'
  import { speedFormatKnots } from '../../utils/speedFormatter.js'
  import { awaFormat, angleFormat } from '../../utils/angleFormatter.js'

  import { useGlobalStore } from '../../stores/global-store'
  import { useVesselStore } from '../../stores/vessel-store'

  const { currentTheme } = useGlobalStore()
  const { vesselName, vesselType } = useVesselStore()

  const GeoJSONbasemapObj = ref({})
  const GeoJSONLayer = ref(null)

  export default {
    name: 'LeafletMap',
    props: {
      id: {
        type: String,
        default: 'mapContainer',
      },
      tabs: {
        type: Array,
        default: null,
      },
      tabsAutoOpen: {
        type: Boolean,
        default: false,
      },
      geoJsonFeatures: {
        type: [Array, Object],
        default: null,
      },
      geoJsonFeature: {
        type: Object,
        default: null,
      },
      mapZoom: {
        type: Number,
        default: 17,
      },
      controlLayer: {
        type: Boolean,
        default: true,
      },
      mapType: {
        type: String,
        default: defaultBaseMapType(),
      },
      geoFilter: {
        /* use to filter the geojson geometry type */
        type: Boolean,
        default: false,
      },
      multigeojson: {
        /* use to handle an array of geojson*/
        type: Boolean,
        default: false,
      },
      externalLink: {
        type: String,
        default: null,
      },
      showNote: {
        type: Boolean,
        default: false,
      },
      onSaveNote: {
        type: Function,
        default: null,
      },
      onDeletePoint: {
        type: Function,
        default: null,
      },
    },
    emits: ['save-note', 'delete-point'],
    data() {
      return {
        map: null,
      }
    },
    mounted() {
      console.debug('Props mapType:', this.mapType, ' mapZoom:', this.mapZoom, 'showNote', this.showNote)
      let centerLat = 0
      let centerLng = 0
      let geojson = null
      if (this.geoJsonFeature && this.geoJsonFeature.geometry) {
        centerLat = this.geoJsonFeature.geometry.coordinates[1]
        centerLng = this.geoJsonFeature.geometry.coordinates[0]
        geojson = this.geoJsonFeature
      }

      if (this.geoJsonFeatures && this.geoJsonFeatures.length > 0) {
        const midPoint = Math.round(this.geoJsonFeatures.length / 2)
        console.debug('length,midPoint', `${this.geoJsonFeatures.length} ${midPoint}`)
        console.debug('geoJsonFeatures', this.geoJsonFeatures)
        if (this.multigeojson) {
          centerLat = parseFloat(this.geoJsonFeatures[midPoint].geojson.features[0].geometry.coordinates[1])
          centerLng = parseFloat(this.geoJsonFeatures[midPoint].geojson.features[0].geometry.coordinates[0])
        } else {
          centerLat = this.geoJsonFeatures[midPoint].geometry.coordinates[1]
          centerLng = this.geoJsonFeatures[midPoint].geometry.coordinates[0]
        }
        geojson = this.geoJsonFeatures
      }
      console.debug(`LeafletMap`, geojson)
      if (centerLat == 0 && centerLng == 0) return

      console.debug(`LeafletMap centerLatLng: ${centerLat} ${centerLng}`)
      this.map = L.map(this.id, { zoomControl: false }).setView([centerLat, centerLng], this.mapZoom)

      const textPopupPoint = (feature) => {
        let status = feature.properties.status || ''
        let time = dateFormatUTC(feature.properties.time)
        let sog = speedFormatKnots(feature.properties.speedoverground)
        let cog = angleFormat(feature.properties.courseovergroundtrue)
        let twd = angleFormat(feature.properties.truewinddirection)
        let aws = speedFormatKnots(feature.properties.windspeedapparent)
        let awa = awaFormat(feature.properties.truewinddirection, feature.properties.courseovergroundtrue)
        let latitude = parseFloat(feature.geometry.coordinates[0]).toFixed(3)
        let longitude = parseFloat(feature.geometry.coordinates[1]).toFixed(3)
        let text = `<div class='mpopup'><h4>${vesselName}: ${status}</h4><br/>
                          <table class='data'><tbody>
                            <tr><th>Time</th><td>${time}</td></tr>
                            <tr><th>Position</th><td>${latitude} ${longitude}</td></tr>`
        if (feature.properties.speedoverground) {
          text += `<tr><th>Speed</th><td>${sog}`
          if (feature.properties.courseovergroundtrue) {
            text += ` / ${cog}`
          }
          text += `</td></tr>`
        }
        if (feature.properties.windspeedapparent) {
          text += `<tr><th>Wind</th><td>${aws}`
          if (feature.properties.truewinddirection) {
            text += ` / ${twd}`
          }
          text += `</td></tr>`
        }
        if (feature.properties.truewinddirection && feature.properties.courseovergroundtrue) {
          text += `<tr><th>AWA</th><td>${awa}</td></tr>`
        }
        if (feature.properties.depth) {
          text += `<tr><th>Depth</th><td>${feature.properties.depth}</td></tr>`
        }
        if (feature.properties.watertemperature) {
          text += `<tr><th>Water Temperature</th><td>${feature.properties.watertemperature}</td></tr>`
        }
        if (feature.properties.outsidetemperature) {
          text += `<tr><th>outsidetemperature</th><td>${feature.properties.outsidetemperature}</td></tr>`
        }
        if (feature.properties.outsidepressure) {
          text += `<tr><th>outsidepressure</th><td>${feature.properties.outsidepressure}</td></tr>`
        }
        if (feature.properties.outsidehumidity) {
          text += `<tr><th>outsidehumidity</th><td>${feature.properties.outsidehumidity}</td></tr>`
        }
        text += `</tbody></table></div>`

        if (this.showNote) {
          text +=
            'Notes:<br/>' +
            "<textarea style='box-sizing: border-box;border-width: 1px;' id='noteTextarea' rows='4' cols='30'>" +
            feature.properties.notes +
            '</textarea><br>'
          if (this.onSaveNote) {
            text += "<div class='center'><button id='saveNoteButton'>Save</button>"
          }
        }
        if (this.onDeletePoint) {
          text += '<button id=deletePointButton>Delete</button></div>'
        }
        return text
      }

      const textPopupLine = (feature) => {
        let time = dateFormatUTC(feature.properties._from_time)
        let duration = durationFormatHours(feature.properties.duration)
        let distance = distanceFormatMiles(feature.properties.distance)
        let avg_speed = speedFormatKnots(feature.properties.avg_speed)
        let max_speed = speedFormatKnots(feature.properties.max_speed)
        let avg_wind = speedFormatKnots(feature.properties.avg_wind_speed)
        let max_wind = speedFormatKnots(feature.properties.max_wind_speed)
        let notes = feature.properties?.notes || ''
        let text = `<div class='mpopup'>
                        <h4><a href="/log/${feature.properties.id}">${feature.properties.name}</a></h4><br/>
                        <table class='data'><tbody>
                          <tr><th>Time</th><td>${time}</td></tr>
                          <tr><th>Distance</th><td>${distance}</td></tr>
                          <tr><th>Duration</th><td>${duration} hours</td></tr>
                          <tr><th>Speed</th><td>avg ${avg_speed} / max ${max_speed}</td></tr>
                          <tr><th>Wind</th><td>avg ${avg_wind} / max ${max_wind}</td></tr>
                          <tr><th>Notes</th><td>${notes}</td></tr>
                        </tbody></table></br>
                        <a href="/timelapse/${feature.properties.id}">Replay</a>
                      </div>`
        return text
      }

      const popup = (feature, layer) => {
        var popupContent = '<p>GeoJSON ' + feature.geometry.type + " now I'm a Leaflet vector!</p>"
        if (feature.properties && feature.properties.time) {
          popupContent = textPopupPoint(feature)
        }
        if (feature.properties && feature.properties._from_time) {
          popupContent = textPopupLine(feature)
        }
        layer.bindPopup(popupContent).on('popupopen', () => {
          const saveButton = document.getElementById('saveNoteButton')
          const deleteButton = document.getElementById('deletePointButton')

          if (saveButton) {
            saveButton.addEventListener('click', () => this.saveNote(feature.properties.time))
          }
          if (deleteButton) {
            deleteButton.addEventListener('click', () => this.deletePoint(feature.properties.time))
          }
        })
      }

      const bMaps = baseMaps()
      const oMaps = overlayMaps()
      bMaps[this.mapType].addTo(this.map)

      if (this.controlLayer) {
        L.control.layers(bMaps, oMaps).addTo(this.map)
        L.control.zoom({ position: 'bottomright' }).addTo(this.map)
      }

      const geoFilter = this.geoFilter
      const geoMapFilter = function (feature, layer) {
        //console.debug('geoMapFilter', geoFilter)
        if (!geoFilter) {
          return true
        }
        if (feature.geometry) {
          // If the geometry is not a LineString, return false (don't render features under construction)
          return feature.geometry.type != 'LineString' ? false : true
        }
        return false
      }

      const boatTypes = boatMarkerTypes()
      const boatIcon = vesselType === 'Sailing' ? boatTypes['Sailboat'] : boatTypes['Powerboat']

      if (this.multigeojson) {
        let layers = []
        let featGroup = new L.FeatureGroup()
        let controlLayer = L.control.layers()
        //console.log(geojson.length)
        for (let i = 0; i < geojson.length; i++) {
          console.log(geojson[i].geojson)
          if (geojson[i].geojson.features == null || geojson[i].geojson.features.length == 0) {
            continue
          }
          let color = random_rgb_dark()
          layers[i] = L.geoJSON(geojson[i].geojson, {
            style: { color: random_rgb_dark() },
            filter: geoMapFilter,
            pointToLayer: boatIcon,
            onEachFeature: popup,
          }).addTo(featGroup)
          featGroup.addTo(this.map)
          const text = `<i class="geojson-box" style="background-color:${color}">&nbsp;</i><h4>${geojson[i]?.geojson?.features[0].properties.name}</h4><small>${geojson[i]?.geojson?.features[0].properties.started}</small>`
          controlLayer.addOverlay(layers[i], text).addTo(this.map)
          //document.getElementsByClassName('leaflet-control-layers-toggle')[1].className = 'leaflet-control-layers-toggle pgsail-geojson'
          document.getElementsByClassName('leaflet-control-layers-toggle')[1].style =
            "background-image: url('/favicon-32x32.png');"
        }
        GeoJSONLayer.value = featGroup
      } else if (this.geoJsonFeatures && this.geoJsonFeatures.length > 0) {
        GeoJSONbasemapObj.value = {
          Sailboat: L.geoJSON(geojson, {
            pointToLayer: boatTypes['Sailboat'],
            onEachFeature: popup,
          }),
          SailboatSails: L.geoJSON(geojson, {
            pointToLayer: boatTypes['SailboatSails'],
            onEachFeature: popup,
          }),
          Powerboat: L.geoJSON(geojson, {
            pointToLayer: boatTypes['Powerboat'],
            onEachFeature: popup,
          }),
          Dot: L.geoJSON(geojson, {
            pointToLayer: boatTypes['Dot'],
            onEachFeature: popup,
          }),
        }
        GeoJSONLayer.value =
          vesselType === 'Sailing'
            ? GeoJSONbasemapObj.value['Sailboat']
            : vesselType === 'Pleasure Craft'
            ? GeoJSONbasemapObj.value['Powerboat']
            : GeoJSONbasemapObj.value['Dot']
        GeoJSONLayer.value.addTo(this.map)
        if (this.controlLayer) {
          L.control.layers(GeoJSONbasemapObj.value).addTo(this.map)
          document.getElementsByClassName('leaflet-control-layers-toggle')[1].style =
            "background-image: url('/favicon-32x32.png');"
        }
      } else {
        GeoJSONLayer.value = L.geoJSON(geojson, {
          filter: geoMapFilter,
          pointToLayer: boatIcon,
          onEachFeature: popup,
        }).addTo(this.map)
      }

      console.debug('LeafletMap props.controlLayer', this.controlLayer, 'props.Zoom:', this.mapZoom)
      this.map.fitBounds(GeoJSONLayer.value.getBounds(), { maxZoom: 17 })

      if (this.externalLink) {
        var extLinkUrl = this.externalLink
        var externalLinkControl = L.control({ position: 'bottomright' })
        externalLinkControl.onAdd = function () {
          var div = L.DomUtil.create('div', 'leaflet-bar leaflet-control')
          div.innerHTML = `<a href="${extLinkUrl}" target="_blank"><i class="va-icon fa fa-external-link" style="font-size: 14px; height: 14px; line-height: 14px;" aria-hidden="true" notranslate=""><!----></i></a>`
          div.title = 'Extended map'
          return div
        }
        externalLinkControl.addTo(this.map)
      }

      if (this.tabs) {
        L.control
          .sidepanel('sidepanel', {
            panelPosition: 'left',
            hasTabs: true,
            tabsPosition: 'top',
            pushControls: true,
            darkMode: currentTheme === 'dark',
            startTab: 'tab-1',
          })
          .addTo(this.map)

        if (this.tabsAutoOpen) {
          this.map.whenReady(function () {
            var toggleButton = document.querySelector('.sidepanel-toggle-button')
            if (toggleButton) {
              toggleButton.click()
            }
          })
        }
      }
    },
    onBeforeUnmount() {
      if (this.map) {
        this.map.remove()
      }
    },
    methods: {
      refreshLayers() {
        console.debug('refreshLayers')
        Object.keys(GeoJSONbasemapObj.value).forEach((GeoJSONlayer) => {
          GeoJSONbasemapObj.value[GeoJSONlayer].clearLayers()
          GeoJSONbasemapObj.value[GeoJSONlayer].addData(this.geoJsonFeatures)
        })
        this.map.removeLayer(GeoJSONLayer.value)
        GeoJSONLayer.value =
          vesselType === 'Sailing'
            ? GeoJSONbasemapObj.value['Sailboat']
            : vesselType === 'Pleasure Craft'
            ? GeoJSONbasemapObj.value['Powerboat']
            : GeoJSONbasemapObj.value['Dot']
        GeoJSONLayer.value.addTo(this.map)
      },
      saveNote(coordinates) {
        console.debug('saveNote:', coordinates)
        var note = document.getElementById('noteTextarea').value
        this.$emit('save-note', coordinates, note)
      },
      deletePoint(coordinates) {
        console.debug('deletePoint:', coordinates)
        this.$emit('delete-point', coordinates)
      },
    },
  }

  function random_rgb_dark() {
    var o = Math.floor,
      r = Math.random,
      s = 256
    return 'rgb(' + o(r() * s) + ',' + o(r() * s) + ',' + o(r() * s) + ')'
  }
</script>

<style lang="scss">
  .mpopup {
    th {
      text-align: right;
      padding-right: 5px;
      font-weight: normal;
    }
    td {
      font-weight: bold;
    }
    a {
      cursor: pointer;
    }
  }
  #saveNoteButton {
    width: 50%;
    padding: 5px;
    color: white;
    background-color: blue;
  }
  #deletePointButton {
    width: 50%;
    color: white;
    background-color: red;
    padding: 5px;
  }
  .sidepanel {
    z-index: 10;
  }
  .sidebar-tab-link.active,
  .sidebar-tab-link:hover {
    color: var(--va-primary) !important;
    border-bottom-color: var(--va-primary) !important;
  }
  .leaflet-map {
    z-index: 0;
  }
  .geojson-box {
    float: left;
    height: 10px;
    width: 10px;
    margin-bottom: 15px;
    border: 1px solid black;
    clear: both;
    padding: 1px 1px;
  }
</style>
