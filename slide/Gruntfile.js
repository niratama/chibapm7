/* global module, require */
module.exports = function(grunt) {
  'use strict';

  require('load-grunt-tasks')(grunt, { scope: 'devDependencies' });

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    jshint: {
      options: {
        strict: true,
        indent: 2,
        maxlen: 80,
        unused: true,
        undef: true,
        browser: true,
        devel: true,
        debug: true
      },
      files: [
        'Gruntfile.js',
        'bower.json',
        'package.json',
        'src/js/*.js',
      ]
    },
    bower: {
      install: {
        options: {
          targetDir: 'static/vendor',
          layout: 'byComponent',
          cleanTargetDir: true
        }
      }
    },
    template: {
      index: {
        options: {
          data: {
            markdown: ''
          }
        },
        files: {
          'static/index.html': [
            'src/tmpl/index.html.tmpl'
          ]
        }
      }
    },
    readfile: {
      slide: {
        files: {
          'template.index.options.data.markdown': 'src/md/slide.md'
        }
      }
    },
    stylus: {
      options: {
        compress: true
      },
      main: {
        files: {
          'static/main.min.css': 'src/css/*.styl'
        }
      }
    },
    uglify: {
      main: {
        files: {
          'static/main.min.js': [
            'src/js/tweetpanel.js',
            'src/js/progresspanel.js',
            'src/js/main.js'
          ]
        }
      }
    },
    copy: {
      main: {
        expand: true,
        cwd: 'src/',
        src: 'images/**',
        dest: 'static/'
      }
    },
    clean: {
      dist: [ 'static' ]
    },
    external_daemon: {
      server: {
        options: {
          verbose: true
        },
        cmd: 'go',
        args: ['run', 'server/twstream.go']
      }
    },
    watch: {
      jshint: {
        files: [ '<%= jshint.files %>' ],
        tasks: [ 'jshint' ]
      },
      markdown: {
        files: [ 'src/md/slide.md' ],
        tasks: [ 'readfile:slide', 'template:index' ]
      },
      html: {
        files: [ 'src/tmpl/index.html.tmpl' ],
        tasks: [ 'readfile:slide', 'template:index' ]
      },
      js: {
        files: [ 'src/js/*.js' ],
        tasks: [ 'uglify:main' ]
      },
      css: {
        files: [ 'src/css/*.styl' ],
        tasks: [ 'stylus:main' ]
      },
      images: {
        files: [ 'src/images/**' ],
        tasks: [ 'copy:main']
      },
      bower: {
        files: [ 'bower.json' ],
        tasks: [ 'bower' ]
      },
      twstream: {
        files: [ 'server/twstream.go' ],
        tasks: [ 'server' ]
      }
    }
  });
  grunt.registerMultiTask('readfile', 'read file', function () {
    var self = this;

    self.files.forEach(function(filePair) {
      filePair.src.forEach(function(src) {
        grunt.log.debug(src + ' -> ' + filePair.dest);
        var value = grunt.file.read(filePair.src);
        grunt.config.set(filePair.dest, value);
      });
    });
  });

  grunt.registerTask('test', [ 'jshint' ]);
  grunt.registerTask('build', [
    'bower', 'readfile:slide', 'template:index', 'uglify:main', 'stylus:main',
    'copy:main'
  ]);
  grunt.registerTask('server', [ 'external_daemon:server' ]);
  grunt.registerTask('default', [ 'test', 'clean', 'build', 'server', 'watch']);
};
/* vi:set sts=2 sw=2 et: */
