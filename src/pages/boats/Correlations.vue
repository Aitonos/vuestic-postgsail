<template>
  <div class="monitoring-tab pt-2 layout">
    <div class="va-table-responsive">
      <h2 class="va-text-center">Map SignalK path to PostgSail</h2>
      <table class="va-table va-table--striped va-table--hoverable">
        <tbody>
          <tr>
            <td>
              {{ t('profile.monitoring.depthKey') }}
            </td>
            <td>
              <MySelect
                v-if="environment_keys.length >= 1"
                :data="monitoring_keys.depthKey"
                :object="environment_keys"
                :sk_key="monitoring_keys"
                map="depthKey"
                @clickFromChildComponent="UpdatePref"
              />
              <br />
              <div>eg: environment.depth.belowTransducer</div>
            </td>
          </tr>
          <tr>
            <td>
              {{ t('profile.monitoring.waterTemperatureKey') }}
            </td>
            <td>
              <MySelect
                v-if="temperatures_keys.length >= 1"
                :data="monitoring_keys.waterTemperatureKey"
                :object="temperatures_keys"
                :sk_key="monitoring_keys"
                map="waterTemperatureKey"
                @clickFromChildComponent="UpdatePref"
              />
              <br />
              <div>eg: environment.water.temperature</div>
            </td>
          </tr>
          <tr>
            <td>
              {{ t('profile.monitoring.windSpeedKey') }}
            </td>
            <td>
              <MySelect
                v-if="wind_keys.length >= 1"
                :data="monitoring_keys.windSpeedKey"
                :object="wind_keys"
                :sk_key="monitoring_keys"
                map="windSpeedKey"
                @clickFromChildComponent="UpdatePref"
              />
              <br />
              <div>eg: environment.wind.speedTrue</div>
            </td>
          </tr>
          <tr>
            <td>
              {{ t('profile.monitoring.windDirectionKey') }}
            </td>
            <td>
              <MySelect
                v-if="wind_keys.length >= 1"
                :data="monitoring_keys.windDirectionKey"
                :object="wind_keys"
                :sk_key="monitoring_keys"
                map="windDirectionKey"
                @clickFromChildComponent="UpdatePref"
              />
              <br />
              <div>eg: environment.wind.directionTrue</div>
            </td>
          </tr>
          <tr>
            <td>
              {{ t('profile.monitoring.insidePressureKey') }}
            </td>
            <td>
              <MySelect
                v-if="pressure_keys.length >= 1"
                :data="monitoring_keys.insidePressureKey"
                :object="pressure_keys"
                :sk_key="monitoring_keys"
                map="insidePressureKey"
                @clickFromChildComponent="UpdatePref"
              />
              <br />
              <div>eg: environment.inside.pressure</div>
            </td>
          </tr>
          <tr>
            <td>
              {{ t('profile.monitoring.outsidePressureKey') }}
            </td>
            <td>
              <MySelect
                v-if="pressure_keys.length >= 1"
                :data="monitoring_keys.outsidePressureKey"
                :object="pressure_keys"
                :sk_key="monitoring_keys"
                map="outsidePressureKey"
                @clickFromChildComponent="UpdatePref"
              />
              <br />
              <div>eg: environment.outside.pressure</div>
            </td>
          </tr>
          <tr>
            <td>
              {{ t('profile.monitoring.insideTemperatureKey') }}
            </td>
            <td>
              <MySelect
                v-if="temperatures_keys.length >= 1"
                :data="monitoring_keys.insideTemperatureKey"
                :object="temperatures_keys"
                :sk_key="monitoring_keys"
                map="insideTemperatureKey"
                @clickFromChildComponent="UpdatePref"
              /><br />
              <div>eg: environment.inside.temperature</div>
            </td>
          </tr>
          <tr>
            <td>
              {{ t('profile.monitoring.outsideTemperatureKey') }}
            </td>
            <td>
              <MySelect
                v-if="temperatures_keys.length >= 1"
                :data="monitoring_keys.outsideTemperatureKey"
                :object="temperatures_keys"
                :sk_key="monitoring_keys"
                map="outsideTemperatureKey"
                @clickFromChildComponent="UpdatePref"
              /><br />
              <div>eg: environment.outside.temperature</div>
            </td>
          </tr>
          <tr>
            <td>
              {{ t('profile.monitoring.insideHumidityKey') }}
            </td>
            <td>
              <MySelect
                v-if="humidity_keys.length >= 1"
                :data="monitoring_keys.insideHumidityKey"
                :object="humidity_keys"
                :sk_key="monitoring_keys"
                map="insideHumidityKey"
                @clickFromChildComponent="UpdatePref"
              /><br />
              <div>eg: environment.inside.relativeHumidity</div>
            </td>
          </tr>
          <tr>
            <td>
              {{ t('profile.monitoring.outsideHumidityKey') }}
            </td>
            <td>
              <MySelect
                v-if="humidity_keys.length >= 1"
                :data="monitoring_keys.outsideHumidityKey"
                :object="humidity_keys"
                :sk_key="monitoring_keys"
                map="outsideHumidityKey"
                @clickFromChildComponent="UpdatePref"
              /><br />
              <div>eg: environment.outside.relativeHumidity</div>
            </td>
          </tr>
          <tr>
            <td>
              {{ t('profile.monitoring.stateOfChargeKey') }}
            </td>
            <td>
              <template v-if="stateOfCharge_keys.length == 0">
                <va-chip outline color="warning"> No valid signalK path found for battery stateOfCharge</va-chip>
              </template>
              <MySelect
                v-if="stateOfCharge_keys.length >= 1"
                :data="monitoring_keys.stateOfChargeKey"
                :object="stateOfCharge_keys"
                :sk_key="monitoring_keys"
                map="stateOfChargeKey"
                @clickFromChildComponent="UpdatePref"
              /><br />
              <div>eg: electrical.batteries.House.capacity.stateOfCharge</div>
            </td>
          </tr>
          <tr>
            <td>
              {{ t('profile.monitoring.voltageKey') }}
            </td>
            <td>
              <template v-if="batteryVoltage_keys.length == 0">
                <va-chip outline color="warning"> No valid signalK path found for battery Voltage</va-chip>
              </template>
              <MySelect
                v-if="batteryVoltage_keys.length >= 1"
                :data="monitoring_keys.voltageKey"
                :object="batteryVoltage_keys"
                :sk_key="monitoring_keys"
                map="voltageKey"
                @clickFromChildComponent="UpdatePref"
              /><br />
              <div>eg: electrical.batteries.House.voltage</div>
            </td>
          </tr>
          <tr>
            <td>
              {{ t('profile.monitoring.solarVoltageKey') }}
            </td>
            <td>
              <template v-if="solarVoltage_keys.length == 0">
                <va-chip outline color="warning"> No valid signalK path found for solar Voltage</va-chip>
              </template>
              <MySelect
                v-if="solarVoltage_keys.length >= 1"
                :data="monitoring_keys.solarVoltageKey"
                :object="solarVoltage_keys"
                :sk_key="monitoring_keys"
                map="solarVoltageKey"
                @clickFromChildComponent="UpdatePref"
              /><br />
              <div>eg: electrical.solar.Main.panelVoltage</div>
            </td>
          </tr>
          <tr>
            <td>
              {{ t('profile.monitoring.solarPowerKey') }}
            </td>
            <td>
              <template v-if="solarPower_keys.length == 0">
                <va-chip outline color="warning"> No valid signalK path found for solar Power</va-chip>
              </template>
              <MySelect
                v-if="solarPower_keys.length >= 1"
                :data="monitoring_keys.solarPowerKey"
                :object="solarPower_keys"
                :sk_key="monitoring_keys"
                map="solarPowerKey"
                @clickFromChildComponent="UpdatePref"
              /><br />
              <div>eg: electrical.solar.Main.panelPower</div>
            </td>
          </tr>
          <tr>
            <td>
              {{ t('profile.monitoring.tankLevelKey') }}
            </td>
            <td>
              <template v-if="tankLevel_keys.length == 0">
                <va-chip outline color="warning"> No valid signalK path found for tank Level </va-chip>
              </template>
              <MySelect
                v-if="tankLevel_keys.length >= 1"
                :data="monitoring_keys.tankLevelKey"
                :object="tankLevel_keys"
                :sk_key="monitoring_keys"
                map="tankLevelKey"
                @clickFromChildComponent="UpdatePref"
              /><br />
              <div>eg: tanks.freshWater.currentLevel</div>
            </td>
          </tr>
          <tr v-for="(section, index) in additionalSections" :key="index">
            <td>
              <va-input v-model="section.name" label="Section Name" type="text" />
            </td>
            <td>
              <VaSelect
                v-if="all_keys.length >= 1"
                v-model="section.key"
                :options="all_keys"
                searchable
                highlight-matched-text
                style="width: 100%"
                @update:modelValue="updateSelectedKey(index, section.key)"
              />
              <va-button color="danger" size="medium" @click="deleteSection(index)">Delete</va-button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <h3 class="h3">Add New Monitoring Value</h3>
    <div>
      <div>{{ t('profile.monitoring.message') }}</div>
      <va-button color="primary" size="medium" class="my-button" @click="addNewMonitoringValue">
        Add New Monitoring Value
      </va-button>
    </div>
  </div>
</template>

<script setup>
  // TODO update setup with lang="ts"
  import { useI18n } from 'vue-i18n'
  import PostgSail from '../../services/api-client'
  import { ref, onMounted, reactive, computed } from 'vue'
  import { useToast } from 'vuestic-ui'
  import MySelect from '../../components/SelectSearchable.vue'

  const { t } = useI18n()
  const { init: initToast } = useToast()

  const api = new PostgSail()
  const isBusy = ref(false)
  const apiError = ref(null)
  const apiSuccess = ref(null)
  const apiData = reactive([])
  const offline = ref(false)
  const monitoring_keys = ref({})
  const additionalSections = ref([])

  const all_keys = computed(() => {
    const f = Array.isArray(apiData.value) ? apiData.value.map((row) => row.key) : []
    console.log(f)
    return f
  })
  const environment_keys = computed(() => {
    const f = Array.isArray(apiData.value)
      ? apiData.value
          .map((row) => row.key)
          .filter((row) => {
            return row.toLowerCase().includes('environment')
          })
      : []
    console.log(f)
    return f
  })
  const stateOfCharge_keys = computed(() => {
    const re = new RegExp(/electrical\.batteries\..*\.stateOfCharge/, 'i')
    const f = Array.isArray(apiData.value)
      ? apiData.value
          .map((row) => row.key)
          .filter((row) => {
            return re.test(row.toLowerCase())
          })
      : []
    console.log(f)
    return f
  })
  const batteryVoltage_keys = computed(() => {
    const re = new RegExp(/electrical\.batteries\..*\.voltage/, 'i')
    const f = Array.isArray(apiData.value)
      ? apiData.value
          .map((row) => row.key)
          .filter((row) => {
            return re.test(row.toLowerCase())
          })
      : []
    console.log(f)
    return f
  })
  const temperatures_keys = computed(() => {
    const re = new RegExp(/environment\..*\.temperature/, 'i')
    const f = Array.isArray(apiData.value)
      ? apiData.value
          .map((row) => row.key)
          .filter((row) => {
            return re.test(row.toLowerCase())
          })
      : []
    console.log(f)
    return f
  })
  const humidity_keys = computed(() => {
    const f = Array.isArray(apiData.value)
      ? apiData.value
          .map((row) => row.key)
          .filter((row) => {
            return row.toLowerCase().includes('humidity')
          })
      : []
    console.log(f)
    return f
  })
  const pressure_keys = computed(() => {
    const f = Array.isArray(apiData.value)
      ? apiData.value
          .map((row) => row.key)
          .filter((row) => {
            return row.toLowerCase().includes('pressure')
          })
      : []
    console.log(f)
    return f
  })
  const wind_keys = computed(() => {
    const f = Array.isArray(apiData.value)
      ? apiData.value
          .map((row) => row.key)
          .filter((row) => {
            return row.toLowerCase().includes('wind')
          })
      : []
    console.log(f)
    return f
  })
  const solarVoltage_keys = computed(() => {
    const re = new RegExp(/electrical\.solar\..*voltage$/, 'i')
    const f = Array.isArray(apiData.value)
      ? apiData.value
          .map((row) => row.key)
          .filter((row) => {
            return re.test(row.toLowerCase())
          })
      : []
    console.log(f)
    return f
  })
  const solarPower_keys = computed(() => {
    const re = new RegExp(/electrical\.solar\..*power$/, 'i')
    const f = Array.isArray(apiData.value)
      ? apiData.value
          .map((row) => row.key)
          .filter((row) => {
            return re.test(row.toLowerCase())
          })
      : []
    console.log(f)
    return f
  })
  const tankLevel_keys = computed(() => {
    const re = new RegExp(/tanks\..*level$/, 'i')
    const f = Array.isArray(apiData.value)
      ? apiData.value
          .map((row) => row.key)
          .filter((row) => {
            return re.test(row.toLowerCase())
          })
      : []
    console.log(f)
    return f
  })

  const addNewMonitoringValue = () => {
    additionalSections.value.push({ name: `Section ${additionalSections.value.length + 1}`, key: '' })
  }

  const deleteSection = (index) => {
    additionalSections.value.splice(index, 1)
  }

  const updateSelectedKey = async (index, key) => {
    console.log('updateSelectedKey', index, key)
    additionalSections.value[index].key = key
    console.log('updateSelectedKey', additionalSections.value)
    await UpdatePref(monitoring_keys.value, additionalSections.value[index].key, additionalSections.value[index].name)
  }

  //const UpdatePref = async (key: string, value: any) => {
  const UpdatePref = async (key, value, map) => {
    console.log(key, value, map)
    if (!key || typeof value == 'undefined') return
    if (key === 'monitoring' && typeof value === 'object') {
      console.debug(`Updating ${key}:`, JSON.stringify(value))
    }
    console.debug('Correlation Tab UpdatePref', `Updating ${map}: ${value}`)
    let obj = {}
    obj[map] = value
    let payload = { ...key, ...obj, ...additionalSections.value }
    // Read by Signalk plugin
    payload['additionalDataKeys'] = Object.values(additionalSections.value.map((section) => section.key))
    console.debug(JSON.stringify(payload))
    const response = await api.update_vessel_monitoring({ patch: payload })
    // Notify user on success or failure using va-toast.
    initToast({
      message: `${response ? 'Successfully updated' : 'Error updating'} ${map} with ${value}`,
      position: 'top-right',
      color: 'primary',
      //color: response.ok ? 'success' : 'warning',
    })
  }

  onMounted(async () => {
    isBusy.value = true
    apiError.value = null
    try {
      // Fetch current configuration
      const vessel_monitoring = await api.get_vessel_monitoring()
      if (Array.isArray(vessel_monitoring) && vessel_monitoring[0].configuration) {
        console.log('Boat Configuration', vessel_monitoring[0].configuration)
        monitoring_keys.value = vessel_monitoring[0].configuration
        console.log('Boat Configuration', monitoring_keys.value)
      } else {
        console.warn('Boat Configuration', vessel_monitoring)
        //throw { response }
      }
      // Fetch all keys all available keys
      const response = await api.explore()
      if (Array.isArray(response)) {
        console.log('Boat Correlation', response)
        apiData.value = response
        console.log('Boat Correlation', apiData.value)
        apiSuccess.value = true
        offline.value = false
      } else {
        console.warn('Boat Correlation', response)
        //throw { response }
      }
    } catch ({ response }) {
      console.log(response)
      apiError.value = t('monitoring.error')
      if (!import.meta.env.PROD) {
        console.warn('Fallback using sample data from local json...', apiError.value)
      }
    } finally {
      isBusy.value = false
    }
  })
</script>

<style lang="scss" scoped>
  .va-data-table {
    overflow-x: auto;
    width: 100%;
  }
  .my-button {
    width: 100%;
    text-align: center;
  }
</style>
