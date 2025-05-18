<template>
  <div id="searchForm">
    <n-form>
      <n-grid :span="24" :x-gap="24">
        <n-form-item-gi :span="6" label="Username" path="username">
          <n-input
            type="text"
            @keydown.enter.prevent
            :input-props="{ name: 'username', autocomplete: 'username', style: 'display:none;' }"
          />
        </n-form-item-gi>
        <n-form-item-gi :span="6" label="Password" path="password">
          <n-input
            v-model:value="password"
            type="password"
            @keydown.enter.prevent
            :input-props="{ name: 'password', autocomplete: 'current-password' }"
          />
        </n-form-item-gi>
        <n-form-item-gi :span="4" label="Date" path="date">
          <n-date-picker v-model:value="timestamp" type="date" />
        </n-form-item-gi>
        <n-form-item-gi :span="6" label="Folder" path="selectValue">
          <n-select
            v-model:value="selectFolder"
            placeholder="Select Folder"
            :options="folderOptions"
          />
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
</template>

<script setup lang="ts">
import { ref, watch, h } from "vue"
import type { ImageRenderToolbarProps } from "naive-ui"
import { CloudDownloadOutline, ConstructOutline } from "@vicons/ionicons5"
import { NButton, useMessage } from "naive-ui"

import { generatePresignedUrl, listImageKeys, validatePass } from "../services/aws-s3"


const myBucket = import.meta.env.VITE_AWS_BUCKET


// Type
type ImageData = {
  urlKey: string
  previewUrl: string
}

const timestamp = ref<number>()
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
          await navigator.clipboard.writeText("url.value")
          message.success("Copied to clipboard")
        }
      },
      {
        icon: () => h(ConstructOutline)
      }
    ),
    nodes.close,
  ]
}



const fetchImageUrls = async (date: string, folder: string) => {
  imagesData.value = []

  const keys = await listImageKeys(myBucket, `outputs/${folder}/${date}/`)

  if (keys.length === 0) {
    message.warning("File not exist.")
    return
  }
  message.success("File exist.")

  for (const key of keys) {
    if (typeof key === "string" && /\.jpg$/.test(key)) {
      const previewUrl = await generatePresignedUrl(myBucket, key)
      if (typeof previewUrl !== "string") {
        continue
      }

      var urlKey = key.replace(".jpg", ".png")
      if (!keys.includes(urlKey)) {
        urlKey = ""
      }

      imagesData.value.push({
        urlKey: urlKey,
        previewUrl: previewUrl
      })
    }
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
}
const goToNext = () => {
  currentImageIndex.value = correctIndex(currentImageIndex.value + 1, imagesData.value.length)
}


const clickDownloadImage = async (index: number) => {
  message.info("Start image download...")

  const key = imagesData.value[index].urlKey
  const url = await generatePresignedUrl(myBucket, key)  
  const filename = key.split("/").pop() || ""

  console.log(url, filename)

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

</script>

<style lang="scss" scoped>

#searchForm, #imageBox {
  margin: 50px;
}
</style>