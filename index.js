var BroccoliMergeTrees = require('broccoli-merge-trees');
var Entry = require('broccoli-merge-trees/entry');
var Plugin = require('broccoli-plugin');
var FSTree = require('fs-tree-diff');
var debug = require('debug');
var fs = require('fs');

var canSymlink = require('can-symlink')();

function BroccoliTreeDifference(inputNodes, options) {
  if (!(this instanceof BroccoliTreeDifference)) return new BroccoliTreeDifference(inputNodes, options)
  options = options || {}
  var name = 'broccoli-tree-difference:' + (options.annotation || '')
  if (!Array.isArray(inputNodes)) {
    throw new TypeError(name + ': Expected array, got: [' + inputNodes +']')
  }
  Plugin.call(this, inputNodes, {
    persistentOutput: true,
    annotation: options.annotation
  })

  this._debug = debug(name);

  this.options = options
  this._buildCount = 0;
  this._currentTree = FSTree.fromPaths([]);
}

module.exports = BroccoliTreeDifference
BroccoliTreeDifference.prototype = Object.create(BroccoliMergeTrees.prototype)
BroccoliTreeDifference.prototype.constructor = BroccoliTreeDifference

BroccoliTreeDifference.prototype._mergeRelativePath = function (baseDir, possibleIndices) {
  var inputPaths = this.inputPaths;
  var result = [];

  // baseDir has a trailing path.sep if non-empty
  var i, j, fileName, fullPath, subEntries;

  // Array of readdir arrays
  var names = inputPaths.map(function (inputPath, i) {
    if (possibleIndices == null || possibleIndices.indexOf(i) !== -1) {
      return fs.readdirSync(inputPath + '/' + baseDir).sort()
    } else {
      return []
    }
  })

  // Accumulate fileInfo hashes of { isDirectory, indices }.
  // Also guard against intrinsic fs errors
  var lowerCaseNames = {}
  var fileInfo = {}
  var inputPath;
  var infoHash;

  for (i = 0; i < inputPaths.length; i++) {
    inputPath = inputPaths[i];
    for (j = 0; j < names[i].length; j++) {
      fileName = names[i][j]

      // Guard against conflicting capitalizations
      var lowerCaseName = fileName.toLowerCase()
      // Note: We are using .toLowerCase to approximate the case
      // insensitivity behavior of HFS+ and NTFS. While .toLowerCase is at
      // least Unicode aware, there are probably better-suited functions.
      if (lowerCaseNames[lowerCaseName] === undefined) {
        lowerCaseNames[lowerCaseName] = {
          index: i,
          originalName: fileName
        }
      } else {
        var originalIndex = lowerCaseNames[lowerCaseName].index
        var originalName = lowerCaseNames[lowerCaseName].originalName
        if (originalName !== fileName) {
          throw new Error('Merge error: conflicting capitalizations:\n'
                          + baseDir + originalName + ' in ' + this.inputPaths[originalIndex] + '\n'
                          + baseDir + fileName + ' in ' + this.inputPaths[i] + '\n'
                          + 'Remove one of the files and re-add it with matching capitalization.\n'
                          + 'We are strict about this to avoid divergent behavior '
                          + 'between case-insensitive Mac/Windows and case-sensitive Linux.'
                         )
        }
      }

      var entry = buildEntry(baseDir + fileName, inputPath);
      var isDirectory = entry.isDirectory();

      if (fileInfo[fileName] == null) {
        fileInfo[fileName] = {
          entry: entry,
          isDirectory: isDirectory,
          indices: [i] // indices into inputPaths in which this file exists
        };
      } else {
        fileInfo[fileName].indices.push(i);

        // Guard against conflicting file types
        var originallyDirectory = fileInfo[fileName].isDirectory
        if (originallyDirectory !== isDirectory) {
          throw new Error('Merge error: conflicting file types: ' + baseDir + fileName
                          + ' is a ' + (originallyDirectory ? 'directory' : 'file')
                          + ' in ' + this.inputPaths[fileInfo[fileName].indices[0]]
                          + ' but a ' + (isDirectory ? 'directory' : 'file')
                          + ' in ' + this.inputPaths[i] + '\n'
                          + 'Remove or rename either of those.'
                         )
        }
      }
    }
  }

  // Done guarding against all error conditions. Actually merge now.
  for (i = 0; i < this.inputPaths.length; i++) {
    for (j = 0; j < names[i].length; j++) {
      fileName = names[i][j]
      fullPath = this.inputPaths[i] + '/' + baseDir + fileName
      infoHash = fileInfo[fileName]

      if (infoHash.isDirectory) {
        if (infoHash.indices.length === 1 && canSymlink) {
          // This directory appears in only one tree: we can symlink it without
          // reading the full tree
          infoHash.entry.linkDir = true;
          result.push(infoHash);
        } else {
          if (infoHash.indices[0] === i) { // avoid duplicate recursion
            subEntries = this._mergeRelativePath(baseDir + fileName + '/', infoHash.indices);
            // recurse down to find more possibly files unique to the input trees
            result.push.apply(result, subEntries);
          }
        }
      } else { // isFile
        if (infoHash.indices.length === 1 && infoHash.indices[0] === i) {
          result.push(infoHash);
        }
      }
    }
  }

  return result;
};

function buildEntry(relativePath, basePath) {
  var stat = fs.statSync(basePath + '/' + relativePath);
  return new Entry(relativePath, basePath, stat.mode, stat.size, stat.mtime);
}