/* jshint node:true */

var dtsGenerator = require('dts-generator');

module.exports = function (grunt) {
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-contrib-copy');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-peg');
	grunt.loadNpmTasks('grunt-ts');
	grunt.loadNpmTasks('intern-geezer');

	grunt.initConfig({
		all: [ 'src/**/*.ts', 'typings/tsd.d.ts' ],
		ignoreDefinitions: [ '<%= all %>', '!**/*.d.ts', 'typings/tsd.d.ts' ],

		clean: {
			framework: {
				src: [ 'dist/' ]
			}
		},

		copy: {
			framework: {
				expand: true,
				cwd: 'src/',
				src: [ '**/*.html' ],
				dest: 'dist/'
			},
			sourceForDebugging: {
				expand: true,
				cwd: 'src/',
				src: [ '**/*.ts' ],
				dest: 'dist/_debug/'
			},
			typings: {
				expand: true,
				cwd: 'typings/',
				src: [ '**/*.d.ts', '!tsd.d.ts' ],
				dest: 'dist/_typings/'
			},
			staticFiles: {
				expand: true,
				cwd: '.',
				src: [ 'README.md', 'LICENSE', 'package.json', 'bower.json' ],
				dest: 'dist/'
			}
		},

		dts: {
			options: {
				name: 'mayhem',
				baseDir: 'src'
			},
			framework: {
				options: {
					externs: [
						'../dgrid/dgrid.d.ts',
						'../dojo/dojo.d.ts',
						'../dojo/dijit.d.ts',
						'../dstore/dstore.d.ts',
						'../esprima/esprima.d.ts',
						'../intern/intern.d.ts',
						'../intl-messageformat/intl-messageformat.d.ts',
						'../xstyle/xstyle.d.ts'
					],
					out: 'dist/_typings/mayhem/mayhem.d.ts'
				},
				src: [ '<%= ignoreDefinitions %>' ]
			}
		},

		intern: {
			runner: {
				options: {
					runType: 'runner',
					config: 'tests/mayhem.intern'
				}
			},
			client: {
				options: {
					config: 'tests/mayhem.intern'
				}
			}
		},

		peg: {
			parser: {
				src: 'src/templating/html/peg/html.pegjs',
				dest: 'dist/templating/html/peg/html.js',
				options: {
					allowedStartRules: [ 'Template', 'BoundText' ],
					wrapper: function (src, parser) {
						return 'define([\'require\', \'module\'], function (require, module) {\n' +
							'return ' + parser + ';\n' +
						'});';
					}
				}
			}
		},

		rename: {
			sourceMaps: {
				expand: true,
				cwd: 'dist/',
				src: [ '**/*.js.map' ],
				dest: 'dist/_debug/'
			}
		},

		rewriteSourceMapSources: {
			framework: {
				options: {
					find: /^.*\/([^\/]+)$/,
					replace: '$1'
				},
				src: [ 'dist/**/*.js.map' ]
			}
		},

		ts: {
			options: {
				// TODO: Remove `failOnTypeErrors` with TS1.5; see TS#1133
				failOnTypeErrors: false,
				target: 'es5',
				module: 'amd',
				sourceMap: true,
				noImplicitAny: true,
				fast: 'never'
			},
			framework: {
				src: [ '<%= ignoreDefinitions %>' ],
				outDir: 'dist',
				options: {
					mapRoot: '../dist/_debug'
				}
			},
			tests: {
				src: [ 'tests/**/*.ts', 'dist/_typings/mayhem/mayhem.d.ts', '!tests/mayhem/**/*.ts' ]
			}
		},

		watch: {
			ts: {
				files: [ '<%= all %>' ],
				tasks: [ 'ts:framework', 'dts' ]
			},
			parser: {
				files: [ '<%= peg.parser.src %>' ],
				tasks: [ 'peg:parser' ]
			}
		}
	});

	grunt.registerMultiTask('dts', function () {
		var done = this.async();
		var onProgress = grunt.verbose.writeln.bind(grunt.verbose);

		var kwArgs = this.options();
		var path = require('path');
		kwArgs.files = this.filesSrc.map(function (filename) {
			return path.relative(kwArgs.baseDir, filename);
		});

		dtsGenerator.generate(kwArgs, onProgress).then(function () {
			grunt.log.writeln('Generated d.ts bundle at \x1b[36m' + kwArgs.out + '\x1b[39;49m');
			done();
		}, done);
	});

	grunt.registerMultiTask('rewriteSourceMapSources', function () {
		var find = this.options().find;
		var replace = this.options().replace;

		grunt.log.writeln('Replacing \x1b[36m' + find + '\x1b[39;49m with \x1b[36m' +
			replace + '\x1b[39;49m in ' + this.filesSrc.length + ' files');

		this.filesSrc.forEach(function (file) {
			var map = JSON.parse(grunt.file.read(file));
			map.sources = map.sources.map(function (source) {
				return source.replace(find, replace);
			});
			grunt.file.write(file, JSON.stringify(map));
		});
	});

	grunt.registerMultiTask('rename', function () {
		this.files.forEach(function (file) {
			grunt.file.mkdir(require('path').dirname(file));
			require('fs').renameSync(file.src[0], file.dest);
			grunt.verbose.writeln('Renamed ' + file.src[0] + ' to ' + file.dest);
		});
		grunt.log.writeln('Moved \x1b[36m' + this.files.length + '\x1b[39;49m files');
	});

	grunt.registerTask('test', [ 'ts:tests', 'intern:client' ]);
	grunt.registerTask('build', [
		'peg:parser',
		'ts:framework',
		'copy:typings',
		'copy:framework',
		'copy:sourceForDebugging',
		'copy:staticFiles',
		'rewriteSourceMapSources',
		'rename:sourceMaps',
		'dts:framework'
	]);
	grunt.registerTask('ci', [ 'build', 'test' ]);
	grunt.registerTask('default', [ 'build', 'watch' ]);
};
