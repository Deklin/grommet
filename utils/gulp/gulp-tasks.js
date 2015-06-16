var del = require('del');
var react = require('gulp-react');
var eslint = require('gulp-eslint');
var gulpWebpack = require('webpack-stream');
var file = require('gulp-file');
var runSequence = require('run-sequence');
var assign = require('object-assign');
var webpack = require('webpack');
var WebpackDevServer = require('webpack-dev-server');
var path = require('path');

String.prototype.endsWith = function(suffix) {
  return this.indexOf(suffix, this.length - suffix.length) !== -1;
};

var webpackConfig = {
  output: {
    filename: 'index.js'
  },
  module: {
    loaders: [
      {
        test: /\.js$/,
        loader: 'jsx-loader'
      },
      {
        test: /\.json$/,
        loader: 'json-loader'
      },
      {
        test: /\.svg$/,
        loader: 'file-loader?mimetype=image/svg'
      },
      {
        test: /\.jpg$/,
        loader: 'file-loader?mimetype=image/jpg'
      },
      {
        test: /\.woff$/,
        loader: 'file-loader?mimetype=application/font-woff'
      },
      {
        test: /\.otf$/,
        loader: 'file-loader?mimetype=application/font/opentype'
      },
      {
        test: /\.scss$/,
        loader: 'style!css!sass?outputStyle=expanded&' +
          'includePaths[]=' +
          (path.resolve(process.cwd(), 'node_modules'))
      }
    ]
  }
};

module.exports = function(gulp, opts) {

  runSequence = runSequence.use(gulp);

  var options = opts || {};

  var dist = options.dist || path.resolve(process.cwd(), 'dist');
  options.webpack = options.webpack || {};

  var scssLintPath = path.resolve(__dirname, 'scss-lint.yml');
  var esLintPath = path.resolve(__dirname, 'eslintrc');

  if (options.base) {
    process.chdir(options.base);
  }

  gulp.task('copy', function() {
    (options.copyAssets || []).forEach(function(copyAsset) {
      if (copyAsset.filename) {
        gulp.src('./')
          .pipe(file(copyAsset.filename, copyAsset.asset))
          .pipe(gulp.dest(copyAsset.dist ? copyAsset.dist : dist));
      } else {
        var asset = copyAsset.asset ? copyAsset.asset : copyAsset;
        var assets = [asset];
        if (copyAsset.ignores) {
          copyAsset.ignores.forEach(function(ignore) {
            assets.push('!' + asset + ignore);
            assets.push('!' + asset + '**/' + ignore);
            assets.push('!' + asset + '**/' + ignore + '/**');
          });
        }
        gulp.src(assets, {
          dot: true
        }).pipe(gulp.dest(copyAsset.dist ? copyAsset.dist : dist));
      }

    });
  });

  gulp.task('clean', function() {
    del.sync([dist]);
  });

  function failLintBuild() {
    console.error('Lint failed');
    process.exit(1);
  }

  gulp.task('scsslint', function() {
    if (options.scsslint) {
      var scsslint = require('gulp-scss-lint');
      return gulp.src(options.scssAssets || []).pipe(scsslint({
        'config': scssLintPath
      }))
        .pipe(scsslint.failReporter())
        .on('error', failLintBuild);
    }
  });

  gulp.task('jslint', function() {
    return gulp.src(options.jsAssets || [])
      .pipe(react())
      .pipe(eslint(esLintPath))
      .pipe(eslint.formatEach())
      .pipe(eslint.failOnError());
  });

  gulp.task('test', function(done) {
    if (options.testPaths) {
      var mocha = require('gulp-mocha');
      var watch = require('gulp-watch');
      var argv = require('yargs').argv;
      require('../test/test-compiler');
      require('../test/mocked-dom')('<html><body></body></html>');

      gulp.src(options.testPaths, {
        read: false
      })
        .pipe(mocha({
          reporter: 'spec'
        })).once('end', function() {
        if (argv.w) {
          var watchFolders = options.testPaths.slice();
          options.jsAssets.forEach(function(jsAsset) {
            watchFolders.push(jsAsset);
          });
          watch(watchFolders, function() {
            gulp.src(options.testPaths, {
              read: false
            })
              .pipe(mocha({
                reporter: 'spec'
              })).once('end', function() {
              console.log('Watching for changes...');
            }).on('error', function(err) {
              console.error('Test failed:', err.stack || err);
              if (argv.w) {
                this.emit('end');
              } else {
                process.exit(1);
              }
            });
          });
          console.log('Watching for changes...');
        } else {
          done();
        }
      }).on('error', function(err) {
        console.error('Test failed:', err.stack || err);
        if (argv.w) {
          this.emit('end');
        } else {
          process.exit(1);
        }
      });
    } else {
      done();
    }
  });

  gulp.task('coverage', ['test'], function(done) {
    if (options.testPaths) {
      var blanket = require('gulp-blanket-mocha');
      gulp.src(options.testPaths, {
        read: false
      })
        .pipe(blanket({
          instrument: [path.join(process.cwd(), 'src/js')],
          captureFile: 'test/coverage.html',
          reporter: 'html-cov'
        }));
      console.log('Done! You can checkout the report at test/coverage.html.');
    } else {
      console.log('No test found, please specify testPaths as an option.');
    }
    done();
  });

  gulp.task('preprocess', function(callback) {
    runSequence('clean', 'copy', 'jslint', 'scsslint', callback);
  });

  gulp.task('dist-preprocess', function(callback) {
    if (options.distPreprocess) {
      if (process.env.CI) {
        runSequence('preprocess', options.distPreprocess, 'copy', callback);
      } else {
        runSequence('preprocess', options.distPreprocess, 'copy', 'test', callback);
      }
    } else {
      if (process.env.CI) {
        runSequence('preprocess', callback);
      } else {
        runSequence('preprocess', 'test', callback);
      }
    }
  });

  gulp.task('dist', ['dist-preprocess'], function() {
    var env = assign({}, options.env, {
      __DEV_MODE__: false
    });

    var config = assign({}, webpackConfig, options.webpack || {}, {
      plugins: [
        new webpack.optimize.UglifyJsPlugin({
          compress: {
            warnings: false
          }
        }),
        new webpack.DefinePlugin(env)
      //new webpack.optimize.DedupePlugin()
      ]
    });

    if (!config.resolve) {
      config.resolve = {};
    }

    if (options.webpack.module && options.webpack.module.loaders) {
      webpackConfig.module.loaders.forEach(function(loader) {
        config.module.loaders.push(loader);
      });
    }

    config.resolve.extensions = ['', '.js', '.json', '.htm', '.html', '.scss'];

    return gulp.src(options.mainJs)
      .pipe(gulpWebpack(config))
      .pipe(gulp.dest(dist));
  });

  gulp.task('dev', ['preprocess'], function() {

    var env = assign({}, options.env, {
      __DEV_MODE__: true
    });

    var devWebpackConfig = assign({}, webpackConfig, options.webpack || {}, {
      entry: {
        app: ['webpack/hot/dev-server', './' + options.mainJs],
        styles: ['webpack/hot/dev-server', './' + options.mainScss]
      },

      output: {
        filename: 'index.js',
        path: dist,
        publicPath: '/'
      },

      devtool: 'inline-source-map',

      plugins: [
        new webpack.HotModuleReplacementPlugin(),
        new webpack.DefinePlugin(env)
      ]

    });

    if (!devWebpackConfig.resolve) {
      devWebpackConfig.resolve = {};
    }

    if (options.webpack.module && options.webpack.module.loaders) {
      webpackConfig.module.loaders.forEach(function(loader) {
        devWebpackConfig.module.loaders.push(loader);
      });
    }

    devWebpackConfig.resolve.extensions = ['', '.js', '.json', '.htm', '.html', '.scss'];

    var devServerConfig = {
      contentBase: dist,
      hot: true,
      inline: true,
      stats: {
        colors: true
      },
      publicPath: devWebpackConfig.output.publicPath,
      historyApiFallback: true
    };

    if (options.devServerProxy) {
      devServerConfig.proxy = options.devServerProxy;
    }

    var server = new WebpackDevServer(webpack(devWebpackConfig), devServerConfig);
    server.use('/', function(req, res, next) {

      if (req.url.match(/.+index.js$/)) {
        res.redirect(301, '/index.js');
      } else if (req.url.match(/.+\/img\//)) { // img
        res.redirect(301, req.url.replace(/.*\/(img\/.*)$/, '/$1'));
      } else if (req.url.match(/\/img\//)) { // img
        next();
      } else if (req.url.match(/.+\/font\//)) { // font
        res.redirect(301, req.url.replace(/.*\/(font\/.*)$/, '/$1'));
      } else if (req.url.match(/\/font\//)) { // font
        next();
      } else if (req.url.match(/.+\/.*\.[^\/]*$/)) { // file
        res.redirect(301, req.url.replace(/.*\/([^\/]*)$/, '/$1'));
      } else {
        next();
      }
    });
    server.listen(options.devServerPort || 8080, 'localhost', function(err) {
      if (err) {
        console.error('[webpack-dev-server] failed to start:', err);
      } else {
        console.log('[webpack-dev-server] started:', 'Browse to http://localhost:' +
          options.devServerPort + '/webpack-dev-server/');
      }
    });

  });

  gulp.task('syncPre', function(callback) {
    return runSequence('dist', callback);
  });

  gulp.task('sync', ['syncPre'], function() {
    if (options.sync) {
      var rsync = require('gulp-rsync');
      gulp.src(dist)
        .pipe(rsync({
          root: dist,
          hostname: options.sync.hostname,
          username: options.sync.username,
          destination: options.sync.remoteDestination,
          recursive: true,
          relative: true,
          incremental: true,
          silent: true,
          clean: true,
          emptyDirectories: true,
          exclude: ['.DS_Store']
        }));
    }

  });
};
