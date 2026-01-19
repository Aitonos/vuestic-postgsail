<template>
  <!-- Photo Upload/Preview -->
  <dd class="mt-2">
    <div class="text-xs uppercase my-2 flex items-center justify-between">
      <!-- Hidden file input with label approach -->
      <label class="cursor-pointer">
        <input type="file" accept="image/*" class="hidden" @change="onFileChange" />
        <va-icon
          name="photo_camera"
          class="cursor-pointer hover:text-primary transition-colors"
          :title="t('photoUploader.select_photo')"
        />
      </label>
    </div>

    <div v-if="item.images && item.images.length > 0">
      <!-- Horizontal scrollable gallery -->
      <div class="flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
        <div
          v-for="(image, index) in item.images"
          :key="image.id"
          class="relative flex-shrink-0 w-40 h-40 sm:w-48 sm:h-48 snap-center"
          @click="openImage(index)"
        >
          <img
            :src="image.url"
            :alt="`Image ${index + 1}`"
            class="w-full h-full object-cover rounded-lg cursor-pointer"
          />
          <!-- Delete button -->
          <VaButton
            icon="delete"
            size="small"
            color="danger"
            class="absolute top-2 right-2 shadow-lg"
            :title="t('photoUploader.delete')"
            @click.stop="confirmDelete(image)"
          />
        </div>
      </div>

      <!-- Mobile-friendly image viewer -->
      <Transition name="slide-up">
        <div
          v-if="viewerOpen"
          class="fixed inset-0 z-50 bg-black"
          @touchstart="handleTouchStart"
          @touchmove="handleTouchMove"
          @touchend="handleTouchEnd"
        >
          <!-- Header -->
          <div
            class="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-4 flex items-center justify-between z-10"
          >
            <span class="text-white text-sm"> {{ currentImageIndex + 1 }} / {{ item.images.length }} </span>
            <div class="flex items-center gap-4">
              <!-- Delete button in viewer -->
              <VaButton
                icon="delete"
                size="small"
                color="danger"
                class="shadow-lg"
                :title="t('photoUploader.delete')"
                @click="confirmDeleteCurrent"
              />
              <!-- Close button -->
              <button type="button" class="text-white text-3xl" @click="closeImage">&times;</button>
            </div>
          </div>

          <!-- Image container with swipe support -->
          <div class="h-full flex items-center justify-center px-4">
            <img
              v-if="item.images[currentImageIndex]"
              :src="item.images[currentImageIndex].url"
              class="max-w-full max-h-full object-contain"
              :style="{ transform: `translateX(${swipeOffset}px)` }"
            />
          </div>

          <!-- Navigation dots -->
          <div v-if="item.images.length > 1" class="absolute bottom-8 left-0 right-0 flex justify-center gap-2">
            <button
              v-for="(image, index) in item.images"
              :key="index"
              type="button"
              class="w-2 h-2 rounded-full transition-all"
              :class="index === currentImageIndex ? 'bg-white w-6' : 'bg-white/50'"
              @click="currentImageIndex = index"
            />
          </div>

          <!-- Desktop navigation arrows -->
          <button
            v-if="item.images.length > 1"
            type="button"
            class="hidden sm:block absolute left-4 top-1/2 -translate-y-1/2 text-white text-4xl hover:text-gray-300 transition-colors"
            @click="previousImage"
          >
            &#8249;
          </button>

          <button
            v-if="item.images.length > 1"
            type="button"
            class="hidden sm:block absolute right-4 top-1/2 -translate-y-1/2 text-white text-4xl hover:text-gray-300 transition-colors"
            @click="nextImage"
          >
            &#8250;
          </button>
        </div>
      </Transition>
    </div>

    <!-- Empty state -->
    <label
      v-else
      class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors block"
    >
      <input type="file" accept="image/*" class="hidden" @change="onFileChange" />
      <va-icon name="add_photo_alternate" :size="48" class="text-gray-400 mb-2" />
      <p class="text-sm text-gray-500">{{ t('photoUploader.no_photos') }}</p>
    </label>
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

  const isBusy = ref(false)
  const apiError = ref(null)
  const fileUpload = ref(null)
  const imgPreview = ref(null)
  const emit = defineEmits(['updated'])

  const imgObj = computed(() => ({
    id: props.item.id,
    images: props.item.images,
    has_images: props.item.has_images,
    type: props.type,
  }))
  console.debug('imgObj', props.item)

  // Gallery viewer state
  const viewerOpen = ref(false)
  const currentImageIndex = ref(0)
  const swipeOffset = ref(0)
  const touchStartX = ref(0)
  const touchCurrentX = ref(0)

  onMounted(() => {
    imgPreview.value = null
    fileUpload.value = null
    apiError.value = null
    isBusy.value = false
  })

  onBeforeUnmount(() => {
    if (imgPreview.value) {
      URL.revokeObjectURL(imgPreview.value)
    }
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
      apiError.value = t('photoUploader.formats')
      fileUpload.value = null
      return
    }

    fileUpload.value = selected
    apiError.value = null
    imgPreview.value = URL.createObjectURL(selected)

    if (!import.meta.env.VITE_S3_URL) {
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      return submitImage()
    }
    reader.readAsDataURL(selected)
  }

  async function submitImage() {
    if (!fileUpload.value || isBusy.value) return

    const file = fileUpload.value
    const type = file.type
    const api = new PostgSail()

    isBusy.value = true
    apiError.value = null

    try {
      // Step 1: Get presigned PUT URL from backend
      const uploadUrl = await api.getPresignedUploadUrl({
        _image_type: type,
        _id: imgObj.value.type === 'vessel' ? null : String(imgObj.value.id),
        _type: imgObj.value.type,
        _vessel_id: vesselId,
        _idx: imgObj.value.type === 'vessel' ? null : props.item.images?.length + 1 || 1,
      })

      // Step 2: Upload the file directly
      const uploadResult = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': type,
        },
        body: file,
      })

      if (!uploadResult.ok) {
        throw new Error(`Upload failed: ${uploadResult.statusText}`)
      }

      // Step 3: Construct image URL
      const image_url = uploadUrl.split('?')[0]

      const payload = {
        _image_type: type,
        _id: imgObj.value.type === 'vessel' ? null : String(imgObj.value.id),
        _type: imgObj.value.type,
        _vessel_id: vesselId,
        _image_url: image_url,
      }

      const response = await api.image_update(payload)
      if (!response) {
        throw new Error('Failed to update image')
      }
      //console.log('Image update success', response)

      // Step 4: Emit update
      if (imgObj.value.type === 'vessel') {
        emit('updated', {
          ...props.item,
          image_url: image_url,
          image_updated_at: new Date().toISOString(),
          has_images: true,
          images: [...(props.item.images || []), response],
        })
      } else {
        emit('updated', {
          ...props.item,
          has_images: true,
          images: [...(props.item.images || []), response],
        })
      }

      // Step 5: Notify user
      initToast({
        message: t('photoUploader.success_upload'),
        position: 'top-right',
        color: 'success',
      })
    } catch (err) {
      console.error('Image upload error:', err)
      apiError.value = 'Failed to upload image.'

      initToast({
        message: t('photoUploader.error_upload'),
        position: 'top-right',
        color: 'warning',
      })
    } finally {
      isBusy.value = false
      fileUpload.value = null
    }
  }

  async function confirmDelete(image) {
    if (!confirm(t('photoUploader.confirm_delete'))) return
    await handleDelete(image)
  }

  async function confirmDeleteCurrent() {
    if (!confirm(t('photoUploader.confirm_delete'))) return
    const currentImage = props.item.images[currentImageIndex.value]
    await handleDelete(currentImage)
  }

  async function handleDelete(image) {
    if (isBusy.value) return

    console.debug('Removing image', image)

    isBusy.value = true
    apiError.value = null
    const api = new PostgSail()

    const payload = {
      _id: imgObj.value.type === 'vessel' ? null : String(imgObj.value.id),
      _image_id: image.id,
      _type: imgObj.value.type,
      _vessel_id: vesselId,
      _operation: 'delete',
    }

    try {
      const response = await api.image_update(payload)
      if (!response) {
        throw new Error('Failed to delete image')
      }
      //console.log('Image delete success', response)

      // Filter out the deleted image
      const updatedImages = (props.item.images || []).filter((img) => img.id !== image.id)

      emit('updated', {
        ...props.item,
        has_images: updatedImages.length > 0,
        images: updatedImages,
      })

      // Adjust viewer state if in viewer
      if (viewerOpen.value) {
        if (updatedImages.length === 0) {
          closeImage()
        } else if (currentImageIndex.value >= updatedImages.length) {
          currentImageIndex.value = Math.max(0, updatedImages.length - 1)
        }
      }

      initToast({
        message: t('photoUploader.success_delete'),
        position: 'top-right',
        color: 'success',
      })
    } catch (err) {
      console.error('Image delete error:', err)
      apiError.value = 'Failed to delete image.'

      initToast({
        message: t('photoUploader.error_delete'),
        position: 'top-right',
        color: 'warning',
      })
    } finally {
      // Step 1: Get presigned DELETE URL from backend
      const deleteUrl = await api.getPresignedDeleteUrl({
        _image_type: image.type,
        _id: props.type === 'vessel' ? null : String(imgObj.value.id),
        _type: props.type,
        _vessel_id: vesselId,
        _idx: image.id, // Index of images array for stays, moorages, logbooks
      })
      // Step 2: Delete the file directly
      const deleteResult = await fetch(deleteUrl, {
        method: 'DELETE',
      })

      if (!deleteResult.ok) {
        console.error('Delete failed:', deleteResult.statusText)
        //throw new Error(`Delete failed: ${deleteResult.statusText}`)
      }
      // Filter out the deleted image
      const updatedImages = props.item.images.filter((img) => img.id !== image.id)
      emit('updated', {
        ...props.item,
        has_images: updatedImages.length > 0,
        images: updatedImages,
      })
      initToast({
        message: 'Successfully deleted image',
        position: 'top-right',
        color: 'success',
      })
      isBusy.value = false
    }
  }

  // Gallery viewer functions
  const openImage = (index) => {
    currentImageIndex.value = index
    viewerOpen.value = true
    document.body.style.overflow = 'hidden'
  }

  const closeImage = () => {
    viewerOpen.value = false
    swipeOffset.value = 0
    document.body.style.overflow = ''
  }

  const nextImage = () => {
    if (currentImageIndex.value < props.item.images.length - 1) {
      currentImageIndex.value++
    }
  }

  const previousImage = () => {
    if (currentImageIndex.value > 0) {
      currentImageIndex.value--
    }
  }

  // Touch gesture handlers
  const handleTouchStart = (e) => {
    touchStartX.value = e.touches[0].clientX
  }

  const handleTouchMove = (e) => {
    touchCurrentX.value = e.touches[0].clientX
    swipeOffset.value = touchCurrentX.value - touchStartX.value
  }

  const handleTouchEnd = () => {
    const swipeThreshold = 50

    if (swipeOffset.value > swipeThreshold) {
      previousImage()
    } else if (swipeOffset.value < -swipeThreshold) {
      nextImage()
    }

    swipeOffset.value = 0
    touchStartX.value = 0
    touchCurrentX.value = 0
  }
</script>

<style scoped>
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }

  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  .slide-up-enter-active,
  .slide-up-leave-active {
    transition: transform 0.3s ease-out;
  }

  .slide-up-enter-from {
    transform: translateY(100%);
  }

  .slide-up-leave-to {
    transform: translateY(100%);
  }
</style>
