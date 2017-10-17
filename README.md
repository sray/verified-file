# verified-file

An npm module to fetch a file and to verify it against one or more checksums on the fly (supports any hash algorithm supported by node-builtin [crypto](https://nodejs.org/api/crypto.html#crypto_crypto_gethashes) module).

## Usage

```javascript
const verifiedFile = require('verified-file');

verifiedFile.get({
  srcUri: 'http://example.com/example.zip',
  destUri: 'example.zip',
  // checksums can be provided in a file or directly as a string
  checksums: [
    {
      uri: 'http://example.com/example.zip.sha256',
      algo: 'sha256'
    },
    {
      sum: 'aa4ae2abde7b7a8e307a1875d13aa123',
      algo: 'md5'
    }
  ],
  //uriRequestExecuter: function (uri, uriContentStreamHandler, options)
  uriRequest: {
    /* executer is a callback that you can implement yourself depending on your uri resource types (url, file path, etc.).
    *  executer should internally write to the writeable stream uriContentStreamHandler.
    *  executer gets called automatically and passes on the uriRequest.options as options.
    */
    executer: function (uri, uriContentStreamHandler, options),
    options: uriRequestOptions
  }
});
```
