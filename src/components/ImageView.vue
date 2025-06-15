<template>
  <div id="searchForm">
    <n-form>
      <n-grid :span="24" :x-gap="24">
        <n-form-item-gi :span="4" label="Username" path="username">
          <n-input
            type="text"
            @keydown.enter.prevent
            :input-props="{ name: 'username', autocomplete: 'username', style: 'display:none;' }"
          />
        </n-form-item-gi>
        <n-form-item-gi :span="4" label="Password" path="password">
          <n-input
            v-model:value="password"
            type="password"
            @keydown.enter.prevent
            :input-props="{ name: 'password', autocomplete: 'current-password' }"
          />
        </n-form-item-gi>
        <n-form-item-gi :span="3" label="Date" path="date">
          <n-date-picker v-model:value="timestamp" type="date" />
        </n-form-item-gi>
        <n-form-item-gi :span="2" label="Update" path="update">
          <n-button round ghost color="#8a2be2" @click="clickUpdateImage">
            <template #icon>
              <n-icon>
                <RefreshOutline />
              </n-icon>
            </template>
            Update
          </n-button>
        </n-form-item-gi>
      </n-grid>
    </n-form>
  </div>
  <div id="imageBox">
    <n-image-group
      show-toolbar-tooltip
      :render-toolbar="renderToolbar"
      :on-preview-prev="goToPrev"
      :on-preview-next="goToNext"
    >
      <n-space>
        <template v-for="imageData, index in imagesData" :key="imageData.urlKey">
          <n-image
            width="200"
            :src="imageData.previewUrl"
            @click=setCurrentImageIndex(index)
          />
        </template>
      </n-space>
    </n-image-group>
  </div>
  <n-modal v-model:show="showModal" :on-after-enter="handleAfterModalOpen">
    <n-card
      style="width: 30%; position: relative; left: 34%;"
      title="Meta Data"
      :bordered="false"
      size="huge"
      role="dialog"
      aria-modal="true"
    >
      <template #header-extra>
      </template>
      <template v-for="data in currentMetaData">
        <n-space justify="end">
          <n-button @click="clickCopy(data)">
            <template #icon>
              <n-icon>
                <CopyOutline />
              </n-icon>
            </template>
            copy
          </n-button>
        </n-space>
        <p class="meta-data" style="white-space: pre-line;">{{ data }}</p>
      </template>
      <template #footer>
      </template>
    </n-card>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, watch, h, onMounted, nextTick } from "vue"
import type { ImageRenderToolbarProps } from "naive-ui"
import { CloudDownloadOutline, ConstructOutline, CopyOutline, RefreshOutline } from "@vicons/ionicons5"
import { NButton, useMessage, NIcon } from "naive-ui"

import { generatePresignedUrl, listImageKeys, validatePass } from "../services/aws-s3"
import { getMetaData } from "../services/image-meta"


const myBucket = import.meta.env.VITE_AWS_BUCKET


// Type
type ImageData = {
  urlKey: string
  previewUrl: string
  metaData: string[]
}

const timestamp = ref<number>(Date.now())
const password = ref<string>("")
const imagesData = ref<ImageData[]>([])
const currentImageIndex = ref<number>(0)
const showModal = ref<boolean>(false)
const currentMetaData = ref<string[]>([])
const message = useMessage()

const highlights = [
  // ComfyUI
  { key: "CheckpointLoaderSimple:", className: "hi-cu-checkpoint" },
  { key: "CLIPTextEncode:", className: "hi-cu-text" },
  { key: "VAELoader:", className: "hi-cu-vae" },
  { key: "LoraLoader:", className: "hi-cu-lora" },
  { key: "UpscaleModelLoader:", className: "hi-cu-up" },
  { key: "ControlNetLoader:", className: "hi-cu-cn" },
  // Stable Diffusion
  { key: "Model:", className: "hi-model" },
  { key: "VAE:", className: "hi-vae" },
  { key: "CFG scale:", className: "hi-sfgs" },
  { key: "Steps:", className: "hi-steps" },
  { key: "Denoising strength:", className: "hi-denois" },
  { key: "Lora hashes:", className: "hi-lora" }
]

const renderToolbar = ({ nodes }: ImageRenderToolbarProps) => {
  return [
    nodes.prev,
    nodes.next,
    nodes.rotateCounterclockwise,
    nodes.rotateClockwise,
    nodes.resizeToOriginalSize,
    nodes.zoomOut,
    nodes.zoomIn,
    h(
      NButton,
      {
        circle: true,
        type: "info",
        style: { marginLeft: "12px" },
        onClick: () => {
          clickDownloadImage(currentImageIndex.value)
        }
      },
      {
        icon: () => h(CloudDownloadOutline)
      }
    ),
    h(
      NButton,
      {
        circle: true,
        type: "primary",
        style: { marginLeft: "12px" },
        onClick: async () => {
          viewMetaData(currentImageIndex.value)
        }
      },
      {
        icon: () => h(ConstructOutline)
      }
    ),
    nodes.close,
  ]
}

const clickCopy = (text: string) => {
  navigator.clipboard.writeText(text)
}

const fetchImageUrls = async (date: string, asc: boolean = false) => {
  const keys = await listImageKeys(myBucket, `outputs/${date}/`, asc)

  if (keys.length === 0) {
    message.warning("Image not found.")
    return
  }
  message.success("Fetching images... Please wait a moment.")

  for (const key of keys) {
    if (typeof key === "string") {

      const fileBaseName = getFileBaseName(key)
      if (imagesData.value.some(image => getFileBaseName(image.urlKey) === fileBaseName)) {
        continue
      }

      const filenameJpg = fileBaseName + ".jpg"
      const filenamePng = fileBaseName + ".png"
      var urlKey
      var previewUrlKey
      if (keys.includes(filenameJpg) && keys.includes(filenamePng)) {
        urlKey = filenamePng
        previewUrlKey = filenameJpg
      } else {
        urlKey = key
        previewUrlKey = key
      }

      const presignedUrl = await generatePresignedUrl(myBucket, previewUrlKey)
      if (typeof presignedUrl !== "string") {
        continue
      }

      const metaData = await getMetaData(presignedUrl)

      if (asc) {
        imagesData.value.unshift({
          urlKey: urlKey,
          previewUrl: presignedUrl,
          metaData: metaData
        })
      } else {
        imagesData.value.push({
          urlKey: urlKey,
          previewUrl: presignedUrl,
          metaData: metaData
        })
      }
    }
  }
}

const getFileBaseName = (key: string) => {
  const dotIndex = key.lastIndexOf(".")
  return dotIndex !== -1 ? key.slice(0, dotIndex) : key
}

const clickUpdateImage = () => {
  if (imagesData.value.length === 0) {
    return
  }

  const date = timestamp_to_date(timestamp.value)

  if (date) {
    fetchImageUrls(date, true)
  }
}

const timestamp_to_date = (timestamp: number) => {
  const date = new Date(timestamp)

  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, "0") // 月は0始まりなので+1
  const dd = String(date.getDate()).padStart(2, "0")

  const formattedDate = `${yyyy}-${mm}-${dd}`

  return formattedDate
}

onMounted(() => {
  fetchImageUrls(timestamp_to_date(Date.now()))
})

watch([timestamp], ([newTimestamp], [oldTimestamp]) => {
  if (!validatePass(password.value)) {
    message.error("Incorrect Password!!!")
    return
  }

  const date = timestamp_to_date(newTimestamp as number)

  if (date) {
    imagesData.value = []
    fetchImageUrls(date)
  }
})

const setCurrentImageIndex = (index: number) => {
  currentImageIndex.value = index
}
const correctIndex = (index: number, listLength: number): number => {
  if (listLength === 0) return 0
  return (index + listLength) % listLength
}
const goToPrev = () => {
  currentImageIndex.value = correctIndex(currentImageIndex.value - 1, imagesData.value.length)
  currentMetaData.value = imagesData.value[currentImageIndex.value].metaData
  highlightMetaData()
}
const goToNext = () => {
  currentImageIndex.value = correctIndex(currentImageIndex.value + 1, imagesData.value.length)
  currentMetaData.value = imagesData.value[currentImageIndex.value].metaData
  highlightMetaData()
}

const clickDownloadImage = async (index: number) => {
  message.info("Start image download...")

  const key = imagesData.value[index].urlKey
  const url = await generatePresignedUrl(myBucket, key)
  const filename = key.split("/").pop() || ""

  await downloadImage(url, filename)

  message.success("Finish image download!!!")
}

const downloadImage = async (url: string, filename: string) => {
  const response = await fetch(url)
  const blob = await response.blob()
  const blobUrl = window.URL.createObjectURL(blob)

  const a = document.createElement("a")
  a.href = blobUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(blobUrl)
}

const viewMetaData = (index: number) => {
  showModal.value = true
  currentMetaData.value = imagesData.value[index].metaData
}

const handleAfterModalOpen = async () => {
  await nextTick()
  const mask = document.querySelector(".n-modal-mask") as HTMLElement
  // モーダル下の画像にmaskをかけないように
  if (mask) {
    mask.style.backgroundColor = "rgba(0, 0, 0, 0)"
  }
  highlightMetaData()
}

const highlightMetaData = async () => {
  await nextTick()
  const metaParagraphs = document.querySelectorAll(".meta-data")
  const target = metaParagraphs[metaParagraphs.length -1]

  if (!target) return

  const originalHTML = target.innerHTML
  let modifiedHTML = originalHTML

  for (const { key, className } of highlights) {
    const regex = new RegExp(`(${key})`, 'g')
    modifiedHTML = modifiedHTML.replace(
      regex,
      `<span class="${className}">$1</span>`
    )
  }

  target.innerHTML = modifiedHTML
}

</script>

<style lang="scss" scoped>

#searchForm, #imageBox {
  margin: 50px;
}

// ComfyUI
::v-deep(.hi-cu-checkpoint) {
  color: #e7497d;
  font-weight: bold;
}
::v-deep(.hi-cu-text) {
  color: #fcff3a;
  font-weight: bold;
  background-color: #181818;
}
::v-deep(.hi-cu-vae) {
  color: #e74949;
  font-weight: bold;
}
::v-deep(.hi-cu-lora) {
  color: #49e763;
  font-weight: bold;
}
::v-deep(.hi-cu-up) {
  color: #49e7e7;
  font-weight: bold;
}
::v-deep(.hi-cu-cn) {
  color: #5449e7;
  font-weight: bold;
}

// Stable Diffusion
::v-deep(.hi-model) {
  color: #e91e63;
  font-weight: bold;
}
::v-deep(.hi-vae) {
  color: #3f51b5;
  font-weight: bold;
}
::v-deep(.hi-sfgs) {
  color: #4caf50;
  font-weight: bold;
}
::v-deep(.hi-steps) {
  color: #ff9800;
  font-weight: bold;
}
::v-deep(.hi-denois) {
  color: #9c27b0;
  font-weight: bold;
}
::v-deep(.hi-lora) {
  color: #001aff;
  font-weight: bold;
}

</style>