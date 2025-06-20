import { S3Client, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"


const myPassword = import.meta.env.VITE_PASSWORD

// S3クライアントの初期化
const s3 = new S3Client({
  region: import.meta.env.VITE_AWS_REGION,
  credentials: {
    accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
  },
})

// URL生成関数
export const generatePresignedUrl = async (bucket: string, key: string): Promise<string> => {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  })

  const url = await getSignedUrl(s3, command, { expiresIn: 3600 }) // 有効期限: 1時間
  return url
}

// 画像URLをリストで取得
export const listImageKeys = async (bucket: string, prefix: string, asc: boolean) => {
  const command = new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: prefix,
  })

  const result = await s3.send(command)
  const contents = result.Contents ?? []

  // sort desc
  contents.sort((a, b) => {
    if (!a.LastModified || !b.LastModified) return 0
    if (asc) {
      return a.LastModified.getTime() - b.LastModified.getTime()
    } else {
      return b.LastModified.getTime() - a.LastModified.getTime()
    }
  })

  return contents.map(item => item.Key)
}

// 画像削除リクエスト
export const deleteS3Object = async (bucket: string, key: string): Promise<void> => {
  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  })

  try {
    await s3.send(command)
    console.log(`Deleted object: s3://${bucket}/${key}`)
  } catch (error) {
    console.error("Failed to delete S3 object:", error)
    throw error
  }
}

export const validatePass = (password: string) => {
  return password === myPassword
}