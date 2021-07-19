#!/usr/bin/env node

'use strict'

const cli = require('./commander')
// Q: can we ask the playbook builder for the config schema?
const configSchema = require('@antora/playbook-builder/lib/config/schema')
const convict = require('@antora/playbook-builder/lib/solitary-convict')
const { finalizeLogger } = require('@antora/logger')
const ospath = require('path')

const DOT_RELATIVE_RX = new RegExp(`^\\.{1,2}[/${ospath.sep.replace('/', '').replace('\\', '\\\\')}]`)
const { version: VERSION } = require('../package.json')

async function run (argv = process.argv) {
  const args = argv.slice(2)
  return cli.parseAsync(args.length ? args : ['help'], { from: 'user' })
}

function exitWithError (err, showStack, msg = undefined) {
  if (!msg) msg = err.message || err
  if (showStack) {
    let stack
    if ((stack = err.backtrace)) {
      msg = [`error: ${msg}`, ...stack.slice(1)].join('\n')
    } else if ((stack = err.stack)) {
      msg = stack.startsWith(`${err.name}: ${msg}\n`) ? stack : [msg, ...stack.split('\n').slice(1)].join('\n')
    } else {
      msg = `error: ${msg} (no stack)`
    }
    console.error(msg)
  } else {
    console.error(`error: ${msg}\nAdd the --stacktrace option to see the cause.`)
  }
  process.exit(1)
}

function getTTYColumns () {
  return process.env.COLUMNS || process.stdout.columns || 80
}

function requireLibraries (requirePaths) {
  if (requirePaths) requirePaths.forEach((requirePath) => requireLibrary(requirePath))
}

function requireLibrary (requirePath, cwd = process.cwd()) {
  if (requirePath.charAt() === '.' && DOT_RELATIVE_RX.test(requirePath)) {
    // NOTE require resolves a dot-relative path relative to current file; resolve relative to cwd instead
    requirePath = ospath.resolve(requirePath)
  } else if (!ospath.isAbsolute(requirePath)) {
    // NOTE appending node_modules prevents require from looking elsewhere before looking in these paths
    const paths = [cwd, ospath.dirname(__dirname)].map((start) => ospath.join(start, 'node_modules'))
    requirePath = require.resolve(requirePath, { paths })
  }
  return require(requirePath)
}

cli
  .allowExcessArguments(false)
  .configureOutput({ getOutHelpWidth: getTTYColumns, getErrHelpWidth: getTTYColumns })
  .storeOptionsAsProperties()
  .name('antora')
  .version(VERSION, '-v, --version', 'Output the version number.')
  .description('A modular, multi-repository documentation site generator for AsciiDoc.')
  .usage('[options] [[command] [args]]')
  .helpOption('-h, --help', 'Output usage information.')
  .addHelpText(
    'after',
    function () {
      const name = this.name()
      return this.createHelp().wrap(
        ` \nRun '${name} <command> --help' to see options and examples for a command (e.g., ${name} generate --help).`,
        getTTYColumns(),
        0
      )
    }.bind(cli)
  )
  .option('-r, --require <library>', 'Require library (aka node module) or script before executing command.')
  .on('option:require', (requirePath) => (cli.requirePaths = [...(cli.requirePaths || []), requirePath]))
  .option('--stacktrace', 'Print the stacktrace to the console if the application fails.')

cli
  .command('generate <playbook>', { isDefault: true })
  .description('Generate a documentation site specified in <playbook>.')
  .optionsFromConvict(convict(configSchema), { exclude: 'playbook' })
  .addOption(
    cli
      .createOption('--generator <library>', 'The site generator library.')
      .default('@antora/site-generator-default', '@antora/site-generator-default')
  )
  .action(async (playbookFile, options, command) => {
    try {
      requireLibraries(cli.requirePaths)
    } catch (err) {
      exitWithError(err, cli.stacktrace)
    }
    const generator = options.generator
    let generateSite
    try {
      generateSite = requireLibrary(generator, ospath.resolve(playbookFile, '..'))
    } catch (err) {
      let msg = 'Generator not found or failed to load.'
      if (generator && generator.charAt() !== '.') msg += ` Try installing the '${generator}' package.`
      exitWithError(err, cli.stacktrace, msg)
    }
    const args = cli.rawArgs.slice(cli.rawArgs.indexOf(command.name()) + 1)
    args.splice(args.indexOf(playbookFile), 0, '--playbook')
    // TODO support passing a preloaded convict config as third option; gets new args and env
    return generateSite(args, process.env)
      .then(finalizeLogger)
      .then((failOnExit) => process.exit(failOnExit ? 1 : process.exitCode))
      .catch((err) => finalizeLogger().then(() => exitWithError(err, cli.stacktrace)))
  })
  .options.sort((a, b) => a.long.localeCompare(b.long))

cli.command('help [command]', { hidden: true }).action((name, options, command) => {
  if (name) {
    const helpCommand = cli.commands.find((candidate) => candidate.name() === name)
    if (helpCommand) {
      helpCommand.help()
    } else {
      console.error(
        `'${name}' is not a valid command in ${cli.name()}. See '${cli.name()} --help' for a list of commands.`
      )
      process.exit(1)
    }
  } else {
    cli.help()
  }
})

cli.command('version', { hidden: true }).action(() => cli.emit('option:version'))

module.exports = run
