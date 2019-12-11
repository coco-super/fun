'use strict';

const fs = require('fs-extra');
const path = require('path');
const util = require('util');
const zip = require('../../package/zip');
const read = util.promisify(fs.read);
const md5File = require('md5-file/promise');

async function zipWithArchiver(srcPath, localNasTmpDir) {

  if (!await fs.exists(srcPath)) { throw new Error('folder not exist: ' + srcPath); }

  if (await isFile(srcPath)) { throw new Error('zipWithArchiver not support a file'); }

  const zipDst = generateZipTargetPath(path.basename(srcPath), localNasTmpDir);

  await fs.ensureDir(zipDstDir);

  await zip.packTo(srcPath, null, zipDst);

  return zipDst;
}

function generateZipTargetPath(targetName, localNasTmpDir) {
  //以当前操作的 unix 时间戳作为临时目录名称
  const curTime = new Date().getTime().toString();
  const zipDstDir = path.join(localNasTmpDir, curTime);
  return path.join(zipDstDir, `.fun-nas-generated-${targetName}.zip`);
}

async function isDir(inputPath) {
  const stats = await fs.lstat(inputPath);

  return stats.isDirectory();
}

async function isFile(inputPath) {
  const stats = await fs.lstat(inputPath);
  return stats.isFile();
}

async function getFileHash(filePath) {
  const file = await isFile(filePath);

  if (file) {
    return await md5File(filePath);
  }
  throw new Error('get file hash error, target is not a file, target path is: ' + filePath);
}

async function isEmptyDir(dirPath) {
  const files = await fs.readdir(dirPath);
  if (!files.length) { return true; }
  return false;
}


async function getFileSize(filePath) {
  const stat = await fs.lstat(filePath);
  return stat.size;
}
async function readFileChunk(filePath, start, size) {
  const fd = await fs.open(filePath, 'r');
  const chunkBuf = Buffer.alloc(size);
  const bytesRead = await read(fd, chunkBuf, 0, size, start);
  if (bytesRead !== size) {
    throw new Error(`ReadChunkFile function bytesRead not equal read size`);
  }
  await fs.close(fd);
  return chunkBuf;
}
async function getFilePermission(filePath) {
  const stat = await fs.lstat(filePath);
  const permission = '0' + (stat.mode & parseInt('777', 8)).toString(8);
  return permission;
}

module.exports = {
  isDir,
  isFile,
  getFileHash,
  zipWithArchiver,
  isEmptyDir,
  getFileSize,
  readFileChunk,
  getFilePermission
};