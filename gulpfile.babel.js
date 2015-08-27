import fs from 'fs';
import path from 'path';
import del from 'del';
import runSequence from 'run-sequence';
import autoprefixer from 'autoprefixer';
import browserSync from 'browser-sync';
import requireDir from 'require-dir';
import swPrecache from 'sw-precache';
import wiredep from 'wiredep';
import gulp from 'gulp';
import gulpLoadPlugins from 'gulp-load-plugins';
import pkg from './package.json';

const $ = gulpLoadPlugins();
const reload = browserSync.reload;
const tasks = requireDir('./tasks');

/*==========  IMAGES  ==========*/

// Optimize images
gulp.task('images', () => {
  return gulp.src('app/assets/images/**/*')
    .pipe($.cache($.imagemin({
      progressive: true,
      interlaced: true
    })))
    .pipe(gulp.dest('dist/assets/images'))
    .pipe($.size({
      title: 'images'
    }));
});

/*==========  FONTS  ==========*/

// Copy web fonts to dist
gulp.task('fonts', () => {
  return gulp.src(['app/assets/fonts/**'])
    .pipe(gulp.dest('dist/assets/fonts'))
    .pipe($.size({title: 'fonts'}));
});

/*==========  JSHINT  ==========*/

gulp.task('jshint', () => {
  return gulp.src('app/assets/scripts/**/*.js')
    .pipe(reload({
      stream: true,
      once: true
    }))
    .pipe($.jshint({ esnext: true }))
    .pipe($.jshint.reporter('jshint-stylish'))
    .pipe($.if(!browserSync.active, $.jshint.reporter('fail')));
});


/*==========  SCRIPTS  ==========*/

// Concatenate and minify JavaScript
gulp.task('scripts', () => {
  return gulp.src(['./app/assets/scripts/**/*.js'])
    .pipe($.sourcemaps.init())
    .pipe($.babel())
    .pipe($.concat('main.min.js'))
    .pipe($.uglify({preserveComments: 'some'}))
    // Output files
    .pipe($.sourcemaps.write('../../.maps'))
    .pipe(gulp.dest('dist/assets/scripts'))
    .pipe($.size({title: 'scripts'}));
});


/*==========  STYLES  ==========*/

gulp.task('styles', () => {
  let processors = [
    autoprefixer({
      browsers: 'last 1 version'
    })
  ];

  return gulp.src('app/assets/styles/**/*.scss')
    .pipe($.sourcemaps.init())
    .pipe($.sass.sync().on('error', $.sass.logError))
    .pipe($.concat('main.min.css'))
    .pipe($.minifyCss())
    .pipe($.sourcemaps.write('../../.maps'))
    .pipe(gulp.dest('dist/assets/styles'))
    .pipe(reload({
      stream: true
    }))
    .pipe($.size({title: 'styles'}));
});

/*==========  HTML  ==========*/

gulp.task('html', () => {
  const assets = $.useref.assets({
    searchPath: '{.tmp,app}'
  });

  return gulp.src('app/**/*.html')
    .pipe(assets)
    // Remove any unused CSS
    // Note: If not using the Style Guide, you can delete it from
    // the next line to only include styles your project uses.
    .pipe($.if('**/*.css', $.uncss({
      html: [
        'app/index.html'
      ],
      // CSS Selectors for UnCSS to ignore
      ignore: []
    })))

  // Concatenate and minify styles
  // In case you are still using useref build blocks
  .pipe($.if('**/*.css', $.minifyCss()))
    .pipe(assets.restore())
    .pipe($.useref())

  // Minify any HTML
  .pipe($.if('*.html', $.minifyHtml()))
    // Output files
    .pipe(gulp.dest('dist'))
    .pipe($.size({
      title: 'html'
    }));
});

/*==========  CLEAN  ==========*/

// Clean output directory
gulp.task('clean', cb => del(['.tmp', 'dist/*', '!dist/.git'], {
  dot: true
}, cb));

/*==========  COPY  ==========*/

// Copy all files at the root level (app)
gulp.task('copy', () => {
  return gulp.src([
    'app/*',
    '!app/*.html',
  ], {
    dot: true
  }).pipe(gulp.dest('dist'))
    .pipe($.size({title: 'copy'}));
});

/*==========  SERVE  ==========*/

// Watch files for changes & reload
gulp.task('serve', ['styles'], () => {
  browserSync({
    notify: false,
    // Customize the BrowserSync console logging prefix
    logPrefix: 'APP',
    // Run as an https by uncommenting 'https: true'
    // Note: this uses an unsigned certificate which on first access
    //       will present a certificate warning in the browser.
    // https: true,
    server: ['.tmp', 'app']
  });

  gulp.watch(['app/**/*.html'], reload);
  gulp.watch(['app/assets/styles/**/*.{scss,css}'], ['styles', reload]);
  gulp.watch(['app/assets/scripts/**/*.js'], ['jshint']);
  gulp.watch(['app/assets/images/**/*'], reload);
});

// Build and serve the output from the dist build
gulp.task('serve:dist', ['default'], () => {
  browserSync({
    notify: false,
    logPrefix: 'APP',
    // Run as an https by uncommenting 'https: true'
    // Note: this uses an unsigned certificate which on first access
    //       will present a certificate warning in the browser.
    // https: true,
    server: 'dist',
    baseDir: 'dist'
  });
});

/*==========  WIREDEP  ==========*/


/*==========  DEFAULT TASK  ==========*/

// Build production files, the default task
gulp.task('default', ['clean'], cb => {
  runSequence(
    'styles', ['jshint', 'html', 'scripts', 'images', 'fonts', 'copy'],
    cb
  );
});
