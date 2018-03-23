import babel_loader from "babel-loader"
import babel_env from "babel-preset-env"
import babel_react from "babel-preset-react";
import del from "del"
import gulp from "gulp"
import babel from "gulp-babel"
import buffer from "gulp-buffer"
import clone from "gulp-clone"
import concat from "gulp-concat"
import cleancss from "gulp-clean-css"
import debug from "gulp-debug"
import gzip from "gulp-gzip"
import htmlmin from "gulp-htmlmin"
import gulp_if from "gulp-if"
import imagemin from "gulp-imagemin"
import inline_source from "gulp-inline-source"
import nunjucks from "gulp-nunjucks-render"
import postcss from "gulp-postcss"
import rename from "gulp-rename"
import sourcemaps from "gulp-sourcemaps"
import template from "gulp-template"
import uglify from "gulp-uglify"
import using from "gulp-using"
import optipng from "imagemin-optipng"
import svgo from "imagemin-svgo"
import merge from "merge2"
import css_critical_split from "postcss-critical-split"
import cssnext from "postcss-cssnext"
import css_import from "postcss-import"
import css_nested from "postcss-nested"
import css_mixins from "postcss-mixins"
import css_nested_ancestors from "postcss-nested-ancestors"
import precss from "precss"
import webpack from "webpack"
import webpack_stream from "webpack-stream"
import yaml from "yamljs"

import precss_extend from "postcss-extend-rule"
import precss_adv_variables from "postcss-advanced-variables"
import precss_preset_env from "postcss-preset-env"
import precss_atroot from "postcss-atroot"
import precss_property_lookup from "postcss-property-lookup"
import crass from "gulp-crass"
import merge_selectors from "postcss-merge-selectors"
import merge_rules from "postcss-merge-rules"

let dirs = {
	src: "../../projects",
	int: "../../intermediate",
	dest: "../../build",
	libs: "../../libraries"
};

// From https://www.sitepoint.com/pass-parameters-gulp-tasks/
const args = (argList =>
{
	let arg = {}, a, opt, thisOpt, curOpt;
	for (a = 0; a < argList.length; a++) {
		thisOpt = argList[a].trim();
		opt = thisOpt.replace(/^\-+/, '');

		if (opt === thisOpt)
		{
			// argument value
			if (curOpt) arg[curOpt] = opt;
			curOpt = null;
		}
		else 
		{
			// argument name
			curOpt = opt;
			arg[curOpt] = true;

		}
	}

	return arg;
})(process.argv);

function DetermineProjects(projectConfig)
{
	let target_projects = Object.entries(projectConfig).map(p => {
		let [name, project] = [...p];
		project.name = name;

		return project;
	});

	const project_names = Object.keys(projectConfig);
	if ("project" in args)
	{
		target_projects = target_projects.filter(p => p.name == args.project);
	}

	return target_projects;
}

// Development:
//		- Focus on readability
//		- Nothing should be minified, everything is readable
//		- Comments exist where relevant
//		- Images remain untouched
//		- No GZip compression at all
// Debug:
//		- Focus on verifying content before pushing to production
//		- Primary use to identify any issues that may exist 
//		- Comments stripped
//		- Structure remains readable, nothing minified
//		- No GZip compression at all
// Production:
//		- Focus on end result
//		- Everything minified as much as possible
//		- GZip compression on everything relevant
function DetermineBuildType(options)
{
	if ("build" in args)
	{
		return args.build;
	}

	if (options.minify)
	{
		return "production"
	}
	
	if (options.debug)
	{
		return "debug"
	}

	return "development"
}

// fetch command line arguments
const config = yaml.load("../scripts/config.yaml")

const projectConfig = "project" in args
					? config.uploads[args.project]
					: undefined;
const target_projects = DetermineProjects(config.uploads);

const options = config.options;
const buildType = DetermineBuildType(options);

if (buildType == "debug")
{
	dirs.dest = dirs.dest.replace("build", "debug");
}

function GZipPipe()
{
	return gulp_if(options.for_s3, 
				gzip({
					append: false,
					gzipOptions: {
						level: 9
					}
				}));
}

function CSSPipe(project, splitMode, file = undefined)
{
	let format = {
		breaks: {
			afterAtRule: true, // controls if a line break comes after an at-rule; e.g. `@charset`; defaults to `false`
			afterBlockBegins: true, // controls if a line break comes after a block begins; e.g. `@media`; defaults to `false`
			afterBlockEnds: true, // controls if a line break comes after a block ends, defaults to `false`
			afterComment: true, // controls if a line break comes after a comment; defaults to `false`
			afterProperty: true, // controls if a line break comes after a property; defaults to `false`
			afterRuleBegins: true, // controls if a line break comes after a rule begins; defaults to `false`
			afterRuleEnds: true, // controls if a line break comes after a rule ends; defaults to `false`
			beforeBlockEnds: true, // controls if a line break comes before a block ends; defaults to `false`
			betweenSelectors: true // controls if a line break comes between selectors; defaults to `false`
		},
		spaces: { // controls where to insert spaces
			aroundSelectorRelation: true, // controls if spaces come around selector relations; e.g. `div > a`; defaults to `false`
			beforeBlockBegins: true, // controls if a space comes before a block begins; e.g. `.block {`; defaults to `false`
			beforeValue: true // controls if a space comes before a value; e.g. `width: 1rem`; defaults to `false`
		},
		indentWith: "tab",
		indentBy: 1
	};
	if (options.minify)
	{
		format = {
			breaks: {
				all: false
			},
			spaces: { 
				all: false
			},
			indentBy: 0
		}
	}

	const sourceFile = file || `${dirs.src}/${project.name}/css/main.css`;
	return gulp.src(sourceFile)
				.pipe(gulp_if(options.verbose, using()))
				.pipe(postcss([
					css_import,
					css_mixins, 
					css_nested,
					css_nested_ancestors, 
					cssnext,
					css_critical_split({
						"output": splitMode
					}),
				]))
				.pipe(cleancss({
					level: {
						1: {
							selectorsSortingMethod: "natural",
							replaceZeroUnits: true
						},
						2: {
							mergeAdjacentRules: true, // controls adjacent rules merging; defaults to true
							mergeIntoShorthands: true, // controls merging properties into shorthands; defaults to true
							mergeMedia: true, // controls `@media` merging; defaults to true
							mergeNonAdjacentRules: true, // controls non-adjacent rule merging; defaults to true
							mergeSemantically: true, // controls semantic merging; defaults to false
							overrideProperties: true, // controls property overriding based on understandability; defaults to true
							removeEmpty: true, // controls removing empty rules and nested blocks; defaults to `true`
							reduceNonAdjacentRules: true, // controls non-adjacent rule reducing; defaults to true
							removeDuplicateFontRules: true, // controls duplicate `@font-face` removing; defaults to true
							removeDuplicateMediaBlocks: true, // controls duplicate `@media` removing; defaults to true
							removeDuplicateRules: true, // controls duplicate rules removing; defaults to true
							removeUnusedAtRules: true, // controls unused at rule removing; defaults to false (available since 4.1.0)
							restructureRules: true, // controls rule restructuring; defaults to false
							skipProperties: [] // controls which properties won't be optimized, defaults to `[]` which means all will be optimized (since 4.1.0)
						}
					},
					format: format
				}));
}

function ProjectTasks(taskName, taskFunction)
{
	let taskMap = new Map(
		target_projects.map(tp => [`${taskName}-${tp.name}-${buildType}`, tp])
	);

	// Registers task in Gulp.
	taskMap.forEach((v, k) => {
		gulp.task(k, () => taskFunction(v))
	})

	return [...taskMap.keys()];
}

function Clean(project)
{
	const folders = [
		`${dirs.int}/${project.name}`,
		`${dirs.dest}/${project.name}`
	];

	return Promise.all(folders.map(f => 
		del(f, { force: true })
	));
}

function Images(project)
{
	return gulp.src(`${dirs.src}/${project.name}/images/**/*.*`)
				.pipe(imagemin([
					optipng({
						optimizationLevel: 7
					}),
					svgo({
						plugins: [
							{	removeViewBox: true	},
							{	cleanupIDs: false	}
						]
					})
				]))
				.pipe(GZipPipe())
				.pipe(gulp.dest(`${dirs.dest}/${project.name}/cdn/images`));
}

function HTML(project)
{
	const matomo = project.matomo;

	let prereqs = [
		new Promise((resolve, reject) =>
		{
			gulp.src([	`${dirs.libs}/loadcss/loadCSS.js`, 
						`${dirs.libs}/loadcss/cssrelpreload.js`
					])
				.pipe(gulp_if(options.verbose, using()))
				.pipe(gulp_if(options.minify, uglify()))
				.pipe(concat("loadcss.js", {newLine: '\n'}))
				.on('error', reject)
				.pipe(gulp.dest(`${dirs.int}/${project.name}/js`))
				.on('end', resolve);
		}),
		new Promise((resolve, reject) =>
		{
			gulp.src(`${dirs.libs}/matomo/matomo.js`)
				.pipe(gulp_if(options.verbose, using()))
				.pipe(template({
					siteId: matomo.siteId,
					mainDomain: `"*.${matomo.mainDomain}"`,
					allDomains: [matomo.mainDomain, ...(matomo.extraDomains || [])].map(domain => `"*.${domain}"`)
				}))
				.pipe(babel({
					presets: [ babel_env ]
				}))
				.pipe(gulp_if(options.minify, uglify()))
				.on('error', reject)
				.pipe(gulp.dest(`${dirs.int}/${project.name}/js`))
				.on('end', resolve);
		}),
		new Promise((resolve, reject) =>
		{
			gulp.src(`${dirs.src}/${project.name}/snippets/*`)
				.pipe(gulp_if(options.verbose, using()))
				.on('error', reject)
				.pipe(gulp.dest(`${dirs.int}/${project.name}/snippets`))
				.on('end', resolve);
		})
	];

	if (project.extras && project.extras.includes("speccy"))
	{
		prereqs.push(new Promise((resolve, reject) =>
		{
			CSSPipe(project, "input", `${dirs.libs}/speccy/speccy.css`)
				.pipe(gulp_if(options.verbose, using()))
				.on('error', reject)
				.pipe(gulp.dest(`${dirs.int}/${project.name}/css`))
				.on('end', resolve);
		}));
	}

	if (options.css.critical_split)
	{
		prereqs.push(new Promise((resolve, reject) =>
		{
			CSSPipe(project, "critical")
				.pipe(rename("critical.inline.css"))
				.on('error', reject)
				.pipe(gulp.dest(`${dirs.int}/${project.name}/css`))
				.on('end', resolve);
		}));
	}

	return Promise.all(prereqs)
					.then(() =>
	{
		const templates = project.templates;

		// Annoyingly, there's a slightly convoluted pipeline in that Nunjucks is required for two 
		// separate workflows for different reasons, but an individual file can only go through 
		// Nunjucks once (since variables for the "second time" will no longer exist in the template).  
		// However, some data is needed for both and some is needed for one or other.  
		// Best solution (for now): Run Nunjucks step on both workflows, but use a common object 
		// storing data for the template and modify accordingly, and merge both workflows post-Nunjucks.  
		let nunjucksData = {
			matomoId: matomo.siteId
		}

		let files = templates;
		if (templates)
		{
			const template = gulp.src(`${dirs.src}/${project.name}/${templates.source}`)
								 .pipe(gulp_if(options.verbose, using()));

			files = templates.output
							 .map(token => {
							 	Object.assign(nunjucksData, {
									token: token
								})

							 	return template.pipe(clone())
												.pipe(nunjucks({
													data: nunjucksData,
													path: `${dirs.int}/${project.name}`,
													inheritExtension: true
												}))
												.pipe(rename({
													basename: token,
													extname: ""
												}))
												.pipe(gulp_if(options.verbose, using()))
							});

			files = merge(files);
		}
		else
		{
			files = gulp.src(`${dirs.src}/${project.name}/*.html`)
						.pipe(gulp_if(options.verbose, using()))
						.pipe(nunjucks({
							data: nunjucksData,
							inheritExtension: true
						}));
		}

		return files.pipe(inline_source({
					compress: false,
					pretty: true,
					rootpath: `${dirs.int}/${project.name}`
				}))
				.pipe(gulp_if(options.minify, htmlmin({
					collapseWhitespace: true,
					removeComments: true
				})))
				.pipe(GZipPipe())
				.pipe(rename(path => {
					// If no HTML transforms are defined for this project, don't bother.  
					if (!project.html_transforms)
					{
						return;
					}

					// Have to reconstruct the filename since it's in two here.  
					let filename = `${path.basename}${path.extname}`;
					if (filename in project.html_transforms)
					{
						// If the source filename is in the transforms, then split up 
						// the new value as required & return.  
						let components = project.html_transforms[filename].split("/")
						let baseDir = components.slice(0, -1).join("/");
						let baseFile = components.slice(-1)[0];

						let parts = baseFile.split(".");
						path.dirname = baseDir
						path.basename = parts[0];
						path.extname = parts.length > 1
										? "." + parts.slice(1).join(".")
										: "";
					}
				}))
				.pipe(gulp.dest(`${dirs.dest}/${project.name}/site`));
	});
}

function JS(project)
{
	let plugins = []
	let babelPresets = [
		[ babel_env, { "modules": false} ]
	]

	if (project.extras && project.extras.includes("react"))
	{
		plugins.push(
			new webpack.DefinePlugin({
				"process.env": {
					"NODE_ENV": JSON.stringify(options.environment),
				}
			})
		);

		babelPresets.push(babel_react)
	}

	return gulp.src(`${dirs.src}/${project.name}/js/*.js`)
				.pipe(gulp_if(options.verbose, using()))
				.pipe(webpack_stream({
					mode: options.minify
							? "production"
							: "development",
					devtool: false,
					optimization:
					{
						minimize: options.minify,
						concatenateModules: true,
					},
					output: {
						filename: `${project.js.filename}.js`
					},
					module: {
						rules: [
							{
								test: /\.js$/, 
								loader: "babel-loader",
								options: {
									presets: babelPresets
								},
								exclude: /node_modules/ 
							}
						]
					},
					resolve: {
						modules: [
							"./setup/node_modules"
						]
					},
					plugins: plugins
				}, webpack))
				.pipe(GZipPipe())
				.pipe(gulp.dest(`${dirs.dest}/${project.name}/cdn/js`));
}

function CSS(project)
{
	return CSSPipe(project, options.css.critical_split ? "rest" : "input")
			.pipe(GZipPipe())
			.pipe(rename("main.css"))
			.pipe(gulp.dest(`${dirs.dest}/${project.name}/cdn/css`));
}

gulp.task("clean", gulp.parallel(ProjectTasks("clean", Clean)));
gulp.task("images", gulp.parallel(ProjectTasks("images", Images)));
gulp.task("js", gulp.parallel(ProjectTasks("js", JS)));
gulp.task("html", gulp.parallel(ProjectTasks("html", HTML)));
gulp.task("css", gulp.parallel(ProjectTasks("css", CSS)))

gulp.task("cdn", gulp.parallel("js", "css", "images"));
gulp.task("site", gulp.parallel("html"));

gulp.task("default", gulp.parallel("js", "css", "site"));

gulp.task("full", gulp.series("clean", "images", "default"))
