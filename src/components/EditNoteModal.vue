<template>
  <div>
    <va-modal v-model="proxyModel" no-padding style="z-index: 99999">
      <template #content="{ cancel }">
        <va-card-title>
          {{ t('modals.noteEditor.title') }}
        </va-card-title>
        <va-card-content>
          <va-inner-loading :loading="isBusy">
            <!--
            <p class="mb-3">{{ stay.moorage_name }} ({{ stay.arrived }})</p>
            -->
            <template v-if="apiError">
              <va-alert color="danger" outline class="mb-4">{{ t('api.error') }}: {{ apiError }}</va-alert>
            </template>
            <div style="mb-4">
              <va-input
                ref="clone"
                v-model="formData.name"
                type="text"
                :placeholder="t('modals.noteEditor.placeholder')"
                style="width: 100%"
              />
            </div>
            <div style="mb-4">
              <vaTextarea
                ref="clone"
                v-model="formData.notes"
                type="textarea"
                :label="t('modals.noteEditor.title') + ':'"
                :placeholder="t('modals.noteEditor.placeholder')"
                :min-rows="5"
                :max-rows="5"
                @focus="$event.target.select()"
              >
              </vaTextarea>
            </div>
          </va-inner-loading>
        </va-card-content>
        <va-card-actions>
          <va-button icon="cancel" class="ml-auto" color="primary" style="width: 100%" @click="cancel">{{
            t('modals.cancel')
          }}</va-button>
          <va-button icon="save" class="ml-auto" color="primary" style="width: 100%" @click="handleSubmit">{{
            t('modals.save')
          }}</va-button>
          <va-button icon="delete" class="ml-auto" color="danger  " style="width: 100%" @click="handleDelete">{{
            t('modals.delete')
          }}</va-button>
        </va-card-actions>
      </template>
    </va-modal>
  </div>
</template>

<script setup>
  import { onMounted, computed, ref } from 'vue'
  import PostgSail from '../services/api-client'
  import { useI18n } from 'vue-i18n'
  import { useToast } from 'vuestic-ui'
  const { init: initToast } = useToast()
  const { t } = useI18n()
  const emit = defineEmits(['update:modelValue', 'updated'])

  const props = defineProps({
    modelValue: { type: Boolean, required: true },
    item: {
      type: Object,
      required: true,
    },
    type: {
      type: String,
      required: true,
    },
  })
  console.log('EditNoteModal props', props)
  const isBusy = ref(true)
  const apiError = ref(null)
  const showModal = ref(false)
  const formData = ref({
    notes: props.item?.stay_notes || props.item?.notes || '',
    name: props.item?.stay_name || props.item?.name || '',
  })

  const noteObj = computed(() => {
    const obj = {
      id: props.item.stay_id || props.item.id || null,
      notes: props.item?.stay_notes || props.item?.notes || '',
      name: props.item?.stay_name || props.item?.name || '',
      type: props.type,
    }
    console.debug('noteObj', obj)
    return obj
  })

  const proxyModel = computed({
    get: () => props.modelValue,
    set: (val) => emit('update:modelValue', val),
  })

  onMounted(() => {
    formData.value = {
      notes: props.item?.stay_notes || props.item?.notes || '',
      name: props.item?.stay_name || props.item?.name || '',
    }
    apiError.value = null
    isBusy.value = false
  })

  const handleSubmit = async () => {
    isBusy.value = true
    apiError.value = null

    const api = new PostgSail()
    const payload = {
      notes: formData.value.notes,
      name: formData.value.name,
    }
    try {
      const response = await api.note_update(noteObj.value.id, payload, noteObj.value.type)
      //console.log(response)
      if (response) {
        console.log('note_update success', response)
        localStorage.removeItem('cache')
        if (noteObj.value.type === 'stay') {
          emit('updated', { ...props.item, stay_notes: payload.notes, stay_name: payload.name })
        } else {
          emit('updated', { ...props.item, notes: payload.notes, name: payload.name })
        }
      } else {
        throw { response }
      }
    } catch (err) {
      console.log('note_update failed', err.message ?? err)
      apiError.value = err
    } finally {
      initToast({
        message: apiError.value ? `Error updating note entry` : `Successfully updated note entry`,
        position: 'top-right',
        color: apiError.value ? 'warning' : 'success',
      })
      isBusy.value = false
      showModal.value = false
    }
  }

  const handleDelete = async () => {
    isBusy.value = true
    apiError.value = null

    const api = new PostgSail()
    const payload = {
      notes: '',
    }
    try {
      const response = await api.note_update(noteObj.value.id, payload, noteObj.value.type)
      //console.log(response)
      if (response) {
        console.log('note_update success', response)
        localStorage.removeItem('cache')
        if (noteObj.value.type === 'stay') {
          emit('updated', { ...props.item, stay_notes: null })
        } else {
          emit('updated', { ...props.item, notes: null })
        }
      } else {
        throw { response }
      }
    } catch (err) {
      console.log('note_update failed', err.message ?? err)
      apiError.value = err
    } finally {
      initToast({
        message: apiError.value ? `Error updating note entry` : `Successfully updated note entry`,
        position: 'top-right',
        color: apiError.value ? 'warning' : 'success',
      })
      isBusy.value = false
      showModal.value = false
    }
  }
</script>

<style lang="scss" scoped>
  .va-input-wrapper.va-input-wrapper--labeled.va-textarea {
    width: 100%;
  }
  .va-modal {
    z-index: 99999;
  }
</style>
