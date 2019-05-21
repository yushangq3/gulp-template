    var config = require('./config.js');
    var spawn = require('child_process').spawn;
    var gulp = require('gulp');
    var ts = require("gulp-typescript");
    var tsProject = ts.createProject("tsconfig.json");
    var runSequence = require('run-sequence');
    var gulpClean = require('gulp-clean');
    var gulpPrint = require('gulp-print');
    var fs = require('fs');
    var mergeStream = require('merge-stream');
    var gulpImagemin = require('gulp-imagemin');
    var less = require('gulp-less');
    var gulpCleanCss = require('gulp-clean-css');
    var gulpCssUrlVersioner = require('gulp-css-url-versioner');
    var dateFormat = require('date-format');
    var gulpUglify = require('gulp-uglify');
    var syncExec = require('sync-exec');
    var gulpIgnore = require('gulp-ignore');
    var postcss = require('gulp-postcss');
    var px2rem = require('postcss-px2rem');
    var gulpHtmlVersion = require('gulp-html-version');
    var cache = require('gulp-cache'); //缓存img，因为img压缩很费时间
    var nodeModulesCondition = 'node_modules/**/*';

    var ENV = {};

    ENV.ROOT = process.env.INIT_CWD.replace(/\/$/, '') + '/';

    ENV.SRC = './';

    ENV.EXT = {
      'static': ['otf', 'eot', 'ttf', 'woff', 'woff2', 'swf', 'svg', 'html', 'xml', 'mp4', 'mp3'],
      'image': ['png', 'jpg', 'jpeg', 'gif'],
      'less': ['less'],
      'css': ['css'],
      'js': ['js'],
      'ts': ['ts']
    };

    ENV.WATCH = {};

    var getBuildParam = function(buildGroup, defaultFileBuildPath) {
      //buildGroup='js'
      //defaultFileBuildPath="public/**/*.js",
      //==
      //buildGroup='static'
      //defaultFileBuildPath="**/*.@(swf|html)",
      var param = [];

      var fileBuildPath = null;
      if (buildGroup in ENV.WATCH) {

        fileBuildPath = ENV.WATCH[buildGroup];
      }

      ENV.WATCH[buildGroup] = null;
      if (!fileBuildPath) {
        var src = null;
        if (typeof defaultFileBuildPath == 'string') {
          src = ENV.SRC + defaultFileBuildPath;
          //src= ./public/**/*.js
          //=
          //src= ./**/*.@(swf|html)
        } else {
          src = [];
          for (var i = 0; i < defaultFileBuildPath.length; i++) {
            src.push(ENV.SRC + defaultFileBuildPath[i]);
          }

        }
        param.push({
          src: src,
          base: ENV.SRC + config.src
        });
      } else {
        if (fs.existsSync(ENV.SRC + fileBuildPath)) {
          param.push({
            src: ENV.SRC + fileBuildPath,
            base: ENV.SRC + config.src
          });
        }
      }

      return param;
    };

    var buildWith = function(buildGroup, defaultFileBuildPath, builder) {
      //buildGroup='js'
      //defaultFileBuildPath="public/**/*.js",
      //==
      //buildGroup='static'
      //defaultFileBuildPath="**/*.@(swf|html)",
      var buildParam = getBuildParam(buildGroup, defaultFileBuildPath);
      //buildParam=[{src:'./public/**/*.js',base:'./'}]
      var merged = mergeStream();
      for (var i = 0; i < buildParam.length; i++) {

        var build = builder(buildParam[i].src, buildParam[i].base);
        merged.add(build);
      }
      return merged;
    };

    gulp.task('build:cleanLaravelCache', function() {
      if (fs.existsSync(config.artisan)) {
        var ret = syncExec( config.artisan + ' view:clear');
        ret = syncExec( config.artisan + ' cache:clear');
      }
    });

    /*
     
     * 处理 静态文件 如  字体 | 图片 | 视频 | HTML;
     * HTML是什么鬼
     * */
    gulp.task('build:static', function() {
      var srcs = [];
      for (var i = 0; i < config.src.length; i++) {
        srcs.push(config.src[i] + '/**/*.@(' + ENV.EXT['static'].join('|') + ')');
      }
      var a = 'static',
        b = srcs,
        c = function(src, base) {
          // src=./**/*.@(swf|html)
          // base:'./public'

          return gulp.src(src, {
              base: base
            })
            .pipe(gulpIgnore.exclude(nodeModulesCondition))
            .pipe(gulpPrint(function(filepath) {
              return "build: " + filepath;
            }))
            .pipe(gulp.dest(config.dist));
        }
      return buildWith(a, b, c);
    });
    
    
    gulp.task('build:html', function() {
      var srcs = [];
      for (var i = 0; i < config.src.length; i++) {
        srcs.push(config.src[i] + "/**/*.html");
      }
      var a = "html",
        b = srcs,
        c = function(src, base) {
           return gulp.src(src, {
                    base: base
                  })
                  .pipe(gulpHtmlVersion({
                      paramType: 'timestamp',
                      suffix: ['css', 'js', 'jpg']
                  }))
                  .pipe(gulp.dest(config.dist));
        }
      return buildWith(a, b, c);
    });
    
    gulp.task('build:image', function() {
      var srcs = [];
      for (var i = 0; i < config.src.length; i++) {
        srcs.push(config.src[i] + '/**/*.@(' + ENV.EXT['image'].join('|') + ')');
      }
      console.log(srcs)
      var a = "image",
        b = srcs,
        c = function(src, base) {
          if (!('imagePack' in config) || config.imagePack) {
            return gulp.src(src, {
                base: base
              })
              .pipe(gulpIgnore.exclude(nodeModulesCondition))
              .pipe(gulpPrint(function(filepath) {
                return "build: " + filepath;
              }))
              .pipe(cache(gulpImagemin({ optimizationLevel: 3, progressive: true, interlaced: true })))
              .pipe(gulp.dest(config.dist));
          } else {
            return gulp.src(src, {
                base: base
              })
              .pipe(gulpIgnore.exclude(nodeModulesCondition))
              .pipe(gulpPrint(function(filepath) {
                return "build: " + filepath;
              }))
              .pipe(gulp.dest(config.dist));
          }
        }
      return buildWith(a, b, c);
    });

    gulp.task('build:less', function() {
      var srcs = [];
      for (var i = 0; i < config.src.length; i++) {
        srcs.push(config.src[i] + "/**/*.less");
      }
      var a = "less",
        b = srcs,
        processors = [px2rem({
          remUnit: 75
        })],
        c = function(src, base) {
          return gulp.src(src, {
              base: base
            })
            .pipe(gulpIgnore.exclude(nodeModulesCondition))
            .pipe(gulpPrint(function(filepath) {
              return "build: " + filepath;
            }))
            .pipe(less())
            //.pipe(postcss(processors))
            .pipe(gulpCssUrlVersioner({
              version: dateFormat.asString('yyMMddhhmmss', new Date())
            }))
            .pipe(gulpCleanCss({
              keepSpecialComments: 0
            }))
            .pipe(gulp.dest(config.dist));
        }


      return buildWith(a, b, c);
    });

    gulp.task('build:css', function() {
      var srcs = [];
      for (var i = 0; i < config.src.length; i++) {
        srcs.push(config.src[i] + '/**/*.css');
      }
      var a = "css",
        b = srcs,
        c = function(src, base) {

          return gulp.src(src, {
              base: base
            })
            .pipe(gulpIgnore.exclude(nodeModulesCondition))
            .pipe(gulpPrint(function(filepath) {
              return "build: " + filepath;
            }))
            .pipe(gulpCssUrlVersioner({
              version: dateFormat.asString('yyMMddhhmmss', new Date())
            }))
            .pipe(gulpCleanCss({
              keepSpecialComments: 0
            }))
            
            .pipe(gulp.dest(config.dist))
            
        }
      return buildWith(a, b, c);
    });

    gulp.task('build:js', function() {
      var srcs = [];
      for (var i = 0; i < config.src.length; i++) {
        srcs.push(config.src[i] + '/**/*.js');
      }
      var a = 'js',
        b = srcs,
        c = function(src, base) {
          // src='./public/**/*.js'
          // base:'./public'
          return gulp.src(src, {
              base: base
            })
            .pipe(gulpIgnore.exclude(nodeModulesCondition))
            .pipe(gulpPrint(function(filepath) {
              return "build: " + filepath;
            }))
            .pipe(gulpUglify())
            .pipe(gulp.dest(config.dist))
            
        }
      return buildWith(a, b, c);
    });
    gulp.task('build:ts', function () {
      var srcs = [];
      for (var i = 0; i < config.src.length; i++) {
        srcs.push(config.src[i] + '/**/*.ts');
      }
      var a = 'js',
        b = srcs,
        c = function(src, base) {
          // src='./public/**/*.js'
          // base:'./public'
          return gulp.src(src, {
              base: base
            })
            .pipe(tsProject())
            .js.pipe(gulp.dest(config.dist))
        }
      return buildWith(a, b, c);
      
    });

    gulp.task('watching', function() {
      var srcs = [config.src + '/**/*.*'];
//       for (var i = 0; i < config.libs.length; i++) {
//         srcs.push(config.src + '/' + config.libs[i] + '/**/*.*');
//       }
//       for (var i = 0; i < config.apps.length; i++) {
//         srcs.push(config.src + '/' + config.apps[i] + '/**/*.*');
//       }
    
      var build = gulp.watch(srcs, function(event) {
        try {
          var path = event.path.substr(ENV.ROOT.length);
          var extension = event.path.substring(event.path.lastIndexOf('.') + 1).toLowerCase();
          var groupFound = null;
          for (var group in ENV.EXT) {
            if (ENV.EXT[group].indexOf(extension) >= 0) {
              groupFound = group;
              break;
            }
          }

          if (null != groupFound) {

            if (groupFound == 'js') {
              for (var i = 0; i < config.apps.length; i++) {
                if (path.indexOf(config.apps[i] + '/') === 0) {
                  console.log('watcher builder ' + groupFound + ' webpack ignore');
                  return null;
                }
              }
            }

            console.log('watcher builder ' + groupFound + ' starting');
            ENV.WATCH[groupFound] = path;
            if ('image' == groupFound) {
              runSequence(
                'build:' + groupFound, 'build:less', 'build:css','build:html', 'build:cleanLaravelCache'
              );
            } else {
              runSequence(
                'build:' + groupFound, 'build:cleanLaravelCache'
              );
            }
          } else {
            console.log('watcher builder not found for : ' + path);
          }

        } catch (e) {
          console.log('buider error !!!!!');
        }

      });
      return build;
    });

    gulp.task('default', function() {
      runSequence(
        'build:static', 'build:image', 'build:less', 'build:css','build:ts','build:js','build:html', 'build:cleanLaravelCache', 'watching'
      );
    });
