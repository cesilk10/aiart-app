import * as ExifReader from "exifreader"


type Node = {
  inputs: { [key: string]: any }
  class_type: string;
  _meta: {
    title: string;
  }
}


export const getMetaData = async (imageUrl: string) => {

  const response = await fetch(imageUrl)
  const arrayBuffer = await response.arrayBuffer()

  // ExifReader は ArrayBuffer をそのまま読み込み可能
  var tags
  try {
    tags = ExifReader.load(arrayBuffer)
  } catch {
    return ["", "", ""]
  }
  var parameter = ""

  // ComfyUI output image
  if (tags["prompt"]) {
    parameter = tags["prompt"].value
    parameter = parameter.replace(/\bNaN\b/g, "null")

    var jsonData: { [key: string]: Node } = {}

    try {
      jsonData = JSON.parse(parameter) as { [key: string]: Node }
    } catch {
      console.log(parameter)
    }

    var params: string = ""
    for (const [nodeId, node] of Object.entries(jsonData)) {
      if (["VAEDecode", "VAEEncode", "SaveAndUploadToS3", "SaveImage", "PreviewImage", "ImageUpscaleWithModel"].includes(node.class_type)) {
        continue
      }

      params += `${node.class_type}: ` + "\n"

      for (const [inputName, inputValue] of Object.entries(node.inputs)) {
        if (["clip"].includes(inputName)) {
          continue
        }

        if (node.class_type === "CLIPTextEncode" && inputName === "text") {
          params += `　　${inputValue}` + "\n"

        } else {
          params += `　　${inputName}: ${inputValue}` + "\n"
        }
      }
      params += "\n"
    }
    return [params]
  }

  // Stable Diffusion ouput image
  if (/\.jpg/.test(imageUrl)) {
    const userCommentValue = tags["UserComment"]?.value || ""
    parameter = parseUserComment(userCommentValue)

  } else if (/\.png/.test(imageUrl)) {
    parameter = tags["parameters"]?.value || ""
  }

  parameter = parameter.replace("Negative prompt:", "@@@@@")
  parameter = parameter.replace("Steps:", "@@@@@Steps:")
  const parameters = parameter.split("@@@@@")

  parameters.forEach((parameter, index) => {
    if (parameter.startsWith("Steps")) {
      parameters[index] = parameter.replace(/, /g, "\n")
    }
  })

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