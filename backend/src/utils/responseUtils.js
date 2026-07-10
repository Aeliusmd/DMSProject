const path = require("path");
const ApiError = require("./ApiError");

/**
 * Express sendFile wrapped in a promise so asyncHandler can catch missing files
 * and other transfer errors.
 */
function sendFileResponse(res, filePath, options = {}) {
  return new Promise((resolve, reject) => {
    const absolutePath = path.resolve(filePath);

    res.sendFile(absolutePath, options, (error) => {
      if (error) {
        if (error.code === "ENOENT") {
          reject(new ApiError(404, "The requested file was not found."));
          return;
        }

        reject(error);
        return;
      }

      resolve();
    });
  });
}

function sendBufferResponse(res, buffer, headers = {}) {
  Object.entries(headers).forEach(([key, value]) => {
    if (value != null) {
      res.setHeader(key, value);
    }
  });

  res.send(buffer);
}

/**
 * Pipe a readable stream to the response and reject on stream/response errors.
 */
function pipeStreamToResponse(res, stream) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      cleanup();

      if (!res.headersSent) {
        reject(error);
        return;
      }

      if (!res.writableEnded) {
        res.end();
      }
    };

    const cleanup = () => {
      stream.removeListener("error", onError);
      res.removeListener("error", onError);
      stream.removeListener("end", onEnd);
    };

    const onEnd = () => {
      cleanup();
      resolve();
    };

    stream.on("error", onError);
    res.on("error", onError);
    stream.on("end", onEnd);
    stream.pipe(res);
  });
}

/**
 * Stream a zip archive to the response with proper async error propagation.
 */
function streamArchiveToResponse(archive, res) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      cleanup();
      reject(error);
    };

    const cleanup = () => {
      archive.removeListener("error", onError);
      res.removeListener("error", onError);
      archive.removeListener("end", onEnd);
    };

    const onEnd = () => {
      cleanup();
      resolve();
    };

    archive.on("error", onError);
    res.on("error", onError);
    archive.on("end", onEnd);
    archive.pipe(res);
    archive.finalize();
  });
}

module.exports = {
  sendFileResponse,
  sendBufferResponse,
  pipeStreamToResponse,
  streamArchiveToResponse,
};
