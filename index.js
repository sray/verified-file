const crypto = require('crypto');
const fs = require('fs');
const path = require("path");
const url = require("url");
const stream = require('stream');

const Promise = require('promise');
const Q = require('q');

/**
* takes a checksum object { uri: '', sum: '', algo: ''}
* returns a promise of a checksum object having sum and algo filled
* if an uri is provided, the checksum will be set to the content of the uri resource
*/
function createChecksumPromiseForUri(uri, checksum, options) {
  if (checksum.uri && checksum.sum) {
    return new Promise(function (resolve, reject) {
      reject('Either provide a checksum uri or a checksum directly, but not both.')
    });
  }

  if (checksum.uri) {
    // if checksum uri defined retrieve checksum file and read content
    return new Promise(function (resolve, reject) {
      checksum.sum = '';

      var readFromUri = new stream.Writable({
        write: function (chunk, enc, next) {
          checksum.sum += chunk.toString();
          next();
        }
      });
      readFromUri.on('finish', function() {
        const srcFilename = (uri.match(/^(http|https|ftp|ftps):\/\//)) ? path.basename(url.parse(uri).pathname) : path.parse(uri.replace(/^\/\//,'')).base;
        const srcFilenameRegExp = new RegExp(srcFilename);
        const lines = checksum.sum.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (srcFilenameRegExp.test(lines[i])) {
            checksum.sum = lines[i].replace(srcFilename, '').trim();
          }
        }
        resolve(checksum);
      });

      options.uriRequest.executer(checksum.uri, readFromUri, options.uriRequest.options);
    });
  }
  if (checksum.sum) {
    return new Promise(function (resolve, reject) {
      resolve(checksum);
    });
  }

  return new Promise(function (resolve, reject) {
    reject('Neither checksum uri nor checksum string provided.')
  });
}

function createUriContentStreamHandler(destFile, checksums) {
  const fsOut = fs.createWriteStream(destFile);
  // init hash algo for each checksum
  const hashes = [];
  if (checksums != undefined && checksums != null) {
    for(let i = 0; i < checksums.length; i++) {
      hashes[i] = crypto.createHash(checksums[i].algo);
    }
  }

  const uriContentStreamHandler = new stream.Writable({
    write: function (chunk, enc, next) {
      fsOut.write(chunk);
      // while writing file, update hashes
      for(let i = 0; i < checksums.length; i++) {
        hashes[i].update(chunk);
      }
      next();
    }
  });
  uriContentStreamHandler.on('finish', function () {
    fsOut.end();
    // if a checksum is wrong immediately abort and delete downloaded file
    for(let i = 0; i < checksums.length; i++) {
      const digest = hashes[i].digest('hex');
      if (digest.toString() != checksums[i].sum) {
        console.error('actual ' + checksums[i].algo + ' checksum invalid:\n' + digest.toString() + '\nmust be:\n' + checksums[i].sum + ' for file: ' + destFile);
        fs.unlinkSync(destFile);
        break;
      } else {
        console.log('valid '  + checksums[i].algo + ' checksum (' + digest.toString() + ') ' + ' for file: ' + destFile);
      }
    }
  });
  return uriContentStreamHandler;
}

function get(options){
  const checksumPromises = [];
  if (options.checksums != undefined && options.checksums != null && options.checksums.length > 0) {
    for(let i = 0; i < options.checksums.length; i++) {
      checksumPromises.push(createChecksumPromiseForUri(options.srcUri, options.checksums[i], options));
    }
  }

  Q.all(checksumPromises).then(function (checksums) {
    // perform download
    console.log('downloading ');
    options.uriRequest.executer(
      options.srcUri,
      createUriContentStreamHandler(options.destUri, checksums),
      options.uriRequest.options
    );
  }, function (reason) {
    console.error('checksum validation failed: ');
    console.error(reason);
  });
}

module.exports.get = get;
