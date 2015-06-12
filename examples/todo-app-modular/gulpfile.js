// (C) Copyright 2014-2015 Hewlett-Packard Development Company, L.P.

var gulp = require('gulp');
var path = require('path');
var devGulpTasks = require('../../src/utils/gulp/gulp-tasks');

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
  devServerPort: 9010,
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
      ]
    }
  }
};

devGulpTasks(gulp, opts);
