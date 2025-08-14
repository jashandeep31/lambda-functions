// file make the zip files of all the lambda functions

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const getDirectories = async (source) =>
  (await fs.promises.readdir(source, { withFileTypes: true }))
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

const checkAndCreateTempFolder = (folderName) => {
  if (!fs.existsSync(folderName)) {
    fs.mkdirSync(folderName);
  }
};

const emptyFolder = (folderName) => {
  if (fs.existsSync(folderName)) {
    fs.rmSync(folderName, { recursive: true, force: true });
  }
};

async function main() {
  // creating temp folder to copy files
  const tempFolder = "temp";
  const zipFolder = "zip";
  // ensure clean start to avoid clashes
  emptyFolder(tempFolder);
  emptyFolder(zipFolder);
  checkAndCreateTempFolder(tempFolder);
  checkAndCreateTempFolder(zipFolder);

  // loading all directories at path ./
  const excludeFolders = ["temp", ".git", "zip", "node_modules"];
  const directories = (await getDirectories(".")).filter((folder) =>
    excludeFolders.includes(folder) ? false : true
  );

  // copying files to temp folder
  for (const directory of directories) {
    handleLambdaFunction(directory);
  }

  console.log(`Zipped ${directories.length} folder(s) into '${zipFolder}/'.`);
}

function handleLambdaFunction(directory) {
  const zipRoot = "zip";
  const folderPath = path.join(process.cwd(), directory);
  // Ensure zip output directory exists (defensive)
  if (!fs.existsSync(zipRoot)) {
    fs.mkdirSync(zipRoot, { recursive: true });
  }
  const zipPath = path.join(process.cwd(), zipRoot, `${directory}.zip`);
  if (fs.existsSync(zipPath)) {
    fs.rmSync(zipPath, { force: true });
  }

  // Build list of items to include only if they exist
  const includeItems = [
    "index.js",
    "package.json",
    "package-lock.json",
    "node_modules",
  ].filter((name) => fs.existsSync(path.join(folderPath, name)));

  if (includeItems.length === 0) {
    console.warn(`Skipping '${directory}': no target files found.`);
    return;
  }

  // Exclude .env files anywhere in the tree
  const excludePatterns = [".env", "*/.env", "**/.env"]
    .map((p) => `-x \"${p}\"`) // escape quotes for shell
    .join(" ");

  const includeArgs = includeItems.map((p) => `\"${p}\"`).join(" ");

  const cmd = `zip -r -q \"${zipPath}\" ${includeArgs} ${excludePatterns}`;
  execSync(cmd, { cwd: folderPath, stdio: "inherit" });
}

main();
