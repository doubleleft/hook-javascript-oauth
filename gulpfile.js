var gulp = require('gulp')
  , uglify = require('gulp-uglify')
  , rename = require('gulp-rename')
  , sourcemaps = require('gulp-sourcemaps')
  , source = require('vinyl-source-stream')
  , buffer = require('vinyl-buffer')
  , browserify = require('browserify')
  , watchify = require('watchify')
  , babel = require('babelify')
  , watch = false;

gulp.task('compile', function() {
  var bundler = watchify(browserify('./src/index.js', { debug: watch }).transform(babel));

  function rebundle() {
    return bundler.bundle()
      .on('error', function(err) { console.error(err); this.emit('end'); })
      .pipe(source('hook-oauth.js'))
      .pipe(buffer())
      .pipe(sourcemaps.init({ loadMaps: true }))
      .pipe(sourcemaps.write('./'))
      .pipe(gulp.dest('./build'));
  }

  if (watch) {
    bundler.on('update', function() {
      console.log('-> bundling...');
      rebundle();
    });
  }

  return rebundle();
});

gulp.task('compress', ['compile'], function() {
  return gulp.src('build/*.js')
    .pipe(uglify())
    .pipe(rename('hook-oauth.min.js'))
    .pipe(gulp.dest('build'))
    .once('end', function () {
      process.exit();
    });
});

gulp.task('build', ['compress']);
gulp.task('watch', function() {
  watch = true;
  gulp.start('compile');
});

gulp.task('default', ['watch']);
