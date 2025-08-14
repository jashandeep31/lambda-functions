import axios from "axios";
import dotenv from "dotenv";
dotenv.config();
import fs from "fs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const client = new S3Client({
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
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
  const mediaBuffer = await axios.get(mediaUrl, {
    responseType: "arraybuffer",
  });

  // Storing locally
  fs.writeFileSync(fileName, mediaBuffer.data);

  //   Uploading to S3
  const uploadParams = {
    Bucket: process.env.S3_BUCKET,
    Key: uploadPath + "/" + fileName,
    Body: fs.createReadStream(fileName),
  };

  await client.send(new PutObjectCommand(uploadParams));

  // Deleting the file Just to keep the github repo clean
  //   although the lamda function are self destructing
  fs.unlinkSync(fileName);

  return event;
};

handler({
  mediaUrl:
    "https://images.unsplash.com/photo-1526779259212-939e64788e3c?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8ZnJlZSUyMGltYWdlc3xlbnwwfHwwfHx8MA%3D%3D",
  uploadPath: "testing-lambda",
  fileName: "image.jpg",
});
