/* قارئ سطور تيار `scene`: Op واحد في كل سطر JSON. السطر قد يصل مقسومًا على
   عدة قطع، فيُجمَّع حتى سطر جديد. سطر ليس JSON يُتخطّى بتحذير. */

export function createLineReader(onValue: (value: unknown) => void) {
  let pending = "";

  function emit(line: string) {
    if (line.trim() === "") return;
    try {
      onValue(JSON.parse(line));
    } catch {
      console.warn("stage: skipped a scene line that is not JSON", line.slice(0, 120));
    }
  }

  return {
    push(chunk: string) {
      pending += chunk;
      let newline = pending.indexOf("\n");
      while (newline !== -1) {
        const line = pending.slice(0, newline);
        pending = pending.slice(newline + 1);
        emit(line);
        newline = pending.indexOf("\n");
      }
    },
    /** The stream closed: a last line without a newline still counts. */
    end() {
      const line = pending;
      pending = "";
      emit(line);
    },
  };
}
