import * as ExifReader from "exifreader"


export const getMetaData = async (imageUrl: string) => {

  const response = await fetch(imageUrl)
  const arrayBuffer = await response.arrayBuffer()

  // ExifReader は ArrayBuffer をそのまま読み込み可能
  const tags = ExifReader.load(arrayBuffer)
  var parameter

  if (/\.jpg/.test(imageUrl)) {
    const userCommentValue = tags["UserComment"]?.value
    parameter = parseUserComment(userCommentValue)

  } else if (/\.png/.test(imageUrl)) {
    parameter = tags["parameters"]?.value
  }

  parameter = parameter.replace("Negative prompt:", "@@@@@Negative prompt:")
  parameter = parameter.replace("Steps:", "@@@@@Steps:")
  const parameters = parameter.split("@@@@@")

  return parameters
}

const parseUserComment = (userCommentValue: number[]): string => {
  const bytes = new Uint8Array(userCommentValue)
  const header = new TextDecoder("ascii").decode(bytes.slice(0, 8))
  const bodyBytes = bytes.slice(8)

  if (header.startsWith("UNICODE")) {
    // UNICODE の場合は UTF-16BE（Exif標準）を使う
    const decoder = new TextDecoder("utf-16be")
    return decoder.decode(bodyBytes)

  } else if (header.startsWith("ASCII")) {
    const decoder = new TextDecoder("ascii")
    return decoder.decode(bodyBytes)

  } else {
    // その他 → UTF-8 or fallback
    const decoder = new TextDecoder("utf-8")
    return decoder.decode(bodyBytes)
  }
}