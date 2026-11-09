import { describe, expect, it } from 'vitest';
import type { SpecDoc } from '@specboard/core';
import { classifyEnd, matchesDeny, suggestRule, type ClassifyInput } from '../src/claude/classify.js';
import type { ClaudeResult, Denial } from '../src/claude/events.js';

const spec = (o: Partial<SpecDoc> & { open?: string[]; done?: boolean[] } = {}): SpecDoc => {
  const { open = [], done = [], ...rest } = o;
  return {
    id: 'T-001', title: 't', status: 'doing', urgency: 'normal', categories: [], dependsOn: [], draft: false, currentSubtask: null,
    created: null, updated: null, specMd: '', featuresMd: '', problems: [],
    questions: open.map((id, i) => ({ id, type: 'text' as const, text: id, options: [], answer: null, line: i })),
    subtasks: done.map((d, i) => ({ n: i + 1, title: `s${i + 1}`, done: d, line: i, hasLog: false })),
    ...rest,
  };
};
const res = (o: Partial<ClaudeResult> = {}): ClaudeResult => ({ isError: false, resultText: 'done', terminalReason: 'completed', apiStatus: null, denials: [], sessionId: 's', ...o });
const bash = (command: string): Denial => ({ tool: 'Bash', input: { command } });
const end = (o: Partial<ClassifyInput>) =>
  classifyEnd({ stopped: false, exitCode: 0, result: res(), stderrTail: '', kind: 'run', before: spec(), after: spec({ status: 'review' }), ...o });

describe('classifyEnd', () => {
  it('stopped wins over everything', () => {
    expect(end({ stopped: true, result: res({ isError: true }) }).status).toBe('stopped');
    expect(end({ stopped: true, result: null, exitCode: 1 }).status).toBe('stopped');
  });

  it('reports not logged in for auth text or a 401', () => {
    const want = { status: 'error', title: "Claude Code isn't logged in", text: 'Run `claude` in a terminal and log in, then run again.' };
    expect(end({ result: res({ isError: true, resultText: 'Please run /login' }) })).toEqual(want);
    expect(end({ result: res({ isError: true, resultText: 'Failed to authenticate' }) })).toEqual(want);
    expect(end({ result: res({ isError: true, resultText: 'nope', apiStatus: 401 }) })).toEqual(want);
    expect(end({ result: null, exitCode: 1, stderrTail: 'Not logged in' })).toEqual(want);
  });

  it('reports other result errors with the result text, whatever the subtype', () => {
    const e = end({ result: res({ isError: true, resultText: 'Reached maximum number of turns (1)', terminalReason: 'max_turns' }) });
    expect(e.status).toBe('error');
    expect(e.text).toBe('Reached maximum number of turns (1)');
    expect(end({ result: res({ isError: true, resultText: 'model gone', apiStatus: 404 }) }).text).toBe('model gone');
  });

  it('reports a missing result with the exit code and last stderr line', () => {
    const e = end({ result: null, exitCode: 3, stderrTail: 'boom\nfirst\n\nlast line\n' });
    expect(e).toEqual({ status: 'error', title: 'Claude Code exited with code 3', text: 'last line' });
    expect(end({ result: null, exitCode: null }).title).toBe('Claude Code exited unexpectedly');
  });

  it('reports a denial as permission with a fix, unless the spec is already in Review', () => {
    const d = bash('npm install date-fns');
    const e = end({ result: res({ denials: [d] }), after: spec() });
    expect(e.status).toBe('permission');
    expect(e.fix).toBe('specboard allow "Bash(npm install:*)"');
    expect(e.denied).toEqual([d]);
    expect(end({ result: res({ denials: [d] }) }).status).toBe('finished');
  });

  it('a run that reaches Review with refusals stays finished, keeps them and says so, with no fix', () => {
    const d = bash('npm install date-fns');
    const one = end({ result: res({ denials: [d] }) });
    expect(one).toEqual({
      status: 'finished',
      denied: [d],
      text: 'Claude was refused 1 action on the way. Check the result before moving this to Done.',
    });
    const two = end({ result: res({ denials: [d, bash('curl x')] }) });
    expect(two.text).toMatch(/refused 2 actions on the way/);
    expect(two.fix).toBeUndefined();
    expect(end({ result: res() })).toEqual({ status: 'finished' });
  });

  it('other ends in Review keep their refusals too', () => {
    const d = bash('npm install date-fns');
    const writeUp = end({ kind: 'write-up', result: res({ denials: [d] }) });
    expect(writeUp.status).toBe('finished');
    expect(writeUp.denied).toEqual([d]);
    const asked = end({ result: res({ denials: [d] }), after: spec({ status: 'review', open: ['Q1'] }) });
    expect(asked.status).toBe('needs');
    expect(asked.denied).toEqual([d]);
    expect(asked.text).toMatch(/1 unanswered question.*refused 1 action/);
  });

  it('omits the fix when the rule is null or matches the deny rules', () => {
    const w = end({ result: res({ denials: [{ tool: 'Write', input: { file_path: 'C:\\x\\.claude\\a.md' } }] }), after: spec() });
    expect(w.status).toBe('permission');
    expect(w.fix).toBeUndefined();
    expect(w.text).toMatch(/blocked by this project's rules/);

    const push = end({ result: res({ denials: [bash('git push origin main')] }), after: spec(), denyRules: ['Bash(git push:*)'] });
    expect(push.fix).toBeUndefined();
    expect(push.text).toMatch(/blocked by this project's rules/);
  });

  it('treats a compound command as denied when any segment matches a deny rule', () => {
    const e = end({ result: res({ denials: [bash('npm install x && git push')] }), after: spec(), denyRules: ['Bash(git push:*)'] });
    expect(e.fix).toBeUndefined();
    const ok = end({ result: res({ denials: [bash('cd x && npm install y')] }), after: spec(), denyRules: ['Bash(git push:*)'] });
    expect(ok.fix).toBe('specboard allow "Bash(npm install:*)"');
  });

  it('lists fixes for several denials, keeping the blocked one out', () => {
    const e = end({
      result: res({ denials: [bash('npm install a'), bash('git push'), bash('npm install b')] }),
      after: spec(),
      denyRules: ['Bash(git push:*)'],
    });
    expect(e.fix).toBe('specboard allow "Bash(npm install:*)"');
    expect(e.text).toMatch(/Bash `git push` stays blocked/);
  });

  it('needs: a new unanswered question, or old ones left outside Review (kind run only)', () => {
    expect(end({ before: spec(), after: spec({ status: 'review', open: ['Q1'] }) }).status).toBe('needs');
    expect(end({ before: spec({ open: ['Q1'] }), after: spec({ open: ['Q1'] }) }).status).toBe('needs');
    expect(end({ before: spec({ open: ['Q1'] }), after: spec({ status: 'review', open: ['Q1'] }) }).status).toBe('finished');
    expect(end({ before: null, after: spec({ open: ['Q1', 'Q2'] }) }).text).toMatch(/2 unanswered/);
  });

  it('finishes a run in Review, and errors when it stopped short, naming subtasks left', () => {
    expect(end({}).status).toBe('finished');
    const e = end({ after: spec({ done: [true, false, false] }) });
    expect(e).toMatchObject({ status: 'error', title: 'Claude stopped before finishing' });
    expect(e.text).toContain('2, 3');
    expect(end({ after: null }).status).toBe('error');
  });

  it('finishes other kinds with no error or denial, even with new questions (R1)', () => {
    for (const kind of ['write-up', 'fix-file', 'refresh-overview'] as const) {
      expect(end({ kind, before: null, after: spec({ open: ['Q1'] }) }).status).toBe('finished');
      expect(end({ kind, after: null }).status).toBe('finished');
    }
    expect(end({ kind: 'write-up', result: res({ denials: [bash('npm i x')] }), after: spec() }).status).toBe('permission');
    expect(end({ kind: 'write-up', result: res({ isError: true }) }).status).toBe('error');
  });
});

describe('suggestRule', () => {
  it.each([
    ['npm install date-fns', 'Bash(npm install:*)'],
    ['ls', 'Bash(ls:*)'],
    ['git status', 'Bash(git status:*)'],
    ['git -C sub status', 'Bash(git:*)'],
    ['git ./x', 'Bash(git:*)'],
    ['FOO=1 npm test', 'Bash(npm test:*)'],
    ['cd x && npm install y', 'Bash(npm install:*)'],
    ['cd x; cd y && go test ./...', 'Bash(go test:*)'],
    ['ls 2>&1', 'Bash(ls:*)'],
    ['echo "a && b"', 'Bash(echo:*)'],
    ['npm test\nnpm run build', 'Bash(npm test:*)'],
  ])('%j -> %s', (command, rule) => {
    expect(suggestRule(bash(command))).toBe(rule);
  });

  it('never produces a wildcard, bare, newline or shell-running rule', () => {
    for (const c of ['*', '', '   ', '&&', 'bash -c "rm -rf /"', 'sh x.sh', 'sudo rm x', 'eval foo', './run.sh', '/usr/bin/x', 'echo $(whoami)', 'echo `x`', 'echo "unclosed', 'cmd /c dir']) {
      expect(suggestRule(bash(c)), c).toBeNull();
    }
    for (const c of ['a\nb', 'ls\n', 'x *', 'git push\n--force']) {
      const r = suggestRule(bash(c));
      expect(r === null || (!r.includes('\n') && r !== 'Bash(*)' && r !== 'Bash')).toBe(true);
    }
    expect(suggestRule({ tool: 'Bash', input: {} })).toBeNull();
    expect(suggestRule({ tool: 'Bash', input: null })).toBeNull();
  });

  it('never offers deleters, PowerShell code runners, or prefixes that run or configure arbitrary things', () => {
    for (const c of ['rm foo', 'rm -rf dist', 'rm. x', 'RM.exe x', 'git config core.hooksPath x', 'npm exec foo', 'pnpm dlx foo', 'npx vitest run', 'yarn dlx x', 'bash. -c x']) {
      expect(suggestRule(bash(c)), c).toBeNull();
    }
    for (const c of ['iex $x', 'Invoke-Expression $x', 'Invoke-Command -x', 'icm x', 'Start-Process a', 'saps a', 'start a', 'call a', 'Remove-Item a', 'ri a', 'del a', 'erase a', 'rd a', 'rmdir a', 'REMOVE-ITEM a']) {
      expect(suggestRule({ tool: 'PowerShell', input: { command: c } }), c).toBeNull();
    }
    expect(suggestRule(bash('git status'))).toBe('Bash(git status:*)');
    expect(suggestRule(bash('npm install x'))).toBe('Bash(npm install:*)');
  });

  it('never offers an interpreter rule (a person may still type one with specboard allow)', () => {
    for (const c of ['node script.js', 'python -m pytest', 'python3 x.py', 'python3.12 x.py', 'ruby a.rb', 'perl a.pl', 'php a.php', 'deno run a.ts', 'bun test', 'node.exe a.js', 'cd x && node a.js']) {
      expect(suggestRule(bash(c)), c).toBeNull();
    }
    expect(suggestRule({ tool: 'PowerShell', input: { command: 'node a.js' } })).toBeNull();
  });

  it('forms a PowerShell rule the same way', () => {
    expect(suggestRule({ tool: 'PowerShell', input: { command: 'git commit --allow-empty -m x' } })).toBe('PowerShell(git commit:*)');
    expect(suggestRule({ tool: 'PowerShell', input: { command: 'Set-Content a.txt hi' } })).toBe('PowerShell(Set-Content:*)');
  });

  it('gives the tool name for other tools and null for file tools', () => {
    expect(suggestRule({ tool: 'WebFetch', input: { url: 'https://x' } })).toBe('WebFetch');
    expect(suggestRule({ tool: 'Write', input: { file_path: 'a' } })).toBeNull();
    expect(suggestRule({ tool: 'Edit', input: { file_path: 'a' } })).toBeNull();
    expect(suggestRule({ tool: 'Write"; rm', input: {} })).toBeNull();
  });
});

describe('matchesDeny', () => {
  it('matches when one rule covers the other, same tool only', () => {
    expect(matchesDeny('Bash(git push:*)', ['Bash(git push:*)'])).toBe(true);
    expect(matchesDeny('Bash(git push:*)', ['Bash(git push origin main)'])).toBe(true);
    expect(matchesDeny('Bash(git:*)', ['Bash(git push:*)'])).toBe(true);
    expect(matchesDeny('Bash(git push:*)', ['Bash(git:*)'])).toBe(true);
    expect(matchesDeny('Bash(git push:*)', ['Bash(git push *)'])).toBe(true);
    expect(matchesDeny('Bash(git status:*)', ['Bash'])).toBe(true);
    expect(matchesDeny('WebFetch', ['WebFetch(domain:x.com)'])).toBe(true);
  });

  it('does not match unrelated rules, other tools, or look-alike prefixes', () => {
    expect(matchesDeny('Bash(git status:*)', ['Bash(git push:*)'])).toBe(false);
    expect(matchesDeny('Bash(git pushd:*)', ['Bash(git push:*)'])).toBe(false);
    expect(matchesDeny('Bash(ls:*)', [])).toBe(false);
  });
});

describe('deny matching hardening', () => {
  const push = ['Bash(git push:*)'];

  it.each(['git.exe push', 'GIT push', 'Git Push', 'git.cmd push', 'GIT.EXE push origin'])('%s is caught by a git push deny', (command) => {
    const rule = suggestRule(bash(command))!;
    expect(rule).toMatch(/^Bash\(.+ [Pp][Uu][Ss][Hh]:\*\)$/);
    expect(matchesDeny(rule, push)).toBe(true);
    expect(end({ result: res({ denials: [bash(command)] }), after: spec(), denyRules: push }).fix).toBeUndefined();
  });

  it('normalises the program name on the deny side too', () => {
    expect(matchesDeny('Bash(git push:*)', ['Bash(GIT.exe push:*)'])).toBe(true);
    expect(matchesDeny('Bash(git status:*)', ['Bash(GIT.exe push:*)'])).toBe(false);
  });

  it.each(['command git push', 'timeout 5 git push', 'nohup git push', 'time git push', 'nice git push', 'wsl git push', 'busybox sh', 'builtin cd', 'env git push', 'xargs rm', 'exec x', 'pwsh -c x', 'zsh x', 'cmd /c x'])('wrapper %s gets no rule', (command) => {
    expect(suggestRule(bash(command))).toBeNull();
    const e = end({ result: res({ denials: [bash(command)] }), after: spec() });
    expect(e.status).toBe('permission');
    expect(e.fix).toBeUndefined();
  });

  it('treats a mid-pattern wildcard deny as overlapping every rule for that program', () => {
    expect(matchesDeny('Bash(git status:*)', ['Bash(git * --force)'])).toBe(true);
    expect(matchesDeny('Bash(git push:*)', ['Bash(git * --force)'])).toBe(true);
    expect(matchesDeny('Bash(ls:*)', ['Bash(git * --force)'])).toBe(false);
  });

  it('treats a leading wildcard deny as overlapping every rule for the tool', () => {
    expect(matchesDeny('Bash(npm install:*)', ['Bash(* push)'])).toBe(true);
    expect(matchesDeny('PowerShell(ls:*)', ['Bash(* push)'])).toBe(true);
    expect(matchesDeny('WebFetch', ['Bash(* push)'])).toBe(false);
  });

  it('checks Bash and PowerShell rules against each other\'s denies', () => {
    expect(matchesDeny('PowerShell(git push:*)', ['Bash(git push:*)'])).toBe(true);
    expect(matchesDeny('Bash(git:*)', ['PowerShell(git push:*)'])).toBe(true);
    expect(matchesDeny('PowerShell(git status:*)', ['Bash(git push:*)'])).toBe(false);
    const e = end({ result: res({ denials: [{ tool: 'PowerShell', input: { command: 'git push origin' } }] }), after: spec(), denyRules: push });
    expect(e.fix).toBeUndefined();
  });
});

describe('a stop that is not the end the skill would pick', () => {
  it('I2: keeps what Claude said, clipped, when it stopped short', () => {
    const said = 'T-002 is not done yet, so I did not start this spec.';
    const e = end({ result: res({ resultText: said }), after: spec({ done: [false, false] }) });
    expect(e.title).toBe('Claude stopped before finishing');
    expect(e.text).toBe(`Subtasks left: 1, 2. Claude said: ${said}`);
    const long = end({ result: res({ resultText: `line one\n\n${'x'.repeat(2000)}` }), after: spec({ done: [false] }) });
    expect(long.text!.length).toBeLessThan(560);
    expect(long.text).toMatch(/Claude said: line one x+…$/);
    expect(end({ result: res({ resultText: '  ' }), after: spec({ done: [false] }) }).text).toBe('Subtasks left: 1.');
    expect(end({ after: null, result: res({ resultText: 'why' }) }).text).toBe('The spec could not be read after the run. Claude said: why');
    expect(end({ result: res({ resultText: 'why' }), after: spec({ done: [true] }) }).text).toBe('No subtasks are left, but the spec is not in Review. Claude said: why');
  });

  it.each([
    ['new question, refusal, not in Review', spec(), spec({ open: ['Q3'] }), [bash('ls')], 'needs'],
    ['new question, refusal, in Review', spec(), spec({ status: 'review', open: ['Q3'] }), [bash('ls')], 'needs'],
    ['a question that was already open, refusal', spec({ open: ['Q1'] }), spec({ open: ['Q1'] }), [bash('ls')], 'permission'],
    ['no question, refusal', spec(), spec(), [bash('ls')], 'permission'],
    ['an old question answered, a new one added, refusal', spec({ open: ['Q1'] }), spec({ open: ['Q2'] }), [bash('ls')], 'needs'],
    ['new question, no refusal', spec(), spec({ open: ['Q3'] }), [], 'needs'],
  ] as const)('I3: %s', (_name, before, after, denials, status) => {
    const e = end({ before, after, result: res({ denials: [...denials] }) });
    expect(e.status).toBe(status);
    if (status === 'needs') {
      expect(e.fix).toBeUndefined();
      if (denials.length > 0) expect(e.text).toMatch(/refused 1 action/);
    }
  });

  it('I3: keeps ruling R1, so other kinds still end permission with a new question', () => {
    const e = end({ kind: 'write-up', before: spec(), after: spec({ open: ['Q3'] }), result: res({ denials: [bash('ls')] }) });
    expect(e.status).toBe('permission');
  });
});

describe('the rules never offered', () => {
  it.each([
    'find . -name x', 'awk 1 a', 'gawk 1 a', 'sed -n 1p a', 'make all', 'xargs ls',
    'git config core.pager x', 'git rebase -i x', 'git bisect run x', 'git filter-branch x', 'git submodule foreach x',
    'go run x', 'cargo run', 'uv run x', 'poetry run x', 'dotnet run', 'docker run x', 'docker exec x y', 'kubectl exec x',
  ])('%s', (command) => {
    expect(suggestRule(bash(command))).toBeNull();
    expect(end({ result: res({ denials: [bash(command)] }), after: spec() }).fix).toBeUndefined();
  });

  it('still offers an ordinary command', () => {
    expect(suggestRule(bash('git status'))).toBe('Bash(git status:*)');
    expect(suggestRule(bash('ls -la'))).toBe('Bash(ls:*)');
  });
});

describe('denials on the wire', () => {
  it('carry only what is shown, clipped, though the rule comes from the whole command', () => {
    const write: Denial = { tool: 'Write', input: { file_path: 'C:\\a\\b.txt', content: 'secret '.repeat(10000) } };
    const longCmd: Denial = { tool: 'Bash', input: { command: `npm install ${'x'.repeat(5000)}`, description: 'd' } };
    const e = end({ result: res({ denials: [write, longCmd] }), after: spec() });
    expect(e.denied![0]).toEqual({ tool: 'Write', input: { file_path: 'C:\\a\\b.txt' } });
    const cmd = (e.denied![1]!.input as { command: string }).command;
    expect(cmd.length).toBeLessThanOrEqual(500);
    expect(cmd.startsWith('npm install x')).toBe(true);
    expect(e.denied![1]!.input).not.toHaveProperty('description');
    expect(e.fix).toBe('specboard allow "Bash(npm install:*)"');
    expect(JSON.stringify(e)).not.toContain('secret');
    const finished = end({ result: res({ denials: [write] }) });
    expect(JSON.stringify(finished)).not.toContain('secret');
  });
});
