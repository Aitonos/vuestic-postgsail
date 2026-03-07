<template>
  <div>
    <!--
    <va-button @click="handleGetToken">
      {{ t('boats.boat.token_modal.button') }}
    </va-button>
  -->
    <va-button
      icon="generating_tokens"
      color="primary"
      size="medium"
      :title="t('profile.token_modal.title')"
      @click="handleGetToken"
    >
      {{ t('profile.token_modal.title') }}
    </va-button>
    <va-modal v-model="showModal" no-padding>
      <template #content="{ ok }">
        <va-card-title>
          {{ t('profile.token_modal.title') }}
        </va-card-title>
        <va-card-content>
          <va-inner-loading :loading="isBusy">
            <p class="mb-3">
              {{ t('profile.token_modal.details') }}
            </p>
            <template v-if="apiError">
              <va-alert color="danger" outline class="mb-4">{{ t('api.error') }}: {{ apiError }}</va-alert>
            </template>
            <!-- TODO use better CSS -->
            <div class="mb-4">
              <vaTextarea
                ref="clone"
                v-model="mcpToken"
                type="textarea"
                :label="t('boats.boat.token_modal.token') + ':'"
                placeholder="Readonly Token"
                :min-rows="3"
                :max-rows="4"
                :readonly="true"
                @focus="$event.target.select()"
              >
                <template #appendInner>
                  <va-icon name="content_copy" @click="copyToClipboard" />
                </template>
              </vaTextarea>
              <va-alert color="warning" outline class="mb-4">
                {{ t('profile.token_modal.message') }}
                <va-icon name="content_copy" atl="Title" @click="copyToClipboard" />
              </va-alert>
              <va-alert color="info" outline class="mb-4">
                {{ $t('profile.msg.mcp_integration') }}
                <a
                  href="https://github.com/xbgmsharp/postgsail-mcp-server"
                  target="_blank"
                  rel="noopener"
                  class="underline"
                >
                  PostgSail Model Context Protocol (MCP) Server
                </a>
              </va-alert>
            </div>
          </va-inner-loading>
        </va-card-content>
        <va-card-actions>
          <va-button class="ml-auto" color="primary" style="width: 100%" @click="ok">{{ t('modals.close') }}</va-button>
        </va-card-actions>
      </template>
    </va-modal>
  </div>
</template>

<script setup>
  import { computed, ref } from 'vue'
  import PostgSail from '../../services/api-client'
  import { useI18n } from 'vue-i18n'
  import { VaIcon, useToast } from 'vuestic-ui'

  const { t } = useI18n()
  const { init: initToast } = useToast()

  const isBusy = ref(true)
  const apiError = ref(null)
  const showModal = ref(false)
  const rowData = ref(null)

  const mcpToken = computed(() => {
    return rowData.value ? rowData.value : ''
  })

  async function handleGetToken() {
    isBusy.value = true
    apiError.value = null
    showModal.value = true
    try {
      const api = new PostgSail()
      const response = await api.mcp()
      if (response.token) {
        rowData.value = response.token
      } else {
        throw { response }
      }
    } catch ({ response }) {
      console.log(response)
      /*
      apiError.value = response.message
      console.warn("Could not get vessel's token", apiError)
      */
    } finally {
      isBusy.value = false
    }
  }

  const copyToClipboard = () => {
    console.log(`copyToClipboard ${mcpToken.value}`)
    navigator.clipboard.writeText(mcpToken.value)
    initToast({ message: 'Token copied to clipboard', position: 'top-right', color: 'primary' })
  }
</script>

<style lang="scss" scoped>
  .va-input-wrapper.va-input-wrapper--labeled.va-textarea {
    width: 100%;
  }
</style>
