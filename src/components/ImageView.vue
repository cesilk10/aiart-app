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
        <n-form-item-gi :span="2" label="Date" path="date">
          <n-date-picker v-model:value="timestamp" type="date" />
        </n-form-item-gi>
        <n-form-item-gi :span="4" label="Folder" path="selectValue">
          <n-select
            v-model:value="selectFolder"
            placeholder="Select Folder"
            :options="folderOptions"
          />
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
  <n-modal v-model:show="showModal">
    <n-card
      style="width: 1200px"
      title="Meta Data"
      :bordered="false"
      size="huge"
      role="dialog"
      aria-modal="true"
    >
      <template #header-extra>
        -- Creation parameters --
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
        <p  style="white-space: pre-line;">{{ data }}</p>
      </template>
      <template #footer>
      </template>
    </n-card>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, watch, h } from "vue"
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
const selectFolder = ref<string>()
const password = ref<string>("")
const folderOptions = ref(["img2img-grids", "img2img-images", "txt2img-grids", "txt2img-images", "extras-images"].map(
  v => ({
    label: v,
    value: v
  })
))
const imagesData = ref<ImageData[]>([])
const currentImageIndex = ref<number>(0)
const showModal = ref<boolean>(false)
const currentMetaData = ref<string[]>([])
const message = useMessage()

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

const fetchImageUrls = async (date: string, folder: string) => {
  const keys = await listImageKeys(myBucket, `outputs/${folder}/${date}/`)

  if (keys.length === 0) {
    message.warning("Image not found.")
    return
  }
  message.success("Fetching images... Please wait a moment.")

  for (const key of keys) {
    if (typeof key === "string" && /\.png$/.test(key)) {

      if (imagesData.value.some(image => image.urlKey === key)) {
        continue
      }

      var previewUrlKey = key.replace(".png", ".jpg")
      if (!keys.includes(previewUrlKey)) {
        previewUrlKey = key
      }

      const previewUrl = await generatePresignedUrl(myBucket, previewUrlKey)
      if (typeof previewUrl !== "string") {
        continue
      }

      const metaData = await getMetaData(previewUrl)

      imagesData.value.push({
        urlKey: key,
        previewUrl: previewUrl,
        metaData: metaData
      })
    }
  }
}

const clickUpdateImage = () => {
  if (imagesData.value.length === 0) {
    return
  }

  const date = timestamp_to_date(timestamp.value)

  if (date && selectFolder.value) {
    fetchImageUrls(date, selectFolder.value)
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

watch([timestamp, selectFolder], ([newTimestamp, newFolder], [oldTimestamp, oldFolder]) => {
  if (!validatePass(password.value)) {
    message.error("Incorrect Password!!!")
    return
  }

  const date = timestamp_to_date(newTimestamp as number)

  if (date && newFolder) {
    imagesData.value = []
    fetchImageUrls(date, newFolder)
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
}
const goToNext = () => {
  currentImageIndex.value = correctIndex(currentImageIndex.value + 1, imagesData.value.length)
  currentMetaData.value = imagesData.value[currentImageIndex.value].metaData

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

</script>

<style lang="scss" scoped>

#searchForm, #imageBox {
  margin: 50px;
}
</style>