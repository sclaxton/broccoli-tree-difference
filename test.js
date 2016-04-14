var TreeDifference = require('./')
var chai = require('chai'), expect = chai.expect
var chaiAsPromised = require('chai-as-promised'); chai.use(chaiAsPromised)
var Fixture = require('broccoli-fixture')


function subtractFixtures(inputFixtures, options) {
  return Fixture.build(new TreeDifference(inputFixtures.map(inputFixture), options))
}

function inputFixture(obj) {
  return new Fixture.Node(obj)
}

function mapBy(array, property) {
  return array.map(function (item) {
    return item[property];
  });
}

describe('TreeDifference', function() {
  describe('_mergeRelativePaths', function() {
    it('returns an array of file infos', function() {
      var subtractTrees = new TreeDifference([]);
      subtractTrees.inputPaths = [__dirname + '/tests/fixtures/a'];
      subtractTrees.outputPath = __dirname + '/tmp/output';

      var fileInfos = subtractTrees._mergeRelativePath('');
      var entries = mapBy(fileInfos, 'entry');

      expect(mapBy(entries, 'relativePath')).to.deep.equal([
        'bar.js',
        'foo.js',
      ]);
    });
  });

  it('takes difference of nested folders', function() {
    return expect(subtractFixtures([
      {
        foo: {
          bar: {
            boof: '1',
            biff: {
              boom: '3',
              meh: '4'
            }
          }
        }
      }, {
        baz: '2',
        foo: {
          bar: {
            biff: {
              meh: '4'
            }
          }
        }
      }
    ])).to.eventually.deep.equal({
      baz: '2',
      foo: {
        bar: {
          boof: '1',
          biff: {
            boom: '3'
          }
        }
      }
    })
  })

  it('takes the difference of empty directories', function() {
    return expect(subtractFixtures([
      {
        foo: {},
        bar: {}
      }, {
        bar: {},
        baz: {}
      }
    ])).to.eventually.deep.equal({
      foo: {},
      baz: {}
    })
  })

  it('subtracts files with the same name', function() {
    return expect(subtractFixtures([
      {
        foo: '1a',
        bar: '2a'
      }, {
        foo: '1b',
        bar: '2b'
      }
    ])).to.eventually.deep.equal({})
  })

  it('empty tree is identity', function() {
    return expect(subtractFixtures([
      {
        foo: {
          bar: '1a',
        }
      }, {
      }
    ])).to.eventually.deep.equal({
      foo: {
        bar: '1a',
      }
    })
  });

  it('works with one tree as input', function() {
    return expect(subtractFixtures([
      {
        foo: {
          bar: '1a',
        }
      }
    ])).to.eventually.deep.equal({
      foo: {
        bar: '1a',
      }
    })
  });

  it('it rebuilds correctly when files are removed', function() {
    var source = inputFixture({
      foo: {
        bar: '1a',
      }
    });
    var fixture = new Fixture.Builder(new TreeDifference([source]));

    return expect(fixture.build().then(function () {
      source.fixture = {};
      return fixture.build();
    })).to.eventually.deep.equal({});
  });

  it('refuses to honor conflicting capitalizations', function() {
    function expectItToRefuseConflictingCapitalizations(type, options) {
      var content = type === 'dir' ? {} : 'hello world'
      return expect(subtractFixtures([
        {
          FOO: content
        }, {
          Foo: content
        }
      ], options)).to.be.rejectedWith(/Merge error: conflicting capitalizations:\nFOO in .*\nFoo in .*\nRemove/)
    }

    return expectItToRefuseConflictingCapitalizations('file')
      .then(function() {
        return expectItToRefuseConflictingCapitalizations('dir')
      })
  })

  it('merges directories', function() {
    return expect(subtractFixtures([
      {
        subdir: {
          foo: '1'
        }
      }, {
        subdir2: {}
      }, {
        subdir: {
          bar: '2'
        }
      }
    ])).to.eventually.deep.equal({
      subdir: {
        foo: '1',
        bar: '2'
      },
      subdir2: {}
    })
  })

  it('rejects directories colliding with files', function() {
    function expectItToRejectTypeCollisions(options) {
      return expect(subtractFixtures([
        {
          foo: {}
        }, {
          foo: 'hello'
        }
      ], options)).to.be.rejectedWith(/Merge error: conflicting file types: foo is a directory in .* but a file in .*/)
      .then(function() {
        return expect(subtractFixtures([
          {
            foo: 'hello'
          }, {
            foo: {}
          }
        ], options)).to.be.rejectedWith(/Merge error: conflicting file types: foo is a file in .* but a directory in .*/)
      })
    }

    return expectItToRejectTypeCollisions()
  })
})

require('mocha-jshint')()