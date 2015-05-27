var gulp = require('gulp');
var path = require('path');
var devGulpTasks = require('grommet/utils/gulp/gulp-tasks');

var opts = {
  copyAssets: [
    'src/index.html',
    {
      asset: 'src/img/**',
      dist: 'dist/img/'
    }
  ],
  jsAssets: ['src/js/**/*.js'],
  mainJs: 'src/js/index.js',
  mainScss: 'src/scss/index.scss',
  sync: {
    hostname: 'grommet.usa.hp.com',
    username: 'ligo',
    remoteDestination: '/var/www/html/examples/cto-app-tuner/dist'
  },
  devServerPort: 9000,
  webpack: {
    devAlias: { // TODO: remove, just for local dev
      'grommet/scss': path.resolve(__dirname, '../../src/scss'),
      'grommet': path.resolve(__dirname, '../../src/js')
    },
    resolve: {
      root: [
        path.resolve(__dirname, 'src/js'),
        path.resolve(__dirname, 'src/scss'),
        path.resolve(__dirname, '../../src/scss'),
        path.resolve(__dirname, '../../node_modules')
        //path.resolve(__dirname, 'node_modules')
      ]
    }
  },
};

devGulpTasks(gulp, opts);
