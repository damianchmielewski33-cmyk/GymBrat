// PreToolUse(Bash): przycina wyjście test/lint/tsc do ostatnich linii, zachowując kod wyjścia.
let raw = "";
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  try {
    const input = JSON.parse(raw);
    const cmd = input.tool_input?.command ?? "";
    const noisy = /^\s*(npm (run )?(test|lint)\b|npx (tsc|vitest|eslint)\b)/.test(cmd);
    if (!noisy || /\|\s*(tail|head|grep)\b/.test(cmd) || cmd.includes("\n")) return;
    const wrapped = `{ ${cmd} ; } 2>&1 | tail -n 60; exit \${PIPESTATUS[0]}`;
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          updatedInput: { ...input.tool_input, command: wrapped },
        },
      }),
    );
  } catch {
    // Brak zmiany polecenia przy błędzie parsowania.
  }
});
