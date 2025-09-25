<template>
  <!-- Photo Upload/Preview -->
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
          @click="handleDelete()"
        />
        <img :src="item.image_url" class="w-full max-h-48 object-contain border rounded" />
        <p class="text-sm text-gray-400 mt-1">{{ t('photoUploader.lastUpdated') }}: {{ item.image_updated_at }}</p>
      </div>
    </template>
  </dd>
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
  const emit = defineEmits(['updated'])
  const imgObj = computed(() => {
    const obj = {
      id: props.item.id,
      image_url: props.item.image_url,
      image_updated_at: props.item.image_updated_at,
      type: props.type,
    }
    //console.debug('imgObj', obj)
    return obj
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
    if (import.meta.env.VITE_S3_URL) {
      // If S3 URL is set, use the old method
      return submitImage()
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      //imgPreview.value = reader.result
      //console.debug(selected)
      submitImage2(e.target.result, selected.type)
    }
    reader.readAsDataURL(selected)
  }

  async function submitImage2(img, type) {
    //if (!fileUpload.value) return
    //console.debug('submitImage2', img, type)
    let isDelete = false
    if (imgObj.value.image_url && !img && !type) {
      console.debug('Removing image')
      isDelete = true
      fileUpload.value = null
      imgPreview.value = null
      apiError.value = null
      imgObj.value.image_url = null
    }

    isBusy.value = true
    apiError.value = null
    const api = new PostgSail()
    const payload = {
      image_b64: img ? img.split(',')[1] : null, // get the base64 part without the header
      image_type: type,
      ref_id: imgObj.value.id,
    }
    try {
      const response = await api.image_update(payload, props.type)
      //console.log(response)
      if (response) {
        console.log(`Image ${props.type} update success`, response)
        apiError.value = null
        emit('updated', {
          ...props.item,
          has_image: true,
          image_url: `/rpc/image?entity=${props.type}&v_id=${vesselId}&_id=${payload.ref_id}`,
        })
      } else {
        throw { response }
      }
    } catch (err) {
      console.error('Image update error:', err)
      apiError.value = 'Failed to update image.'
    } finally {
      let notifyMsg = apiError.value ? `Error uploading image` : `Successfully uploaded image`
      if (isDelete) {
        apiError.value ? `Error deleting image` : `Successfully deleted image`
      }
      initToast({
        message: notifyMsg,
        position: 'top-right',
        color: apiError.value ? 'warning' : 'success',
      })
      isBusy.value = false
      showCustomContent.value = false
    }
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
      const presignResponse = await api.getPresignedUploadUrl({
        _image_type: type,
        _id: String(imgObj.value.id),
        _type: imgObj.value.type,
        _vessel_id: vesselId,
      })
      isBusy.value = true
      // Step 2: Upload the file directly
      const uploadResult = await fetch(presignResponse, {
        method: 'PUT',
        headers: {
          'Content-Type': type,
        },
        body: file, // Directly use the binary File object
      })

      if (!uploadResult.ok) {
        throw new Error(`Upload failed: ${uploadResult.statusText}`)
      }

      let image_url = `${import.meta.env.VITE_S3_URL}/postgsail/${vesselId}/${props.type}s/${props.type}_${vesselId}_${
        imgObj.value.id
      }.${type.split('/')[1]}`
      if (props.type === 'vessel') {
        image_url = `${import.meta.env.VITE_S3_URL}/postgsail/${vesselId}/${vesselId}.${type.split('/')[1]}`
      }

      const payload = {
        image_type: type,
        ref_id: imgObj.value.id,
        image_url: imgObj.value.image_url ? imgObj.value.image_url : image_url,
      }
      try {
        const response = await api.image_update(payload, props.type)
        //console.log(response)
        if (response) {
          console.log('Image update success', response)
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
        has_image: true,
        image_url: image_url,
      })
      // Notify user
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
    console.debug('Removing image')
    const isDelete = true
    fileUpload.value = null
    imgPreview.value = null
    apiError.value = null
    imgObj.value.image_url = null

    isBusy.value = true
    apiError.value = null
    const api = new PostgSail()
    const payload = {
      image_b64: null,
      image_type: null,
      image: null,
      ref_id: imgObj.value.id,
      image_url: null,
      image_updated_at: null,
    }
    try {
      const response = await api.image_update(payload, props.type)
      //console.log(response)
      if (response) {
        console.log('Image update success', response)
        apiError.value = null
        emit('updated', { ...props.item, has_image: false, image_url: null })
      } else {
        throw { response }
      }
    } catch (err) {
      console.error('Image update error:', err)
      apiError.value = 'Failed to update image.'
    } finally {
      let notifyMsg = apiError.value ? `Error uploading image` : `Successfully uploaded image`
      if (isDelete) {
        apiError.value ? `Error deleting image` : `Successfully deleted image`
      }
      initToast({
        message: notifyMsg,
        position: 'top-right',
        color: apiError.value ? 'warning' : 'success',
      })
      isBusy.value = false
      showCustomContent.value = false
    }
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
