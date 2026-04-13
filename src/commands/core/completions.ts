/**
 * Completions command - Generate shell completion scripts
 */

import chalk from 'chalk'
import type { Command } from 'commander'

function generateBashCompletions(commands: string[]): string {
  return `# Specter bash completions
# Add to ~/.bashrc: eval "$(specter completions bash)"
_specter_completions() {
  local cur="\${COMP_WORDS[COMP_CWORD]}"
  local commands="${commands.join(' ')}"
  COMPREPLY=( $(compgen -W "$commands" -- "$cur") )
  return 0
}
complete -F _specter_completions specter
`
}

function generateZshCompletions(commandDescs: Array<{ name: string; desc: string }>): string {
  const items = commandDescs.map((c) => `'${c.name}:${c.desc.replace(/'/g, '')}'`).join('\n    ')
  return `#compdef specter
# Specter zsh completions
# Add to ~/.zshrc: eval "$(specter completions zsh)"
_specter() {
  local -a commands
  commands=(
    ${items}
  )
  _describe 'command' commands
}
compdef _specter specter
`
}

function generateFishCompletions(commandDescs: Array<{ name: string; desc: string }>): string {
  const lines = commandDescs.map(
    (c) =>
      `complete -c specter -n __fish_use_subcommand -a '${c.name}' -d '${c.desc.replace(/'/g, '')}'`
  )
  return `# Specter fish completions
# Save to ~/.config/fish/completions/specter.fish
${lines.join('\n')}
`
}

export function register(program: Command): void {
  program
    .command('completions <shell>')
    .description('Generate shell completion scripts (bash, zsh, fish)')
    .addHelpText(
      'after',
      `
Examples:
  $ specter completions bash >> ~/.bashrc
  $ specter completions zsh >> ~/.zshrc
  $ specter completions fish > ~/.config/fish/completions/specter.fish
  $ eval "$(specter completions zsh)"`
    )
    .action((shell: string) => {
      // Gather all command names and descriptions from the parent program
      const root = program.parent || program
      const commandDescs = root.commands
        .filter((cmd: Command) => cmd.name() !== 'completions')
        .map((cmd: Command) => ({
          name: cmd.name(),
          desc: cmd.description() || '',
        }))
      const commandNames = commandDescs.map((c: { name: string }) => c.name)

      // Add global flags
      commandNames.push('--help', '--version', '--json', '--accessible', '--quiet', '--no-emoji')

      switch (shell.toLowerCase()) {
        case 'bash':
          process.stdout.write(generateBashCompletions(commandNames))
          process.stderr.write(
            chalk.dim('# Add to ~/.bashrc or eval "$(specter completions bash)"\n')
          )
          break
        case 'zsh':
          process.stdout.write(generateZshCompletions(commandDescs))
          process.stderr.write(
            chalk.dim('# Add to ~/.zshrc or eval "$(specter completions zsh)"\n')
          )
          break
        case 'fish':
          process.stdout.write(generateFishCompletions(commandDescs))
          process.stderr.write(chalk.dim('# Save to ~/.config/fish/completions/specter.fish\n'))
          break
        default:
          console.error(chalk.red(`Unknown shell: ${shell}. Supported: bash, zsh, fish`))
          process.exit(1)
      }
    })
}
