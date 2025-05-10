<template>
  <div class="p-4 dark:text-white">
    <va-card class="shadow-lg rounded-lg">
      <va-card-content class="mb-4">
        <Map style="width: 100%; height: 40vh" :map-zoom="13" :moorage-map-id="Number.parseInt(route.params.id)" />
      </va-card-content>
    </va-card>
    <va-card class="p-4 dark:text-white">
      <va-card-title class="text-xl font-bold dark:text-white">{{ $t('moorages.details.title') }}</va-card-title>
      <va-card-content>
        <template v-if="apiError">
          <va-alert color="danger" outline class="mb-4">{{ $t('api.error') }}: {{ apiError }}</va-alert>
        </template>
        <va-inner-loading :loading="isBusy">
          <!-- Details Grid -->
          <template v-if="item">
            <va-form ref="form" @submit.prevent="handleSubmit" @validation="formData.isValid = $event">
              <dl class="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-4 text-md md:text-base">
                <!-- Name -->
                <div class="hover:bg-gray-100 dark:hover:bg-gray-800 p-3 rounded transition">
                  <dt class="font-semibold text-gray-900 dark:text-white">{{ $t('moorages.moorage.moorage') }}</dt>
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

                <!-- Default Stay Type -->
                <div class="hover:bg-gray-100 dark:hover:bg-gray-800 p-3 rounded transition">
                  <dt class="font-semibold text-gray-900 dark:text-white">
                    {{ $t('moorages.moorage.departed') }}
                  </dt>
                  <dd class="text-gray-800 dark:text-white">
                    <div>
                      <StayAt
                        v-if="item.default_stay_id"
                        :id="parseInt(route.params.id)"
                        :data="parseInt(item.default_stay_id)"
                        @clickFromChildComponent="updateDefaultStay($event)"
                      />
                      <!--
                    <va-select
                      v-model="stayed_at_options[item.default_stay_id]"
                      :options="stayed_at_options"
                      outline
                      class="mb-6"
                      @update:modelValue="runBusy(updateDefaultStay, route.params.id, $event)"
                    />
                    --></div>
                  </dd>
                </div>

                <!-- Home -->
                <div class="hover:bg-gray-100 dark:hover:bg-gray-800 p-3 rounded transition">
                  <dt class="font-semibold text-gray-900 dark:text-white">
                    {{ $t('moorages.moorage.home') }}
                  </dt>
                  <dd class="text-gray-800 dark:text-white">
                    <va-switch v-model="item.home" size="small" @update:modelValue="runBusy(updateHome, $event)" />
                  </dd>
                </div>

                <!-- total_duration -->
                <div class="hover:bg-gray-100 dark:hover:bg-gray-800 p-3 rounded transition">
                  <dt class="font-semibold text-gray-900 dark:text-white">
                    {{ $t('moorages.moorage.stayed_at') }}
                  </dt>
                  <dd class="text-gray-800 dark:text-white">
                    <router-link class="va-link link" :to="{ name: 'moorage-stays', params: { id: item.id } }">
                      {{ durationI18nDaysHours(item.total_duration) }}
                    </router-link>
                  </dd>
                </div>

                <!-- arrivals -->
                <div class="hover:bg-gray-100 dark:hover:bg-gray-800 p-3 rounded transition">
                  <dt class="font-semibold text-gray-900 dark:text-white">
                    {{ $t('moorages.moorage.arrivals') }}
                  </dt>
                  <dd class="text-gray-800 dark:text-white">
                    <router-link
                      class="va-link link"
                      :to="{ name: 'moorage-arrivals-departures', params: { id: item.id } }"
                    >
                      {{ item.arrivals_departures }}
                    </router-link>
                  </dd>
                </div>

                <!-- visits -->
                <div class="hover:bg-gray-100 dark:hover:bg-gray-800 p-3 rounded transition">
                  <dt class="font-semibold text-gray-900 dark:text-white">
                    {{ $t('moorages.moorage.visits') }}
                  </dt>
                  <dd class="text-gray-800 dark:text-white">
                    {{ item.visits }}
                  </dd>
                </div>

                <!-- first_seen -->
                <div class="hover:bg-gray-100 dark:hover:bg-gray-800 p-3 rounded transition">
                  <dt class="font-semibold text-gray-900 dark:text-white">
                    {{ $t('moorages.moorage.first_seen') }}
                  </dt>
                  <dd class="text-gray-800 dark:text-white">
                    {{ dateFormatUTC(item.first_seen) }}
                  </dd>
                </div>

                <!-- last_seen -->
                <div class="hover:bg-gray-100 dark:hover:bg-gray-800 p-3 rounded transition">
                  <dt class="font-semibold text-gray-900 dark:text-white">
                    {{ $t('moorages.moorage.last_seen') }}
                  </dt>
                  <dd class="text-gray-800 dark:text-white">
                    {{ dateFormatUTC(item.last_seen) }}
                  </dd>
                </div>

                <!-- first_seen_id -->
                <div class="hover:bg-gray-100 dark:hover:bg-gray-800 p-3 rounded transition">
                  <dt class="font-semibold text-gray-900 dark:text-white">
                    {{ $t('moorages.moorage.note') }}
                  </dt>
                  <dd class="w-full text-gray-800 dark:text-white">
                    <VaTextarea v-model="formData.notes" outline placeholder="Note" @change="handleSubmit" />
                  </dd>
                </div>
              </dl>

              <template v-if="updateError">
                <va-alert color="danger" outline class="mb-4">{{ $t('api.error') }}: {{ updateError }}</va-alert>
              </template>
              <div>
                <!--
                <div class="flex">
                  <va-button :disabled="!canSubmit" @click="handleSubmit">Save</va-button>
                </div>
                -->
                <div class="flex flex-row pa-2 p-2">
                  <va-button icon="delete" color="danger" style="width: 100%" @click="handleDelete">{{
                    $t('moorages.moorage.delete')
                  }}</va-button>
                </div>
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
  import { useRoute, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { setAppTitle } from '../../utils/app.js'
  import PostgSail from '../../services/api-client'
  import { useCacheStore } from '../../stores/cache-store'
  import { useGlobalStore } from '../../stores/global-store'
  import Map from '../../components/maps/leafletMapMoorages.vue'
  import { asBusy } from '../../utils/handleExports'
  import StayAt from '../../components/SelectStayAt.vue'
  import { dateFormatUTC, durationI18nDaysHours } from '../../utils/dateFormatter.js'
  import { useModal, useToast } from 'vuestic-ui'
  const { confirm } = useModal()
  const { init: initToast } = useToast()
  const { t } = useI18n()

  import moorages from '../../data/moorages.json'

  const router = useRouter()
  const route = useRoute()
  const CacheStore = useCacheStore()
  const GlobalStore = useGlobalStore()
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
          default_stay: apiData.row.default_stay,
          home: apiData.row.home,
          visits: apiData.row.stays_count,
          total_duration: apiData.row.stays_sum_duration,
          arrivals_departures: apiData.row.logs_count,
          notes: apiData.row.notes,
          default_stay_id: apiData.row.default_stay_id,
          first_seen: apiData.row.stay_first_seen,
          last_seen: apiData.row.stay_last_seen,
          first_seen_id: apiData.row.stay_first_seen_id,
          last_seen_id: apiData.row.stay_last_seen_id,
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
      //const response = await api.moorage_get(id)
      const response = await CacheStore.getAPI('moorage_get', id)
      if (Array.isArray(response)) {
        apiData.row = response[0]
        formData.name = apiData.row.name || null
        formData.notes = apiData.row.notes || null
        if (formData.name) {
          document.title = setAppTitle(t('moorages.details.title') + ': ' + formData.name)
        }
      } else {
        throw { response }
      }
    } catch (e) {
      apiError.value = e
      if (!import.meta.env.PROD) {
        console.warn('Get sample data from local json...', apiError.value)
        const row = moorages.find((row) => row.id == route.params.id)
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
      const response = await api.moorage_update(id, payload)
      //console.log(response)
      if (response) {
        console.log('moorage_update success', response)
        // Clean CacheStore and force refresh
        await CacheStore.resetCache()
        CacheStore.refresh = 'true'
        await CacheStore.getAPI('moorage_get', id)
        CacheStore.refresh = 'false'
        return true
      } else {
        throw { response }
      }
    } catch (err) {
      console.log('moorage_update failed', err.message ?? err)
      updateError.value = err
    } finally {
      initToast({
        message: updateError.value ? `Error updating moorage entry` : `Successfully updated moorage entry`,
        position: 'top-right',
        color: updateError.value ? 'warning' : 'success',
      })
      isBusy.value = false
    }
  }

  function runBusy(fn, ...args) {
    asBusy(isBusy, apiError, fn, ...args)
  }

  function updateDefaultStay(update_default_stay) {
    // runBusy handles isBusy & apiError
    console.log('updateDefaultStay', update_default_stay)
    const id = route.params.id
    if (update_default_stay && update_default_stay > 0) {
      new PostgSail()
        .moorage_update(id, { stay_code: update_default_stay })
        .then(async (response) => {
          console.log('updateDefaultStay success', response)
          // Clean CacheStore and force refresh
          await CacheStore.resetCache()
          await CacheStore.getAPI('moorage_get', id)
          //return true
        })
        .catch((err) => {
          console.log('updateDefaultStay failed', err.message ?? err)
          updateError.value = err
        })
        .finally(() => {
          initToast({
            message: updateError.value ? `Error updating moorage entry` : `Successfully updated moorage entry`,
            position: 'top-right',
            color: updateError.value ? 'warning' : 'success',
          })
          isBusy.value = false
        })
    }
  }

  function updateHome(new_home) {
    // runBusy handles isBusy & apiError
    console.log('updateHome', new_home)
    const id = route.params.id
    new PostgSail()
      .moorage_update(id, { home_flag: new_home })
      .then(async (response) => {
        console.log('updateHome success', response)
        // Clean CacheStore and force refresh
        await CacheStore.resetCache()
        await CacheStore.getAPI('moorage_get', id)
        //return true
      })
      .catch((err) => {
        console.log('updateHome failed', err.message ?? err)
        updateError.value = err
      })
      .finally(() => {
        initToast({
          message: updateError.value ? `Error updating moorage entry` : `Successfully updated moorage entry`,
          position: 'top-right',
          color: updateError.value ? 'warning' : 'success',
        })
        isBusy.value = false
      })
  }

  const handleDelete = async () => {
    isBusy.value = true
    updateError.value = null
    let canDelete = false

    const modal_result = await confirm({
      message:
        'This will permanently delete the Moorage Entry and any associated Logs and Stays. Do you really want to continue?',
      title: 'Are you sure?',
      okText: 'Yes, I agree',
      cancelText: 'No, keep my data',
    })
    if (modal_result) {
      canDelete = true
      if (GlobalStore.readOnly) {
        initToast({
          message: `Demo account readonly`,
          position: 'top-right',
          color: 'warning',
        })
        return false
      }
    } else {
      isBusy.value = false
      initToast('Operation cancel')
    }

    if (!canDelete) return

    const api = new PostgSail()
    const id = route.params.id
    try {
      const response = await api.moorage_delete(id)
      if (response) {
        console.log('moorage_delete success', response)
        // Clean CacheStore and force refresh
        await CacheStore.resetCache()
        await CacheStore.getAPI('moorage_get', id)
      } else {
        throw { response }
      }
    } catch (err) {
      const { response } = err
      console.log('moorage_delete failed', response)
      updateError.value = response.message
    } finally {
      isBusy.value = false
      router.push({ name: 'logs' })
    }
  }
</script>

<style lang="scss" scoped>
  .va-input-wrapper.va-textarea {
    width: 100%;
  }
</style>
