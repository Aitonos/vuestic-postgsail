<template>
  <div class="p-4 dark:text-white">
    <va-card class="shadow-lg rounded-lg">
      <template v-if="item && item.moorage_id">
        <va-card-content class="mb-4">
          <Map style="width: 100%; height: 40vh" :map-zoom="13" :moorage-map-id="Number.parseInt(item.moorage_id)" />
        </va-card-content>
      </template>
    </va-card>
    <va-card class="p-4 dark:text-white">
      <va-card-title class="text-xl font-bold dark:text-white">{{ $t('stays.details.title') }}</va-card-title>
      <va-card-content>
        <template v-if="apiError">
          <va-alert color="danger" outline class="mb-4">{{ $t('api.error') }}: {{ apiError }}</va-alert>
        </template>
        <va-inner-loading :loading="isBusy">
          <!-- Details Grid -->
          <template v-if="item && item.moorage_id">
            <va-form ref="form" @submit.prevent="handleSubmit" @validation="formData.isValid = $event">
              <dl class="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-4 text-md md:text-base">
                <!-- Name -->
                <div class="hover:bg-gray-100 dark:hover:bg-gray-800 p-3 rounded transition">
                  <dt class="font-semibold text-gray-900 dark:text-white">{{ $t('stays.stay.name') }}</dt>
                  <dd class="text-gray-800 dark:text-white">
                    <VaValue v-slot="v">
                      <input
                        v-if="v.value"
                        v-model="formData.name"
                        outline
                        :rules="[(value) => (value && value.length > 0) || 'Field is required']"
                        class="w-full md:w-2/3 max-w-md"
                        @change="handleSubmit"
                      />
                      <span v-else>
                        {{ formData.name }}
                      </span>

                      <VaButton
                        :icon="v.value ? 'save' : 'edit'"
                        preset="plain"
                        size="medium"
                        @click="v.value = !v.value"
                      />
                    </VaValue>
                  </dd>
                </div>

                <!-- Moorage -->
                <div class="hover:bg-gray-100 dark:hover:bg-gray-800 p-3 rounded transition">
                  <dt class="font-semibold text-gray-900 dark:text-white">{{ $t('stays.stay.moorage') }}</dt>
                  <!--<dd class="flex xs12 md6 pa-2">{{ item.moorage }}</dd>-->
                  <dd class="text-gray-800 dark:text-white">
                    <router-link class="link" :to="{ name: 'moorage-details', params: { id: item.moorage_id } }">
                      {{ item.moorage }}
                    </router-link>
                  </dd>
                </div>

                <!-- Duration -->
                <div class="hover:bg-gray-100 dark:hover:bg-gray-800 p-3 rounded transition">
                  <dt class="font-semibold text-gray-900 dark:text-white">{{ $t('stays.stay.duration') }}</dt>
                  <dd class="text-gray-800 dark:text-white">
                    {{ durationI18nDaysHours(item.duration) }}
                  </dd>
                </div>

                <!-- stayed_at -->
                <div class="hover:bg-gray-100 dark:hover:bg-gray-800 p-3 rounded transition">
                  <dt class="font-semibold text-gray-900 dark:text-white">{{ $t('stays.stay.stayed_at') }}</dt>
                  <dd class="flex">
                    <div>
                      <StayAt
                        v-if="item.stayed_at_id"
                        :id="parseInt(route.params.id)"
                        :data="parseInt(item.stayed_at_id)"
                        @clickFromChildComponent="updateStayedAt"
                      />
                      <!--
                    <va-select
                      v-model="stayed_at_options[item.stayed_at_id]"
                      :options="stayed_at_options"
                      :placeholder="item.stayed_at"
                      outline
                      @update:modelValue="runBusy(updateStayedAt, route.params.id, $event)"
                    />
                    --></div>
                  </dd>
                </div>

                <!-- departed_to_moorage_name -->
                <div class="hover:bg-gray-100 dark:hover:bg-gray-800 p-3 rounded transition">
                  <dt class="font-semibold text-gray-900 dark:text-white">{{ $t('stays.stay.arrived') }}</dt>
                  <dd class="text-gray-800 dark:text-white">
                    <router-link
                      class="link"
                      :to="{ name: 'moorage-details', params: { id: item.departed_to_moorage_id } }"
                    >
                      {{ item.departed_to_moorage_name }}
                    </router-link>
                  </dd>
                </div>

                <!-- arrived -->
                <div class="hover:bg-gray-100 dark:hover:bg-gray-800 p-3 rounded transition">
                  <dt class="font-semibold text-gray-900 dark:text-white">{{ $t('stays.stay.arrival') }}</dt>
                  <dd class="text-gray-800 dark:text-white">
                    <router-link class="link" :to="{ name: 'log-map', params: { id: item.arrived_log_id } }">
                      {{ dateFormatUTC(item.arrived) }}
                    </router-link>
                  </dd>
                </div>

                <!-- arrived_from_moorage_name -->
                <div class="hover:bg-gray-100 dark:hover:bg-gray-800 p-3 rounded transition">
                  <dt class="font-semibold text-gray-900 dark:text-white">{{ $t('stays.stay.departed') }}</dt>
                  <dd class="text-gray-800 dark:text-white">
                    <router-link
                      class="link"
                      :to="{ name: 'moorage-details', params: { id: item.arrived_from_moorage_id } }"
                    >
                      {{ item.arrived_from_moorage_name }}
                    </router-link>
                  </dd>
                </div>

                <!-- departed -->
                <div class="hover:bg-gray-100 dark:hover:bg-gray-800 p-3 rounded transition">
                  <dt class="font-semibold text-gray-900 dark:text-white">{{ $t('stays.stay.departure') }}</dt>
                  <dd class="text-gray-800 dark:text-white">
                    <router-link class="link" :to="{ name: 'log-map', params: { id: item.departed_log_id } }">
                      {{ dateFormatUTC(item.departed) }}
                    </router-link>
                  </dd>
                </div>

                <div class="hover:bg-gray-100 dark:hover:bg-gray-800 p-3 rounded transition">
                  <dt class="font-semibold text-gray-900 dark:text-white">{{ $t('stays.stay.note') }}</dt>
                  <dd class="text-gray-800 dark:text-white">
                    <VaTextarea
                      v-model="formData.notes"
                      outline
                      placeholder="Note"
                      type="textarea"
                      @change="handleSubmit"
                    />
                  </dd>
                </div>
              </dl>
              <template v-if="updateError">
                <va-alert color="danger" outline class="mb-4">{{ $t('api.error') }}: {{ updateError }}</va-alert>
              </template>
              <div class="row justify-end">
                <!--
                <div class="flex">
                  <va-button :disabled="!canSubmit" @click="handleSubmit">Save</va-button>
                </div>
                -->
              </div>
            </va-form>
          </template>
        </va-inner-loading>
      </va-card-content>
    </va-card>
  </div>
</template>

<script setup>
  import { computed, ref, reactive, onMounted } from 'vue'
  import { useRoute } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { setAppTitle } from '../../utils/app.js'
  import PostgSail from '../../services/api-client'
  import { useCacheStore } from '../../stores/cache-store'
  import { dateFormatUTC, durationI18nDaysHours } from '../../utils/dateFormatter.js'
  import Map from '../../components/maps/leafletMapMoorages.vue'
  import { asBusy } from '../../utils/handleExports'
  import StayAt from '../../components/SelectStayAt.vue'
  import { useToast } from 'vuestic-ui'
  const { init: initToast } = useToast()
  const { t } = useI18n()

  import stays from '../../data/stays.json'

  const route = useRoute()
  const CacheStore = useCacheStore()
  const isBusy = ref(false)
  const apiError = ref(null)
  const updateError = ref(null)
  const apiData = reactive({ row: null })
  const formData = reactive({
    isValid: true,
    name: null,
    notes: null,
  })

  const item = computed(() => {
    return apiData.row
      ? {
          id: apiData.row.id,
          name: apiData.row.name,
          moorage: apiData.row.moorage,
          moorage_id: apiData.row.moorage_id,
          duration: apiData.row.duration,
          stayed_at: apiData.row.stayed_at,
          departed: apiData.row.departed,
          arrived: apiData.row.arrived,
          arrived_from_moorage_id: apiData.row.arrived_from_moorage_id,
          departed_to_moorage_id: apiData.row.departed_to_moorage_id,
          departed_log_id: apiData.row.departed_log_id,
          arrived_log_id: apiData.row.arrived_log_id,
          departed_to_moorage_name: apiData.row.departed_to_moorage_name,
          arrived_from_moorage_name: apiData.row.arrived_from_moorage_name,
          notes: apiData.row.notes,
          stayed_at_id: apiData.row.stayed_at_id,
        }
      : {}
  })
  const mapGeoJsonFeatures = computed(() => {
    return item.value && item.value.geoJson && item.value.geoJson.features && Array.isArray(item.value.geoJson.features)
      ? item.value.geoJson.features
      : []
  })
  const canSubmit = computed(() => {
    const isDirty = item.value.name !== formData.name || item.value.notes !== formData.notes
    return !isBusy.value && formData.isValid && isDirty
  })
  onMounted(async () => {
    isBusy.value = true
    apiError.value = null
    //const api = new PostgSail()
    const id = route.params.id
    try {
      //const response = await CacheStore.api.stay_get(id)
      const response = await CacheStore.getAPI('stay_get', id)
      if (Array.isArray(response)) {
        apiData.row = response[0]
        formData.name = apiData.row.name || null
        formData.notes = apiData.row.notes || null
        if (formData.name) {
          document.title = setAppTitle(t('stays.details.title') + ': ' + formData.name)
        }
      } else {
        throw { response }
      }
    } catch (e) {
      apiError.value = e
      if (!import.meta.env.PROD) {
        console.warn('Get sample data from local json...', apiError.value)
        const row = stays.find((row) => row.id == route.params.id)
        apiData.row = row
      }
    } finally {
      isBusy.value = false
    }
  })

  const handleSubmit = async () => {
    isBusy.value = true
    updateError.value = null

    const api = new PostgSail()
    const id = route.params.id
    const payload = {
      name: formData.name,
      notes: formData.notes,
    }
    try {
      const response = await api.stay_update(id, payload)
      //console.log(response)
      if (response) {
        console.log('stay_update success', response)
        localStorage.removeItem('cache')
      } else {
        throw { response }
      }
    } catch (err) {
      console.log('stay_update failed', err.message ?? err)
      updateError.value = err
    } finally {
      initToast({
        message: updateError.value ? `Error updating stay entry` : `Successfully updated stay entry`,
        position: 'top-right',
        color: updateError.value ? 'warning' : 'success',
      })
      isBusy.value = false
    }
  }

  function runBusy(fn, ...args) {
    asBusy(isBusy, apiError, fn, ...args)
  }

  function updateStayedAt(update_stayed_at, id) {
    // runBusy handles isBusy & apiError
    console.log('updateStayedAt', update_stayed_at, id)
    if (update_stayed_at && update_stayed_at > 0) {
      new PostgSail()
        .stay_update(id, { stay_code: update_stayed_at })
        .then(async (response) => {
          console.log('updateStayedAt success', response)
          // Clean CacheStore and force refresh
          await CacheStore.resetCache()
          await CacheStore.getAPI('stay_get', id)
        })
        .catch((err) => {
          console.log('updateStayedAt failed', err.message ?? err)
          updateError.value = err
        })
        .finally(() => {
          initToast({
            message: updateError.value ? `Error updating stay entry` : `Successfully updated stay entry`,
            position: 'top-right',
            color: updateError.value ? 'warning' : 'success',
          })
          isBusy.value = false
        })
    }
  }
</script>

<style lang="scss" scoped>
  .va-input-wrapper.va-textarea {
    width: 100%;
  }
</style>
