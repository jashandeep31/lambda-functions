import axios from "axios";
import dotenv from "dotenv";
dotenv.config();
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const client = new S3Client({
  region: process.env.S3_REGION,
  ...(process.env.S3_ENDPOINT && { endpoint: process.env.S3_ENDPOINT }),
  credentials: {
    accessKeyId: process.env.S3_BUCKET_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_BUCKET_SECRET_ACCESS_KEY,
  },
});

export const handler = async (event) => {
  const mediaUrl = event.mediaUrl;
  const uploadPath = event.uploadPath;
  const fileName = event.fileName;
  if (!mediaUrl || !uploadPath || !fileName) {
    throw new Error("Media URL and upload path are required");
  }

  // Downloading the media using axios
  const mediaResponse = await axios.get(mediaUrl, {
    responseType: "arraybuffer",
  });

  // Uploading directly to S3 without writing to the filesystem
  const uploadParams = {
    Bucket: process.env.S3_BUCKET,
    Key: uploadPath + "/" + fileName,
    Body: Buffer.from(mediaResponse.data),
    ContentType: mediaResponse.headers?.["content-type"],
  };
  const uploadedUrl = `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com/${uploadPath}/${fileName}`;
  await client.send(new PutObjectCommand(uploadParams));

  return {
    url: uploadedUrl,
  };
};
