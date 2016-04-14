# broccoli-tree-difference

Copy multiple trees with the result tree having only nodes belonging to exactly one tree.

## Installation

```bash
npm install --save-dev broccoli-tree-difference
```

## Usage

```js
var TreeDifference = require('broccoli-tree-difference');

var difference = new BroccoliMergeTrees(inputNodes, options);
```

* **`inputNodes`**: An array of nodes, whose contents will be merged

* **`options`**: A hash of options

### Options

* `annotation`: A note to help tell multiple plugin instances apart.

### Example

If this is your `Brocfile.js`:

```js
var BroccoliMergeTrees = require('broccoli-tree-difference');
vat Funnel = require('broccoli-funnel');

module.exports = new BroccoliMergeTrees(['public', new Funnel('public', { srcDir: 'images', destDir: 'images' })]);
```

And your project contains these files:

    .
    ├─ public
    │  ├─ index.html
    │  └─ images
    │     └─ logo.png
    …

Then running `broccoli build the-output` will generate this folder:

    the-output
    └─ index.html

This is a pretty pedantic example, but here we're taking the difference of a tree and one of its subtrees.

## Contributing

Clone this repo and run the tests like so:

```
npm install
npm test
```

Issues and pull requests are welcome. If you change code, be sure to re-run
`npm test`. Oftentimes it's useful to add or update tests as well.
