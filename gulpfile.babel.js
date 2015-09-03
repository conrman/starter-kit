/*jshint ignore:start */
import fs from 'fs';
import del from 'del';
import runSequence from 'run-sequence';
import assetBuilder from 'asset-builder';
import autoprefixer from 'autoprefixer';
import browserSync from 'browser-sync';
import minimist from 'minimist';
import lazypipe from 'lazypipe';
import merge from 'merge-stream';
import requireDir from 'require-dir';
import wiredep from 'wiredep';
import gulp from 'gulp';
import gutil from 'gulp-util';
import gulpLoadPlugins from 'gulp-load-plugins';

const $ = gulpLoadPlugins();
const argv = minimist(process.argv.slice(2));
const reload = browserSync.reload;
const tasks = requireDir('./tasks');
const manifest = assetBuilder('./assets/manifest.json');
const path = manifest.paths;
const config = manifest.config || {};
const globs = manifest.globs;
const project = manifest.getProjectGlobs();
const revManifest = path.dist + 'assets.json';

// CLI options
const enabled = {
  // Enable static asset revisioning when `--production`
  rev: argv.production,
  // Disable source maps when `--production`
  maps: !argv.production,
  // Fail styles task on error when `--production`
  failStyleTask: argv.production
};


var cssTasks = (filename) => {
  return lazypipe()
  .pipe(() => {
    return $.if(!enabled.failStyleTask, $.plumber());
  })
  .pipe(() => {
    return $.if(enabled.maps, $.sourcemaps.init());
  })
  .pipe(() => {
    return $.if('*.scss', $.sass({
        outputStyle: 'nested', // libsass doesn't support expanded yet
        precision: 10,
        includePaths: ['.'],
        errLogToConsole: !enabled.failStyleTask
    }));
  })
  .pipe($.concat, filename)
  .pipe($.autoprefixer, {
    browsers: [
    'last 2 versions',
    'ie 8',
    'ie 9',
    'android 2.3',
    'android 4',
    'opera 12'
    ]
  })
  .pipe($.minifyCss, {
    advanced: false,
    rebase: false
  })
  .pipe(() => {
    return $.if(enabled.rev, $.rev());
  })
  .pipe(() => {
    return $.if(enabled.maps, $.sourcemaps.write('.'));
  })();
};

var jsTasks = (filename) => {
  return lazypipe()
  .pipe(() => {
    return $.if(enabled.maps, $.sourcemaps.init());
  })
  .pipe($.concat, filename)
  .pipe($.ignore, ['**/**.map'])
  .pipe($.uglify)
  .pipe(() => {
    return $.if(enabled.rev, $.rev());
  })
  .pipe(() => {
    return $.if(enabled.maps, $.sourcemaps.write('.'));
  })();
};

var writeToManifest = (directory) => {
  return lazypipe()
  .pipe(gulp.dest, path.dist + directory)
  .pipe(browserSync.stream, {match: '**/*.{js,css}'})
  .pipe($.rev.manifest, revManifest, {
    base: path.dist,
    merge: true
  })
  .pipe(gulp.dest, path.dist)();
};

/*==========  IMAGES  ==========*/

// Optimize images
gulp.task('images', () => {
 return gulp.src(globs.images)
  .pipe($.imagemin({
    progressive: true,
    interlaced: true,
    svgoPlugins: [{removeUnknownsAndDefaults: false}, {cleanupIDs: false}]
  }))
  .pipe(gulp.dest(path.dist + 'images'))
  .pipe(browserSync.stream());
});

/*==========  FONTS  ==========*/

// Copy web fonts to dist
gulp.task('fonts', () => {
  return gulp.src(globs.fonts)
    .pipe($.flatten())
    .pipe(gulp.dest(path.dist + 'fonts'))
    .pipe(browserSync.stream());
});

/*==========  STYLES  ==========*/

gulp.task('styles', ['wiredep'], () => {
  let merged = merge();
  manifest.forEachDependency('css', (dep) => {
    var cssTasksInstance = cssTasks(dep.name);
    if (!enabled.failStyleTask) {
      cssTasksInstance.on('error', (err) => {
        console.error(err.message);
        this.emit('end');
      });
    }
    merged.add(gulp.src(dep.globs, {base: 'styles'})
               .pipe(cssTasksInstance));
  });
  return merged
  .pipe(writeToManifest('styles'));
});

/*==========  JSHINT  ==========*/

gulp.task('jshint', () => {
  return gulp.src([
                  'bower.json', 'gulpfile.babel.js'
                  ].concat(project.js))
  .pipe($.jshint())
  .pipe($.jshint.reporter('jshint-stylish'))
  .pipe($.jshint.reporter('fail'));
});


/*==========  SCRIPTS  ==========*/

// Concatenate and minify JavaScript
gulp.task('scripts', ['jshint'], () => {
  let merged = merge();
  manifest.forEachDependency('js', (dep) => {
    merged.add(
               gulp.src(dep.globs, {base: 'scripts'})
               .pipe(jsTasks(dep.name))
    );
  });
  return merged
  .pipe(writeToManifest('scripts'));
});

/*==========  TEMPLATES  ==========*/

gulp.task('templates', () => {
  let LOCALS = {};

  return gulp.src('**/*.jade')
    .pipe($.jade({
      locals: LOCALS
    }))
    .pipe(gulp.dest(path.dist));
});


/*==========  CLEAN  ==========*/

// Clean output directory
gulp.task('clean', del(path.dist));

/*==========  WATCH  ==========*/

// Watch files for changes & reload
gulp.task('watch', ['build'], function() {
  browserSync.init({
    server: {
      baseDir: path.dist
    }  
  });
  gulp.watch([path.source + 'styles/**/*'], ['styles']);
  gulp.watch([path.source + 'scripts/**/*'], ['jshint', 'scripts']);
  gulp.watch([path.source + 'fonts/**/*'], ['fonts']);
  gulp.watch([path.source + 'images/**/*'], ['images']);
  gulp.watch([path.source + 'templates/**/*'], ['templates']).on('change', browserSync.reload);
  gulp.watch(['*.jade'], ['templates']).on('change', browserSync.reload);
  gulp.watch(['bower.json', 'assets/manifest.json'], ['build']);
});

/*==========  WIREDEP  ==========*/

gulp.task('wiredep', () => {
  return gulp.src(project.css)
  .pipe(wiredep.stream())
  .pipe($.changed(path.source + 'styles', {
    hasChanged: $.changed.compareSha1Digest
  }))
  .pipe(gulp.dest(path.source + 'styles'));
});

/*==========  BUILD  ==========*/

gulp.task('build', (callback) => {
  runSequence('styles',
              'scripts',
              'templates',
              ['fonts', 'images'],
              callback
  );
});

/*==========  DEFAULT TASK  ==========*/

// Build production files, the default task
gulp.task('default', ['clean'], () => {
  gulp.start('build');
});
/*jshint ignore:end */