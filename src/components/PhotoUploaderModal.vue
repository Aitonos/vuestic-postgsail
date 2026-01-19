<template>
  <!--
    <va-button @click="handleGetToken">
      {{ t('boats.boat.token_modal.button') }}
    </va-button>
  -->
  <!--
  <template v-if="!item.image_url">
    <va-icon name="photo_camera" @click="showCustomContent = !showCustomContent" />
  </template>
  <template v-else>
    <div v-if="item.image_url" class="relative">
      <VaButton icon="delete" color="secondary" class="absolute top-2 right-2 text-red-500" @click="handleDelete()" />
      <img :src="item.image_url" class="w-full max-h-48 object-contain border rounded" />
    </div>
  </template>
-->
  <VaModal v-model="proxyModel" no-padding style="z-index: 99999">
    <template #content="{ cancel }">
      <VaCardContent>
        <va-inner-loading :loading="isBusy">
          <div class="col-span-full mt-6 p-3 rounded transition hover:bg-gray-100 dark:hover:bg-gray-800">
            <dt class="font-semibold text-gray-800 dark:text-white">
              {{ $t('boats.boat.photo') }}
            </dt>
            <dd class="mt-2">
              <template v-if="!item.image_url">
                <input type="file" accept="image/*" @change="onFileChange" />
                <div v-if="imgPreview" class="mt-4">
                  <p class="text-sm text-gray-500 mb-2">{{ t('photoUploader.preview') }}:</p>
                  <img :src="imgPreview" class="w-full max-h-48 object-contain border rounded" />
                </div>
              </template>
              <template v-else>
                <div v-if="item.image_url" class="relative">
                  <VaButton
                    icon="delete"
                    color="secondary"
                    class="absolute top-2 right-2 text-red-500"
                    :title="t('photoUploader.delete')"
                    @click="handleDelete(item, item.id)"
                  />
                  <img :src="item.image_url" class="w-full max-h-48 object-contain border rounded" />
                </div>
              </template>
            </dd>
          </div>
        </va-inner-loading>
      </VaCardContent>
      <VaCardActions>
        <va-button icon="cancel" class="ml-auto" color="primary" style="width: 100%" @click="cancel">{{
          t('modals.cancel')
        }}</va-button>
        <!--
        <va-button icon="save" class="ml-auto" color="primary" style="width: 100%" @click="save">{{
          t('modals.save')
        }}</va-button>
        -->
        <va-button icon="delete" class="ml-auto" color="danger  " style="width: 100%" @click="handleDelete">{{
          t('modals.delete')
        }}</va-button>
      </VaCardActions>
    </template>
  </VaModal>
</template>

<script setup>
  import { onMounted, computed, ref, onBeforeUnmount } from 'vue'
  import PostgSail from '../services/api-client'
  import { useI18n } from 'vue-i18n'
  import { useToast } from 'vuestic-ui'
  const { init: initToast } = useToast()
  import { useVesselStore } from '../stores/vessel-store'

  const { vesselId } = useVesselStore()
  const { t } = useI18n()

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
  const isBusy = ref(true)
  const apiError = ref(null)
  const showCustomContent = ref(false)
  const fileUpload = ref(null)
  const imgPreview = ref(null)
  const emit = defineEmits(['update:modelValue', 'updated'])
  const imgObj = computed(() => {
    const obj = {
      id: props.item.id,
      images: props.item?.images || [],
      type: props.type,
    }
    if (props.type === 'stay' && props.item.stay_id) {
      obj.id = props.item.stay_id
    }
    console.debug('imgObj', props, obj)
    return obj
  })

  const proxyModel = computed({
    get: () => props.modelValue,
    set: (val) => emit('update:modelValue', val),
  })

  onMounted(() => {
    imgPreview.value = null
    fileUpload.value = null
    apiError.value = null
    isBusy.value = false
  })

  function onFileChange(event) {
    const selected = event.target.files[0]
    if (!selected) {
      fileUpload.value = null
      imgPreview.value = null
      apiError.value = null
      return
    }

    if (!selected.type.startsWith('image/')) {
      apiError.value = 'Please select a valid image file.'
      fileUpload.value = null
      return
    }

    fileUpload.value = selected
    apiError.value = null
    imgPreview.value = URL.createObjectURL(selected)
    //console.debug('Selected file:', imgPreview.value)
    if (!import.meta.env.VITE_S3_URL) {
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      //imgPreview.value = reader.result
      //console.debug(selected)
      submitImage()
    }
    reader.readAsDataURL(selected)
  }

  async function submitImage() {
    if (!fileUpload.value) return

    const file = fileUpload.value
    const type = file.type
    const api = new PostgSail()

    isBusy.value = true
    apiError.value = null

    try {
      // Step 1: Get presigned PUT URL from backend
      const uploadUrl = await api.getPresignedUploadUrl({
        _image_type: type,
        _id: imgObj.value.type === 'vessel' ? null : String(imgObj.value.id), // Id for stays, moorages, logbooks
        _type: imgObj.value.type,
        _vessel_id: vesselId,
        _idx: (props.item.images?.length || 0) + 1, // Index of images array for stays, moorages, logbooks
      })
      // Step 2: Upload the file directly
      const uploadResult = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': type,
        },
        body: file, // Directly use the binary File object
      })

      if (!uploadResult.ok) {
        throw new Error(`Upload failed: ${uploadResult.statusText}`)
      }

      const image_url = uploadUrl.split('?')[0]

      const payload = {
        _image_type: type,
        _id: imgObj.value.type === 'vessel' ? null : String(imgObj.value.id),
        _type: imgObj.value.type,
        _vessel_id: vesselId,
        _image_url: image_url,
      }
      let responseObj = null
      try {
        const response = await api.image_update(payload)
        //console.log(response)
        if (response) {
          console.log('Image update success', response)
          responseObj = response
        } else {
          throw { response }
        }
      } catch (err) {
        console.error('Image update error:', err)
        apiError.value = 'Failed to update image.'
      }

      // Step 3: Emit update
      emit('updated', {
        ...props.item,
        has_images: true,
        images: [
          ...(props.item.images || []).map((img) => ({ ...img })), // Create plain objects
          responseObj,
        ],
      })
      // Step 4: Notify user
      initToast({
        message: 'Successfully uploaded image',
        position: 'top-right',
        color: 'success',
      })
    } catch (err) {
      console.error('Image upload error:', err)
      apiError.value = 'Failed to upload image.'

      initToast({
        message: 'Error uploading image',
        position: 'top-right',
        color: 'warning',
      })
    } finally {
      isBusy.value = false
      showCustomContent.value = false
    }
  }

  async function handleDelete() {
    console.debug('Removing image handleDelete, do nothing')
  }

  onBeforeUnmount(() => {
    if (imgPreview.value) {
      URL.revokeObjectURL(imgPreview.value)
    }
  })
</script>

<style scoped>
  input[type='file'] {
    display: block;
  }
</style>
